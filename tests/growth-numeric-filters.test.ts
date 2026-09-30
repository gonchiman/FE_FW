import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  filterGrowthCharactersByConditions,
  formatGrowthNumericCondition,
  parseGrowthNumericFilterValue,
  type GrowthNumericCondition,
  type GrowthNumericFilterOperator,
} from '../src/lib/growth-numeric-filters.ts'
import { GROWTH_STATS, type CharacterGrowth } from '../src/types/growth.ts'

function character(id: string, rates: Partial<CharacterGrowth['rates']>, status: CharacterGrowth['status'] = 'verified'): CharacterGrowth {
  return { id, name: id, sourceId: 'test', status,
    rates: { ...Object.fromEntries(GROWTH_STATS.map(({ key }) => [key, null])), ...rates } as CharacterGrowth['rates'] }
}
function condition(value: string, operator: GrowthNumericFilterOperator = 'gte', field: GrowthNumericCondition['field'] = 'str', id = 1): GrowthNumericCondition {
  return { id, field, operator, value }
}
const ids = (characters: readonly CharacterGrowth[]) => characters.map(character => character.id)

test('numeric input preserves zero, decimals and scientific notation; rejects partial or negative values', () => {
  for (const [input, expected] of [['0', 0], [' 45 ', 45], ['.5', .5], ['+12.5', 12.5], ['5e1', 50], ['150', 150]] as const) {
    assert.equal(parseGrowthNumericFilterValue(input), expected)
  }
  for (const input of ['', ' ', '-', '1e', '-0.1', 'NaN', 'Infinity', '1e999', '0x10', '45%', '1,000']) {
    assert.equal(parseGrowthNumericFilterValue(input), null, input)
  }
})

test('all comparison operators distinguish equality from strict boundaries', () => {
  const roster = [character('below', { str: 40 }), character('equal', { str: 45 }), character('above', { str: 50 })]
  const expected: Record<GrowthNumericFilterOperator, string[]> = {
    eq: ['equal'], gte: ['equal', 'above'], lte: ['below', 'equal'], gt: ['above'], lt: ['below'],
  }
  for (const operator of Object.keys(expected) as GrowthNumericFilterOperator[]) {
    assert.deepEqual(ids(filterGrowthCharactersByConditions(roster, [condition('45', operator)])), expected[operator])
  }
})

test('conditions combine with AND across abilities and can bound the same ability', () => {
  const roster = [
    character('both', { str: 45, spd: 50 }), character('strength-only', { str: 55, spd: 30 }),
    character('speed-only', { str: 30, spd: 55 }), character('upper', { str: 50, spd: 60 }),
  ]
  assert.deepEqual(ids(filterGrowthCharactersByConditions(roster, [condition('45'), condition('50', 'gte', 'spd', 2)])), ['both', 'upper'])
  assert.deepEqual(ids(filterGrowthCharactersByConditions(roster, [condition('45'), condition('50', 'lt', 'str', 2)])), ['both'])
  assert.deepEqual(ids(filterGrowthCharactersByConditions(roster, [condition('50', 'gt'), condition('45', 'lt', 'str', 2)])), [])
})

test('missing and invalid rates never satisfy a valid condition; confirmed zero and unverified values do', () => {
  const roster = [
    character('zero', { str: 0 }), character('unverified', { str: 10 }, 'unverified'),
    character('null', { str: null }), character('nan', { str: NaN }), character('infinite', { str: Infinity }),
    character('negative', { str: -5 }), character('sample', { str: 10 }, 'sample'),
  ]
  assert.deepEqual(ids(filterGrowthCharactersByConditions(roster, [condition('0')])), ['zero', 'unverified'])
  assert.deepEqual(ids(filterGrowthCharactersByConditions(roster, [condition('0', 'eq')])), ['zero'])
})

test('blank and invalid rows are inactive without disabling other conditions or losing missing observations', () => {
  const roster = [character('low', { str: 5 }), character('high', { str: 50 }), character('missing', {}), character('sample', {}, 'sample')]
  const inactive = ['', ' ', '-1', '1e', 'Infinity'].map((value, index) => condition(value, 'gte', 'spd', index + 2))
  assert.deepEqual(ids(filterGrowthCharactersByConditions(roster, [])), ['low', 'high', 'missing'])
  assert.deepEqual(ids(filterGrowthCharactersByConditions(roster, inactive)), ['low', 'high', 'missing'])
  assert.deepEqual(ids(filterGrowthCharactersByConditions(roster, [condition('45'), ...inactive])), ['high'])
})

test('condition summaries use Japanese ability names, exact operators, normalized numbers and percent units', () => {
  assert.equal(formatGrowthNumericCondition(condition(' 4.5e1 ', 'gte', 'spd')), '速さ≥45%')
  assert.equal(formatGrowthNumericCondition(condition('0', 'eq', 'hp')), 'HP＝0%')
  assert.equal(formatGrowthNumericCondition(condition('5', 'lt', 'mag')), '魔力＜5%')
  for (const input of ['', '-1', 'Infinity', '1e']) assert.equal(formatGrowthNumericCondition(condition(input)), null)
})

test('filtering keeps roster order and never mutates records or conditions', () => {
  const first = Object.freeze(character('first', Object.freeze({ str: 50 })))
  Object.freeze(first.rates)
  const second = Object.freeze(character('second', { str: 45 }))
  Object.freeze(second.rates)
  const roster = Object.freeze([first, second])
  const conditions = Object.freeze([Object.freeze(condition('40'))])
  const result = filterGrowthCharactersByConditions(roster, conditions)
  assert.deepEqual(ids(result), ['first', 'second'])
  assert.notEqual(result, roster)
  assert.equal(result[0], first)
  assert.equal(conditions[0].value, '40')
})
