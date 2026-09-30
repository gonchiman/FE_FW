import { useLayoutEffect, useRef, useState } from 'react'
import { placeGroupedBarValueLabels } from '../lib/groupedBarValueLabels'
import { avoidHistogramReferenceLines } from '../lib/histogramPercentageLabels'
import { getHistogramBinRangeLabelCenters } from '../lib/histogramBinRangeLabels'

export interface HistogramBarGeometry {
  x: number
  y: number
  width: number
  height: number
  percentage: string | null
}

export function useHistogramPercentageLayout(bars: HistogramBarGeometry[], width: number, height: number, enabled: boolean, referenceXs: number[]) {
  const labelsRef = useRef<SVGGElement>(null)
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({})
  const textKey = JSON.stringify(enabled ? bars.map((bar) => bar.percentage) : [])
  useLayoutEffect(() => {
    if (!enabled) return
    let active = true
    const measure = () => {
      if (!active) return
      const context = document.createElement('canvas').getContext('2d')
      if (!context) return
      const next: typeof sizes = {}
      labelsRef.current?.querySelectorAll<SVGTextElement>('text[data-percentage-index]').forEach((text) => {
        // CSS font metrics stay unscaled inside the reduced-size PNG preview.
        const style = getComputedStyle(text)
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        next[text.dataset.percentageIndex!] = {
          width: Math.ceil(context.measureText(text.textContent ?? '').width) + 6,
          height: Math.ceil(Number.parseFloat(style.fontSize) * 1.3) + 4,
        }
      })
      setSizes((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
    measure()
    void document.fonts.ready.then(measure)
    document.fonts.addEventListener('loadingdone', measure)
    return () => { active = false; document.fonts.removeEventListener('loadingdone', measure) }
  }, [enabled, textKey])
  const placement = placeGroupedBarValueLabels({
    width, height, gap: 4,
    labels: enabled ? bars.flatMap((bar, index) => bar.percentage === null ? [] : [{
      id: String(index), anchorX: bar.x + bar.width / 2, anchorY: bar.y,
      width: sizes[index]?.width ?? bar.percentage.length * 8 + 6,
      height: sizes[index]?.height ?? 20, direction: 'above' as const,
    }]) : [],
    obstacles: bars.filter((bar) => bar.height > 0),
  })
  return { ...avoidHistogramReferenceLines({ layout: placement, referenceXs, width, height, bars }), labelsRef }
}

export function useHistogramBinRangeLayout(labels: { center: number; lines: string[] }[], plotLeft: number, plotRight: number, enabled: boolean) {
  const measureRef = useRef<SVGTextElement>(null)
  const [measured, setMeasured] = useState<{ key: string; widths: number[] }>({ key: '', widths: [] })
  const textKey = JSON.stringify(labels.map((label) => label.lines))
  useLayoutEffect(() => {
    if (!enabled) return
    let active = true
    const measure = () => {
      const text = measureRef.current
      if (!active || !text) return
      const context = document.createElement('canvas').getContext('2d')
      if (!context) return
      const style = getComputedStyle(text)
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const lines: string[][] = JSON.parse(textKey)
      const widths = lines.map((parts) => Math.ceil(Math.max(0, ...parts.map((part) => context.measureText(part).width))) + 2)
      setMeasured((current) => current.key === textKey && current.widths.length === widths.length
        && current.widths.every((width, index) => width === widths[index]) ? current : { key: textKey, widths })
    }
    measure()
    void document.fonts.ready.then(measure)
    document.fonts.addEventListener('loadingdone', measure)
    return () => { active = false; document.fonts.removeEventListener('loadingdone', measure) }
  }, [enabled, textKey])
  const centers = enabled && measured.key === textKey && labels.every((label) => label.lines.length > 0)
    ? getHistogramBinRangeLabelCenters(labels.map((label, index) => ({ center: label.center, width: measured.widths[index] })), plotLeft, plotRight, 2)
    : null
  return { measureRef, visible: centers !== null, centers }
}
