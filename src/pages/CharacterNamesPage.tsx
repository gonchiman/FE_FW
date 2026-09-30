import { useRef, useState } from 'react'
import { CharacterNamesTable } from '../components/CharacterNamesTable'
import { characterNameData } from '../data/character-names-data'
import { filterAndSortCharacterNames } from '../lib/character-names'
import type { CharacterNameDataset, NameSort, NameStatusFilter } from '../types/character-names'
import './CharacterNamesPage.css'

function CharacterNamesContent({ data }: { data: CharacterNameDataset }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<NameStatusFilter>('all')
  const [sort, setSort] = useState<NameSort>({ key: 'japaneseName', direction: 'asc' })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const sourceButtonRef = useRef<HTMLButtonElement | null>(null)
  const characters = filterAndSortCharacterNames(data.characters, query, status, sort)
  const verifiedCount = data.characters.filter((character) => character.status === 'verified').length

  function changeSort(key: NameSort['key']) {
    setSort((previous) => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))
    setExpandedId(null)
  }

  return (
    <section aria-label="キャラクター名対応">
      <div className="character-names-toolbar">
        <label className="character-names-search" htmlFor="character-name-search">
          キャラクター名
          <input id="character-name-search" type="search" placeholder="日本語・英語で検索" autoComplete="off" value={query} onChange={(event) => { setQuery(event.target.value); setExpandedId(null) }} />
        </label>
        <label className="character-names-filter" htmlFor="character-name-status">
          確認状況
          <select id="character-name-status" value={status} onChange={(event) => { setStatus(event.target.value as NameStatusFilter); setExpandedId(null) }}>
            <option value="all">すべて</option>
            <option value="verified">確認済</option>
            <option value="unverified">未確認</option>
          </select>
        </label>
        <span className="character-names-count" role="status">{characters.length === data.characters.length ? `${characters.length}人` : `${characters.length} / ${data.characters.length}人`}</span>
      </div>

      {characters.length > 0 ? (
        <CharacterNamesTable characters={characters} sources={data.sources} sort={sort} onSort={changeSort} expandedId={expandedId}
          onToggleSources={(id, button) => { sourceButtonRef.current = button; setExpandedId((previous) => previous === id ? null : id) }}
          onCloseSources={() => { setExpandedId(null); sourceButtonRef.current?.focus() }} />
      ) : (
        <p className="character-names-empty">{data.characters.length === 0 ? 'キャラクターデータはまだありません。' : '該当するキャラクターがいません。'}</p>
      )}

      <div className="character-names-meta"><span>—：対応未確認</span><span>確認済 {verifiedCount} / {data.characters.length}人</span></div>
    </section>
  )
}

export function CharacterNamesPage() {
  if (!characterNameData.data) return <p role="alert">{characterNameData.error}</p>
  return <CharacterNamesContent data={characterNameData.data} />
}
