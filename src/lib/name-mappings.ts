import { normalizeGrowthSearch } from './growth.ts'
import type {
  NameEntry,
  NameDataset,
  NameSort,
  NameSource,
  NameStatusFilter,
} from '../types/name-mappings.ts'

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
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`)
  return value
}

function requireDate(value: unknown, path: string): string {
  const date = requireString(value, path)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError(`${path} must be a valid YYYY-MM-DD date`)
  }
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new TypeError(`${path} must be a valid YYYY-MM-DD date`)
  }
  return date
}

function requireSafeUrl(value: unknown, path: string): string {
  const url = requireString(value, path)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new TypeError(`${path} must be an HTTPS URL without credentials`)
  }
  if (!/^https:\/\//.test(url) || /[\s\u0000-\u001f\u007f\\]/.test(url)
    || parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
    throw new TypeError(`${path} must be an HTTPS URL without credentials`)
  }
  return url
}

function addUniqueId(ids: Set<string>, id: string, path: string): void {
  if (ids.has(id)) throw new TypeError(`${path} contains a duplicate id: ${id}`)
  ids.add(id)
}

/** Join verified names to a complete roster, retaining every unmapped entry. */
export function validateAndMergeNames(
  input: unknown,
  roster: readonly { id: string; name: string }[],
  mappingIdKey: 'characterId' | 'classId',
): NameDataset {
  const dataset = requireRecord(input, 'dataset')
  const rosterIds = new Set<string>()
  const entries = roster.map((entry, index) => {
    const path = `roster[${index}]`
    const entity = requireRecord(entry, path)
    const id = requireString(entity.id, `${path}.id`)
    addUniqueId(rosterIds, id, path)
    return { id, englishName: requireString(entity.name, `${path}.name`) }
  })

  const sourceIds = new Set<string>()
  const sources = requireArray(dataset.sources, 'sources').map((entry, index): NameSource => {
    const path = `sources[${index}]`
    const source = requireRecord(entry, path)
    const id = requireString(source.id, `${path}.id`)
    addUniqueId(sourceIds, id, path)
    const language = source.language
    if (language !== 'ja' && language !== 'en' && language !== 'ja-en') {
      throw new TypeError(`${path}.language must be ja, en, or ja-en`)
    }
    return {
      id,
      language,
      name: requireString(source.name, `${path}.name`),
      url: requireSafeUrl(source.url, `${path}.url`),
      retrievedAt: requireDate(source.retrievedAt, `${path}.retrievedAt`),
      sourceVersion: requireNullableString(source.sourceVersion, `${path}.sourceVersion`),
      gameVersion: requireNullableString(source.gameVersion, `${path}.gameVersion`),
    }
  })
  const sourcesById = new Map(sources.map((source) => [source.id, source]))
  const mappedIds = new Set<string>()
  const mappings = requireArray(dataset.mappings, 'mappings').map((entry, index): Omit<NameEntry, 'englishName'> => {
    const path = `mappings[${index}]`
    const mapping = requireRecord(entry, path)
    const id = requireString(mapping[mappingIdKey], `${path}.${mappingIdKey}`)
    addUniqueId(mappedIds, id, path)
    if (!rosterIds.has(id)) {
      const entity = mappingIdKey === 'classId' ? 'class' : 'character'
      throw new TypeError(`${path}.${mappingIdKey} references an unknown ${entity}: ${id}`)
    }
    const status = mapping.status
    if (status !== 'verified' && status !== 'unverified') {
      throw new TypeError(`${path}.status must be verified or unverified`)
    }
    const japaneseName = requireNullableString(mapping.japaneseName, `${path}.japaneseName`)
    const checkedAt = mapping.checkedAt === null ? null : requireDate(mapping.checkedAt, `${path}.checkedAt`)
    const note = requireString(mapping.note, `${path}.note`, true)
    const uniqueReferences = new Set<string>()
    const references = requireArray(mapping.sourceIds, `${path}.sourceIds`).map((value, referenceIndex) => {
      const sourceId = requireString(value, `${path}.sourceIds[${referenceIndex}]`)
      addUniqueId(uniqueReferences, sourceId, `${path}.sourceIds`)
      if (!sourcesById.has(sourceId)) {
        throw new TypeError(`${path}.sourceIds references an unknown source: ${sourceId}`)
      }
      return sourceId
    })
    if (status === 'verified') {
      const languages = new Set(references.map((sourceId) => sourcesById.get(sourceId)!.language))
      const coversBothLanguages = languages.has('ja-en') || (languages.has('ja') && languages.has('en'))
      if (japaneseName === null || checkedAt === null || !coversBothLanguages) {
        throw new TypeError(`${path}: verified names require a Japanese name, a checked date, and ja/en or ja-en sources`)
      }
      if (note.trim().length === 0) throw new TypeError(`${path}: verified names require a non-empty evidence note`)
    } else if (japaneseName !== null || checkedAt !== null) {
      throw new TypeError(`${path}: unverified names must have null japaneseName and checkedAt`)
    }
    return {
      id, japaneseName, status, sourceIds: references, checkedAt,
      note,
    }
  })
  const mappingsById = new Map(mappings.map((mapping) => [mapping.id, mapping]))

  return {
    sources,
    entries: entries.map(({ id, englishName }): NameEntry => {
      const mapping = mappingsById.get(id)
      return {
        id,
        englishName,
        japaneseName: mapping?.japaneseName ?? null,
        status: mapping?.status ?? 'unverified',
        sourceIds: mapping ? [...mapping.sourceIds] : [],
        checkedAt: mapping?.checkedAt ?? null,
        note: mapping?.note ?? '',
      }
    }),
  }
}

function compareIds(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0
}

function compareEnglishNames(first: NameEntry, second: NameEntry): number {
  return nameCollator.compare(first.englishName, second.englishName) || compareIds(first.id, second.id)
}

/** Search either language; unknown Japanese names stay last in both sort directions. */
export function filterAndSortNames(
  entries: readonly NameEntry[],
  query = '',
  status: NameStatusFilter = 'all',
  sort: NameSort = { key: 'japaneseName', direction: 'asc' },
): NameEntry[] {
  const normalizedQuery = normalizeGrowthSearch(query)
  const direction = sort.direction === 'asc' ? 1 : -1
  return entries
    .filter((entry) => (status === 'all' || entry.status === status)
      && (normalizeGrowthSearch(entry.englishName).includes(normalizedQuery)
        || (entry.japaneseName !== null && normalizeGrowthSearch(entry.japaneseName).includes(normalizedQuery))))
    .sort((first, second) => {
      if (sort.key === 'englishName') {
        return direction * nameCollator.compare(first.englishName, second.englishName) || compareIds(first.id, second.id)
      }
      if (first.japaneseName === null && second.japaneseName === null) return compareEnglishNames(first, second)
      if (first.japaneseName === null) return 1
      if (second.japaneseName === null) return -1
      return direction * nameCollator.compare(first.japaneseName, second.japaneseName) || compareEnglishNames(first, second)
    })
}
