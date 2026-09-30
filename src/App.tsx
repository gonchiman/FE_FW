import { AppShell } from './components/AppShell'
import { useHashRoute } from './lib/useHashRoute'
import { getNameTabHref } from './lib/navigation'
import { GrowthRatesPage } from './pages/GrowthRatesPage'
import { CharacterNamesPage } from './pages/CharacterNamesPage'
import { GrowthAnalysisPage } from './pages/GrowthAnalysisPage'

export default function App() {
  const page = useHashRoute()

  return (
    <AppShell title={page?.title ?? 'ページが見つかりません'} activePage={page?.id ?? null}>
      {page?.id === 'growth-rates' && <GrowthRatesPage />}
      {page?.id === 'growth-analysis' && <GrowthAnalysisPage />}
      {page?.id === 'character-names' && <CharacterNamesPage tab={page.nameTab} onTabChange={(tab) => { window.location.hash = getNameTabHref(tab) }} />}
      {!page && <a href="#/">ホームへ</a>}
    </AppShell>
  )
}
