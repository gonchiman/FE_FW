import { validateGrowthDataset } from './growth.ts'
import type { CharacterSkill, CharacterSkillDataset } from '../types/character-skills.ts'

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} must be an object`)
  return value as Record<string, unknown>
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${path} must be a non-empty string`)
  return value
}

function nullableText(value: unknown, path: string): string | null {
  return value === null ? null : text(value, path)
}

/** Reject ambiguous joins and replacement chains before they reach display or analysis. */
export function validateCharacterSkillDataset(input: unknown, roster: readonly { id: string }[]): CharacterSkillDataset {
  const raw = record(input, 'dataset')
  const sources = validateGrowthDataset({ sources: raw.sources, characters: [] }).sources
  const sourceIds = new Set(sources.map(source => source.id))
  const characterIds = new Set(roster.map(character => character.id))
  if (characterIds.size !== roster.length) throw new TypeError('roster contains a duplicate id')
  if (!Array.isArray(raw.skills)) throw new TypeError('skills must be an array')
  const skillIds = new Set<string>()
  const personalCharacters = new Set<string>()
  const skills = raw.skills.map((value, index): CharacterSkill => {
    const path = `skills[${index}]`
    const skill = record(value, path)
    const id = text(skill.id, `${path}.id`)
    if (skillIds.has(id)) throw new TypeError(`${path} contains a duplicate id: ${id}`)
    skillIds.add(id)
    const characterId = text(skill.characterId, `${path}.characterId`)
    if (!characterIds.has(characterId)) throw new TypeError(`${path} references an unknown character: ${characterId}`)
    const kind = skill.kind
    if (kind !== 'personal' && kind !== 'unique') throw new TypeError(`${path}.kind must be personal or unique`)
    if (kind === 'personal') {
      if (personalCharacters.has(characterId)) throw new TypeError(`${path} contains a duplicate personal skill`)
      personalCharacters.add(characterId)
    }
    const level = skill.level
    if (level !== null && (typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1)) {
      throw new TypeError(`${path}.level must be null or a positive integer`)
    }
    const status = skill.status
    if (status !== 'unverified' && status !== 'verified') throw new TypeError(`${path}.status must be unverified or verified`)
    if (!Array.isArray(skill.sourceIds) || skill.sourceIds.length === 0) throw new TypeError(`${path}.sourceIds must be non-empty`)
    const references = skill.sourceIds.map((value, refIndex) => text(value, `${path}.sourceIds[${refIndex}]`))
    if (new Set(references).size !== references.length) throw new TypeError(`${path} contains a duplicate source reference`)
    for (const sourceId of references) {
      if (!sourceIds.has(sourceId)) throw new TypeError(`${path} references an unknown source: ${sourceId}`)
    }
    return {
      id, characterId, kind,
      name: text(skill.name, `${path}.name`),
      englishName: nullableText(skill.englishName, `${path}.englishName`),
      description: nullableText(skill.description, `${path}.description`),
      level,
      acquisition: nullableText(skill.acquisition, `${path}.acquisition`),
      upgradesSkillId: nullableText(skill.upgradesSkillId, `${path}.upgradesSkillId`),
      sourceIds: references, status,
    }
  })
  const byId = new Map(skills.map(skill => [skill.id, skill]))
  for (const skill of skills) {
    const previous = skill.upgradesSkillId === null ? null : byId.get(skill.upgradesSkillId)
    if (previous === undefined) throw new TypeError(`${skill.id} references an unknown upgraded skill`)
    if (previous && (previous.characterId !== skill.characterId || previous.kind !== skill.kind)) {
      throw new TypeError(`${skill.id} upgrade must belong to the same character and kind`)
    }
    if (previous && skill.level !== null && previous.level !== null && skill.level <= previous.level) {
      throw new TypeError(`${skill.id} upgrade level must be greater than its predecessor`)
    }
    const chain = new Set<string>([skill.id])
    let current: CharacterSkill | null | undefined = previous
    while (current) {
      if (chain.has(current.id)) throw new TypeError(`${skill.id} contains an upgrade cycle`)
      chain.add(current.id)
      current = current.upgradesSkillId === null ? null : byId.get(current.upgradesSkillId)
    }
  }
  return { sources, skills }
}

/** Preserve source records; unknown acquisition levels sort after known ones. */
export function groupCharacterSkills(skills: readonly CharacterSkill[]): ReadonlyMap<string, readonly CharacterSkill[]> {
  const grouped = new Map<string, CharacterSkill[]>()
  for (const skill of skills) {
    const list = grouped.get(skill.characterId) ?? []
    list.push(skill)
    grouped.set(skill.characterId, list)
  }
  for (const list of grouped.values()) {
    list.sort((first, second) => {
      if (first.kind !== second.kind) return first.kind === 'personal' ? -1 : 1
      return (first.level ?? Infinity) - (second.level ?? Infinity)
        || first.name.localeCompare(second.name, 'ja') || first.id.localeCompare(second.id)
    })
  }
  return grouped
}

/** Index every version, including entries not shown in a compact table cell. */
export function buildCharacterSkillSearchTexts(skills: readonly CharacterSkill[]): ReadonlyMap<string, string> {
  return new Map([...groupCharacterSkills(skills)].map(([characterId, entries]) => [characterId,
    entries.map(skill => [skill.name, skill.englishName, skill.description, skill.acquisition].filter(Boolean).join(' ')).join('\n'),
  ]))
}
