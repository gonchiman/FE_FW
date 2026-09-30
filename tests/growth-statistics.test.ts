import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateGrowthDataset } from '../src/lib/growth.ts'
import {
  buildGrowthHistogram,
  filterGrowthAnalysisCharacters,
  getGrowthStatistics,
  getHistogramUpperBound,
  type GrowthCondition,
} from '../src/lib/growth-statistics.ts'
import { GROWTH_STATS, type CharacterGrowth, type StatKey } from '../src/types/growth.ts'

function character(
  id: string,
  hp: number | null,
  status: CharacterGrowth['status'] = 'verified',
): CharacterGrowth {
  const rates = Object.fromEntries(GROWTH_STATS.map(({ key }) => [key, null])) as CharacterGrowth['rates']
  rates.hp = hp
  return { id, name: id, sourceId: 'source', status, rates }
}

function roster(values: (number | null)[]): CharacterGrowth[] {
  return values.map((value, index) => character(String(index), value))
}

test('empty or entirely missing statistics have no fabricated numeric values', () => {
  const empty = {
    count: 0, missingCount: 0, min: null, max: null, mean: null, median: null,
    q1: null, q3: null, standardDeviation: null, iqr: null,
    coefficientOfVariation: null, normalizedIqr: null,
  }
  assert.deepEqual(getGrowthStatistics([], 'hp'), empty)
  assert.deepEqual(getGrowthStatistics(roster([null, null]), 'hp'), { ...empty, missingCount: 2 })
  assert.deepEqual(getGrowthStatistics([character('sample', 50, 'sample')], 'hp'), empty)
})

test('zero, one observation, and ties have the expected population statistics', () => {
  assert.deepEqual(getGrowthStatistics(roster([0, null]), 'hp'), {
    count: 1, missingCount: 1, min: 0, max: 0, mean: 0, median: 0,
    q1: 0, q3: 0, standardDeviation: 0, iqr: 0,
    coefficientOfVariation: null, normalizedIqr: null,
  })
  assert.deepEqual(getGrowthStatistics(roster([25, 25, 25]), 'hp'), {
    count: 3, missingCount: 0, min: 25, max: 25, mean: 25, median: 25,
    q1: 25, q3: 25, standardDeviation: 0, iqr: 0,
    coefficientOfVariation: 0, normalizedIqr: 0,
  })
})

test('quartiles interpolate at (n - 1)p and deviation divides by population n', () => {
  assert.deepEqual(getGrowthStatistics(roster([30, 0, 20, 10]), 'hp'), {
    count: 4, missingCount: 0, min: 0, max: 30, mean: 15, median: 15,
    q1: 7.5, q3: 22.5, standardDeviation: Math.sqrt(125), iqr: 15,
    coefficientOfVariation: Math.sqrt(125) / 15, normalizedIqr: 1,
  })
  const odd = getGrowthStatistics(roster([0, 5, 10, 15, 100]), 'hp')
  assert.equal(odd.median, 10)
  assert.equal(odd.q1, 5)
  assert.equal(odd.q3, 15)
  assert.equal(odd.iqr, 10)
})

test('relative dispersion distinguishes zero denominators from positive constant observations', () => {
  const zeros = getGrowthStatistics(roster([0, 0, 0]), 'hp')
  assert.equal(zeros.coefficientOfVariation, null)
  assert.equal(zeros.normalizedIqr, null)
  for (const values of [[25], [25, 25, 25]]) {
    const constant = getGrowthStatistics(roster(values), 'hp')
    assert.equal(constant.coefficientOfVariation, 0)
    assert.equal(constant.normalizedIqr, 0)
  }
  const zeroMedian = getGrowthStatistics(roster([0, 0, 0, 20]), 'hp')
  assert.equal(zeroMedian.mean, 5)
  assert.equal(zeroMedian.median, 0)
  assert.equal(zeroMedian.iqr, 5)
  assert.equal(zeroMedian.coefficientOfVariation, Math.sqrt(75) / 5)
  assert.equal(zeroMedian.normalizedIqr, null)
})

test('nonconstant relative dispersion is dimensionless and ignores missing observations', () => {
  for (const values of [[10, 20, 30, 40, null], [20, 40, 60, 80, null]]) {
    const statistics = getGrowthStatistics(roster(values), 'hp')
    assert.equal(statistics.count, 4)
    assert.equal(statistics.missingCount, 1)
    assert.ok(Math.abs(statistics.coefficientOfVariation! - Math.sqrt(125) / 25) < 1e-12)
    assert.equal(statistics.normalizedIqr, 0.6)
  }
})

test('sample fixtures are excluded and invalid rates are missing, never zero', () => {
  const entries = [
    character('sample', 900, 'sample'), character('verified', 0),
    character('unverified', 20, 'unverified'), ...roster([null, NaN, Infinity, -Infinity, -5]),
  ]
  const statistics = getGrowthStatistics(entries, 'hp')
  assert.equal(statistics.count, 2)
  assert.equal(statistics.missingCount, 5)
  assert.equal(statistics.mean, 10)
  assert.equal(statistics.min, 0)
  assert.equal(statistics.max, 20)
  const bins = buildGrowthHistogram(entries, 'hp', 10, 30)
  assert.deepEqual(bins.map(({ count }) => count), [1, 0, 1])
  assert.deepEqual(bins.flatMap(({ characterIds }) => characterIds), ['verified', 'unverified'])
})

test('optional conditions are inclusive, retain zero, and reject unknown rates', () => {
  const entries = [
    character('zero', 0), character('ten', 10), character('twenty', 20, 'unverified'),
    character('unknown', null), character('invalid', NaN), character('sample', 10, 'sample'),
  ]
  assert.deepEqual(filterGrowthAnalysisCharacters(entries, null).map(({ id }) => id),
    ['zero', 'ten', 'twenty', 'unknown', 'invalid'])
  assert.deepEqual(filterGrowthAnalysisCharacters(entries, { stat: 'hp', operator: 'gte', value: 10 })
    .map(({ id }) => id), ['ten', 'twenty'])
  assert.deepEqual(filterGrowthAnalysisCharacters(entries, { stat: 'hp', operator: 'lte', value: 10 })
    .map(({ id }) => id), ['zero', 'ten'])
  assert.deepEqual(filterGrowthAnalysisCharacters(entries, { stat: 'hp', operator: 'lte', value: 0 })
    .map(({ id }) => id), ['zero'])
  assert.deepEqual(filterGrowthAnalysisCharacters(entries, { stat: 'hp', operator: 'gte', value: 21 }), [])
})

test('a condition selects the cohort while statistics can use a different stat', () => {
  const entries = roster([10, 20, 30])
  entries[0].rates.spd = 90
  entries[1].rates.spd = 0
  entries[2].rates.spd = null
  const selected = filterGrowthAnalysisCharacters(entries, { stat: 'hp', operator: 'gte', value: 20 })
  const statistics = getGrowthStatistics(selected, 'spd')
  assert.equal(statistics.count, 1)
  assert.equal(statistics.missingCount, 1)
  assert.equal(statistics.mean, 0)
})

test('conditions reject non-finite or negative thresholds and malformed fields', () => {
  for (const value of [NaN, Infinity, -Infinity, -1]) {
    assert.throws(() => filterGrowthAnalysisCharacters([], { stat: 'hp', operator: 'gte', value }),
      /condition.value/)
  }
  assert.throws(() => filterGrowthAnalysisCharacters([], {
    stat: 'unknown' as StatKey, operator: 'gte', value: 10,
  }), /condition.stat/)
  assert.throws(() => filterGrowthAnalysisCharacters([], {
    stat: 'hp', operator: 'gt' as GrowthCondition['operator'], value: 10,
  }), /condition.operator/)
})

test('histogram bounds use all nine stats, exclude samples, and extend beyond 100', () => {
  const entries = [character('one', 10), character('sample', 900, 'sample')]
  entries[0].rates.cha = 125
  entries[0].rates.res = Infinity
  assert.equal(getHistogramUpperBound(entries, 5), 130)
  assert.equal(getHistogramUpperBound(entries, 10), 130)
  assert.equal(getHistogramUpperBound(roster([100]), 5), 105)
  assert.equal(getHistogramUpperBound(roster([100]), 10), 110)
  assert.equal(getHistogramUpperBound(roster([104.9]), 5), 105)
  assert.equal(getHistogramUpperBound([], 5), 5)
  assert.equal(getHistogramUpperBound(roster([null, NaN, -1]), 10), 10)
})

test('histogram bins are half open, retain empty bins, and conserve observations and IDs', () => {
  const entries = roster([0, 4.9, 5, 9.9, 10, 100, 125, null])
  for (const binWidth of [5, 10] as const) {
    const upperBound = getHistogramUpperBound(entries, binWidth)
    const bins = buildGrowthHistogram(entries, 'hp', binWidth, upperBound)
    assert.equal(bins.length, upperBound / binWidth)
    assert.equal(bins[0].lower, 0)
    assert.equal(bins.at(-1)?.upper, 130)
    assert.ok(bins.some(({ count }) => count === 0))
    assert.equal(bins.reduce((sum, { count }) => sum + count, 0), 7)
    assert.deepEqual(bins.flatMap(({ characterIds }) => characterIds), ['0', '1', '2', '3', '4', '5', '6'])
    for (const bin of bins) {
      assert.equal(bin.count, bin.characterIds.length)
      assert.equal(bin.lower, bin.index * binWidth)
      assert.equal(bin.upper, bin.lower + binWidth)
      for (const id of bin.characterIds) {
        const value = entries[Number(id)].rates.hp!
        assert.ok(value >= bin.lower && value < bin.upper)
      }
    }
  }
  assert.deepEqual(buildGrowthHistogram(entries, 'hp', 5, 130).slice(0, 3).map(({ count }) => count), [2, 2, 1])
})

test('empty and filtered histograms keep the same full-roster bounds for every stat', () => {
  const entries = roster([0, 10, 100])
  entries[0].rates.spd = 40
  const upperBound = getHistogramUpperBound(entries, 10)
  const selected = filterGrowthAnalysisCharacters(entries, { stat: 'hp', operator: 'lte', value: 10 })
  for (const { key } of GROWTH_STATS) {
    const fullBins = buildGrowthHistogram(entries, key, 10, upperBound)
    const filteredBins = buildGrowthHistogram(selected, key, 10, upperBound)
    const emptyBins = buildGrowthHistogram([], key, 10, upperBound)
    assert.deepEqual(fullBins.map(({ lower, upper }) => [lower, upper]),
      filteredBins.map(({ lower, upper }) => [lower, upper]))
    assert.equal(emptyBins.length, fullBins.length)
    assert.ok(emptyBins.every(({ count, characterIds }) => count === 0 && characterIds.length === 0))
    assert.equal(filteredBins.reduce((sum, { count }) => sum + count, 0), getGrowthStatistics(selected, key).count)
  }
})

test('invalid histogram inputs fail explicitly instead of dropping values', () => {
  for (const upperBound of [0, -10, NaN, Infinity, 12]) {
    assert.throws(() => buildGrowthHistogram([], 'hp', 10, upperBound), /upperBound/)
  }
  assert.throws(() => buildGrowthHistogram(roster([100]), 'hp', 10, 100), /strictly greater/)
  assert.throws(() => buildGrowthHistogram(roster([125]), 'hp', 10, 100), /strictly greater/)
  assert.throws(() => buildGrowthHistogram([], 'hp', 0 as 5, 10), /binWidth/)
  assert.throws(() => getHistogramUpperBound([], 20 as 10), /binWidth/)
  assert.throws(() => getHistogramUpperBound(roster([Number.MAX_VALUE]), 10), /too large/)
})

test('analysis functions preserve frozen input data and roster order', () => {
  const entries = roster([20, null, 0, 10])
  const before = structuredClone(entries)
  for (const entry of entries) {
    Object.freeze(entry.rates)
    Object.freeze(entry)
  }
  Object.freeze(entries)
  const result = filterGrowthAnalysisCharacters(entries, { stat: 'hp', operator: 'gte', value: 0 })
  getGrowthStatistics(entries, 'hp')
  const bound = getHistogramUpperBound(entries, 10)
  buildGrowthHistogram(entries, 'hp', 10, bound)
  assert.deepEqual(entries, before)
  assert.notEqual(result, entries)
  assert.deepEqual(result.map(({ id }) => id), ['0', '2', '3'])
})

test('the imported 62-character roster has the expected speed summary and histogram totals', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/character-growths.json', import.meta.url), 'utf8'))
  const { characters } = validateGrowthDataset(raw)
  const statistics = getGrowthStatistics(characters, 'spd')
  assert.equal(statistics.count, 62)
  assert.equal(statistics.missingCount, 0)
  assert.equal(statistics.min, 10)
  assert.equal(statistics.max, 65)
  assert.equal(statistics.mean, 2525 / 62)
  assert.equal(statistics.median, 40)
  assert.equal(statistics.q1, 35)
  assert.equal(statistics.q3, 48.75)
  assert.equal(statistics.iqr, 13.75)
  assert.ok(Math.abs(statistics.standardDeviation! - 11.174812338524916) < 1e-12)
  for (const binWidth of [5, 10] as const) {
    const bound = getHistogramUpperBound(characters, binWidth)
    assert.equal(bound, binWidth === 5 ? 75 : 80)
    for (const { key } of GROWTH_STATS) {
      const bins = buildGrowthHistogram(characters, key, binWidth, bound)
      assert.equal(bins.reduce((sum, { count }) => sum + count, 0), 62)
      assert.equal(new Set(bins.flatMap(({ characterIds }) => characterIds)).size, 62)
    }
  }
})
