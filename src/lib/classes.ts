import { normalizeGrowthSearch } from './growth.ts'
import { GROWTH_STATS, type StatKey } from '../types/growth.ts'
import type { ClassTier } from '../types/class-names.ts'
import type { ClassInfo } from '../types/classes.ts'

export const CLASS_TIERS: readonly { value: ClassTier; label: string }[] = [
  { value: 'Base', label: '基本職' },
  { value: 'Beginner', label: '初級職' },
  { value: 'Specialty', label: '中級職' },
  { value: 'Advanced', label: '上級職' },
  { value: 'Master', label: '最上級職' },
  { value: 'Divine', label: '神将職' },
]

export const CLASS_VIEWS = [
  { value: 'basic', label: '基本情報' },
  { value: 'bonuses', label: '能力補正' },
  { value: 'growths', label: '成長率補正' },
] as const

export type ClassView = (typeof CLASS_VIEWS)[number]['value']
export type ClassSortKey = 'name' | 'tier' | 'movement' | StatKey
export type ClassSort = { key: ClassSortKey; direction: 'asc' | 'desc' }
export type ClassListState = { query: string; tier: ClassTier | 'all'; view: ClassView; sort: ClassSort }

export function createClassListState(): ClassListState {
  return { query: '', tier: 'all', view: 'basic', sort: { key: 'name', direction: 'asc' } }
}

export function getClassName(row: Pick<ClassInfo, 'id' | 'name'>, displayNames?: ReadonlyMap<string, string>): string {
  return displayNames?.get(row.id) ?? row.name
}

export function getClassTierLabel(tier: ClassTier): string {
  return CLASS_TIERS.find(({ value }) => value === tier)?.label ?? tier
}

export function nextClassSort(sort: ClassSort, key: ClassSortKey): ClassSort {
  return {
    key,
    direction: sort.key === key ? (sort.direction === 'asc' ? 'desc' : 'asc') : (key === 'name' || key === 'tier' ? 'asc' : 'desc'),
  }
}

/** A view change never leaves an invisible sort column selected. */
export function changeClassView(state: ClassListState, view: ClassView): ClassListState {
  const key = state.sort.key
  const visible = key === 'name' || key === 'tier' || (view === 'basic' ? key === 'movement' : GROWTH_STATS.some(stat => stat.key === key))
  return { ...state, view, sort: visible ? state.sort : { key: 'name', direction: 'asc' } }
}

const nameCollator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' })
const compareIds = (first: string, second: string) => first < second ? -1 : first > second ? 1 : 0

/** Keep signed values and missing values intact, with missing values last in both directions. */
export function filterAndSortClasses(
  rows: readonly ClassInfo[],
  state: ClassListState = createClassListState(),
  displayNames?: ReadonlyMap<string, string>,
): ClassInfo[] {
  const query = normalizeGrowthSearch(state.query)
  const { sort, view } = state
  const direction = sort.direction === 'asc' ? 1 : -1
  const compareNames = (first: ClassInfo, second: ClassInfo) => nameCollator.compare(getClassName(first, displayNames), getClassName(second, displayNames))
    || compareIds(first.id, second.id)
  const numericValue = (row: ClassInfo): number | null => {
    if (sort.key === 'tier') return CLASS_TIERS.findIndex(({ value }) => value === row.tier)
    if (sort.key === 'movement') return row.movement
    if (sort.key === 'name' || view === 'basic') return null
    return row[view][sort.key]
  }

  return rows.filter(row => (state.tier === 'all' || row.tier === state.tier)
    && [row.name, getClassName(row, displayNames)].some(name => normalizeGrowthSearch(name).includes(query)))
    .sort((first, second) => {
      if (sort.key === 'name') return direction * nameCollator.compare(getClassName(first, displayNames), getClassName(second, displayNames))
        || compareIds(first.id, second.id)
      const firstValue = numericValue(first)
      const secondValue = numericValue(second)
      if (firstValue === null && secondValue === null) return compareNames(first, second)
      if (firstValue === null) return 1
      if (secondValue === null) return -1
      return direction * (firstValue - secondValue) || compareNames(first, second)
    })
}

export function formatClassModifier(value: number | null): string {
  return value === null ? '—' : value > 0 ? `+${value}` : String(value)
}

const classTerms: Readonly<Record<string, string>> = {
  Infantry: '歩兵', Cavalry: '騎兵', Flier: '飛行', Flying: '飛行',
  'Cavalry Heavy Armor': '重装・騎兵', 'Heavy Armor Infantry': '重装・歩兵', 'Infantry Heavy Armor': '重装・歩兵',
  Sword: '剣', Spear: '槍', Axe: '斧', Bow: '弓', Gauntlet: '籠手',
  'Black Magic': '黒魔法', 'White Magic': '白魔法',
}

export function getClassTerm(value: string): string {
  return classTerms[value] ?? value
}
