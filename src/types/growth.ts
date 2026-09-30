export const GROWTH_STATS = [
  { key: 'hp', label: 'HP' },
  { key: 'str', label: '力' },
  { key: 'mag', label: '魔力' },
  { key: 'dex', label: '技' },
  { key: 'spd', label: '速さ' },
  { key: 'lck', label: '幸運' },
  { key: 'def', label: '守備' },
  { key: 'res', label: '魔防' },
  { key: 'cha', label: '魅力' },
] as const

export type StatKey = (typeof GROWTH_STATS)[number]['key']

export interface CharacterGrowth {
  id: string
  name: string
  sourceId: string
  status: 'sample' | 'unverified' | 'verified'
  rates: Record<StatKey, number | null>
}

export interface GrowthSource {
  id: string
  name: string
  url: string | null
  retrievedAt: string | null
  sourceVersion: string | null
  gameVersion: string | null
  note: string
}

export interface GrowthDataset {
  sources: GrowthSource[]
  characters: CharacterGrowth[]
}

export type GrowthSortKey = 'name' | StatKey
export type GrowthSortDirection = 'asc' | 'desc'

export interface GrowthSort {
  key: GrowthSortKey
  direction: GrowthSortDirection
}
