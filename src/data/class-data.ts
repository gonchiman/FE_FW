import rawData from './class-details.json'
import { validateClassDataset } from '../lib/class-data'
import type { ClassDataset } from '../types/classes'

function loadClassData(): { data: ClassDataset; error: null } | { data: null; error: string } {
  try {
    return { data: validateClassDataset(rawData), error: null }
  } catch {
    return { data: null, error: 'クラス情報を読み込めませんでした。' }
  }
}

export const classData = loadClassData()
