import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ChartImageFrame } from './ChartImageFrame'
import { GrowthHistogram, type GrowthHistogramProps } from './GrowthHistogram'
import { getChartImageLayout } from '../lib/chartImageLayout'
import './GrowthHistogramImage.css'

export interface GrowthHistogramImageData extends Omit<GrowthHistogramProps, 'fixedWidth' | 'fixedHeight' | 'image' | 'onSelectBin' | 'reservedLabelHeight' | 'onLabelOverflow'> {
  filename: string
  conditions: string
  statusLabel: string
  sourceLabel: string
}

export function GrowthHistogramImage({ data, aspectRatio, onLayout }: {
  data: GrowthHistogramImageData
  aspectRatio?: number
  onLayout?: (size: { width: number; height: number }) => void
}) {
  const [labelOverflow, setLabelOverflow] = useState(0)
  const reserveLabelOverflow = useCallback((required: number) => {
    setLabelOverflow(current => Math.max(current, required))
  }, [])
  return <ChartImageFrame className="growth-histogram-image" title={`${data.metricLabel}のヒストグラム`}
    conditions={data.conditions} naturalChartHeight={334 + labelOverflow} axisTitle={`${data.metricLabel}（%）`}
    aspectRatio={aspectRatio} onLayout={onLayout}
    legend={<span className="growth-histogram-image-source">{[data.statusLabel, data.sourceLabel].filter(Boolean).join(' · ')}</span>}>
    {({ width, height }) => <GrowthHistogram {...data} fixedWidth={width} fixedHeight={height} image reservedLabelHeight={labelOverflow} onLabelOverflow={reserveLabelOverflow} onSelectBin={() => {}} />}
  </ChartImageFrame>
}

export function GrowthHistogramImagePreview({ data, aspectRatio }: { data: GrowthHistogramImageData; aspectRatio?: number }) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = useState(600)
  const [size, setSize] = useState<{ width: number; height: number }>(() => getChartImageLayout({ naturalChartHeight: 334, aspectRatio }))
  useLayoutEffect(() => {
    const element = previewRef.current
    if (!element) return
    const measure = () => setAvailableWidth(Math.max(1, element.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const scale = Math.min(availableWidth / size.width, 380 / size.height, 1)
  const pixelRatio = Math.min(2, 16_000 / size.width, 16_000 / size.height, Math.sqrt(32_000_000 / size.width / size.height))
  return <div className="growth-image-preview">
    <div className="growth-image-preview-heading"><span>プレビュー</span><span>PNG</span></div>
    <div ref={previewRef} className="growth-image-preview-frame" style={{ height: Math.ceil(size.height * scale) }}>
      <div className="growth-image-preview-position" style={{ width: size.width, height: size.height,
        left: (availableWidth - size.width * scale) / 2, transform: `scale(${scale})` }}>
        <GrowthHistogramImage data={data} aspectRatio={aspectRatio} onLayout={setSize} />
      </div>
    </div>
    <span className="growth-image-preview-size" aria-live="polite">
      {Math.floor(size.width * pixelRatio).toLocaleString('ja-JP')} × {Math.floor(size.height * pixelRatio).toLocaleString('ja-JP')} px
    </span>
  </div>
}
