import rawData from './character-growths.json'
import { validateGrowthDataset } from '../lib/growth'
import type { GrowthDataset } from '../types/growth'

function loadGrowthData(): { data: GrowthDataset; error: null } | { data: null; error: string } {
  try {
    return { data: validateGrowthDataset(rawData), error: null }
  } catch {
    return { data: null, error: '成長率データを読み込めませんでした。' }
  }
}

export const growthData = loadGrowthData()
