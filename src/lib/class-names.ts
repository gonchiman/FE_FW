import { validateAndMergeNames } from './name-mappings.ts'
import type { ClassNameDataset, ClassRoster, ClassRosterEntry, ClassTier } from '../types/class-names.ts'

const classTiers: readonly ClassTier[] = ['Base', 'Beginner', 'Specialty', 'Advanced', 'Master', 'Divine']

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${path} must be a non-empty string`)
  }
  return value
}

/** Keep the upstream class keys intact rather than deriving IDs from translations. */
export function validateClassRoster(input: unknown): ClassRoster {
  const snapshot = requireRecord(input, 'class roster')
  if (snapshot.schemaVersion !== 1) throw new TypeError('class roster.schemaVersion must be 1')
  if (!Array.isArray(snapshot.classes) || snapshot.classes.length === 0) {
    throw new TypeError('class roster.classes must be a non-empty array')
  }
  const ids = new Set<string>()
  const classes = snapshot.classes.map((entry, index): ClassRosterEntry => {
    const path = `class roster.classes[${index}]`
    const item = requireRecord(entry, path)
    const id = requireString(item.id, `${path}.id`)
    if (ids.has(id)) throw new TypeError(`${path} contains a duplicate id: ${id}`)
    ids.add(id)
    const name = requireString(item.name, `${path}.name`)
    if (id !== name) throw new TypeError(`${path}.name must preserve the upstream class key`)
    const tier = requireString(item.tier, `${path}.tier`)
    if (!classTiers.includes(tier as ClassTier)) throw new TypeError(`${path}.tier is unknown: ${tier}`)
    return { id, name, tier: tier as ClassTier }
  })
  const { sources } = validateAndMergeNames({ sources: [snapshot.source], mappings: [] }, classes, 'classId')
  if (sources[0].language !== 'en') throw new TypeError('class roster.source.language must be en')
  return { source: sources[0], classes }
}

export function validateAndMergeClassNames(
  input: unknown,
  roster: readonly Pick<ClassRosterEntry, 'id' | 'name'>[],
): ClassNameDataset {
  const { sources, entries } = validateAndMergeNames(input, roster, 'classId')
  return { sources, classes: entries }
}
