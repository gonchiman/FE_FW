import type { ClassTier } from './class-names.ts'
import type { GrowthSource, StatKey } from './growth.ts'

export type { ClassTier } from './class-names.ts'

export interface ClassSkill {
  name: string
  effect: string | null
}

/** Source values stay separate from translated names and display labels. */
export interface ClassInfo {
  id: string
  name: string
  tier: ClassTier
  status: 'unverified'
  unitType: string | null
  movement: number | null
  weapons: string[] | null
  bonuses: Record<StatKey, number | null>
  growths: Record<StatKey, number | null>
  abilities: ClassSkill[] | null
  masterSkills: ClassSkill[] | null
  sourcePageUrl: string | null
}

export interface ClassDataset {
  sources: GrowthSource[]
  classes: ClassInfo[]
}
