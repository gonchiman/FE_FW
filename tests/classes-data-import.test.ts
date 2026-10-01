import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { importClassSnapshot } from '../scripts/lib/import-classes.ts'

const raw = JSON.parse(readFileSync(new URL('../data/sources/fortunes-weave-class-details.json', import.meta.url), 'utf8'))
const statMapping = { HP: 'hp', Str: 'str', Mag: 'mag', Dex: 'dex', Spd: 'spd', Lck: 'lck', Def: 'def', Res: 'res', Cha: 'cha' } as const

function fixture() {
  return structuredClone(raw)
}

test('preserves all 531 JSON growth values and all 522 recorded bonuses by named stat', () => {
  const input = fixture()
  const before = structuredClone(input)
  const result = importClassSnapshot(input)
  assert.deepEqual(input, before)
  assert.equal(result.classes.length, 59)
  let checkedGrowths = 0
  let checkedBonuses = 0
  for (const item of result.classes) {
    for (const [source, local] of Object.entries(statMapping)) {
      assert.equal(item.growths[local], raw.classes[item.id].growths[source], `${item.id}.${source}`)
      checkedGrowths += 1
    }
    for (const row of raw.database.growths.filter((row: { class: string; kind: string }) => row.class === item.id && row.kind === 'bonus')) {
      assert.equal(item.bonuses[statMapping[row.stat as keyof typeof statMapping]], row.value)
      checkedBonuses += 1
    }
  }
  assert.equal(checkedGrowths, 531)
  assert.equal(checkedBonuses, 522)
  const roster = JSON.parse(readFileSync(new URL('../data/sources/fortunes-weave-classes.json', import.meta.url), 'utf8'))
  assert.deepEqual(result.classes.map(({ id, name, tier }) => ({ id, name, tier })), roster.classes.toSorted((a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
})

test('keeps Commoner gaps, missing Elephant Rider weapons and Warrior TBD effect unknown', () => {
  const result = importClassSnapshot(fixture())
  const commoner = result.classes.find(item => item.id === 'Commoner')!
  assert.deepEqual(Object.values(commoner.growths), Array(9).fill(0))
  assert.deepEqual(Object.values(commoner.bonuses), Array(9).fill(null))
  for (const field of ['unitType', 'movement', 'weapons', 'abilities', 'masterSkills', 'sourcePageUrl'] as const) assert.equal(commoner[field], null)
  assert.equal(result.classes.find(item => item.id === 'Elephant Rider')!.weapons, null)
  assert.deepEqual(result.classes.find(item => item.id === 'Warrior')!.masterSkills, [{ name: 'Practiced Art', effect: null }])
  assert.equal(result.classes.filter(item => item.sourcePageUrl !== null).length, 58)
  assert.equal(result.classes.filter(item => item.abilities !== null).length, 54)
  assert.equal(result.classes.filter(item => item.masterSkills !== null).length, 58)
})

test('imports every class ability row, removing only exact repeated image-alt names', () => {
  const input = fixture()
  const result = importClassSnapshot(input)
  const myrmidon = result.classes.find(item => item.id === 'Myrmidon')!
  assert.deepEqual(myrmidon.abilities, [
    { name: 'Combat Arts +1', effect: 'Unit can equip +1 combat arts.' },
    { name: 'Sword Crit +3', effect: 'When equipped with a sword, grants Crit +3.' },
  ])
  assert.equal(myrmidon.bonuses.res, -1)
  for (const detail of input.database.classes) {
    const item = result.classes.find(item => item.id === detail.name)!
    const abilityTable = input.database.tables.find((table: { page_id: string; heading: string }) => table.page_id === detail.page_id && table.heading === 'Class Ability')
    if (abilityTable) assert.equal(item.abilities!.length, JSON.parse(abilityTable.rows).length, item.name)
  }
  // The lossy convenience field must never take precedence over the original table.
  input.database.classes.find((row: { name: string }) => row.name === 'Myrmidon').class_ability = 'Incorrect first ability'
  assert.deepEqual(importClassSnapshot(input).classes.find(item => item.id === 'Myrmidon')!.abilities, myrmidon.abilities)
})

test('preserves explicit negative and null growth values consistently recorded in both files', () => {
  for (const value of [-5, null, 0]) {
    const input = fixture()
    input.classes.Myrmidon.growths.Res = value
    input.database.classes.find((row: { name: string }) => row.name === 'Myrmidon').growth_res = value
    input.database.growths.find((row: { class: string; stat: string; kind: string }) => row.class === 'Myrmidon' && row.stat === 'Res' && row.kind === 'growth').value = value
    const result = importClassSnapshot(input)
    assert.equal(result.classes.find(item => item.id === 'Myrmidon')!.growths.res, value)
  }
})

test('rejects malformed or inconsistent provenance', () => {
  for (const patch of [
    { repository: 'other/repo' }, { sourceVersion: 'main' }, { gameVersion: undefined },
    { retrievedAt: '2026-10-01' }, { retrievedAt: '2026-02-30T12:00:00Z' }, { files: [] },
  ]) {
    const input = fixture()
    Object.assign(input.provenance, patch)
    assert.throws(() => importClassSnapshot(input))
  }
  for (const patch of [{ path: 'data/other.json' }, { sha256: 'missing' }, { url: 'https://example.com/file' }]) {
    const input = fixture()
    Object.assign(input.provenance.files[0], patch)
    assert.throws(() => importClassSnapshot(input))
  }
  const duplicate = fixture()
  duplicate.provenance.files[1] = duplicate.provenance.files[0]
  assert.throws(() => importClassSnapshot(duplicate), /unique source file/)
})

test('rejects missing, duplicate, invalid and conflicting numeric rows', () => {
  for (const value of ['5', undefined, NaN, Infinity]) {
    const input = fixture()
    input.classes.Myrmidon.growths.Res = value
    assert.throws(() => importClassSnapshot(input), /growths.Res/)
  }
  const missing = fixture()
  missing.database.growths.pop()
  assert.throws(() => importClassSnapshot(missing), /is missing/)
  const duplicate = fixture()
  duplicate.database.growths.push(duplicate.database.growths[0])
  assert.throws(() => importClassSnapshot(duplicate), /duplicate stat/)
  const inconsistent = fixture()
  inconsistent.classes.Myrmidon.growths.Res = 99
  assert.throws(() => importClassSnapshot(inconsistent), /disagrees/)
  const invalidStat = fixture()
  invalidStat.database.growths[0].stat = 'Unknown'
  assert.throws(() => importClassSnapshot(invalidStat), /stat is unknown/)
  const invalidClass = fixture()
  invalidClass.database.classes[0].name = 'Nonexistent'
  assert.throws(() => importClassSnapshot(invalidClass), /unknown class/)
  const invalidMovement = fixture()
  invalidMovement.database.classes[0].movement = '5 miles'
  assert.throws(() => importClassSnapshot(invalidMovement), /non-negative integer/)
})

test('rejects malformed skill tables and duplicate or foreign page references', () => {
  for (const patch of [{ rows: '{}' }, { rows: 'broken JSON' }, { rows: '[["name"]]' }, { rows: '[["name",10]]' }]) {
    const input = fixture()
    const table = input.database.tables.find((table: { heading: string }) => table.heading === 'Class Ability')
    Object.assign(table, patch)
    assert.throws(() => importClassSnapshot(input))
  }
  const duplicate = fixture()
  duplicate.database.tables.push(duplicate.database.tables[0])
  assert.throws(() => importClassSnapshot(duplicate), /duplicate table/)
  const foreign = fixture()
  foreign.database.tables[0].page_id = '999999999'
  assert.throws(() => importClassSnapshot(foreign), /unknown page/)
  const missingPage = fixture()
  missingPage.database.pages.pop()
  assert.throws(() => importClassSnapshot(missingPage), /every recorded class detail page/)
})

test('generated data and source fingerprints match the recorded fixed revision', () => {
  const result = importClassSnapshot(fixture())
  const generated = JSON.parse(readFileSync(new URL('../src/data/class-details.json', import.meta.url), 'utf8'))
  assert.deepEqual(generated, result)
  assert.ok(result.sources.every(source => source.sourceVersion === '29609cc76a0a79a86473ef1e0980771e94c97640' && source.gameVersion === null))
  assert.deepEqual(raw.provenance.files.map((file: { sha256: string }) => file.sha256), [
    '5a15eedbb9b49dafb879866cb2777d78ecb6a0aa5b1c729984fd43118a1cbfd7',
    '76ebb18b819de3423c2db5a4d93a69443d990588c28f11907be7e1c23bffed94',
  ])
})
