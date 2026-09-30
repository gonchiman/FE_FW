import rawRoster from '../../data/sources/fortunes-weave-classes.json'
import rawNames from './class-names.json'
import { validateAndMergeClassNames, validateClassRoster } from '../lib/class-names'
import type { ClassNameDataset } from '../types/class-names'

function loadClassNames(): { data: ClassNameDataset; error: null } | { data: null; error: string } {
  try {
    const roster = validateClassRoster(rawRoster)
    return { data: validateAndMergeClassNames(rawNames, roster.classes), error: null }
  } catch {
    return { data: null, error: 'クラスの名前対応データを読み込めませんでした。' }
  }
}

export const classNameData = loadClassNames()
