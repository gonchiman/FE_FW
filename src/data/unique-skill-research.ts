import type { UniqueSkillResearch } from '../types/character-skills.ts'

/** Absence from an incomplete source does not establish that a character has no skills. */
export const uniqueSkillResearch: UniqueSkillResearch = {
  checkedAt: '2026-10-01',
  inspectedCharacterIds: ['fwe-aswan', 'fwe-centurio', 'fwe-creek', 'fwe-hong-hua', 'fwe-nathan', 'fwe-tahonia', 'fwe-troy'],
  sources: [
    {
      id: 'serenes-unique-skill-research',
      name: 'Serenes Forest / Personal Abilities',
      url: 'https://serenesforest.net/fortunes-weave/characters/personal-abilities/',
      retrievedAt: '2026-10-01T10:28:54Z',
      sourceVersion: null,
      gameVersion: null,
      note: 'コウカとトロイアのLv50・Lv60の固有習得スキルを掲載。追加スキルの非掲載は、存在しないことの確認には使わない。',
    },
    {
      id: 'gamewith-unique-skill-research',
      name: 'GameWith / ネイサンの習得スキル',
      url: 'https://gamewith.jp/fefw/577895',
      retrievedAt: '2026-10-01T10:28:54Z',
      sourceVersion: null,
      gameVersion: null,
      note: '確認できたものを順次掲載する資料。追加スキルが載っていないだけでは、固有習得スキルなしと判定しない。',
    },
  ],
  knownSkills: [
    { characterId: 'fwe-hong-hua', englishName: 'Amplify Magic', level: 50, sourceId: 'serenes-unique-skill-research' },
    { characterId: 'fwe-hong-hua', englishName: 'Amplify Magic+', level: 60, sourceId: 'serenes-unique-skill-research' },
    { characterId: 'fwe-troy', englishName: 'Modified Weapon', level: 50, sourceId: 'serenes-unique-skill-research' },
    { characterId: 'fwe-troy', englishName: 'Modified Weapon+', level: 60, sourceId: 'serenes-unique-skill-research' },
  ],
}
