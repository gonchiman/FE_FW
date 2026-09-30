export interface NameSource {
  id: string
  language: 'ja' | 'en' | 'ja-en'
  name: string
  url: string
  retrievedAt: string
  sourceVersion: string | null
  gameVersion: string | null
}

export type NameVerificationStatus = 'verified' | 'unverified'

export interface CharacterNameMapping {
  characterId: string
  japaneseName: string | null
  status: NameVerificationStatus
  sourceIds: string[]
  checkedAt: string | null
  note: string
}

export interface CharacterName {
  id: string
  englishName: string
  japaneseName: string | null
  status: NameVerificationStatus
  sourceIds: string[]
  checkedAt: string | null
  note: string
}

export interface CharacterNameDataset {
  sources: NameSource[]
  characters: CharacterName[]
}

export interface NameSort {
  key: 'japaneseName' | 'englishName'
  direction: 'asc' | 'desc'
}

export type NameStatusFilter = 'all' | NameVerificationStatus
