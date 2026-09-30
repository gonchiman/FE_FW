import { useRef, useState, type KeyboardEvent } from 'react'
import { HelpPopover } from '../components/HelpPopover'
import { NameMappingsTable } from '../components/NameMappingsTable'
import { characterNameData } from '../data/character-names-data'
import { classNameData } from '../data/class-names-data'
import { filterAndSortNames } from '../lib/name-mappings'
import type { NameTab } from '../lib/navigation'
import type { NameEntry, NameSource, NameSort, NameStatusFilter } from '../types/name-mappings'
import './CharacterNamesPage.css'

const tabs = [
  { id: 'characters', label: 'キャラクター', unit: '人' },
  { id: 'classes', label: 'クラス', unit: '件' },
] as const

function NameMappingsContent({ entity, entries, sources }: {
  entity: NameTab
  entries: NameEntry[]
  sources: NameSource[]
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<NameStatusFilter>('all')
  const [sort, setSort] = useState<NameSort>({ key: 'japaneseName', direction: 'asc' })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const sourceButtonRef = useRef<HTMLButtonElement | null>(null)
  const names = filterAndSortNames(entries, query, status, sort)
  const verifiedCount = entries.filter((entry) => entry.status === 'verified').length
  const { label, unit } = tabs.find(({ id }) => id === entity)!

  function changeSort(key: NameSort['key']) {
    setSort((previous) => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))
    setExpandedId(null)
  }

  return (
    <>
      <div className="character-names-toolbar">
        <label className="character-names-search" htmlFor={`${entity}-name-search`}>
          {label}名
          <input id={`${entity}-name-search`} type="search" placeholder="日本語・英語で検索" autoComplete="off" value={query} onChange={(event) => { setQuery(event.target.value); setExpandedId(null) }} />
        </label>
        <label className="character-names-filter" htmlFor={`${entity}-name-status`}>
          確認状況
          <select id={`${entity}-name-status`} value={status} onChange={(event) => { setStatus(event.target.value as NameStatusFilter); setExpandedId(null) }}>
            <option value="all">すべて</option>
            <option value="verified">確認済</option>
            <option value="unverified">未確認</option>
          </select>
        </label>
        <span className="character-names-count" role="status">{names.length === entries.length ? `${names.length}${unit}` : `${names.length} / ${entries.length}${unit}`}</span>
      </div>

      {names.length > 0 ? (
        <NameMappingsTable entity={entity} entries={names} sources={sources} sort={sort} onSort={changeSort} expandedId={expandedId}
          onToggleSources={(id, button) => { sourceButtonRef.current = button; setExpandedId((previous) => previous === id ? null : id) }}
          onCloseSources={() => { setExpandedId(null); sourceButtonRef.current?.focus() }} />
      ) : (
        <p className="character-names-empty">{entries.length === 0 ? `${label}データはまだありません。` : `該当する${label}がありません。`}</p>
      )}

      <div className="character-names-meta">
        <span>—：対応未確認</span>
        <span className="character-names-verification">確認済 {verifiedCount} / {entries.length}{unit}
          <HelpPopover label="確認状況について">「確認済」は、日本語名と英語名の対応を資料で確認した状態です。成長率の数値の確認状況とは別です。</HelpPopover>
        </span>
      </div>
    </>
  )
}

export function CharacterNamesPage({ tab, onTabChange }: { tab: NameTab; onTabChange: (tab: NameTab) => void }) {
  const tabRefs = useRef<Partial<Record<NameTab, HTMLButtonElement>>>({})

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: NameTab) {
    const index = tabs.findIndex(({ id }) => id === current)
    let nextIndex: number
    switch (event.key) {
      case 'ArrowLeft': nextIndex = (index + tabs.length - 1) % tabs.length; break
      case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break
      case 'Home': nextIndex = 0; break
      case 'End': nextIndex = tabs.length - 1; break
      default: return
    }
    event.preventDefault()
    const next = tabs[nextIndex].id
    onTabChange(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="name-mappings-page">
      <div className="name-mappings-tabs" role="tablist" aria-label="名前の種類">
        {tabs.map(({ id, label }) => (
          <button key={id} ref={(button) => { if (button) tabRefs.current[id] = button; else delete tabRefs.current[id] }}
            type="button" role="tab" id={`name-tab-${id}`} aria-controls={`name-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
            onClick={() => onTabChange(id)} onKeyDown={(event) => handleTabKeyDown(event, id)}>{label}</button>
        ))}
      </div>
      <section id="name-panel-characters" role="tabpanel" aria-labelledby="name-tab-characters" hidden={tab !== 'characters'}>
        {characterNameData.data
          ? <NameMappingsContent entity="characters" entries={characterNameData.data.characters} sources={characterNameData.data.sources} />
          : <p role="alert">{characterNameData.error}</p>}
      </section>
      <section id="name-panel-classes" role="tabpanel" aria-labelledby="name-tab-classes" hidden={tab !== 'classes'}>
        {classNameData.data
          ? <NameMappingsContent entity="classes" entries={classNameData.data.classes} sources={classNameData.data.sources} />
          : <p role="alert">{classNameData.error}</p>}
      </section>
    </div>
  )
}
