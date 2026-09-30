export const NAVIGATION_ITEMS = [
  { id: 'home', label: 'ホーム', title: 'ホーム', href: '#/' },
  { id: 'growth-rates', label: '成長率', title: 'キャラクター成長率', href: '#/growth-rates' },
  { id: 'growth-analysis', label: '成長率分析', title: '成長率の統計分析', href: '#/analysis/growth-rates' },
  { id: 'character-names', label: '名前対応表', title: '名前対応表', href: '#/character-names' },
] as const

export type NavigationPage = (typeof NAVIGATION_ITEMS)[number]['id']
export type NameTab = 'characters' | 'classes'

export function getPageFromHash(hash: string) {
  const pathname = hash.split('?')[0]
  const path = pathname === '' || pathname === '#' ? '#/' : pathname
  return NAVIGATION_ITEMS.find((item) => item.href === path)
}

export function getNameTabFromHash(hash: string): NameTab {
  if (getPageFromHash(hash)?.id !== 'character-names') return 'characters'
  const queryStart = hash.indexOf('?')
  const query = new URLSearchParams(queryStart === -1 ? '' : hash.slice(queryStart + 1))
  return query.get('tab') === 'classes' ? 'classes' : 'characters'
}

export function getNameTabHref(tab: NameTab): string {
  return tab === 'classes' ? '#/character-names?tab=classes' : '#/character-names'
}
