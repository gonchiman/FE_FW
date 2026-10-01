import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterAndSortGrowthCharacters, getGrowthCharacterName, normalizeGrowthSearch, validateGrowthDataset } from '../src/lib/growth.ts'
import { GROWTH_STATS, type CharacterGrowth, type GrowthDataset, type StatKey } from '../src/types/growth.ts'

function character(id: string, name: string, hp: number | null): CharacterGrowth {
  const rates = Object.fromEntries(GROWTH_STATS.map(({ key }) => [key, null])) as Record<StatKey, number | null>
  rates.hp = hp
  return { id, name, sourceId: 'source', status: 'sample', rates }
}

function dataset(): GrowthDataset {
  return {
    sources: [{
      id: 'source', name: 'Test fixture', url: null, retrievedAt: null,
      sourceVersion: null, gameVersion: null, note: '',
    }],
    characters: [character('one', 'サンプルA', 0), character('two', 'サンプルB', null)],
  }
}

test('validation preserves confirmed zero and unknown null separately', () => {
  const input = dataset()
  const result = validateGrowthDataset(input)
  assert.equal(result.characters[0].rates.hp, 0)
  assert.equal(result.characters[1].rates.hp, null)
  assert.equal(result.characters[0].rates.str, null)
  assert.deepEqual(result, input)
  assert.notEqual(result.characters[0].rates, input.characters[0].rates)
})

test('validation accepts empty datasets and rates above 100 without imposing a game rule', () => {
  assert.deepEqual(validateGrowthDataset({ sources: [], characters: [] }), { sources: [], characters: [] })
  const input = dataset()
  input.characters[0].rates.hp = 125.5
  assert.equal(validateGrowthDataset(input).characters[0].rates.hp, 125.5)
})

test('validation rejects missing, non-finite, negative, or nonnumeric rates', () => {
  for (const rate of [undefined, Number.NaN, Infinity, -Infinity, -1, '0', false]) {
    const input = dataset()
    ;(input.characters[0].rates as Record<string, unknown>).hp = rate
    assert.throws(() => validateGrowthDataset(input), /characters\[0\]\.rates\.hp/)
  }
  const missingColumn = dataset()
  delete (missingColumn.characters[0].rates as Partial<CharacterGrowth['rates']>).cha
  assert.throws(() => validateGrowthDataset(missingColumn), /rates\.cha/)
})

test('validation rejects duplicate ids and unknown source references', () => {
  const duplicateSource = dataset()
  duplicateSource.sources.push({ ...duplicateSource.sources[0] })
  assert.throws(() => validateGrowthDataset(duplicateSource), /duplicate id/)

  const duplicateCharacter = dataset()
  duplicateCharacter.characters.push({ ...duplicateCharacter.characters[0] })
  assert.throws(() => validateGrowthDataset(duplicateCharacter), /duplicate id/)

  const missingSource = dataset()
  missingSource.characters[0].sourceId = 'missing'
  assert.throws(() => validateGrowthDataset(missingSource), /unknown source/)
})

test('validation rejects malformed dataset shape, status, and required metadata', () => {
  for (const input of [null, [], {}, { sources: {}, characters: [] }, { sources: [], characters: null }]) {
    assert.throws(() => validateGrowthDataset(input), TypeError)
  }

  const badStatus = dataset()
  ;(badStatus.characters[0] as unknown as Record<string, unknown>).status = 'confirmed'
  assert.throws(() => validateGrowthDataset(badStatus), /status/)

  const missingVersion = dataset()
  delete (missingVersion.sources[0] as unknown as Record<string, unknown>).gameVersion
  assert.throws(() => validateGrowthDataset(missingVersion), /gameVersion/)

  const blankId = dataset()
  blankId.characters[0].id = '  '
  assert.throws(() => validateGrowthDataset(blankId), /id/)
})

test('search normalizes width, case, whitespace, and hiragana/katakana', () => {
  assert.equal(normalizeGrowthSearch('  ｻﾝﾌﾟﾙＡ  '), 'さんぷるa')
  const characters = [character('a', 'サンプルＡ', 20), character('b', 'サンプルB', 30)]
  for (const query of ['ｻﾝﾌﾟﾙa', 'さんぷるＡ', '  サンプルa  ', 'Ａ']) {
    assert.deepEqual(filterAndSortGrowthCharacters(characters, query).map(({ id }) => id), ['a'])
  }
  assert.equal(filterAndSortGrowthCharacters(characters, 'missing').length, 0)
  assert.equal(filterAndSortGrowthCharacters(characters, '   ').length, 2)
  assert.deepEqual(filterAndSortGrowthCharacters([], ''), [])
})

test('numeric sorting keeps null last in both directions and includes zero', () => {
  const characters = [character('unknown', 'Unknown', null), character('high', 'High', 80), character('zero', 'Zero', 0)]
  assert.deepEqual(filterAndSortGrowthCharacters(characters, '', { key: 'hp', direction: 'asc' }).map(({ id }) => id),
    ['zero', 'high', 'unknown'])
  assert.deepEqual(filterAndSortGrowthCharacters(characters, '', { key: 'hp', direction: 'desc' }).map(({ id }) => id),
    ['high', 'zero', 'unknown'])
})

test('equal rates and nulls have deterministic ascending name and id tie breakers', () => {
  const characters = [
    character('b2', 'Beta', 40), character('a', 'Alpha', 40), character('b1', 'Beta', 40),
    character('u2', 'Delta', null), character('u1', 'Charlie', null),
  ]
  for (const direction of ['asc', 'desc'] as const) {
    assert.deepEqual(filterAndSortGrowthCharacters(characters, '', { key: 'hp', direction }).map(({ id }) => id),
      ['a', 'b1', 'b2', 'u1', 'u2'])
  }
})

test('name sorting supports both directions with stable equal-name ids', () => {
  const characters = [character('b2', 'Beta', 1), character('a', 'Alpha', 2), character('b1', 'Beta', 3)]
  assert.deepEqual(filterAndSortGrowthCharacters(characters).map(({ id }) => id), ['a', 'b1', 'b2'])
  assert.deepEqual(filterAndSortGrowthCharacters(characters, '', { key: 'name', direction: 'desc' }).map(({ id }) => id),
    ['b1', 'b2', 'a'])
})

test('filtering and sorting never mutate input arrays or rates', () => {
  const characters = [character('b', 'Beta', 20), character('a', 'Alpha', 10)]
  const before = structuredClone(characters)
  for (const entry of characters) {
    Object.freeze(entry.rates)
    Object.freeze(entry)
  }
  Object.freeze(characters)
  const result = filterAndSortGrowthCharacters(characters, '', { key: 'hp', direction: 'asc' })
  assert.deepEqual(characters, before)
  assert.notEqual(result, characters)
  assert.deepEqual(result.map(({ id }) => id), ['a', 'b'])
})

test('display names are resolved by character id and fall back to the original name', () => {
  const displayNames = new Map([['mapped', 'アリス']])
  assert.equal(getGrowthCharacterName(character('mapped', 'Alice', 20), displayNames), 'アリス')
  assert.equal(getGrowthCharacterName(character('missing', 'Alice', 20), displayNames), 'Alice')
  assert.equal(getGrowthCharacterName(character('mapped', 'Alice', 20)), 'Alice')
})

test('localized growth searches accept Japanese variants and retain English name searches', () => {
  const characters = [character('alice', 'Alice', 20), character('bob', 'Bob', 30)]
  const displayNames = new Map([['alice', 'アリス']])
  for (const query of ['アリス', 'ありす', 'ｱﾘｽ', '  アリ  ', 'ALICE', 'ａｌｉｃｅ', 'ice']) {
    assert.deepEqual(filterAndSortGrowthCharacters(characters, query, undefined, displayNames).map(({ id }) => id), ['alice'])
  }
  assert.deepEqual(filterAndSortGrowthCharacters(characters, 'BOB', undefined, displayNames).map(({ id }) => id), ['bob'])
  assert.deepEqual(filterAndSortGrowthCharacters(characters, 'missing', undefined, displayNames), [])
})

test('name sorting follows Japanese display names in both directions with stable id ties', () => {
  const characters = [
    character('i2', 'Alpha', 20), character('a', 'Zulu', 30), character('i1', 'Beta', 40),
  ]
  const displayNames = new Map([['a', 'アリス'], ['i1', 'イリス'], ['i2', 'イリス']])
  assert.deepEqual(filterAndSortGrowthCharacters(characters, '', { key: 'name', direction: 'asc' }, displayNames).map(({ id }) => id),
    ['a', 'i1', 'i2'])
  assert.deepEqual(filterAndSortGrowthCharacters(characters, '', { key: 'name', direction: 'desc' }, displayNames).map(({ id }) => id),
    ['i1', 'i2', 'a'])
})

test('numeric sorts use display names for ties and keep unknown rates last', () => {
  const characters = [
    character('u-i', 'Alpha', null), character('i2', 'Beta', 40), character('high', 'Gamma', 80),
    character('u-a', 'Zulu', null), character('a', 'Zulu', 40), character('i1', 'Delta', 40),
    character('zero', 'Zero', 0),
  ]
  const displayNames = new Map([
    ['u-a', 'アリス'], ['u-i', 'イリス'], ['a', 'アリス'], ['i1', 'イリス'], ['i2', 'イリス'],
  ])
  assert.deepEqual(filterAndSortGrowthCharacters(characters, '', { key: 'hp', direction: 'asc' }, displayNames).map(({ id }) => id),
    ['zero', 'a', 'i1', 'i2', 'high', 'u-a', 'u-i'])
  assert.deepEqual(filterAndSortGrowthCharacters(characters, '', { key: 'hp', direction: 'desc' }, displayNames).map(({ id }) => id),
    ['high', 'a', 'i1', 'i2', 'zero', 'u-a', 'u-i'])
})

test('localized filtering and sorting preserve original records and the supplied name mappings', () => {
  const characters = [character('b', 'Beta', 20), character('a', 'Alpha', 10)]
  const displayNames = new Map([['a', 'イリス'], ['b', 'アリス']])
  const before = structuredClone(characters)
  const namesBefore = [...displayNames]
  for (const entry of characters) {
    Object.freeze(entry.rates)
    Object.freeze(entry)
  }
  Object.freeze(characters)
  const result = filterAndSortGrowthCharacters(characters, 'りす', undefined, displayNames)
  assert.deepEqual(result.map(({ id }) => id), ['b', 'a'])
  assert.equal(result[0], characters[0])
  assert.deepEqual(characters, before)
  assert.deepEqual([...displayNames], namesBefore)
  assert.notEqual(result, characters)
})
