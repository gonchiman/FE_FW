import type { GrowthSource } from './growth.ts'

export type CharacterSkillKind = 'personal' | 'unique'

/** One character's skill acquisition; higher-level versions remain separate records. */
export interface CharacterSkill {
  id: string
  characterId: string
  kind: CharacterSkillKind
  name: string
  englishName: string | null
  description: string | null
  /** Null means the acquisition level is not confirmed, not level zero. */
  level: number | null
  acquisition: string | null
  /** Only an explicitly confirmed replacement, not a skill enhanced by this effect. */
  upgradesSkillId: string | null
  sourceIds: string[]
  status: 'unverified' | 'verified'
}

export interface CharacterSkillDataset {
  sources: GrowthSource[]
  skills: CharacterSkill[]
}

/** Source evidence of a unique acquisition, separate from the app's collected skills. */
export interface KnownUniqueSkill {
  characterId: string
  englishName: string
  level: number
  sourceId: string
}

export interface UniqueSkillResearch {
  checkedAt: string
  inspectedCharacterIds: string[]
  sources: GrowthSource[]
  knownSkills: KnownUniqueSkill[]
}
