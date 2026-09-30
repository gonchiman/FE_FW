import type { NameEntry, NameSource } from './name-mappings.ts'

export type ClassTier = 'Base' | 'Beginner' | 'Specialty' | 'Advanced' | 'Master' | 'Divine'

/** Names and tiers only; this roster does not import class growth values. */
export interface ClassRosterEntry {
  id: string
  name: string
  tier: ClassTier
}

export interface ClassRoster {
  source: NameSource
  classes: ClassRosterEntry[]
}

export interface ClassNameDataset {
  sources: NameSource[]
  classes: NameEntry[]
}
