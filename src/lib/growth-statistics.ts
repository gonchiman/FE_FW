import { GROWTH_STATS, type CharacterGrowth, type StatKey } from '../types/growth.ts'

export interface GrowthCondition {
  stat: StatKey
  operator: 'gte' | 'lte'
  value: number
}

export interface GrowthStatistics {
  count: number
  missingCount: number
  min: number | null
  max: number | null
  mean: number | null
  median: number | null
  q1: number | null
  q3: number | null
  standardDeviation: number | null
  iqr: number | null
}

export interface GrowthHistogramBin {
  index: number
  lower: number
  upper: number
  count: number
  characterIds: string[]
}

function isValidRate(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validateBinWidth(binWidth: 5 | 10): void {
  if (binWidth !== 5 && binWidth !== 10) {
    throw new RangeError('binWidth must be 5 or 10')
  }
}

/** Sample fixtures are never analytical observations; thresholds include equality. */
export function filterGrowthAnalysisCharacters(
  characters: readonly CharacterGrowth[],
  condition: GrowthCondition | null,
): CharacterGrowth[] {
  if (condition !== null) {
    if (!GROWTH_STATS.some(({ key }) => key === condition.stat)) {
      throw new TypeError('condition.stat must be a growth stat')
    }
    if (condition.operator !== 'gte' && condition.operator !== 'lte') {
      throw new TypeError('condition.operator must be gte or lte')
    }
    if (!isValidRate(condition.value)) {
      throw new RangeError('condition.value must be a finite non-negative number')
    }
  }

  return characters.filter((character) => {
    if (character.status === 'sample') return false
    if (condition === null) return true
    const rate = character.rates[condition.stat]
    if (!isValidRate(rate)) return false
    return condition.operator === 'gte' ? rate >= condition.value : rate <= condition.value
  })
}

/** Linear interpolation at (n - 1) × p, on a sorted non-empty array. */
function quantile(values: readonly number[], probability: number): number {
  const position = (values.length - 1) * probability
  const lowerIndex = Math.floor(position)
  const lowerValue = values[lowerIndex]
  return lowerValue + (values[Math.ceil(position)] - lowerValue) * (position - lowerIndex)
}

/** Missing rates stay separate from confirmed zero; deviation uses the population n. */
export function getGrowthStatistics(
  characters: readonly CharacterGrowth[],
  stat: StatKey,
): GrowthStatistics {
  const values: number[] = []
  let missingCount = 0
  for (const character of characters) {
    if (character.status === 'sample') continue
    const rate = character.rates[stat]
    if (isValidRate(rate)) values.push(rate)
    else missingCount += 1
  }

  const count = values.length
  if (count === 0) {
    return {
      count, missingCount, min: null, max: null, mean: null, median: null,
      q1: null, q3: null, standardDeviation: null, iqr: null,
    }
  }

  values.sort((first, second) => first - second)
  const mean = values.reduce((sum, value) => sum + value, 0) / count
  const q1 = quantile(values, 0.25)
  const q3 = quantile(values, 0.75)
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count
  return {
    count,
    missingCount,
    min: values[0],
    max: values[count - 1],
    mean,
    median: quantile(values, 0.5),
    q1,
    q3,
    standardDeviation: Math.sqrt(variance),
    iqr: q3 - q1,
  }
}

/** Use the complete roster so stat changes and filtering retain a common horizontal scale. */
export function getHistogramUpperBound(
  characters: readonly CharacterGrowth[],
  binWidth: 5 | 10,
): number {
  validateBinWidth(binWidth)
  let maximum = 0
  for (const character of characters) {
    if (character.status === 'sample') continue
    for (const { key } of GROWTH_STATS) {
      const rate = character.rates[key]
      if (isValidRate(rate)) maximum = Math.max(maximum, rate)
    }
  }
  const upperBound = (Math.floor(maximum / binWidth) + 1) * binWidth
  if (!Number.isFinite(upperBound) || upperBound <= maximum) {
    throw new RangeError('The maximum growth rate is too large for a finite histogram bound')
  }
  return upperBound
}

/** Each observed rate appears once in [lower, upper); IDs connect bins to the roster. */
export function buildGrowthHistogram(
  characters: readonly CharacterGrowth[],
  stat: StatKey,
  binWidth: 5 | 10,
  upperBound: number,
): GrowthHistogramBin[] {
  validateBinWidth(binWidth)
  if (!Number.isFinite(upperBound) || upperBound <= 0 || upperBound % binWidth !== 0) {
    throw new RangeError('upperBound must be a positive finite multiple of binWidth')
  }

  const bins = Array.from({ length: upperBound / binWidth }, (_, index): GrowthHistogramBin => ({
    index,
    lower: index * binWidth,
    upper: (index + 1) * binWidth,
    count: 0,
    characterIds: [],
  }))

  for (const character of characters) {
    if (character.status === 'sample') continue
    const rate = character.rates[stat]
    if (!isValidRate(rate)) continue
    if (rate >= upperBound) {
      throw new RangeError('upperBound must be strictly greater than every observed growth rate')
    }
    const bin = bins[Math.floor(rate / binWidth)]
    bin.count += 1
    bin.characterIds.push(character.id)
  }
  return bins
}
