import rawData from './character-names.json'
import { growthData } from './growth-data'
import { validateAndMergeCharacterNames } from '../lib/character-names'
import type { CharacterNameDataset } from '../types/character-names'

function loadCharacterNames(): { data: CharacterNameDataset; error: null } | { data: null; error: string } {
  if (growthData.data === null) {
    return { data: null, error: 'キャラクター一覧を読み込めないため、名前対応を表示できませんでした。' }
  }
  try {
    return { data: validateAndMergeCharacterNames(rawData, growthData.data.characters), error: null }
  } catch {
    return { data: null, error: '名前対応データを読み込めませんでした。' }
  }
}

export const characterNameData = loadCharacterNames()

export const japaneseCharacterNames: ReadonlyMap<string, string> = new Map(
  (characterNameData.data?.characters ?? [])
    .filter(character => character.status === 'verified' && character.japaneseName !== null)
    .map(character => [character.id, character.japaneseName!]),
)
