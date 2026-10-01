import { GROWTH_STATS, type CharacterGrowth, type GrowthSort, type GrowthSortKey } from '../types/growth'
import { getGrowthCharacterName } from '../lib/growth'
import './DataTable.css'
import './GrowthRatesTable.css'

type GrowthRatesTableProps = {
  characters: CharacterGrowth[]
  displayNames?: ReadonlyMap<string, string>
  sort: GrowthSort
  onSort: (key: GrowthSortKey) => void
  showSampleLabels: boolean
  showUnverifiedLabels: boolean
}

const columns = [{ key: 'name' as const, label: 'キャラクター' }, ...GROWTH_STATS]

export function GrowthRatesTable({ characters, displayNames, sort, onSort, showSampleLabels, showUnverifiedLabels }: GrowthRatesTableProps) {
  return (
    <div className="data-table-scroll" role="region" aria-label="個人成長率の表。横にスクロールできます" tabIndex={0}>
      <table className="data-table growth-table">
        <caption className="visually-hidden">個人成長率（%）。—は未確認の値です。</caption>
        <colgroup><col className="growth-name-column" /><col span={GROWTH_STATS.length} /></colgroup>
        <thead>
          <tr>
            {columns.map(({ key, label }) => {
              const selected = sort.key === key
              const nextDirection = selected ? (sort.direction === 'asc' ? '降順' : '昇順') : (key === 'name' ? '昇順' : '降順')
              return (
                <th key={key} scope="col" aria-sort={selected ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button className="table-sort-button" type="button" onClick={() => onSort(key)} aria-label={`${label}を${nextDirection}に並べ替え`}>
                    <span>{label}</span>
                    <span className="table-sort-indicator" aria-hidden="true">{selected ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {characters.map((character) => (
            <tr key={character.id}>
              <th scope="row">
                {getGrowthCharacterName(character, displayNames)}
                {showUnverifiedLabels && character.status === 'unverified' && <span className="growth-row-status">未照合</span>}
                {showSampleLabels && character.status === 'sample' && <span className="growth-row-status">仮データ</span>}
              </th>
              {GROWTH_STATS.map(({ key }) => (
                <td className="table-number" key={key}>
                  {character.rates[key] === null ? <span className="growth-missing" aria-label="未確認">—</span> : character.rates[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
