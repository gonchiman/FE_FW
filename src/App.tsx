import { AppShell } from './components/AppShell'
import { useHashRoute } from './lib/useHashRoute'
import { getNameTabHref } from './lib/navigation'
import { GrowthRatesPage } from './pages/GrowthRatesPage'
import { CharacterNamesPage } from './pages/CharacterNamesPage'
import { GrowthAnalysisPage } from './pages/GrowthAnalysisPage'
import { ClassInformationPage } from './pages/ClassInformationPage'

export default function App() {
  const page = useHashRoute()

  return (
    <AppShell title={page?.id === 'classes' && page.classId ? 'クラス詳細' : page?.title ?? 'ページが見つかりません'} activePage={page?.id ?? null}>
      {page?.id === 'growth-rates' && <GrowthRatesPage />}
      {page?.id === 'growth-analysis' && <GrowthAnalysisPage />}
      {page?.id === 'classes' && <ClassInformationPage classId={page.classId} />}
      {page?.id === 'character-names' && <CharacterNamesPage tab={page.nameTab} onTabChange={(tab) => { window.location.hash = getNameTabHref(tab) }} />}
      {!page && <a href="#/">ホームへ</a>}
    </AppShell>
  )
}
