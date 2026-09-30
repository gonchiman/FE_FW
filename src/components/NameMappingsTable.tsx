import { Fragment } from 'react'
import type { NameEntry, NameSort, NameSource } from '../types/name-mappings'
import type { NameTab } from '../lib/navigation'
import './DataTable.css'
import './NameMappingsTable.css'

type NameMappingsTableProps = {
  entity: NameTab
  entries: NameEntry[]
  sources: NameSource[]
  sort: NameSort
  onSort: (key: NameSort['key']) => void
  expandedId: string | null
  onToggleSources: (id: string, button: HTMLButtonElement) => void
  onCloseSources: () => void
}

const nameColumns = [
  { key: 'japaneseName', label: '日本語名' },
  { key: 'englishName', label: '英語名' },
] as const

const sourceLanguageLabels: Record<NameSource['language'], string> = {
  ja: '日本語',
  en: '英語',
  'ja-en': '日英対照',
}

export function NameMappingsTable({ entity, entries, sources, sort, onSort, expandedId, onToggleSources, onCloseSources }: NameMappingsTableProps) {
  const sourceById = new Map(sources.map((source) => [source.id, source]))

  return (
    <div className="data-table-scroll" role="region" aria-label={`${entity === 'characters' ? 'キャラクター' : 'クラス'}名の対応表。横にスクロールできます`} tabIndex={0}
      onKeyDown={(event) => { if (event.key === 'Escape' && expandedId !== null) { event.preventDefault(); event.stopPropagation(); onCloseSources() } }}>
      <table className="data-table name-mappings-table">
        <caption className="visually-hidden">日本語名と英語名の対応。—は対応未確認です。</caption>
        <colgroup><col className="name-mappings-name-column" span={2} /><col className="name-mappings-status-column" /><col className="name-mappings-source-column" /></colgroup>
        <thead>
          <tr>
            {nameColumns.map(({ key, label }) => {
              const selected = sort.key === key
              const nextDirection = selected && sort.direction === 'asc' ? '降順' : '昇順'
              return (
                <th key={key} scope="col" aria-sort={selected ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button type="button" className="table-sort-button" onClick={() => onSort(key)} aria-label={`${label}を${nextDirection}に並べ替え`}>
                    <span>{label}</span>
                    <span className="table-sort-indicator" aria-hidden="true">{selected ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              )
            })}
            <th scope="col"><span className="name-mappings-heading">確認状況</span></th>
            <th scope="col"><span className="name-mappings-heading">出典</span></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const expanded = expandedId === entry.id
            const panelId = `${entity}-name-sources-${encodeURIComponent(entry.id)}`
            return (
              <Fragment key={entry.id}>
                <tr className="name-mapping-row">
                  <th scope="row">
                    {entry.japaneseName ?? <span className="name-mapping-missing" aria-label={`${entry.englishName}の日本語名は未確認`}>—</span>}
                  </th>
                  <td lang="en">{entry.englishName}</td>
                  <td><span className={`name-mapping-status ${entry.status}`}>{entry.status === 'verified' ? '確認済' : '未確認'}</span></td>
                  <td>
                    {entry.status === 'verified' ? (
                      <button type="button" className="name-mapping-source-button" aria-label={`${entry.japaneseName}の出典`} aria-expanded={expanded} aria-controls={expanded ? panelId : undefined} onClick={(event) => onToggleSources(entry.id, event.currentTarget)}>
                        出典
                      </button>
                    ) : <span className="name-mapping-missing">—</span>}
                  </td>
                </tr>
                {expanded && (
                  <tr className="name-mapping-source-row">
                    <td colSpan={4}>
                      <section id={panelId} aria-label={`${entry.japaneseName}の名前の出典`} className="name-mapping-evidence">
                        <div className="name-mapping-evidence-header">
                          <h2>{entry.japaneseName} / <span lang="en">{entry.englishName}</span></h2>
                          <button type="button" className="name-mapping-close" onClick={onCloseSources}>閉じる</button>
                        </div>
                        <div className="name-mapping-source-list">
                          {entry.sourceIds.map((sourceId) => {
                            const source = sourceById.get(sourceId)!
                            return (
                              <div key={source.id}>
                                <a href={source.url} target="_blank" rel="noopener noreferrer">{sourceLanguageLabels[source.language]}：{source.name}<span aria-hidden="true"> ↗</span><span className="visually-hidden">（新しいタブで開く）</span></a>
                                <dl>
                                  <dt>取得日</dt><dd>{source.retrievedAt}</dd>
                                  <dt>元ページの版</dt><dd>{source.sourceVersion ?? '不明'}</dd>
                                  <dt>ゲームの版</dt><dd>{source.gameVersion ?? '不明'}</dd>
                                </dl>
                              </div>
                            )
                          })}
                        </div>
                        <dl className="name-mapping-check">
                          <dt>確認日</dt><dd>{entry.checkedAt}</dd>
                          <dt>照合内容</dt><dd>{entry.note}</dd>
                        </dl>
                      </section>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
