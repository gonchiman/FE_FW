import rawData from './character-skills.json'
import { growthData } from './growth-data'
import { groupCharacterSkills, validateCharacterSkillDataset } from '../lib/character-skills'
import type { CharacterSkillDataset } from '../types/character-skills'

function loadCharacterSkills(): { data: CharacterSkillDataset; error: null } | { data: null; error: string } {
  if (!growthData.data) return { data: null, error: 'キャラクター一覧を読み込めないため、スキルを表示できませんでした。' }
  try {
    return { data: validateCharacterSkillDataset(rawData, growthData.data.characters), error: null }
  } catch {
    return { data: null, error: 'スキルデータを読み込めませんでした。' }
  }
}

export const characterSkillData = loadCharacterSkills()
export const characterSkillsByCharacter = groupCharacterSkills(characterSkillData.data?.skills ?? [])
