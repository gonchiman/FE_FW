import type { NameEntry, NameSource } from './name-mappings.ts'

export type { NameSource, NameVerificationStatus, NameSort, NameStatusFilter } from './name-mappings.ts'

export interface CharacterNameMapping extends Omit<NameEntry, 'id' | 'englishName'> {
  characterId: string
}

export type CharacterName = NameEntry

export interface CharacterNameDataset {
  sources: NameSource[]
  characters: CharacterName[]
}
