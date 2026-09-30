import { Fragment } from 'react'
import type { CharacterName, NameSort, NameSource } from '../types/character-names'
import './DataTable.css'
import './CharacterNamesTable.css'

type CharacterNamesTableProps = {
  characters: CharacterName[]
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

export function CharacterNamesTable({ characters, sources, sort, onSort, expandedId, onToggleSources, onCloseSources }: CharacterNamesTableProps) {
  const sourceById = new Map(sources.map((source) => [source.id, source]))

  return (
    <div className="data-table-scroll" role="region" aria-label="キャラクター名の対応表。横にスクロールできます" tabIndex={0}>
      <table className="data-table character-names-table">
        <caption className="visually-hidden">日本語名と英語名の対応。—は対応未確認です。</caption>
        <colgroup><col className="character-names-name-column" span={2} /><col className="character-names-status-column" /><col className="character-names-source-column" /></colgroup>
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
            <th scope="col"><span className="character-names-heading">確認状況</span></th>
            <th scope="col"><span className="character-names-heading">出典</span></th>
          </tr>
        </thead>
        <tbody>
          {characters.map((character) => {
            const expanded = expandedId === character.id
            const panelId = `name-sources-${character.id}`
            return (
              <Fragment key={character.id}>
                <tr className="character-name-row">
                  <th scope="row">
                    {character.japaneseName ?? <span className="character-name-missing" aria-label={`${character.englishName}の日本語名は未確認`}>—</span>}
                  </th>
                  <td lang="en">{character.englishName}</td>
                  <td><span className={`character-name-status ${character.status}`}>{character.status === 'verified' ? '確認済' : '未確認'}</span></td>
                  <td>
                    {character.status === 'verified' ? (
                      <button type="button" className="character-name-source-button" aria-label={`${character.japaneseName}の出典`} aria-expanded={expanded} aria-controls={expanded ? panelId : undefined} onClick={(event) => onToggleSources(character.id, event.currentTarget)}>
                        出典
                      </button>
                    ) : <span className="character-name-missing">—</span>}
                  </td>
                </tr>
                {expanded && (
                  <tr className="character-name-source-row">
                    <td colSpan={4}>
                      <section id={panelId} aria-label={`${character.japaneseName}の名前の出典`} className="character-name-evidence">
                        <div className="character-name-evidence-header">
                          <h2>{character.japaneseName} / <span lang="en">{character.englishName}</span></h2>
                          <button type="button" className="character-name-close" onClick={onCloseSources}>閉じる</button>
                        </div>
                        <div className="character-name-source-list">
                          {character.sourceIds.map((sourceId) => {
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
                        <dl className="character-name-check">
                          <dt>確認日</dt><dd>{character.checkedAt}</dd>
                          <dt>照合内容</dt><dd>{character.note}</dd>
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
