import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateClassDataset } from '../src/lib/class-data.ts'
import type { ClassDataset } from '../src/types/classes.ts'

function fixture(): ClassDataset {
  const stats = { hp: 0, str: 2, mag: null, dex: 5, spd: 10, lck: 0, def: 1, res: -1, cha: 0 }
  return {
    sources: [{ id: 'source', name: 'Source', url: 'https://example.com/data', retrievedAt: null, sourceVersion: null, gameVersion: null, note: 'Unverified' }],
    classes: [{
      id: 'Myrmidon', name: 'Myrmidon', tier: 'Specialty', status: 'unverified', unitType: 'Infantry',
      movement: 0, weapons: ['Sword'], bonuses: { ...stats }, growths: { ...stats },
      abilities: [{ name: 'Ability', effect: null }, { name: 'Second ability', effect: 'Effect' }],
      masterSkills: null, sourcePageUrl: null,
    }],
  }
}

test('validates all class data while preserving negative, zero, null and multiple abilities', () => {
  const input = fixture()
  const before = structuredClone(input)
  assert.deepEqual(validateClassDataset(input), input)
  assert.deepEqual(input, before)
  input.classes[0].abilities = []
  input.classes[0].weapons = []
  assert.deepEqual(validateClassDataset(input).classes[0].abilities, [])
  assert.deepEqual(validateClassDataset(input).classes[0].weapons, [])
})

test('rejects missing or non-numeric stats instead of filling them with zero', () => {
  for (const field of ['bonuses', 'growths'] as const) {
    for (const value of [undefined, '10', Infinity, NaN, false]) {
      const input = fixture()
      Object.assign(input.classes[0][field], { res: value })
      assert.throws(() => validateClassDataset(input), new RegExp(`${field}.res`))
    }
    const missing = fixture()
    Reflect.deleteProperty(missing.classes[0][field], 'res')
    assert.throws(() => validateClassDataset(missing), /exactly nine stats/)
    const extra = fixture()
    Object.assign(extra.classes[0][field], { total: 10 })
    assert.throws(() => validateClassDataset(extra), /exactly nine stats/)
  }
})

test('rejects malformed class identity, movement, skills, weapons, and source URLs', () => {
  for (const patch of [
    { id: 'Changed ID' }, { tier: 'Unknown' }, { status: 'verified' },
    { movement: -1 }, { movement: 1.5 }, { movement: '5' }, { movement: undefined },
    { unitType: undefined }, { weapons: ['Sword', 'Sword'] }, { weapons: [''] },
    { abilities: [{ name: 'Ability' }] }, { masterSkills: 'TBD' },
    { abilities: [{ name: 'Same', effect: null }, { name: 'Same', effect: null }] },
    { sourcePageUrl: 'javascript:alert(1)' }, { sourcePageUrl: 'https://user:password@example.com' },
  ]) {
    const input = fixture()
    Object.assign(input.classes[0], patch)
    assert.throws(() => validateClassDataset(input), JSON.stringify(patch))
  }
  const duplicateClass = fixture()
  duplicateClass.classes.push(duplicateClass.classes[0])
  assert.throws(() => validateClassDataset(duplicateClass), /duplicate id/)
  const duplicateSource = fixture()
  duplicateSource.sources.push(duplicateSource.sources[0])
  assert.throws(() => validateClassDataset(duplicateSource), /duplicate id/)
  assert.throws(() => validateClassDataset({ ...fixture(), sources: [] }), /at least one source/)
  assert.throws(() => validateClassDataset({ ...fixture(), classes: [] }), /at least one class/)
})

test('checked-in dataset validates all 59 classes with explicit verification state', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/class-details.json', import.meta.url), 'utf8'))
  const result = validateClassDataset(raw)
  assert.equal(result.classes.length, 59)
  assert.ok(result.classes.every(item => item.status === 'unverified'))
  assert.deepEqual(result, raw)
})
