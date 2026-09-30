import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { GrowthHistogramBin } from '../lib/growth-statistics'
import { getHistogramAxisTicks } from '../lib/histogram-axis'
import { formatHistogramPercentage } from '../lib/histogramPercentageLabels'
import { formatHistogramBinRangeLines } from '../lib/histogramBinRangeLabels'
import { layoutHistogramReferenceLabels } from '../lib/histogramReferenceLabels'
import { useHistogramBinRangeLayout, useHistogramPercentageLayout, type HistogramBarGeometry } from './useHistogramLabels'
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
  fixedWidth?: number
  fixedHeight?: number
  image?: boolean
  showPercentages?: boolean
  showBinRanges?: boolean
  reservedLabelHeight?: number
  onLabelOverflow?: (height: number) => void
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

interface HistogramReference {
  key: 'mean' | 'median'
  label: string
  value: number
}

function useReferenceLabels(references: HistogramReference[], position: (value: number) => number,
  plotLeft: number, plotRight: number, compact: boolean) {
  const elements = useRef<Partial<Record<HistogramReference['key'], SVGTextElement | null>>>({})
  const [widths, setWidths] = useState<Partial<Record<HistogramReference['key'], number>>>({})
  const textKey = JSON.stringify(references.map(({ key, label, value }) => [key, label, value]))
  useLayoutEffect(() => {
    let active = true
    const measure = () => {
      if (!active) return
      const next = {
        mean: elements.current.mean?.getComputedTextLength() ?? 0,
        median: elements.current.median?.getComputedTextLength() ?? 0,
      }
      setWidths(current => current.mean === next.mean && current.median === next.median ? current : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    Object.values(elements.current).forEach(element => { if (element) observer.observe(element) })
    void document.fonts.ready.then(measure)
    document.fonts.addEventListener('loadingdone', measure)
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener('loadingdone', measure) }
  }, [compact, textKey, plotLeft, plotRight])

  const layout = layoutHistogramReferenceLabels(references.map(reference => {
    const text = `${reference.label} ${numberFormatter.format(reference.value)}%`
    return { ...reference, text, x: position(reference.value), width: widths[reference.key] || text.length * 11 }
  }), plotLeft, plotRight, compact)
  return { elements, ...layout }
}

export function GrowthHistogram({
  bins, metricLabel, count, measure, mean, median, showMean, showMedian, selectedBin, onSelectBin, fixedWidth, fixedHeight, image = false,
  showPercentages = false, showBinRanges = false, reservedLabelHeight = 0, onLabelOverflow,
}: GrowthHistogramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [measuredWidth, setWidth] = useState(640)
  const width = fixedWidth ?? measuredWidth
  const [hoveredBin, setHoveredBin] = useState<number | null>(null)
  const [focusedBin, setFocusedBin] = useState<number | null>(null)

  useEffect(() => {
    if (fixedWidth !== undefined) return
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
  }, [fixedWidth])

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
  const left = Math.max(52, 30 + tickFormatter.format(yMax).length * 7)
  const right = 18
  const requestedHeight = fixedHeight ?? 310
  const baseHeight = requestedHeight - reservedLabelHeight
  const baseBottom = baseHeight - (image ? 18 : 52)
  const plotWidth = Math.max(1, width - left - right)
  const x = (growth: number) => left + (growth - lower) / (upper - lower || 1) * plotWidth
  const boundaries = [...bins.map((bin) => bin.lower), upper]
  const xTicks = getHistogramAxisTicks(lower, upper, bins[0] ? bins[0].upper - bins[0].lower : 1, plotWidth)
  const majorTickValues = new Set(xTicks)
  const detailIndex = hoveredBin ?? focusedBin ?? selectedBin
  const detailBin = bins.find((bin) => bin.index === detailIndex)
  const references: HistogramReference[] = []
  if (showMean && mean !== null && Number.isFinite(mean)) {
    references.push({ key: 'mean', label: '平均', value: mean })
  }
  if (showMedian && median !== null && Number.isFinite(median)) {
    references.push({ key: 'median', label: '中央値', value: median })
  }
  const visibleReferences = references.filter((reference) => reference.value >= lower && reference.value <= upper)
  const referenceLabels = useReferenceLabels(visibleReferences, x, left, width - right, image || showPercentages)
  const top = image ? referenceLabels.top : 44
  const plotHeight = Math.max(1, baseBottom - top)
  const barGap = Math.min(3, Math.max(1, plotWidth / Math.max(1, bins.length) * 0.08))
  const bars = bins.map((bin): HistogramBarGeometry => {
    const binWidth = x(bin.upper) - x(bin.lower)
    const barHeight = value(bin) / yMax * plotHeight
    return {
      x: x(bin.lower) - left + barGap / 2, y: plotHeight - barHeight,
      width: Math.max(0, binWidth - barGap), height: Math.max(0, barHeight),
      percentage: formatHistogramPercentage(bin.count, count),
    }
  })
  const percentageLayout = useHistogramPercentageLayout(bars, plotWidth, plotHeight, showPercentages && count > 0,
    visibleReferences.map((reference) => x(reference.value) - left))
  const binRangeLabels = bins.map((bin, index) => ({
    center: left + bars[index].x + bars[index].width / 2, lines: formatHistogramBinRangeLines(bin),
  }))
  const binRangeLayout = useHistogramBinRangeLayout(binRangeLabels, left, width - 2, showBinRanges && count > 0)
  const extraTop = Math.ceil(percentageLayout.extraTop)
  const extraBottom = binRangeLayout.visible ? 20 : 0
  useLayoutEffect(() => { onLabelOverflow?.(extraTop + extraBottom) }, [extraTop, extraBottom, onLabelOverflow])
  const height = Math.max(requestedHeight, baseHeight + extraTop + extraBottom)
  const bottom = baseBottom + extraTop
  const y = (frequency: number) => bottom - frequency / yMax * plotHeight

  return (
    <div ref={containerRef} className={`growth-histogram${image ? ' growth-histogram-image-plot' : ''}`} role="region" aria-label={`${metricLabel}の度数分布`}>
      {count === 0 || bins.length === 0 ? (
        <p className="growth-histogram-empty">表示できるデータがありません。</p>
      ) : (
        <>
          <svg className="growth-histogram-svg" data-histogram-axis={binRangeLayout.visible ? 'ranges' : 'ticks'} viewBox={`0 0 ${width} ${height}`} width={image ? width : undefined} height={image ? height : undefined} role={image ? 'img' : 'group'} aria-labelledby={titleId} aria-describedby={descriptionId}>
            <title id={titleId}>{metricLabel}のヒストグラム</title>
            <desc id={descriptionId}>横軸は{metricLabel}（%）、縦軸は{measure === 'count' ? '人数（人）' : '構成比（%）'}。{!image && '各階級を選択すると対象のキャラクターを確認できます。'}{visibleReferences.map(reference => ` ${reference.label} ${numberFormatter.format(reference.value)}%。`).join('')}{showPercentages && ` 棒上に有効データ${count}人に対する割合を表示します。`}{showBinRanges && (binRangeLayout.visible ? ' 各棒の下に階級の範囲を表示します。下限以上、上限未満です。' : ' 階級の範囲が収まらないため、通常の横軸目盛りを表示します。')}</desc>
            {showBinRanges && <text ref={binRangeLayout.measureRef} className="growth-histogram-tick growth-histogram-range-label" visibility="hidden" aria-hidden="true">0</text>}
            <g aria-hidden="true">
              <text className="growth-histogram-axis-title" transform={`translate(14 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">{measure === 'count' ? '人数（人）' : '構成比（%）'}</text>
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line className="growth-histogram-grid" x1={left} x2={left + plotWidth} y1={y(tick)} y2={y(tick)} />
                  <text className="growth-histogram-tick" x={left - 8} y={y(tick) + 4} textAnchor="end">{tickFormatter.format(tick)}</text>
                </g>
              ))}
              <rect className="growth-histogram-frame" x={left} y={top} width={plotWidth} height={plotHeight + extraTop} />
              {!binRangeLayout.visible && boundaries.filter(boundary => !majorTickValues.has(boundary)).map(boundary => (
                <line key={boundary} className="growth-histogram-tick-mark" x1={x(boundary)} x2={x(boundary)} y1={bottom} y2={bottom + 2} />
              ))}
              {!binRangeLayout.visible && xTicks.map(tick => (
                <g key={tick} className="growth-histogram-x-tick">
                  <line className="growth-histogram-tick-mark" x1={x(tick)} x2={x(tick)} y1={bottom} y2={bottom + 5} />
                  <text className="growth-histogram-tick" x={x(tick)} y={bottom + 19} textAnchor={tick === lower ? 'start' : tick === upper ? 'end' : 'middle'}>{tickFormatter.format(tick)}</text>
                </g>
              ))}
              {binRangeLayout.centers && <g className="growth-histogram-range-axis">
                {binRangeLabels.map((label, index) => <g key={bins[index].index}>
                  <line className="growth-histogram-tick-mark" x1={label.center} x2={label.center} y1={bottom} y2={bottom + 5} />
                  <text className="growth-histogram-tick growth-histogram-range-label" x={binRangeLayout.centers![index]} y={bottom + 19} textAnchor="middle">
                    <title>{rangeLabel(bins[index])}</title>
                    {label.lines.map((line, lineIndex) => <tspan key={lineIndex} x={binRangeLayout.centers![index]} dy={lineIndex === 0 ? 0 : 15}>{line}</tspan>)}
                  </text>
                </g>)}
              </g>}
              {!image && <text className="growth-histogram-axis-title" x={left + plotWidth / 2} y={height - 8} textAnchor="middle">{metricLabel}（%）</text>}
            </g>
            {bins.map((bin) => {
              const selected = selectedBin === bin.index
              const binWidth = x(bin.upper) - x(bin.lower)
              const barHeight = Math.max(0, bottom - y(value(bin)))
              const label = `${rangeLabel(bin)}、${bin.count}人、${numberFormatter.format(percentage(bin))}%`
              return (
                <g
                  key={bin.index}
                  className={`growth-histogram-bin${selected ? ' is-selected' : ''}`}
                  role={image ? undefined : 'button'}
                  tabIndex={image ? undefined : 0}
                  aria-label={label}
                  aria-pressed={image ? undefined : selected}
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
                  <rect className="growth-histogram-hit-area" x={x(bin.lower)} y={top} width={binWidth} height={plotHeight + extraTop} />
                  <rect className="growth-histogram-bar" x={x(bin.lower) + barGap / 2} y={bottom - barHeight} width={Math.max(0, binWidth - barGap)} height={barHeight} />
                  <rect className="growth-histogram-focus" x={x(bin.lower) + 1} y={top + 1} width={Math.max(0, binWidth - 2)} height={Math.max(0, plotHeight + extraTop - 2)} />
                  {selected && <path className="growth-histogram-selection" d={`M ${x(bin.lower) + binWidth / 2 - 3} ${bottom + 3} l 6 0 l -3 4 z`} />}
                </g>
              )
            })}
            <g className="growth-histogram-reference-lines" aria-hidden="true">
              {referenceLabels.labels.map((reference) => (
                <g key={reference.key}>
                  <line className={`growth-histogram-reference ${reference.key}`} x1={x(reference.value)} x2={x(reference.value)} y1={top} y2={bottom} />
                  <text ref={element => { referenceLabels.elements.current[reference.key] = element }} className={`growth-histogram-reference-label ${reference.key}`} x={reference.x} y={reference.y}>{reference.text}</text>
                </g>
              ))}
            </g>
            <g ref={percentageLayout.labelsRef} className="growth-histogram-percentages" transform={`translate(${left} ${top + extraTop})`} aria-hidden="true">
              {percentageLayout.labels.filter((label) => label.shifted).map((label) => (
                <line key={label.id} className="growth-histogram-percentage-connector" x1={label.anchorX} y1={label.anchorY - 2}
                  x2={label.x + label.width / 2} y2={label.y + label.height} />
              ))}
              {percentageLayout.labels.map((label) => <text key={label.id} className="growth-histogram-percentage-label" data-percentage-index={label.id}
                x={label.x + label.width / 2} y={label.y + label.height / 2} dominantBaseline="central" textAnchor="middle">{bars[Number(label.id)].percentage}</text>)}
            </g>
          </svg>
          {!image && <div className="growth-histogram-detail" aria-live="polite" aria-atomic="true">
            {detailBin && <><span>{rangeLabel(detailBin)}</span><span>{detailBin.count}人（{numberFormatter.format(percentage(detailBin))}%）</span>{selectedBin === detailBin.index && <span className="growth-histogram-selected-label">選択中</span>}</>}
          </div>}
        </>
      )}
    </div>
  )
}
