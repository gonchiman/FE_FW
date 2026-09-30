import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { importGrowthSnapshot } from '../scripts/lib/import-growths.ts'

const revision = '29609cc76a0a79a86473ef1e0980771e94c97640'
const provenance = {
  repository: 'Rico0319/Fortunes-Weave-Helper',
  revision,
  path: 'data/fwe.json',
  fileBlobSha: '2e86835071c96f4725696f2659a02191de88affa',
  retrievedAt: '2026-09-30T05:36:34Z',
  upstreamUrl: `https://github.com/Rico0319/Fortunes-Weave-Helper/blob/${revision}/data/fwe.json`,
  originalSourceUrl: 'https://game8.co/games/Fire-Emblem-Fortunes-Weave',
  gameVersion: null,
}

function makeSnapshot() {
  return {
    provenance: { ...provenance },
    units: {
      Alpha: {
        name: 'Alpha',
        // Deliberately keep a different order from the displayed stat columns.
        growths: { Cha: 9, Res: 8, HP: 1, Str: 2, Mag: 0, Spd: 5, Dex: 4, Def: 7, Lck: null },
      },
    },
  }
}

test('maps named stats without relying on order and preserves explicit zero and null', () => {
  const snapshot = makeSnapshot()
  const before = structuredClone(snapshot)
  const actual = importGrowthSnapshot(snapshot)
  assert.deepEqual(actual.characters, [{
    id: 'fwe-alpha', name: 'Alpha', sourceId: 'fortunes-weave-helper', status: 'unverified',
    rates: { hp: 1, str: 2, mag: 0, dex: 4, spd: 5, lck: null, def: 7, res: 8, cha: 9 },
  }])
  assert.equal(actual.sources[0].url, provenance.upstreamUrl)
  assert.equal(actual.sources[0].sourceVersion, revision)
  assert.equal(actual.sources[0].retrievedAt, provenance.retrievedAt)
  assert.equal(actual.sources[0].gameVersion, null)
  assert.deepEqual(snapshot, before)
})

test('orders characters deterministically regardless of snapshot insertion order', () => {
  const { provenance, units: { Alpha } } = makeSnapshot()
  const Beta = { ...Alpha, name: 'Beta' }
  assert.deepEqual(
    importGrowthSnapshot({ provenance, units: { Beta, Alpha } }),
    importGrowthSnapshot({ provenance, units: { Alpha, Beta } }),
  )
})

test('rejects invalid or missing rates instead of making them zero', () => {
  for (const value of [undefined, '35', -1, NaN, Infinity, false]) {
    const snapshot = makeSnapshot()
    Object.assign(snapshot.units.Alpha.growths, { Spd: value })
    assert.throws(() => importGrowthSnapshot(snapshot), /growths.Spd/)
  }
  const missing = makeSnapshot()
  Reflect.deleteProperty(missing.units.Alpha.growths, 'Spd')
  assert.throws(() => importGrowthSnapshot(missing), /nine growth stats/)
  const extra = makeSnapshot()
  Object.assign(extra.units.Alpha.growths, { Total: 36 })
  assert.throws(() => importGrowthSnapshot(extra), /nine growth stats/)
})

test('rejects mismatched names, empty inputs, and normalized identifier collisions', () => {
  const snapshot = makeSnapshot()
  snapshot.units.Alpha.name = 'Beta'
  assert.throws(() => importGrowthSnapshot(snapshot), /must match its unit key/)
  assert.throws(() => importGrowthSnapshot({ provenance, units: {} }), /at least one/)
  const { units: { Alpha } } = makeSnapshot()
  assert.throws(() => importGrowthSnapshot({ provenance, units: {
    'A B': { ...Alpha, name: 'A B' },
    'A-B': { ...Alpha, name: 'A-B' },
  } }), /duplicate identifier/)
})

test('rejects malformed or inconsistent provenance', () => {
  const invalidProvenance = [
    { revision: 'main' },
    { fileBlobSha: null },
    { retrievedAt: '2026-09-30' },
    { retrievedAt: '2026-99-99T00:00:00Z' },
    { originalSourceUrl: 'http://game8.co/article' },
    { originalSourceUrl: 'https://user:password@game8.co/article' },
    { upstreamUrl: 'https://github.com/Rico0319/Fortunes-Weave-Helper/blob/main/data/fwe.json' },
    { path: 'other.json' },
    { repository: 'other/repository' },
    { gameVersion: undefined },
  ]
  for (const invalid of invalidProvenance) {
    const snapshot = makeSnapshot()
    Object.assign(snapshot.provenance, invalid)
    assert.throws(() => importGrowthSnapshot(snapshot))
  }
})

test('all 62 recorded characters preserve all 558 individual growth values', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../data/sources/fortunes-weave-growths.json', import.meta.url), 'utf8'))
  const dataset = importGrowthSnapshot(snapshot)
  const statMapping = { hp: 'HP', str: 'Str', mag: 'Mag', dex: 'Dex', spd: 'Spd', lck: 'Lck', def: 'Def', res: 'Res', cha: 'Cha' }
  assert.equal(Object.keys(snapshot.units).length, 62)
  assert.equal(dataset.characters.length, 62)
  let comparedValues = 0
  for (const character of dataset.characters) {
    assert.equal(character.status, 'unverified')
    const recorded = snapshot.units[character.name]
    assert.ok(recorded, character.name)
    for (const [key, upstreamKey] of Object.entries(statMapping)) {
      assert.equal(character.rates[key as keyof typeof character.rates], recorded.growths[upstreamKey], `${character.name}.${key}`)
      comparedValues += 1
    }
  }
  assert.equal(comparedValues, 558)
})

test('checked-in display data is exactly the generated snapshot projection', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../data/sources/fortunes-weave-growths.json', import.meta.url), 'utf8'))
  const actual = JSON.parse(readFileSync(new URL('../src/data/character-growths.json', import.meta.url), 'utf8'))
  assert.deepEqual(actual, importGrowthSnapshot(snapshot))
})
