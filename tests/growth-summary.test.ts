import assert from 'node:assert/strict'
import test from 'node:test'
import { filterGrowthCharactersByConditions } from '../src/lib/growth-numeric-filters.ts'
import { getGrowthSummaryRows, sortGrowthSummaryRows, type GrowthSummarySortKey } from '../src/lib/growth-summary.ts'
import { GROWTH_STATS, type CharacterGrowth } from '../src/types/growth.ts'

function character(id: string, rates: CharacterGrowth['rates'], status: CharacterGrowth['status'] = 'verified'): CharacterGrowth {
  return { id, name: id, sourceId: 'source', status, rates }
}

function rates(value: number | null): CharacterGrowth['rates'] {
  return Object.fromEntries(GROWTH_STATS.map(({ key }) => [key, value])) as CharacterGrowth['rates']
}

test('all nine rows describe the same filtered cohort in the standard ability order', () => {
  const first = rates(0)
  const second = rates(0)
  GROWTH_STATS.forEach(({ key }, index) => { first[key] = 10 + index; second[key] = 30 + 2 * index })
  first.spd = null
  second.spd = 0
  first.mag = 0
  second.mag = 0
  const cohort = filterGrowthCharactersByConditions([
    character('first', first), character('second', second, 'unverified'),
    character('filtered-out', rates(0)), character('sample', rates(900), 'sample'),
  ], [{ id: 1, field: 'hp', operator: 'gte', value: '10' }])
  const rows = getGrowthSummaryRows(cohort)
  assert.equal(rows.length, 9)
  assert.deepEqual(rows.map(({ key, label, order }) => ({ key, label, order })),
    GROWTH_STATS.map(({ key, label }, order) => ({ key, label, order })))
  for (const row of rows) {
    const { count, missingCount, mean } = row.statistics
    assert.equal(count + missingCount, 2)
    assert.equal(count, row.key === 'spd' ? 1 : 2)
    assert.equal(mean, row.key === 'spd' || row.key === 'mag' ? 0 : 20 + row.order * 1.5)
  }
})

test('empty and entirely missing cohorts retain all rows without fabricating zero observations', () => {
  for (const [cohort, missing] of [[[], 0], [[character('missing', rates(null)), character('sample', rates(60), 'sample')], 1]] as const) {
    const rows = getGrowthSummaryRows(cohort)
    assert.equal(rows.length, 9)
    for (const { statistics } of rows) {
      assert.equal(statistics.count, 0)
      assert.equal(statistics.missingCount, missing)
      assert.equal(statistics.mean, null)
      assert.equal(statistics.median, null)
      assert.equal(statistics.coefficientOfVariation, null)
      assert.equal(statistics.normalizedIqr, null)
    }
  }
  const zeroRows = getGrowthSummaryRows([character('zero', rates(0)), character('missing', rates(null))])
  assert.ok(zeroRows.every(({ statistics }) => statistics.count === 1 && statistics.missingCount === 1
    && statistics.mean === 0 && statistics.min === 0 && statistics.max === 0))
})

test('all numeric columns keep null and non-finite values last in both directions', () => {
  const keys: Exclude<GrowthSummarySortKey, 'stat'>[] = [
    'mean', 'median', 'standardDeviation', 'min', 'q1', 'q3', 'max',
    'coefficientOfVariation', 'normalizedIqr', 'count', 'missingCount',
  ]
  const values = [null, 5, NaN, 0, Infinity, -Infinity]
  for (const key of keys) {
    const rows = getGrowthSummaryRows([]).slice(0, values.length).map((row, index) => ({
      ...row, statistics: { ...row.statistics, [key]: values[index] },
    })).reverse()
    assert.deepEqual(sortGrowthSummaryRows(rows, { key, direction: 'asc' }).map(row => row.order), [3, 1, 0, 2, 4, 5], key)
    assert.deepEqual(sortGrowthSummaryRows(rows, { key, direction: 'desc' }).map(row => row.order), [1, 3, 0, 2, 4, 5], key)
  }
})

test('sort uses unrounded statistics and breaks true ties by standard order independently of direction', () => {
  const rows = getGrowthSummaryRows([]).slice(0, 4).map((row, index) => ({
    ...row, statistics: { ...row.statistics, mean: [10.04, 10.01, 10.04, 10.02][index] },
  })).reverse()
  assert.ok(rows.every(row => row.statistics.mean!.toFixed(1) === '10.0'))
  assert.deepEqual(sortGrowthSummaryRows(rows, { key: 'mean', direction: 'asc' }).map(row => row.order), [1, 3, 0, 2])
  assert.deepEqual(sortGrowthSummaryRows(rows, { key: 'mean', direction: 'desc' }).map(row => row.order), [0, 2, 3, 1])
  assert.deepEqual(sortGrowthSummaryRows(rows, { key: 'stat', direction: 'asc' }).map(row => row.order), [0, 1, 2, 3])
  assert.deepEqual(sortGrowthSummaryRows(rows, { key: 'stat', direction: 'desc' }).map(row => row.order), [3, 2, 1, 0])
})

test('summary construction and sorting leave frozen source data and rows unchanged', () => {
  const cohort = [character('one', rates(20)), character('two', rates(0))]
  const before = structuredClone(cohort)
  cohort.forEach(entry => { Object.freeze(entry.rates); Object.freeze(entry) })
  Object.freeze(cohort)
  const rows = getGrowthSummaryRows(cohort)
  const rowsBefore = structuredClone(rows)
  rows.forEach(row => { Object.freeze(row.statistics); Object.freeze(row) })
  Object.freeze(rows)
  const sorted = sortGrowthSummaryRows(rows, { key: 'stat', direction: 'desc' })
  assert.notEqual(sorted, rows)
  assert.equal(sorted[0], rows[8])
  assert.deepEqual(rows, rowsBefore)
  assert.deepEqual(cohort, before)
})
