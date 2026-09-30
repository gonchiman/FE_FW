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

/** Verification concerns name correspondence, independently of numerical game data. */
export interface NameEntry {
  id: string
  englishName: string
  japaneseName: string | null
  status: NameVerificationStatus
  sourceIds: string[]
  checkedAt: string | null
  note: string
}

export interface NameDataset {
  sources: NameSource[]
  entries: NameEntry[]
}

export interface NameSort {
  key: 'japaneseName' | 'englishName'
  direction: 'asc' | 'desc'
}

export type NameStatusFilter = 'all' | NameVerificationStatus
