import { GROWTH_STATS, type GrowthSource, type StatKey } from '../types/growth.ts'
import type { ClassDataset, ClassInfo, ClassSkill, ClassTier } from '../types/classes.ts'

export const CLASS_TIERS: readonly ClassTier[] = ['Base', 'Beginner', 'Specialty', 'Advanced', 'Master', 'Divine']

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${path} must be a non-empty trimmed string`)
  }
  return value
}

function nullableString(value: unknown, path: string): string | null {
  return value === null ? null : string(value, path)
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`)
  return value
}

function httpsUrl(value: unknown, path: string): string | null {
  const text = nullableString(value, path)
  if (text === null) return null
  const url = new URL(text)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new TypeError(`${path} must be an HTTPS URL without credentials`)
  }
  return text
}

function stats(value: unknown, path: string): Record<StatKey, number | null> {
  const raw = record(value, path)
  if (Object.keys(raw).length !== GROWTH_STATS.length) {
    throw new TypeError(`${path} must contain exactly nine stats`)
  }
  const result = {} as Record<StatKey, number | null>
  for (const { key } of GROWTH_STATS) {
    const value = raw[key]
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new TypeError(`${path}.${key} must be null or a finite number`)
    }
    result[key] = value
  }
  return result
}

function skills(value: unknown, path: string): ClassSkill[] | null {
  if (value === null) return null
  const names = new Set<string>()
  return array(value, path).map((entry, index) => {
    const skillPath = `${path}[${index}]`
    const raw = record(entry, skillPath)
    const name = string(raw.name, `${skillPath}.name`)
    if (names.has(name)) throw new TypeError(`${path} contains a duplicate skill: ${name}`)
    names.add(name)
    return { name, effect: nullableString(raw.effect, `${skillPath}.effect`) }
  })
}

/** Missing values must be explicit nulls; zero and negative bonuses are valid. */
export function validateClassDataset(input: unknown): ClassDataset {
  const dataset = record(input, 'dataset')
  const sourceIds = new Set<string>()
  const sources = array(dataset.sources, 'sources').map((entry, index): GrowthSource => {
    const path = `sources[${index}]`
    const raw = record(entry, path)
    const id = string(raw.id, `${path}.id`)
    if (sourceIds.has(id)) throw new TypeError(`${path} contains a duplicate id: ${id}`)
    sourceIds.add(id)
    return {
      id,
      name: string(raw.name, `${path}.name`),
      url: httpsUrl(raw.url, `${path}.url`),
      retrievedAt: nullableString(raw.retrievedAt, `${path}.retrievedAt`),
      sourceVersion: nullableString(raw.sourceVersion, `${path}.sourceVersion`),
      gameVersion: nullableString(raw.gameVersion, `${path}.gameVersion`),
      note: string(raw.note, `${path}.note`),
    }
  })
  if (sources.length === 0) throw new TypeError('sources must contain at least one source')
  const ids = new Set<string>()
  const classes = array(dataset.classes, 'classes').map((entry, index): ClassInfo => {
    const path = `classes[${index}]`
    const raw = record(entry, path)
    const id = string(raw.id, `${path}.id`)
    if (ids.has(id)) throw new TypeError(`${path} contains a duplicate id: ${id}`)
    ids.add(id)
    const name = string(raw.name, `${path}.name`)
    if (name !== id) throw new TypeError(`${path}.name must preserve the upstream class id`)
    const tier = string(raw.tier, `${path}.tier`)
    if (!CLASS_TIERS.includes(tier as ClassTier)) throw new TypeError(`${path}.tier is unknown: ${tier}`)
    if (raw.status !== 'unverified') throw new TypeError(`${path}.status must be unverified`)
    const movement = raw.movement
    if (movement !== null && (typeof movement !== 'number' || !Number.isInteger(movement) || movement < 0)) {
      throw new TypeError(`${path}.movement must be null or a non-negative integer`)
    }
    const weapons = raw.weapons === null ? null : array(raw.weapons, `${path}.weapons`)
      .map((weapon, index) => string(weapon, `${path}.weapons[${index}]`))
    if (weapons && new Set(weapons).size !== weapons.length) throw new TypeError(`${path}.weapons contains duplicates`)
    return {
      id, name, tier: tier as ClassTier, status: 'unverified',
      unitType: nullableString(raw.unitType, `${path}.unitType`), movement, weapons,
      bonuses: stats(raw.bonuses, `${path}.bonuses`), growths: stats(raw.growths, `${path}.growths`),
      abilities: skills(raw.abilities, `${path}.abilities`),
      masterSkills: skills(raw.masterSkills, `${path}.masterSkills`),
      sourcePageUrl: httpsUrl(raw.sourcePageUrl, `${path}.sourcePageUrl`),
    }
  })
  if (classes.length === 0) throw new TypeError('classes must contain at least one class')
  return { sources, classes }
}
