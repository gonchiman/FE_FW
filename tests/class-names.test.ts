import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { validateAndMergeClassNames, validateClassRoster } from '../src/lib/class-names.ts'

const rawRoster = JSON.parse(readFileSync(new URL('../data/sources/fortunes-weave-classes.json', import.meta.url), 'utf8'))
const rawNames = JSON.parse(readFileSync(new URL('../src/data/class-names.json', import.meta.url), 'utf8'))

test('class roster preserves all 59 fixed upstream keys without adding missing classes or growth data', () => {
  const roster = validateClassRoster(rawRoster)
  assert.equal(roster.classes.length, 59)
  assert.equal(new Set(roster.classes.map((entry) => entry.id)).size, 59)
  assert.ok(roster.classes.every((entry) => entry.id === entry.name))
  assert.ok(roster.classes.some((entry) => entry.id === 'Commoner'))
  assert.ok(!roster.classes.some((entry) => entry.id === 'Noble'))
  assert.deepEqual(new Set(roster.classes.map((entry) => entry.tier)), new Set(['Base', 'Beginner', 'Specialty', 'Advanced', 'Master', 'Divine']))
  assert.ok(rawRoster.classes.every((entry: object) => !('growths' in entry)))
  assert.equal(roster.source.sourceVersion, '29609cc76a0a79a86473ef1e0980771e94c97640')
  assert.equal(roster.source.retrievedAt, '2026-09-30')
  assert.equal(roster.source.gameVersion, null)
})

test('class correspondences cover every upstream class with distinct Japanese names and traceable proof', () => {
  const roster = validateClassRoster(rawRoster)
  const dataset = validateAndMergeClassNames(rawNames, roster.classes)
  assert.equal(dataset.classes.length, 59)
  assert.equal(new Set(dataset.classes.map((entry) => entry.japaneseName)).size, 59)
  assert.deepEqual(dataset.sources.find((source) => source.id === roster.source.id), roster.source)
  for (const entry of dataset.classes) {
    assert.equal(entry.status, 'verified')
    assert.ok(entry.japaneseName)
    assert.ok(entry.sourceIds.includes(roster.source.id))
    assert.ok(entry.sourceIds.includes('gamewith-class-list-ja'))
    assert.equal(entry.checkedAt, '2026-09-30')
    assert.match(entry.note, /区分|職/)
    assert.match(entry.note, /確認済は名前の対応のみ/)
  }
})

test('localized class names are explicit mappings rather than machine translations', () => {
  const dataset = validateAndMergeClassNames(rawNames, validateClassRoster(rawRoster).classes)
  const names = new Map(dataset.classes.map((entry) => [entry.englishName, entry.japaneseName]))
  assert.equal(names.get('Pugilist'), 'セスタス')
  assert.equal(names.get('Dreadnought'), 'ヘヴィアーマー')
  assert.equal(names.get('High Savant'), 'ハイエピタフ')
  assert.equal(names.get('Bau Lord'), 'ドラゴンマスター')
  assert.equal(names.get('The Apsara'), 'ジ・アプサラス')
})

test('known numerical discrepancies remain documented separately from name verification', () => {
  const dataset = validateAndMergeClassNames(rawNames, validateClassRoster(rawRoster).classes)
  const differences = dataset.classes.filter((entry) => entry.note.includes('差異：'))
  assert.equal(differences.length, 17)
  for (const entry of differences) {
    assert.match(entry.note, /英語JSON/)
    assert.match(entry.note, /日本語表/)
    assert.match(entry.note, /ゲーム内の数値は未照合/)
  }
  const ornius = dataset.classes.find((entry) => entry.id === 'Ornius Rider')!
  assert.match(ornius.note, /技は英語JSON 5・日本語表 0/)
  assert.match(ornius.note, /Mount\/Dismount/)
  for (const id of ['Ornius Rider', 'Armored Knight', 'Dreadnought', 'Elephant Rider']) {
    assert.ok(dataset.classes.find((entry) => entry.id === id)!.sourceIds.includes('game8-class-list-en'))
  }
})

test('a newly added or unmapped class remains null and unverified', () => {
  const roster = validateClassRoster(rawRoster).classes
  const result = validateAndMergeClassNames({ sources: rawNames.sources, mappings: [] }, roster)
  assert.equal(result.classes.length, 59)
  for (const entry of result.classes) {
    assert.equal(entry.japaneseName, null)
    assert.equal(entry.status, 'unverified')
    assert.equal(entry.checkedAt, null)
    assert.deepEqual(entry.sourceIds, [])
  }
})

test('class roster rejects damaged identities, missing tiers and invalid provenance', () => {
  const duplicate = structuredClone(rawRoster)
  duplicate.classes.push(duplicate.classes[0])
  assert.throws(() => validateClassRoster(duplicate), /duplicate id/)
  const renamed = structuredClone(rawRoster)
  renamed.classes[0].name = 'Translated ID'
  assert.throws(() => validateClassRoster(renamed), /preserve the upstream class key/)
  const badTier = structuredClone(rawRoster)
  badTier.classes[0].tier = null
  assert.throws(() => validateClassRoster(badTier), /tier/)
  const badSource = structuredClone(rawRoster)
  badSource.source.retrievedAt = '2026-02-30'
  assert.throws(() => validateClassRoster(badSource), /valid YYYY-MM-DD date/)
  const missingVersion = structuredClone(rawRoster)
  delete missingVersion.source.gameVersion
  assert.throws(() => validateClassRoster(missingVersion), /gameVersion/)
  assert.throws(() => validateClassRoster({ ...rawRoster, schemaVersion: 2 }), /schemaVersion/)
  assert.throws(() => validateClassRoster({ ...rawRoster, classes: [] }), /non-empty array/)
})

test('class mapping validation rejects unknown class keys and unsupported verified translations', () => {
  const roster = validateClassRoster(rawRoster).classes
  const unknown = structuredClone(rawNames)
  unknown.mappings[0].classId = 'Noble'
  assert.throws(() => validateAndMergeClassNames(unknown, roster), /unknown/)
  const unsupported = structuredClone(rawNames)
  unsupported.mappings[0].sourceIds = ['fortunes-weave-classes-en']
  assert.throws(() => validateAndMergeClassNames(unsupported, roster), /verified names require/)
})
