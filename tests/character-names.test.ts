import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { filterAndSortCharacterNames, validateAndMergeCharacterNames } from '../src/lib/character-names.ts'
import { validateGrowthDataset } from '../src/lib/growth.ts'
import type { CharacterName, CharacterNameMapping, NameSource } from '../src/types/character-names.ts'

const roster = [
  { id: 'fwe-cai', name: 'Cai' },
  { id: 'fwe-leda', name: 'Leda' },
  { id: 'fwe-unknown', name: 'Unknown' },
]

function input(): { sources: NameSource[]; mappings: CharacterNameMapping[] } {
  return {
    sources: [
      {
        id: 'ja', language: 'ja', name: '日本語の公式紹介', url: 'https://example.com/ja',
        retrievedAt: '2026-09-30', sourceVersion: null, gameVersion: null,
      },
      {
        id: 'en', language: 'en', name: 'English official introduction', url: 'https://example.com/en',
        retrievedAt: '2026-09-30', sourceVersion: null, gameVersion: null,
      },
    ],
    mappings: [{
      characterId: 'fwe-cai', japaneseName: 'カイ', status: 'verified',
      sourceIds: ['ja', 'en'], checkedAt: '2026-09-30', note: '人物紹介で対応を確認。',
    }],
  }
}

function character(id: string, englishName: string, japaneseName: string | null): CharacterName {
  return {
    id, englishName, japaneseName, status: japaneseName === null ? 'unverified' : 'verified',
    sourceIds: japaneseName === null ? [] : ['ja', 'en'],
    checkedAt: japaneseName === null ? null : '2026-09-30', note: '',
  }
}

test('merge adds unknown names for unmapped roster entries without changing growth verification status', () => {
  const growthRoster = roster.map((entry) => ({ ...entry, status: 'unverified' }))
  const source = input()
  const before = structuredClone(source)
  const result = validateAndMergeCharacterNames(source, growthRoster)
  assert.deepEqual(result.characters, [
    { ...character('fwe-cai', 'Cai', 'カイ'), note: '人物紹介で対応を確認。' },
    character('fwe-leda', 'Leda', null),
    character('fwe-unknown', 'Unknown', null),
  ])
  assert.deepEqual(source, before)
  assert.deepEqual(growthRoster.map(({ status }) => status), ['unverified', 'unverified', 'unverified'])
  assert.notEqual(result.sources[0], source.sources[0])
  assert.notEqual(result.characters[0].sourceIds, source.mappings[0].sourceIds)
  assert.notEqual(result.characters[1].sourceIds, result.characters[2].sourceIds)
  assert.deepEqual(validateAndMergeCharacterNames({ sources: [], mappings: [] }, []), { sources: [], characters: [] })
})

test('merge rejects duplicate character mappings, roster ids, source ids, and source references', () => {
  const duplicateMapping = input()
  duplicateMapping.mappings.push({ ...duplicateMapping.mappings[0] })
  assert.throws(() => validateAndMergeCharacterNames(duplicateMapping, roster), /duplicate id/)

  const duplicateSource = input()
  duplicateSource.sources.push({ ...duplicateSource.sources[0] })
  assert.throws(() => validateAndMergeCharacterNames(duplicateSource, roster), /duplicate id/)

  const duplicateReference = input()
  duplicateReference.mappings[0].sourceIds.push('ja')
  assert.throws(() => validateAndMergeCharacterNames(duplicateReference, roster), /duplicate id/)
  assert.throws(() => validateAndMergeCharacterNames(input(), [...roster, roster[0]]), /duplicate id/)
})

test('merge rejects orphan character and source references', () => {
  const unknownCharacter = input()
  unknownCharacter.mappings[0].characterId = 'missing'
  assert.throws(() => validateAndMergeCharacterNames(unknownCharacter, roster), /unknown character/)

  const unknownSource = input()
  unknownSource.mappings[0].sourceIds.push('missing')
  assert.throws(() => validateAndMergeCharacterNames(unknownSource, roster), /unknown source/)
})

test('verified mappings require a Japanese name, both source languages, and a checked date', () => {
  for (const sourceIds of [[], ['ja'], ['en']]) {
    const source = input()
    source.mappings[0].sourceIds = sourceIds
    assert.throws(() => validateAndMergeCharacterNames(source, roster), /verified names require/)
  }
  const noJapanese = input()
  noJapanese.mappings[0].japaneseName = null
  assert.throws(() => validateAndMergeCharacterNames(noJapanese, roster), /verified names require/)

  const noDate = input()
  noDate.mappings[0].checkedAt = null
  assert.throws(() => validateAndMergeCharacterNames(noDate, roster), /verified names require/)
})

test('verified mappings accept one cited bilingual source while retaining required name and date', () => {
  const source = input()
  source.sources = [{ ...source.sources[0], id: 'bilingual', language: 'ja-en' }]
  source.mappings[0].sourceIds = ['bilingual']
  const result = validateAndMergeCharacterNames(source, roster)
  assert.equal(result.sources[0].language, 'ja-en')
  assert.equal(result.characters[0].status, 'verified')
  assert.deepEqual(result.characters[0].sourceIds, ['bilingual'])

  const noJapanese = structuredClone(source)
  noJapanese.mappings[0].japaneseName = null
  assert.throws(() => validateAndMergeCharacterNames(noJapanese, roster), /verified names require/)
  const noDate = structuredClone(source)
  noDate.mappings[0].checkedAt = null
  assert.throws(() => validateAndMergeCharacterNames(noDate, roster), /verified names require/)
})

test('verified mappings retain a concrete evidence note', () => {
  for (const note of ['', '   ']) {
    const source = input()
    source.mappings[0].note = note
    assert.throws(() => validateAndMergeCharacterNames(source, roster), /non-empty evidence note/)
  }
})

test('unverified mappings preserve unknown names and dates as null', () => {
  const source = input()
  source.mappings[0] = {
    characterId: 'fwe-cai', japaneseName: null, status: 'unverified', sourceIds: [], checkedAt: null, note: '',
  }
  assert.deepEqual(validateAndMergeCharacterNames(source, roster).characters[0], character('fwe-cai', 'Cai', null))
  source.mappings[0].japaneseName = 'カイ'
  assert.throws(() => validateAndMergeCharacterNames(source, roster), /unverified names must have null/)
  source.mappings[0].japaneseName = null
  source.mappings[0].checkedAt = '2026-09-30'
  assert.throws(() => validateAndMergeCharacterNames(source, roster), /unverified names must have null/)
})

test('metadata dates must represent actual calendar days', () => {
  for (const date of ['2026-02-29', '2026-09-31', '2026-13-01', '2026-00-01', '2026-1-01', '2026-09-30T00:00:00Z', 'invalid']) {
    const badRetrieval = input()
    badRetrieval.sources[0].retrievedAt = date
    assert.throws(() => validateAndMergeCharacterNames(badRetrieval, roster), /retrievedAt/)
    const badChecked = input()
    badChecked.mappings[0].checkedAt = date
    assert.throws(() => validateAndMergeCharacterNames(badChecked, roster), /checkedAt/)
  }
  const leapDay = input()
  leapDay.sources[0].retrievedAt = '2024-02-29'
  leapDay.mappings[0].checkedAt = '2024-02-29'
  assert.equal(validateAndMergeCharacterNames(leapDay, roster).characters[0].checkedAt, '2024-02-29')
})

test('source links must be valid HTTPS URLs without credentials or hidden control characters', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', '/relative',
    'https://user:password@example.com', ' https://example.com', 'https://exa\nmple.com', 'https://exa\u0001mple.com',
    'https:\\example.com', 'https://']) {
    const source = input()
    source.sources[0].url = url
    assert.throws(() => validateAndMergeCharacterNames(source, roster), /HTTPS URL/)
  }
  const source = input()
  source.sources[0].url = 'https://example.com/characters?lang=ja#cai'
  assert.equal(validateAndMergeCharacterNames(source, roster).sources[0].url, source.sources[0].url)
})

test('merge rejects malformed input and missing or invalid metadata', () => {
  for (const source of [null, [], {}, { sources: {}, mappings: [] }, { sources: [], mappings: null }]) {
    assert.throws(() => validateAndMergeCharacterNames(source, roster), TypeError)
  }
  for (const [field, value] of [['language', 'fr'], ['gameVersion', undefined], ['retrievedAt', null], ['name', ' ']] as const) {
    const source = input()
    ;(source.sources[0] as unknown as Record<string, unknown>)[field] = value
    assert.throws(() => validateAndMergeCharacterNames(source, roster), TypeError)
  }
  for (const [field, value] of [['status', 'confirmed'], ['japaneseName', ' '], ['note', undefined], ['sourceIds', null]] as const) {
    const source = input()
    ;(source.mappings[0] as unknown as Record<string, unknown>)[field] = value
    assert.throws(() => validateAndMergeCharacterNames(source, roster), TypeError)
  }
  assert.throws(() => validateAndMergeCharacterNames(input(), [{ id: ' ', name: 'Cai' }]), TypeError)
})

test('search matches Japanese or English names with width, case, and kana normalization', () => {
  const characters = [character('cai', 'Cai', 'カイ'), character('leda', 'Leda', 'レダ'), character('unknown', 'Unknown', null)]
  for (const query of ['CAI', 'ｃａｉ', '  Cai  ', 'かい', 'ｶｲ']) {
    assert.deepEqual(filterAndSortCharacterNames(characters, query).map(({ id }) => id), ['cai'])
  }
  assert.deepEqual(filterAndSortCharacterNames(characters, 'unknown').map(({ id }) => id), ['unknown'])
  assert.equal(filterAndSortCharacterNames(characters, '   ').length, 3)
  assert.deepEqual(filterAndSortCharacterNames(characters, 'not found'), [])
})

test('status filtering combines with name search', () => {
  const characters = [character('cai', 'Cai', 'カイ'), character('cal', 'Cal', null), character('unknown', 'Unknown', null)]
  assert.deepEqual(filterAndSortCharacterNames(characters, 'ca', 'all').map(({ id }) => id), ['cai', 'cal'])
  assert.deepEqual(filterAndSortCharacterNames(characters, 'ＣＡ', 'verified').map(({ id }) => id), ['cai'])
  assert.deepEqual(filterAndSortCharacterNames(characters, 'ca', 'unverified').map(({ id }) => id), ['cal'])
  assert.deepEqual(filterAndSortCharacterNames(characters, 'かい', 'unverified'), [])
})

test('Japanese sorting keeps unknown names last in both directions with deterministic ties', () => {
  const characters = [
    character('u2', 'Zed', null), character('r2', 'Leda', 'レダ'), character('u1', 'Adam', null),
    character('cai', 'Cai', 'カイ'), character('r1', 'Leda', 'レダ'),
  ]
  assert.deepEqual(filterAndSortCharacterNames(characters).map(({ id }) => id), ['cai', 'r1', 'r2', 'u1', 'u2'])
  assert.deepEqual(filterAndSortCharacterNames(characters, '', 'all', { key: 'japaneseName', direction: 'desc' }).map(({ id }) => id),
    ['r1', 'r2', 'cai', 'u1', 'u2'])
})

test('English sorting supports both directions without mutating input', () => {
  const characters = [character('b2', 'Beta', null), character('a', 'Alpha', 'アルファ'), character('b1', 'Beta', 'ベータ')]
  const before = structuredClone(characters)
  for (const entry of characters) {
    Object.freeze(entry.sourceIds)
    Object.freeze(entry)
  }
  Object.freeze(characters)
  assert.deepEqual(filterAndSortCharacterNames(characters, '', 'all', { key: 'englishName', direction: 'asc' }).map(({ id }) => id),
    ['a', 'b1', 'b2'])
  assert.deepEqual(filterAndSortCharacterNames(characters, '', 'all', { key: 'englishName', direction: 'desc' }).map(({ id }) => id),
    ['b1', 'b2', 'a'])
  assert.deepEqual(characters, before)
  assert.notEqual(filterAndSortCharacterNames(characters), characters)
})

test('checked-in mappings cover all 62 names with sources and preserve distinct localized identities', () => {
  const growth = validateGrowthDataset(JSON.parse(readFileSync(new URL('../src/data/character-growths.json', import.meta.url), 'utf8')))
  const names = JSON.parse(readFileSync(new URL('../src/data/character-names.json', import.meta.url), 'utf8'))
  const result = validateAndMergeCharacterNames(names, growth.characters)
  const verified = result.characters.filter(({ status }) => status === 'verified')
  assert.equal(result.characters.length, 62)
  assert.equal(verified.length, 62)
  assert.equal(new Set(verified.map(({ japaneseName }) => japaneseName)).size, 62)
  assert.deepEqual(result.characters.map(({ id, englishName }) => ({ id, name: englishName })),
    growth.characters.map(({ id, name }) => ({ id, name })))
  for (const [englishName, japaneseName] of [
    ['Cai', 'カイ'], ['Dietrich', 'ディートリヒ'], ['Leda', 'レダ'], ['Theodora', 'セオドラ'],
    ['Eshmel', 'イシュマール'], ['Bonaventure', 'ボナパルテ'], ['Buccar', 'バッカニア'],
    ['Creek', 'キリーク'], ['Kiroc', 'キロイカ'], ['Dadao', 'ダイトウ'], ['Ludia', 'ルルディヤー'],
    ['Hong Hua', 'コウカ'], ['Sha Lan', 'サラン'], ['Yang Jie', 'ヨーカイ'], ['Nezha', 'ナジャ'],
    ['Troy', 'トロイア'], ['Ursula', 'ウーシュラ'], ['Tahonia', 'タホウニア'],
  ]) {
    const entry = result.characters.find((character) => character.englishName === englishName)
    assert.equal(entry?.japaneseName, japaneseName, englishName)
    assert.ok(filterAndSortCharacterNames(result.characters, japaneseName).some((character) => character.englishName === englishName),
      `${japaneseName} must find ${englishName}`)
  }
  assert.ok(result.sources.every(({ url, name, retrievedAt }) =>
    retrievedAt === '2026-09-30' && (new URL(url).hostname === 'www.nintendo.com' || name.includes('非公式'))))
  assert.ok(verified.every(({ checkedAt, note }) => checkedAt === '2026-09-30' && note.length > 0))
  assert.ok(growth.characters.every(({ status }) => status === 'unverified'))
})
