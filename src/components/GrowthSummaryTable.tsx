import { useState } from 'react'
import {
  sortGrowthSummaryRows,
  type GrowthSummaryRow,
  type GrowthSummarySort,
  type GrowthSummarySortKey,
} from '../lib/growth-summary'
import type { StatKey } from '../types/growth'
import './DataTable.css'
import './GrowthSummaryTable.css'

export interface GrowthSummaryTableProps {
  rows: readonly GrowthSummaryRow[]
  metric: StatKey
  onSelectMetric: (key: StatKey) => void
}

const numberFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 })
const columns: { key: GrowthSummarySortKey; label: string; unit?: string }[] = [
  { key: 'stat', label: 'ステータス' },
  { key: 'mean', label: '平均', unit: '%' },
  { key: 'median', label: '中央値', unit: '%' },
  { key: 'standardDeviation', label: '標準偏差', unit: 'pt' },
  { key: 'min', label: '最小', unit: '%' },
  { key: 'q1', label: '第1四分位', unit: '%' },
  { key: 'q3', label: '第3四分位', unit: '%' },
  { key: 'max', label: '最大', unit: '%' },
  { key: 'coefficientOfVariation', label: '変動係数（CV）', unit: '%' },
  { key: 'normalizedIqr', label: '正規化IQR', unit: '%' },
  { key: 'count', label: '有効データ', unit: '人' },
  { key: 'missingCount', label: '値なし', unit: '人' },
]

function formatValue(value: number | null) {
  return value === null ? <span className="growth-summary-missing" aria-label="算出なし">—</span> : numberFormatter.format(value)
}

export function GrowthSummaryTable({ rows, metric, onSelectMetric }: GrowthSummaryTableProps) {
  const [sort, setSort] = useState<GrowthSummarySort>({ key: 'stat', direction: 'asc' })
  const sortedRows = sortGrowthSummaryRows(rows, sort)
  const sortLabel = columns.find(column => column.key === sort.key)!.label
  const sortStatus = sort.key === 'stat'
    ? sort.direction === 'asc' ? 'ステータス標準順' : 'ステータス逆順'
    : `${sortLabel}の${sort.direction === 'asc' ? '昇順' : '降順'}`

  function selectSort(key: GrowthSummarySortKey) {
    setSort(current => ({
      key,
      direction: current.key === key ? current.direction === 'asc' ? 'desc' : 'asc' : key === 'stat' ? 'asc' : 'desc',
    }))
  }

  return (
    <div className="growth-summary-table-section">
      <div className="growth-summary-table-meta">
        <span>{rows.length}ステータス</span>
        <span role="status" aria-live="polite" aria-atomic="true">{sortStatus}</span>
      </div>
      <div className="data-table-scroll growth-summary-table-scroll" role="region" aria-label="成長率の統計サマリー。横にスクロールできます" tabIndex={0}>
        <table className="data-table growth-summary-table">
          <caption className="visually-hidden">全ステータスの成長率の統計量。—は算出できない値です。</caption>
          <colgroup><col className="growth-summary-stat-column" /><col span={8} /><col className="growth-summary-iqr-column" /><col span={2} /></colgroup>
          <thead>
            <tr>{columns.map(({ key, label, unit }) => {
              const selected = sort.key === key
              const nextDirection = selected ? sort.direction === 'asc' ? 'desc' : 'asc' : key === 'stat' ? 'asc' : 'desc'
              const nextLabel = key === 'stat' ? nextDirection === 'asc' ? '標準順' : '逆順' : nextDirection === 'asc' ? '昇順' : '降順'
              return <th key={key} scope="col" aria-sort={selected ? sort.direction === 'asc' ? 'ascending' : 'descending' : undefined}>
                <button type="button" className="table-sort-button" onClick={() => selectSort(key)} aria-label={`${label}${unit ? `（${unit}）` : ''}を${nextLabel}に並べ替え`}>
                  <span>{label}{unit && <small className="growth-summary-unit">（{unit}）</small>}</span>
                  <span className="table-sort-indicator" aria-hidden="true">{selected ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span>
                </button>
              </th>
            })}</tr>
          </thead>
          <tbody>{sortedRows.map(row => (
            <tr key={row.key} className={row.key === metric ? 'is-selected' : undefined}>
              <th scope="row">
                <button type="button" className="growth-summary-stat-button" aria-pressed={row.key === metric} aria-label={`${row.label}の分布を表示`} onClick={() => onSelectMetric(row.key)}>
                  <span className="growth-summary-selection-mark" aria-hidden="true">{row.key === metric ? '›' : ''}</span>
                  <span>{row.label}</span>
                </button>
              </th>
              {columns.slice(1).map(({ key }) => {
                if (key === 'stat') return null
                const value = row.statistics[key]
                const displayedValue = value !== null && (key === 'coefficientOfVariation' || key === 'normalizedIqr') ? value * 100 : value
                return <td key={key} className="table-number">
                  {formatValue(displayedValue)}
                  {key === 'normalizedIqr' && <small className="growth-summary-iqr-note">IQR {formatValue(row.statistics.iqr)}{row.statistics.iqr !== null && 'pt'}</small>}
                </td>
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
