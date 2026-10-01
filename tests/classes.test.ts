import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  changeClassView, createClassListState, filterAndSortClasses, formatClassModifier,
  getClassName, getClassTerm, getClassTierLabel, nextClassSort,
  type ClassListState,
} from '../src/lib/classes.ts'
import type { ClassInfo } from '../src/types/classes.ts'
import { GROWTH_STATS } from '../src/types/growth.ts'

function row(id: string, value: number | null, overrides: Partial<ClassInfo> = {}): ClassInfo {
  const modifiers = Object.fromEntries(GROWTH_STATS.map(stat => [stat.key, value])) as ClassInfo['bonuses']
  return {
    id, name: id, tier: 'Specialty', status: 'unverified', unitType: 'Infantry', movement: value,
    weapons: null, bonuses: { ...modifiers }, growths: { ...modifiers }, abilities: null, masterSkills: null,
    sourcePageUrl: null, ...overrides,
  }
}

function state(overrides: Partial<ClassListState> = {}): ClassListState {
  return { ...createClassListState(), ...overrides }
}

test('class search combines Japanese/English name normalization with tier filtering', () => {
  const rows = [row('Warrior', 1, { tier: 'Advanced' }), row('Myrmidon', 2), row('Commoner', null, { tier: 'Base' })]
  const names = new Map([['Warrior', 'ウォーリアー'], ['Myrmidon', '剣士'], ['Commoner', '平民']])
  for (const query of ['  ＷＡＲＲＩＯＲ ', 'ｳｫｰﾘｱｰ', 'うぉーりあー']) {
    assert.deepEqual(filterAndSortClasses(rows, state({ query }), names).map(row => row.id), ['Warrior'])
  }
  assert.deepEqual(filterAndSortClasses(rows, state({ query: '剣士', tier: 'Specialty' }), names).map(row => row.id), ['Myrmidon'])
  assert.equal(filterAndSortClasses(rows, state({ query: '剣士', tier: 'Base' }), names).length, 0)
  assert.equal(filterAndSortClasses(rows, state({ query: 'does not exist' }), names).length, 0)
  assert.equal(filterAndSortClasses(rows, state({ query: '   ' }), names).length, 3)
})

test('numeric comparison preserves negative, zero and missing values for every displayed stat', () => {
  const rows = [row('Unknown', null), row('Positive', 5), row('Zero', 0), row('Negative', -5)]
  for (const view of ['bonuses', 'growths'] as const) {
    for (const { key } of GROWTH_STATS) {
      assert.deepEqual(filterAndSortClasses(rows, state({ view, sort: { key, direction: 'asc' } })).map(row => row.id),
        ['Negative', 'Zero', 'Positive', 'Unknown'])
      assert.deepEqual(filterAndSortClasses(rows, state({ view, sort: { key, direction: 'desc' } })).map(row => row.id),
        ['Positive', 'Zero', 'Negative', 'Unknown'])
    }
  }
  assert.deepEqual(filterAndSortClasses(rows, state({ sort: { key: 'movement', direction: 'desc' } })).map(row => row.id),
    ['Positive', 'Zero', 'Negative', 'Unknown'])
  assert.deepEqual(filterAndSortClasses(rows, state({ sort: { key: 'movement', direction: 'asc' } })).map(row => row.id),
    ['Negative', 'Zero', 'Positive', 'Unknown'])
})

test('bonuses and growth rates sort by their own values instead of a shared stat field', () => {
  const a = row('A', 1)
  const b = row('B', 2)
  a.growths.hp = 10
  b.growths.hp = -10
  assert.deepEqual(filterAndSortClasses([a, b], state({ view: 'bonuses', sort: { key: 'hp', direction: 'desc' } })).map(row => row.id), ['B', 'A'])
  assert.deepEqual(filterAndSortClasses([a, b], state({ view: 'growths', sort: { key: 'hp', direction: 'desc' } })).map(row => row.id), ['A', 'B'])
})

test('tier ordering follows progression rather than alphabetical labels', () => {
  const tiers = ['Divine', 'Master', 'Advanced', 'Specialty', 'Beginner', 'Base'] as const
  const rows = tiers.map(tier => row(tier, 0, { tier }))
  assert.deepEqual(filterAndSortClasses(rows, state({ sort: { key: 'tier', direction: 'asc' } })).map(row => row.tier), [...tiers].reverse())
  assert.deepEqual(filterAndSortClasses(rows, state({ view: 'growths', sort: { key: 'tier', direction: 'desc' } })).map(row => row.tier), [...tiers])
  assert.equal(getClassTierLabel('Divine'), '神将職')
})

test('numeric ties have stable ascending display-name and id fallback in both directions', () => {
  const rows = [row('b2', 1, { name: 'Beta' }), row('b1', 1, { name: 'Beta' }), row('a', 1, { name: 'Alpha' }), row('null-b', null), row('null-a', null)]
  for (const direction of ['asc', 'desc'] as const) {
    assert.deepEqual(filterAndSortClasses(rows, state({ view: 'bonuses', sort: { key: 'hp', direction } })).map(row => row.id),
      ['a', 'b1', 'b2', 'null-a', 'null-b'])
  }
})

test('name sorting uses the displayed Japanese name with deterministic duplicate ids', () => {
  const rows = [row('c', 0), row('b', 0), row('a', 0)]
  const names = new Map([['c', 'アーチャー'], ['b', 'ウォーリアー'], ['a', 'アーチャー']])
  assert.deepEqual(filterAndSortClasses(rows, state(), names).map(row => row.id), ['a', 'c', 'b'])
  assert.deepEqual(filterAndSortClasses(rows, state({ sort: { key: 'name', direction: 'desc' } }), names).map(row => row.id), ['b', 'a', 'c'])
  assert.equal(getClassName(row('Unmapped', 0), names), 'Unmapped')
})

test('view changes retain filters and visible sort columns but reset invisible columns', () => {
  const initial = state({ query: 'Light', tier: 'Specialty', sort: { key: 'movement', direction: 'desc' } })
  const growths = changeClassView(initial, 'growths')
  assert.deepEqual(growths, { query: 'Light', tier: 'Specialty', view: 'growths', sort: { key: 'name', direction: 'asc' } })
  const numeric = { ...growths, sort: { key: 'res', direction: 'desc' } } as const
  assert.deepEqual(changeClassView(numeric, 'bonuses').sort, numeric.sort)
  assert.deepEqual(changeClassView(numeric, 'basic').sort, { key: 'name', direction: 'asc' })
  const tier = state({ sort: { key: 'tier', direction: 'desc' } })
  assert.deepEqual(changeClassView(tier, 'bonuses').sort, tier.sort)
  assert.equal(initial.view, 'basic')
})

test('sort toggles and default directions match the accessible header action', () => {
  assert.deepEqual(nextClassSort({ key: 'name', direction: 'asc' }, 'name'), { key: 'name', direction: 'desc' })
  assert.deepEqual(nextClassSort({ key: 'hp', direction: 'desc' }, 'name'), { key: 'name', direction: 'asc' })
  assert.deepEqual(nextClassSort({ key: 'name', direction: 'asc' }, 'tier'), { key: 'tier', direction: 'asc' })
  assert.deepEqual(nextClassSort({ key: 'name', direction: 'asc' }, 'res'), { key: 'res', direction: 'desc' })
})

test('filter/sort never mutates source data', () => {
  const rows = [row('B', 2), row('A', -2)]
  const before = structuredClone(rows)
  for (const entry of rows) { Object.freeze(entry.bonuses); Object.freeze(entry.growths); Object.freeze(entry) }
  Object.freeze(rows)
  const result = filterAndSortClasses(rows, state({ view: 'bonuses', sort: { key: 'hp', direction: 'asc' } }))
  assert.notEqual(result, rows)
  assert.deepEqual(rows, before)
  assert.deepEqual(result.map(row => row.id), ['A', 'B'])
})

test('display formatting distinguishes null, zero, negative and positive modifiers', () => {
  assert.equal(formatClassModifier(null), '—')
  assert.equal(formatClassModifier(0), '0')
  assert.equal(formatClassModifier(-5), '-5')
  assert.equal(formatClassModifier(10), '+10')
  assert.equal(getClassTerm('Infantry Heavy Armor'), '重装・歩兵')
  assert.equal(getClassTerm('Heavy Armor Infantry'), '重装・歩兵')
  assert.equal(getClassTerm('Cavalry Heavy Armor'), '重装・騎兵')
  assert.equal(getClassTerm('Unknown source term'), 'Unknown source term')
})
