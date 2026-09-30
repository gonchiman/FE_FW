import { useState } from 'react'
import { GrowthRatesTable } from '../components/GrowthRatesTable'
import { growthData } from '../data/growth-data'
import { filterAndSortGrowthCharacters } from '../lib/growth'
import type { GrowthDataset, GrowthSort, GrowthSortKey } from '../types/growth'
import './GrowthRatesPage.css'

function GrowthRatesContent({ data }: { data: GrowthDataset }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<GrowthSort>({ key: 'name', direction: 'asc' })
  const characters = filterAndSortGrowthCharacters(data.characters, query, sort)
  const sampleCount = data.characters.filter((character) => character.status === 'sample').length
  const allSamples = sampleCount > 0 && sampleCount === data.characters.length
  const unverifiedCount = data.characters.filter((character) => character.status === 'unverified').length
  const allUnverified = unverifiedCount > 0 && unverifiedCount === data.characters.length

  function changeSort(key: GrowthSortKey) {
    setSort((previous) => ({
      key,
      direction: previous.key === key ? (previous.direction === 'asc' ? 'desc' : 'asc') : (key === 'name' ? 'asc' : 'desc'),
    }))
  }

  return (
    <section aria-label="個人成長率">
      <div className="growth-toolbar">
        <label className="growth-search" htmlFor="growth-search">
          キャラクター名
          <span className="growth-search-field">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" strokeLinecap="round" />
            </svg>
            <input id="growth-search" type="search" placeholder="名前で検索" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
          </span>
        </label>
        <div className="growth-result-info">
          {sampleCount > 0 && <span className="growth-data-status">{allSamples ? '仮データ' : '仮データを含む'}</span>}
          {unverifiedCount > 0 && <span className="growth-data-status">{allUnverified ? 'ゲーム内未照合' : '未照合データを含む'}</span>}
          <span className="growth-result-count" role="status">{characters.length === data.characters.length ? `${characters.length}人` : `${characters.length} / ${data.characters.length}人`}</span>
        </div>
      </div>

      {characters.length > 0 ? (
        <GrowthRatesTable characters={characters} sort={sort} onSort={changeSort} showSampleLabels={!allSamples} showUnverifiedLabels={!allUnverified} />
      ) : (
        <p className="growth-empty">{data.characters.length === 0 ? '成長率データはまだありません。' : '該当するキャラクターがいません。'}</p>
      )}

      <div className="growth-table-meta"><span>個人成長率（%）</span><span>—：未確認</span></div>
      <details className="growth-sources">
        <summary>データの出典</summary>
        {data.sources.map((source) => (
          <div className="growth-source" key={source.id}>
            <p className="growth-source-name">{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}</p>
            {source.note && <p>{source.note}</p>}
            <dl>
              <dt>取得日</dt><dd>{source.retrievedAt ?? '未取得'}</dd>
              <dt>元データの版</dt><dd>{source.sourceVersion ?? '不明'}</dd>
              <dt>ゲームの版</dt><dd>{source.gameVersion ?? '不明'}</dd>
            </dl>
          </div>
        ))}
      </details>
    </section>
  )
}

export function GrowthRatesPage() {
  if (!growthData.data) return <p role="alert">{growthData.error}</p>
  return <GrowthRatesContent data={growthData.data} />
}
