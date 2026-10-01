import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildCharacterSkillSearchTexts, groupCharacterSkills, validateCharacterSkillDataset } from '../src/lib/character-skills.ts'
import { filterAndSortGrowthCharacters, validateGrowthDataset } from '../src/lib/growth.ts'
import type { CharacterSkill, CharacterSkillDataset } from '../src/types/character-skills.ts'
import { GROWTH_STATS, type CharacterGrowth, type StatKey } from '../src/types/growth.ts'

const roster = [{ id: 'one' }, { id: 'two' }]

function skill(overrides: Partial<CharacterSkill> = {}): CharacterSkill {
  return {
    id: 'one-personal', characterId: 'one', kind: 'personal',
    name: 'サンプル個人スキル', englishName: null, description: null,
    level: null, acquisition: null, upgradesSkillId: null,
    sourceIds: ['source'], status: 'unverified', ...overrides,
  }
}

function dataset(skills: CharacterSkill[] = [skill()]): CharacterSkillDataset {
  return {
    sources: [{
      id: 'source', name: 'Test fixture', url: null, retrievedAt: null,
      sourceVersion: null, gameVersion: null, note: '',
    }],
    skills,
  }
}

function character(id: string, name: string, hp: number | null): CharacterGrowth {
  const rates = Object.fromEntries(GROWTH_STATS.map(({ key }) => [key, null])) as Record<StatKey, number | null>
  rates.hp = hp
  return { id, name, sourceId: 'source', status: 'sample', rates }
}

test('skill validation preserves unknown values and does not invent a skill for an uncovered character', () => {
  const input = dataset()
  const result = validateCharacterSkillDataset(input, roster)
  assert.deepEqual(result, input)
  assert.equal(result.skills[0].level, null)
  assert.equal(result.skills[0].description, null)
  assert.equal(result.skills[0].englishName, null)
  assert.equal(result.skills[0].acquisition, null)
  assert.equal(result.skills[0].upgradesSkillId, null)
  assert.equal(result.skills[0].status, 'unverified')
  assert.equal(groupCharacterSkills(result.skills).has('two'), false)
  assert.notEqual(result.skills[0], input.skills[0])
  assert.notEqual(result.skills[0].sourceIds, input.skills[0].sourceIds)
  assert.deepEqual(validateCharacterSkillDataset({ sources: [], skills: [] }, roster), { sources: [], skills: [] })
})

test('skill validation rejects zero, missing, fractional, and nonnumeric acquisition levels', () => {
  for (const level of [undefined, 0, -1, 1.5, NaN, Infinity, '20', false, Number.MAX_SAFE_INTEGER + 1]) {
    const input = dataset()
    ;(input.skills[0] as unknown as Record<string, unknown>).level = level
    assert.throws(() => validateCharacterSkillDataset(input, roster), /level must be null or a positive integer/)
  }
  assert.equal(validateCharacterSkillDataset(dataset([skill({ level: 20 })]), roster).skills[0].level, 20)
})

test('skill joins reject duplicate ids, missing characters, and ambiguous roster ids', () => {
  assert.throws(() => validateCharacterSkillDataset(dataset([skill(), skill()]), roster), /duplicate id/)
  assert.throws(() => validateCharacterSkillDataset(dataset([skill({ characterId: 'missing' })]), roster), /unknown character/)
  assert.throws(() => validateCharacterSkillDataset(dataset(), [{ id: 'one' }, { id: 'one' }]), /roster contains a duplicate id/)
})

test('each character can have one personal skill and several unique acquisitions', () => {
  const entries = [
    skill(),
    skill({ id: 'one-lv20', kind: 'unique', level: 20 }),
    skill({ id: 'one-lv35', kind: 'unique', level: 35 }),
    skill({ id: 'two-personal', characterId: 'two' }),
  ]
  assert.equal(validateCharacterSkillDataset(dataset(entries), roster).skills.length, 4)
  assert.throws(() => validateCharacterSkillDataset(dataset([
    skill(), skill({ id: 'one-extra-personal' }),
  ]), roster), /duplicate personal skill/)
})

test('every skill must have distinct and resolvable source references', () => {
  for (const sourceIds of [[], ['missing'], ['source', 'source']]) {
    assert.throws(() => validateCharacterSkillDataset(dataset([skill({ sourceIds })]), roster), /source/)
  }
  const duplicateSource = dataset()
  duplicateSource.sources.push({ ...duplicateSource.sources[0] })
  assert.throws(() => validateCharacterSkillDataset(duplicateSource, roster), /duplicate id/)

  const missingVersion = dataset()
  delete (missingVersion.sources[0] as unknown as Record<string, unknown>).gameVersion
  assert.throws(() => validateCharacterSkillDataset(missingVersion, roster), /gameVersion/)
})

test('skill validation rejects malformed categories, status, names, and missing nullable fields', () => {
  for (const [key, value] of [
    ['kind', 'class'], ['status', 'sample'], ['name', '  '], ['id', ''],
    ['description', undefined], ['englishName', undefined], ['acquisition', ''], ['upgradesSkillId', undefined],
  ] as const) {
    const input = dataset()
    ;(input.skills[0] as unknown as Record<string, unknown>)[key] = value
    assert.throws(() => validateCharacterSkillDataset(input, roster), TypeError, key)
  }
})

test('confirmed upgrades remain separate acquisitions and can reference a later input record', () => {
  const input = dataset([
    skill({ id: 'plus', kind: 'unique', level: 35, upgradesSkillId: 'base' }),
    skill({ id: 'base', kind: 'unique', level: 20 }),
  ])
  const result = validateCharacterSkillDataset(input, roster)
  assert.deepEqual(result, input)
  assert.equal(result.skills[0].upgradesSkillId, 'base')
  assert.deepEqual(groupCharacterSkills(result.skills).get('one')?.map(({ id }) => id), ['base', 'plus'])
})

test('upgrades must reference an existing skill of the same character and category', () => {
  assert.throws(() => validateCharacterSkillDataset(dataset([
    skill({ id: 'plus', kind: 'unique', level: 35, upgradesSkillId: 'missing' }),
  ]), roster), /unknown upgraded skill/)

  for (const previous of [
    skill({ id: 'base', characterId: 'two', kind: 'unique', level: 20 }),
    skill({ id: 'base', kind: 'personal', level: null }),
  ]) {
    assert.throws(() => validateCharacterSkillDataset(dataset([
      previous, skill({ id: 'plus', kind: 'unique', level: 35, upgradesSkillId: 'base' }),
    ]), roster), /same character and kind/)
  }
})

test('known upgrade levels must increase while unknown levels stay unknown', () => {
  for (const level of [1, 19, 20]) {
    assert.throws(() => validateCharacterSkillDataset(dataset([
      skill({ id: 'base', kind: 'unique', level: 20 }),
      skill({ id: 'plus', kind: 'unique', level, upgradesSkillId: 'base' }),
    ]), roster), /upgrade level must be greater/)
  }
  for (const [beforeLevel, afterLevel] of [[null, 35], [20, null], [null, null]] as const) {
    const result = validateCharacterSkillDataset(dataset([
      skill({ id: 'base', kind: 'unique', level: beforeLevel }),
      skill({ id: 'plus', kind: 'unique', level: afterLevel, upgradesSkillId: 'base' }),
    ]), roster)
    assert.equal(result.skills[0].level, beforeLevel)
    assert.equal(result.skills[1].level, afterLevel)
  }
})

test('upgrade validation rejects self references and multi-record cycles even with unknown levels', () => {
  assert.throws(() => validateCharacterSkillDataset(dataset([
    skill({ id: 'self', kind: 'unique', upgradesSkillId: 'self' }),
  ]), roster), /upgrade cycle/)
  assert.throws(() => validateCharacterSkillDataset(dataset([
    skill({ id: 'a', kind: 'unique', upgradesSkillId: 'c' }),
    skill({ id: 'b', kind: 'unique', upgradesSkillId: 'a' }),
    skill({ id: 'c', kind: 'unique', upgradesSkillId: 'b' }),
  ]), roster), /upgrade cycle/)
})

test('grouping preserves all versions, places unknown acquisition levels last, and leaves source records unchanged', () => {
  const entries = [
    skill({ id: 'unknown', kind: 'unique' }),
    skill({ id: 'plus', kind: 'unique', level: 35, upgradesSkillId: 'base' }),
    skill({ id: 'two-personal', characterId: 'two' }),
    skill({ id: 'base', kind: 'unique', level: 20 }),
    skill(),
  ]
  const before = structuredClone(entries)
  for (const entry of entries) {
    Object.freeze(entry.sourceIds)
    Object.freeze(entry)
  }
  Object.freeze(entries)
  const grouped = groupCharacterSkills(entries)
  assert.deepEqual(grouped.get('one')?.map(({ id }) => id), ['one-personal', 'base', 'plus', 'unknown'])
  assert.deepEqual(grouped.get('two')?.map(({ id }) => id), ['two-personal'])
  assert.equal(grouped.get('one')?.[3], entries[0])
  assert.deepEqual(entries, before)
  assert.notEqual(grouped.get('one'), entries)
})

test('growth search finds every unique version, including entries beyond the compact table preview', () => {
  const skills = [
    skill({ name: 'サンプル固有能力', englishName: 'Sample ability' }),
    skill({ id: 'one-first', kind: 'unique', name: '最初の技能', level: 5 }),
    skill({ id: 'one-second', kind: 'unique', name: '次の技能', level: 10 }),
    skill({ id: 'one-third', kind: 'unique', name: '三つ目の技能', level: 20 }),
    skill({ id: 'one-last', kind: 'unique', name: 'ラストスキル＋', englishName: 'Last Skill+',
      description: '回復魔法の射程＋2', acquisition: 'レベル35で習得', level: 35 }),
    skill({ id: 'two-personal', characterId: 'two', name: '別の能力' }),
  ]
  const characters = [character('two', 'Beta', 80), character('one', 'Alpha', 20)]
  const displayNames = new Map([['one', 'アリス'], ['two', 'ボブ']])
  const searchTexts = buildCharacterSkillSearchTexts(skills)
  for (const query of ['固有能力', 'sample ability', '最初', '次の技能', '三つ目', 'らすとすきる+',
    '  ＬＡＳＴ ＳＫＩＬＬ＋ ', '射程+2', 'レベル35', 'ありす', 'ＡＬＰＨＡ']) {
    assert.deepEqual(filterAndSortGrowthCharacters(characters, query, undefined, displayNames, searchTexts).map(({ id }) => id), ['one'], query)
  }
  assert.deepEqual(filterAndSortGrowthCharacters(characters, 'missing', undefined, displayNames, searchTexts), [])
  assert.equal(searchTexts.has('missing'), false)
  assert.equal(searchTexts.get('two')?.includes('null'), false)
})

test('skill filtering preserves numeric sorting, Japanese ties, unknown rates, and original growth and skill data', () => {
  const characters = [
    character('unknown', 'Unknown', null), character('low-i', 'Alpha', 20),
    character('high', 'High', 80), character('low-a', 'Zulu', 20), character('other', 'Other', 0),
  ]
  const skills = characters.map(({ id }) => skill({
    id: `${id}-personal`, characterId: id, name: id === 'other' ? '別の能力' : 'サンプル能力', description: '効果',
  }))
  const displayNames = new Map([['low-a', 'アリス'], ['low-i', 'イリス']])
  const searchTexts = buildCharacterSkillSearchTexts(skills)
  const before = structuredClone({ characters, skills, displayNames, searchTexts })
  for (const entry of characters) {
    Object.freeze(entry.rates)
    Object.freeze(entry)
  }
  for (const entry of skills) {
    Object.freeze(entry.sourceIds)
    Object.freeze(entry)
  }
  Object.freeze(characters)
  Object.freeze(skills)
  assert.deepEqual(filterAndSortGrowthCharacters(characters, 'さんぷる', { key: 'hp', direction: 'asc' }, displayNames, searchTexts)
    .map(({ id }) => id), ['low-a', 'low-i', 'high', 'unknown'])
  assert.deepEqual(filterAndSortGrowthCharacters(characters, 'さんぷる', { key: 'hp', direction: 'desc' }, displayNames, searchTexts)
    .map(({ id }) => id), ['high', 'low-a', 'low-i', 'unknown'])
  const result = filterAndSortGrowthCharacters(characters, 'サンプル', undefined, displayNames, searchTexts)
  assert.equal(result.length, 4)
  assert.ok(result.every(entry => characters.includes(entry)))
  assert.deepEqual({ characters, skills, displayNames, searchTexts }, before)
})

function productionData() {
  const growth = validateGrowthDataset(JSON.parse(readFileSync(new URL('../src/data/character-growths.json', import.meta.url), 'utf8')))
  const raw: unknown = JSON.parse(readFileSync(new URL('../src/data/character-skills.json', import.meta.url), 'utf8'))
  return { growth, skills: validateCharacterSkillDataset(raw, growth.characters) }
}

test('production skills join the complete growth roster without losing source metadata or unknown values', () => {
  const { growth, skills } = productionData()
  assert.deepEqual(new Set(skills.skills.filter(({ kind }) => kind === 'personal').map(({ characterId }) => characterId)),
    new Set(growth.characters.map(({ id }) => id)))
  assert.ok(skills.skills.some(({ kind }) => kind === 'unique'))
  assert.ok(skills.skills.some(({ level }) => level === null))
  assert.ok(skills.skills.some(({ englishName }) => englishName === null))
  assert.ok(skills.skills.every(({ status }) => status === 'unverified'), 'No source record has been checked against the game yet')
  for (const source of skills.sources) {
    assert.match(source.url ?? '', /^https:\/\//, source.id)
    assert.ok(Number.isFinite(Date.parse(source.retrievedAt ?? '')), `${source.id} must record when it was retrieved`)
    assert.equal(source.gameVersion, null, 'An unknown game version must not be inferred from the source date')
  }
})

test('production data remains reproducible from the recorded source snapshot', () => {
  const { growth, skills } = productionData()
  const snapshot: unknown = JSON.parse(readFileSync(new URL('../data/sources/character-skills.json', import.meta.url), 'utf8'))
  const expected = validateCharacterSkillDataset(snapshot, growth.characters)
  assert.equal(skills.skills.length, expected.skills.length, 'Run the skill importer after updating the source snapshot')
  assert.deepEqual(skills, expected)
})

test('every production skill name and available English name finds its character in the growth table', () => {
  const { growth, skills } = productionData()
  const searchTexts = buildCharacterSkillSearchTexts(skills.skills)
  const before = structuredClone({ growth, skills })
  for (const entry of skills.skills) {
    for (const query of [entry.name, entry.englishName, entry.description].filter((value): value is string => value !== null)) {
      const matches = filterAndSortGrowthCharacters(growth.characters, query, { key: 'hp', direction: 'desc' }, undefined, searchTexts)
      assert.ok(matches.some(({ id }) => id === entry.characterId), `${entry.id}: ${query}`)
    }
  }
  assert.deepEqual({ growth, skills }, before)
})
