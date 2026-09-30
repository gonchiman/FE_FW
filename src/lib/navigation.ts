export const NAVIGATION_ITEMS = [
  { id: 'home', label: 'ホーム', title: 'ホーム', href: '#/' },
  { id: 'growth-rates', label: '成長率', title: 'キャラクター成長率', href: '#/growth-rates' },
  { id: 'growth-analysis', label: '成長率分析', title: '成長率の統計分析', href: '#/analysis/growth-rates' },
  { id: 'character-names', label: '名前対応', title: 'キャラクター名対応表', href: '#/character-names' },
] as const

export type NavigationPage = (typeof NAVIGATION_ITEMS)[number]['id']

export function getPageFromHash(hash: string) {
  const path = hash === '' || hash === '#' ? '#/' : hash
  return NAVIGATION_ITEMS.find((item) => item.href === path)
}
