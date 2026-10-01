import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getUniqueSkillCoverage } from '../src/lib/unique-skill-coverage.ts'
import type { CharacterSkill, KnownUniqueSkill } from '../src/types/character-skills.ts'

function skill(overrides: Partial<CharacterSkill> = {}): CharacterSkill {
  return {
    id: 'one-base', characterId: 'one', kind: 'unique',
    name: 'サンプル固有スキル', englishName: 'Sample Ability', description: null,
    level: 20, acquisition: null, upgradesSkillId: null,
    sourceIds: ['source'], status: 'unverified', ...overrides,
  }
}

function known(overrides: Partial<KnownUniqueSkill> = {}): KnownUniqueSkill {
  return { characterId: 'one', englishName: 'Sample Ability', level: 20, sourceId: 'research', ...overrides }
}

const ids = (entries: readonly { id: string }[]) => entries.map(({ id }) => id).sort()
const strings = (entries: readonly string[]) => [...entries].sort()

test('coverage separates recorded, observed but unrecorded, and presence-unconfirmed characters', () => {
  const roster = [{ id: 'one' }, { id: 'two' }, { id: 'three' }, { id: 'four' }]
  const recorded = skill()
  const personalOnly = skill({ id: 'four-personal', characterId: 'four', kind: 'personal' })
  const observation = known({ characterId: 'two', englishName: 'Another Ability', level: 50 })
  const result = getUniqueSkillCoverage(roster, [recorded, personalOnly], [observation])

  assert.equal(result.characterCount, 4)
  assert.deepEqual(result.skills, [recorded])
  assert.deepEqual(result.charactersWithSkills, ['one'])
  assert.deepEqual(result.missingKnownSkills, [observation])
  assert.deepEqual(strings(result.presenceUnconfirmedCharacterIds), ['four', 'three'])
})

test('a partially recorded character still reports the missing higher-level ability', () => {
  const base = skill({ level: null })
  const baseObservation = known()
  const plusObservation = known({ englishName: 'Sample Ability+', level: 35 })
  const result = getUniqueSkillCoverage([{ id: 'one' }], [base], [baseObservation, plusObservation])

  assert.deepEqual(result.charactersWithSkills, ['one'])
  assert.deepEqual(result.missingKnownSkills, [plusObservation])
  assert.deepEqual(result.presenceUnconfirmedCharacterIds, [])
  assert.deepEqual(result.unknownLevelSkills, [base])
  assert.equal(base.level, null)
})

test('research joins by either the English field or displayed English name within the same character', () => {
  const localized = skill({ name: '遠隔治癒', englishName: 'Distant Healing' })
  const englishDisplay = skill({
    id: 'two-base', characterId: 'two', name: 'Flamekeeper', englishName: null, level: 35,
  })
  const unmatchedCharacter = known({ characterId: 'three', englishName: 'Distant Healing' })
  const result = getUniqueSkillCoverage(
    [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
    [localized, englishDisplay],
    [known({ englishName: 'Distant Healing' }), known({ characterId: 'two', englishName: 'Flamekeeper', level: 35 }), unmatchedCharacter],
  )

  assert.deepEqual(result.missingKnownSkills, [unmatchedCharacter])
  assert.deepEqual(strings(result.charactersWithSkills), ['one', 'two'])
  assert.deepEqual(result.presenceUnconfirmedCharacterIds, [])
})

test('personal abilities and similarly named versions cannot satisfy a unique-skill observation', () => {
  const personal = skill({ id: 'one-personal', kind: 'personal' })
  const plus = skill({ id: 'two-plus', characterId: 'two', name: '強化版', englishName: 'Sample Ability+', level: 35 })
  const observations = [known(), known({ characterId: 'two' })]
  const result = getUniqueSkillCoverage([{ id: 'one' }, { id: 'two' }], [personal, plus], observations)

  assert.deepEqual(result.skills, [plus])
  assert.deepEqual(result.charactersWithSkills, ['two'])
  assert.deepEqual(result.missingKnownSkills, observations)
  assert.deepEqual(result.presenceUnconfirmedCharacterIds, [])
})

test('unknown levels, English-only names, and unverified records are independent coverage gaps', () => {
  const verifiedUnknown = skill({ id: 'unknown-level', level: null, status: 'verified' })
  const englishOnly = skill({ id: 'english-only', name: 'Second Ability', englishName: 'Second Ability', level: 35 })
  const localized = skill({ id: 'localized', name: '日本語名', englishName: 'Third Ability', level: 50 })
  const unknownEnglish = skill({ id: 'no-english-field', name: 'Fourth Ability', englishName: null, level: 60, status: 'verified' })
  const personal = skill({ id: 'personal', kind: 'personal', level: null, name: 'Personal Ability', englishName: 'Personal Ability' })
  const result = getUniqueSkillCoverage([{ id: 'one' }], [verifiedUnknown, englishOnly, localized, unknownEnglish, personal])

  assert.deepEqual(ids(result.skills), ['english-only', 'localized', 'no-english-field', 'unknown-level'])
  assert.deepEqual(result.charactersWithSkills, ['one'])
  assert.deepEqual(result.unknownLevelSkills, [verifiedUnknown])
  assert.deepEqual(result.englishNameOnlySkills, [englishOnly])
  assert.deepEqual(ids(result.unverifiedSkills), ['english-only', 'localized'])
})

test('every coverage category is limited to the supplied roster', () => {
  const outsider = skill({ id: 'outside-base', characterId: 'outside', level: null, name: 'Outside Ability', englishName: 'Outside Ability' })
  const observations = [known({ characterId: 'outside', englishName: 'Outside Ability+' })]
  const result = getUniqueSkillCoverage([{ id: 'one' }], [outsider], observations)

  assert.equal(result.characterCount, 1)
  assert.deepEqual(result.skills, [])
  assert.deepEqual(result.charactersWithSkills, [])
  assert.deepEqual(result.missingKnownSkills, [])
  assert.deepEqual(result.presenceUnconfirmedCharacterIds, ['one'])
  assert.deepEqual(result.unknownLevelSkills, [])
  assert.deepEqual(result.englishNameOnlySkills, [])
  assert.deepEqual(result.unverifiedSkills, [])
})

test('an empty roster yields empty coverage even when unrelated records and observations exist', () => {
  assert.deepEqual(getUniqueSkillCoverage([], [skill()], [known()]), {
    characterCount: 0,
    skills: [],
    charactersWithSkills: [],
    missingKnownSkills: [],
    presenceUnconfirmedCharacterIds: [],
    unknownLevelSkills: [],
    englishNameOnlySkills: [],
    unverifiedSkills: [],
  })
})

test('omitting research does not turn an absent record into a confirmed absence', () => {
  const result = getUniqueSkillCoverage([{ id: 'one' }, { id: 'two' }], [skill()])
  assert.deepEqual(result.charactersWithSkills, ['one'])
  assert.deepEqual(result.missingKnownSkills, [])
  assert.deepEqual(result.presenceUnconfirmedCharacterIds, ['two'])
})

test('coverage leaves frozen input records, levels, and ordering unchanged across repeated calls', () => {
  const roster = [{ id: 'two' }, { id: 'one' }, { id: 'three' }]
  const records = [skill({ id: 'plus', level: 35, englishName: 'Sample Ability+' }), skill({ level: null })]
  const observations = [known({ characterId: 'two', level: 50 }), known()]
  const before = structuredClone({ roster, records, observations })
  for (const entry of roster) Object.freeze(entry)
  for (const entry of records) {
    Object.freeze(entry.sourceIds)
    Object.freeze(entry)
  }
  for (const entry of observations) Object.freeze(entry)
  Object.freeze(roster)
  Object.freeze(records)
  Object.freeze(observations)

  const first = getUniqueSkillCoverage(roster, records, observations)
  const second = getUniqueSkillCoverage(roster, records, observations)
  assert.deepEqual(first, second)
  assert.deepEqual({ roster, records, observations }, before)
  assert.deepEqual(first.unknownLevelSkills.map(({ level }) => level), [null])
  assert.deepEqual(first.missingKnownSkills, [observations[0]])
})
