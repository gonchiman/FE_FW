import { useEffect, useId, useRef, useState } from 'react'
import type { GrowthHistogramBin } from '../lib/growth-statistics'
import './GrowthHistogram.css'

export interface GrowthHistogramProps {
  bins: GrowthHistogramBin[]
  metricLabel: string
  count: number
  measure: 'count' | 'percent'
  mean: number | null
  median: number | null
  showMean: boolean
  showMedian: boolean
  selectedBin: number | null
  onSelectBin: (index: number) => void
}

const numberFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 })
const tickFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 3 })

function niceStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value || 1))
  const fraction = value / magnitude
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude
}

function rangeLabel(bin: GrowthHistogramBin) {
  return `${numberFormatter.format(bin.lower)}%以上 ${numberFormatter.format(bin.upper)}%未満`
}

export function GrowthHistogram({
  bins, metricLabel, count, measure, mean, median, showMean, showMedian, selectedBin, onSelectBin,
}: GrowthHistogramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [width, setWidth] = useState(640)
  const [hoveredBin, setHoveredBin] = useState<number | null>(null)
  const [focusedBin, setFocusedBin] = useState<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const updateWidth = () => {
      const measuredWidth = container.getBoundingClientRect().width
      if (measuredWidth > 0) setWidth(Math.floor(measuredWidth))
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const percentage = (bin: GrowthHistogramBin) => count > 0 ? bin.count / count * 100 : 0
  const value = (bin: GrowthHistogramBin) => measure === 'count' ? bin.count : percentage(bin)
  const maxValue = bins.reduce((maximum, bin) => Math.max(maximum, value(bin)), 0)
  const step = measure === 'count' ? Math.max(1, niceStep(maxValue / 4)) : niceStep(maxValue / 4)
  const yMax = measure === 'percent'
    ? Math.min(100, Math.max(step, Math.ceil(maxValue / step) * step))
    : Math.max(step, Math.ceil(maxValue / step) * step)
  const yTicks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, index) => index * step)
  const lower = bins[0]?.lower ?? 0
  const upper = bins[bins.length - 1]?.upper ?? 1
  const left = 45
  const right = 14
  const top = 29
  const plotHeight = 180
  const bottom = top + plotHeight
  const height = bottom + 54
  const plotWidth = Math.max(1, width - left - right)
  const x = (growth: number) => left + (growth - lower) / (upper - lower || 1) * plotWidth
  const y = (frequency: number) => bottom - frequency / yMax * plotHeight
  const boundaries = [...bins.map((bin) => bin.lower), upper]
  const tickCount = Math.min(width < 480 ? 4 : 7, boundaries.length)
  const xTicks = Array.from({ length: tickCount }, (_, index) => (
    boundaries[Math.round(index * (boundaries.length - 1) / Math.max(1, tickCount - 1))]
  ))
  const detailIndex = hoveredBin ?? focusedBin ?? selectedBin
  const detailBin = bins.find((bin) => bin.index === detailIndex)
  const references: { key: string; label: string; value: number; dashed: boolean }[] = []
  if (showMean && mean !== null && Number.isFinite(mean)) {
    references.push({ key: 'mean', label: '平均', value: mean, dashed: true })
  }
  if (showMedian && median !== null && Number.isFinite(median)) {
    references.push({ key: 'median', label: '中央値', value: median, dashed: false })
  }

  return (
    <div ref={containerRef} className="growth-histogram" role="region" aria-label={`${metricLabel}の度数分布`}>
      {count === 0 || bins.length === 0 ? (
        <p className="growth-histogram-empty">表示できるデータがありません。</p>
      ) : (
        <>
          <svg className="growth-histogram-svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
            <title id={titleId}>{metricLabel}のヒストグラム</title>
            <desc id={descriptionId}>横軸は{metricLabel}（%）、縦軸は{measure === 'count' ? '人数（人）' : '構成比（%）'}。各階級を選択すると対象のキャラクターを確認できます。</desc>
            <g aria-hidden="true">
              <text className="growth-histogram-axis-title" x={left} y={14}>{measure === 'count' ? '人数（人）' : '構成比（%）'}</text>
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line className="growth-histogram-grid" x1={left} x2={left + plotWidth} y1={y(tick)} y2={y(tick)} />
                  <text className="growth-histogram-tick" x={left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">{tickFormatter.format(tick)}</text>
                </g>
              ))}
              <rect className="growth-histogram-frame" x={left} y={top} width={plotWidth} height={plotHeight} />
              {xTicks.map((tick, index) => (
                <g key={tick}>
                  <line className="growth-histogram-tick-mark" x1={x(tick)} x2={x(tick)} y1={bottom} y2={bottom + 4} />
                  <text className="growth-histogram-tick" x={x(tick)} y={bottom + 20} textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}>{tickFormatter.format(tick)}</text>
                </g>
              ))}
              <text className="growth-histogram-axis-title" x={left + plotWidth / 2} y={height - 6} textAnchor="middle">{metricLabel}（%）</text>
            </g>
            {bins.map((bin) => {
              const selected = selectedBin === bin.index
              const binWidth = x(bin.upper) - x(bin.lower)
              const gap = Math.min(3, binWidth * 0.12)
              const barHeight = Math.max(0, bottom - y(value(bin)))
              const label = `${rangeLabel(bin)}、${bin.count}人、${numberFormatter.format(percentage(bin))}%`
              return (
                <g
                  key={bin.index}
                  className={`growth-histogram-bin${selected ? ' is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => onSelectBin(bin.index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectBin(bin.index)
                    }
                  }}
                  onFocus={() => {
                    setHoveredBin(null)
                    setFocusedBin(bin.index)
                  }}
                  onBlur={() => setFocusedBin(null)}
                  onMouseEnter={() => setHoveredBin(bin.index)}
                  onMouseLeave={() => setHoveredBin(null)}
                >
                  <title>{label}</title>
                  <rect className="growth-histogram-hit-area" x={x(bin.lower)} y={top} width={binWidth} height={plotHeight} />
                  <rect className="growth-histogram-bar" x={x(bin.lower) + gap / 2} y={bottom - barHeight} width={Math.max(0, binWidth - gap)} height={barHeight} />
                  <rect className="growth-histogram-focus" x={x(bin.lower) + 1} y={top + 1} width={Math.max(0, binWidth - 2)} height={plotHeight - 2} />
                  {selected && <path className="growth-histogram-selection" d={`M ${x(bin.lower) + binWidth / 2 - 3} ${bottom + 3} l 6 0 l -3 4 z`} />}
                </g>
              )
            })}
            <g className="growth-histogram-reference-lines" aria-hidden="true">
              {references.filter((reference) => reference.value >= lower && reference.value <= upper).map((reference) => (
                <line key={reference.key} className={`growth-histogram-reference${reference.dashed ? ' is-dashed' : ''}`} x1={x(reference.value)} x2={x(reference.value)} y1={top} y2={bottom} />
              ))}
            </g>
          </svg>
          {references.length > 0 && (
            <div className="growth-histogram-legend">
              {references.map((reference) => (
                <span key={reference.key}><span className={`growth-histogram-legend-line${reference.dashed ? ' is-dashed' : ''}`} aria-hidden="true" />{reference.label} {numberFormatter.format(reference.value)}%</span>
              ))}
            </div>
          )}
          <div className="growth-histogram-detail" aria-live="polite" aria-atomic="true">
            {detailBin && <><span>{rangeLabel(detailBin)}</span><span>{detailBin.count}人（{numberFormatter.format(percentage(detailBin))}%）</span>{selectedBin === detailBin.index && <span className="growth-histogram-selected-label">選択中</span>}</>}
          </div>
        </>
      )}
    </div>
  )
}
