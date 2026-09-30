import { GROWTH_STATS, type CharacterGrowth, type StatKey } from '../types/growth.ts'

export const GROWTH_NUMERIC_FILTER_OPERATORS = [
  { key: 'eq', label: '等しい' },
  { key: 'gte', label: '以上' },
  { key: 'lte', label: '以下' },
  { key: 'gt', label: 'より大きい' },
  { key: 'lt', label: 'より小さい' },
] as const

export type GrowthNumericFilterOperator = typeof GROWTH_NUMERIC_FILTER_OPERATORS[number]['key']

export interface GrowthNumericCondition {
  id: number
  field: StatKey
  operator: GrowthNumericFilterOperator
  value: string
}

const operatorSymbols: Record<GrowthNumericFilterOperator, string> = {
  eq: '＝', gte: '≥', lte: '≤', gt: '＞', lt: '＜',
}

/** Blank, partial, negative and non-finite input is not an active condition. */
export function parseGrowthNumericFilterValue(value: string): number | null {
  const normalized = value.trim()
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return null
  const number = Number(normalized)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function getConditionValue(condition: GrowthNumericCondition): number | null {
  if (!GROWTH_STATS.some(({ key }) => key === condition.field)
    || !GROWTH_NUMERIC_FILTER_OPERATORS.some(({ key }) => key === condition.operator)) return null
  return parseGrowthNumericFilterValue(condition.value)
}

export function formatGrowthNumericCondition(condition: GrowthNumericCondition): string | null {
  const value = getConditionValue(condition)
  if (value === null) return null
  const field = GROWTH_STATS.find(({ key }) => key === condition.field)!
  return `${field.label}${operatorSymbols[condition.operator]}${value}%`
}

/** Every active condition must match; sample rows are never analysis observations. */
export function filterGrowthCharactersByConditions(
  characters: readonly CharacterGrowth[],
  conditions: readonly GrowthNumericCondition[],
): CharacterGrowth[] {
  const active = conditions.flatMap((condition) => {
    const threshold = getConditionValue(condition)
    return threshold === null ? [] : [{ ...condition, threshold }]
  })
  return characters.filter((character) => character.status !== 'sample' && active.every((condition) => {
    const value = character.rates[condition.field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false
    switch (condition.operator) {
      case 'eq': return value === condition.threshold
      case 'gte': return value >= condition.threshold
      case 'lte': return value <= condition.threshold
      case 'gt': return value > condition.threshold
      case 'lt': return value < condition.threshold
    }
  }))
}
