import { GROWTH_STATS, type CharacterGrowth, type StatKey } from '../types/growth.ts'
import { getGrowthStatistics, type GrowthStatistics } from './growth-statistics.ts'

export interface GrowthSummaryRow {
  key: StatKey
  label: string
  order: number
  statistics: GrowthStatistics
}

export type GrowthSummarySortKey = 'stat' | 'mean' | 'median' | 'standardDeviation'
  | 'min' | 'q1' | 'q3' | 'max' | 'coefficientOfVariation' | 'normalizedIqr'
  | 'count' | 'missingCount'

export interface GrowthSummarySort {
  key: GrowthSummarySortKey
  direction: 'asc' | 'desc'
}

/** Every ability describes the same cohort, with its own missing-value count. */
export function getGrowthSummaryRows(characters: readonly CharacterGrowth[]): GrowthSummaryRow[] {
  return GROWTH_STATS.map(({ key, label }, order) => ({
    key,
    label,
    order,
    statistics: getGrowthStatistics(characters, key),
  }))
}

/** Sort original precision; unavailable statistics stay last in either direction. */
export function sortGrowthSummaryRows(rows: readonly GrowthSummaryRow[], sort: GrowthSummarySort): GrowthSummaryRow[] {
  const direction = sort.direction === 'asc' ? 1 : -1
  const key = sort.key
  return [...rows].sort((first, second) => {
    if (key === 'stat') return (first.order - second.order) * direction
    const firstValue = first.statistics[key]
    const secondValue = second.statistics[key]
    const firstMissing = firstValue === null || !Number.isFinite(firstValue)
    const secondMissing = secondValue === null || !Number.isFinite(secondValue)
    if (firstMissing !== secondMissing) return firstMissing ? 1 : -1
    if (!firstMissing && !secondMissing && firstValue !== secondValue) {
      return (firstValue! < secondValue! ? -1 : 1) * direction
    }
    return first.order - second.order
  })
}
