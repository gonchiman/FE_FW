export const NAVIGATION_ITEMS = [
  { id: 'home', label: 'ホーム', href: '#/' },
] as const

export type NavigationPage = (typeof NAVIGATION_ITEMS)[number]['id']
