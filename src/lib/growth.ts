import {
  GROWTH_STATS,
  type CharacterGrowth,
  type GrowthDataset,
  type GrowthSort,
  type GrowthSource,
  type StatKey,
} from '../types/growth.ts'

const nameCollator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' })

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new TypeError(`${path} must be ${allowEmpty ? 'a string' : 'a non-empty string'}`)
  }
  return value
}

function requireNullableString(value: unknown, path: string): string | null {
  return value === null ? null : requireString(value, path)
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array`)
  }
  return value
}

function addUniqueId(ids: Set<string>, id: string, path: string): void {
  if (ids.has(id)) {
    throw new TypeError(`${path} contains a duplicate id: ${id}`)
  }
  ids.add(id)
}

/** Validate imported data without treating missing or unconfirmed values as zero. */
export function validateGrowthDataset(input: unknown): GrowthDataset {
  const dataset = requireRecord(input, 'dataset')
  const sourceIds = new Set<string>()
  const characterIds = new Set<string>()

  const sources = requireArray(dataset.sources, 'sources').map((value, index): GrowthSource => {
    const path = `sources[${index}]`
    const source = requireRecord(value, path)
    const id = requireString(source.id, `${path}.id`)
    addUniqueId(sourceIds, id, path)

    return {
      id,
      name: requireString(source.name, `${path}.name`),
      url: requireNullableString(source.url, `${path}.url`),
      retrievedAt: requireNullableString(source.retrievedAt, `${path}.retrievedAt`),
      sourceVersion: requireNullableString(source.sourceVersion, `${path}.sourceVersion`),
      gameVersion: requireNullableString(source.gameVersion, `${path}.gameVersion`),
      note: requireString(source.note, `${path}.note`, true),
    }
  })

  const characters = requireArray(dataset.characters, 'characters').map((value, index): CharacterGrowth => {
    const path = `characters[${index}]`
    const character = requireRecord(value, path)
    const id = requireString(character.id, `${path}.id`)
    addUniqueId(characterIds, id, path)
    const sourceId = requireString(character.sourceId, `${path}.sourceId`)
    if (!sourceIds.has(sourceId)) {
      throw new TypeError(`${path}.sourceId references an unknown source: ${sourceId}`)
    }
    const status = character.status
    if (status !== 'sample' && status !== 'unverified' && status !== 'verified') {
      throw new TypeError(`${path}.status must be sample, unverified, or verified`)
    }

    const rawRates = requireRecord(character.rates, `${path}.rates`)
    const rates = {} as Record<StatKey, number | null>
    for (const { key } of GROWTH_STATS) {
      const rate = rawRates[key]
      if (rate !== null && (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0)) {
        throw new TypeError(`${path}.rates.${key} must be null or a finite non-negative number`)
      }
      rates[key] = rate
    }

    return {
      id,
      name: requireString(character.name, `${path}.name`),
      sourceId,
      status,
      rates,
    }
  })

  return { sources, characters }
}

/** Match width, case, and common hiragana/katakana variants consistently. */
export function normalizeGrowthSearch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/[\u30a1-\u30f6]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .trim()
}

function compareIds(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0
}

export function getGrowthCharacterName(character: CharacterGrowth, displayNames?: ReadonlyMap<string, string>): string {
  return displayNames?.get(character.id) ?? character.name
}

function compareNames(first: CharacterGrowth, second: CharacterGrowth, displayNames?: ReadonlyMap<string, string>): number {
  return nameCollator.compare(getGrowthCharacterName(first, displayNames), getGrowthCharacterName(second, displayNames))
    || compareIds(first.id, second.id)
}

/** Unknown values stay last in either direction; equal rates use name and id. */
export function filterAndSortGrowthCharacters(
  characters: readonly CharacterGrowth[],
  query = '',
  sort: GrowthSort = { key: 'name', direction: 'asc' },
  displayNames?: ReadonlyMap<string, string>,
  searchTexts?: ReadonlyMap<string, string>,
): CharacterGrowth[] {
  const normalizedQuery = normalizeGrowthSearch(query)
  const direction = sort.direction === 'asc' ? 1 : -1
  return characters
    .filter((character) => normalizeGrowthSearch(character.name).includes(normalizedQuery)
      || normalizeGrowthSearch(getGrowthCharacterName(character, displayNames)).includes(normalizedQuery)
      || normalizeGrowthSearch(searchTexts?.get(character.id) ?? '').includes(normalizedQuery))
    .sort((first, second) => {
      if (sort.key === 'name') {
        return direction * nameCollator.compare(getGrowthCharacterName(first, displayNames), getGrowthCharacterName(second, displayNames))
          || compareIds(first.id, second.id)
      }

      const firstRate = first.rates[sort.key]
      const secondRate = second.rates[sort.key]
      if (firstRate === null && secondRate === null) return compareNames(first, second, displayNames)
      if (firstRate === null) return 1
      if (secondRate === null) return -1
      return direction * (firstRate - secondRate) || compareNames(first, second, displayNames)
    })
}
