import { useRef, useState } from 'react'
import { CollapsibleAnalysisPanel } from '../components/CollapsibleAnalysisPanel'
import { GrowthNumericFilter } from '../components/GrowthNumericFilter'
import { PanelStateScope } from '../lib/PanelStateScope'
import { usePanelOpen } from '../lib/usePanelOpen'
import { filterGrowthCharactersByConditions, formatGrowthNumericCondition, type GrowthNumericCondition } from '../lib/growth-numeric-filters'
import { GrowthHistogram } from '../components/GrowthHistogram'
import { characterNameData } from '../data/character-names-data'
import { growthData } from '../data/growth-data'
import { ChartImageSaveDialog, type ChartImageAspectSettings } from '../components/ChartImageSaveDialog'
import { GrowthHistogramImage, GrowthHistogramImagePreview, type GrowthHistogramImageData } from '../components/GrowthHistogramImage'
import { saveComparisonChartImage } from '../components/saveComparisonChartImage'
import { getChartImageSavePicker, selectChartImageDestination } from '../lib/chartImageDestination'
import { getChartImageLayout } from '../lib/chartImageLayout'
import { createChartImageFilename, withChartImageAspect } from '../lib/chartImageFilename'
import {
  buildGrowthHistogram,
  filterGrowthAnalysisCharacters,
  getGrowthStatistics,
  getHistogramUpperBound,
} from '../lib/growth-statistics'
import { GROWTH_STATS, type GrowthDataset, type StatKey } from '../types/growth'
import '../components/DataTable.css'
import './GrowthRatesPage.css'
import './GrowthAnalysisPage.css'

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 })
const differenceFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
const format = (value: number | null) => value === null ? '—' : numberFormat.format(value)
const japaneseNames = new Map(
  (characterNameData.data?.characters ?? [])
    .filter(character => character.status === 'verified' && character.japaneseName !== null)
    .map(character => [character.id, character.japaneseName]),
)

function StatOptions() {
  return GROWTH_STATS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)
}

export function GrowthAnalysisContent({ data }: { data: GrowthDataset }) {
  const [metric, setMetric] = useState<StatKey>('spd')
  const [binWidth, setBinWidth] = useState<5 | 10>(5)
  const [measure, setMeasure] = useState<'count' | 'percent'>('count')
  const [showMean, setShowMean] = useState(false)
  const [showMedian, setShowMedian] = useState(false)
  const [showPercentages, setShowPercentages] = useState(false)
  const [showBinRanges, setShowBinRanges] = useState(false)
  const [conditions, setConditions] = useState<readonly GrowthNumericCondition[]>([])
  const [frequencyOpen, setFrequencyOpen] = usePanelOpen('growth-frequency-distribution', false)
  const [selectedBin, setSelectedBin] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [savingImage, setSavingImage] = useState(false)
  const [imageMessage, setImageMessage] = useState('')
  const [imageError, setImageError] = useState(false)
  const [imageData, setImageData] = useState<GrowthHistogramImageData | null>(null)
  const [imageAspect, setImageAspect] = useState<ChartImageAspectSettings>({ preset: 'auto', width: '16', height: '9' })
  const savingImageRef = useRef(false)
  const selectionStatusRef = useRef<HTMLSpanElement>(null)
  const eligible = filterGrowthAnalysisCharacters(data.characters, null)
  const filtered = filterGrowthCharactersByConditions(eligible, conditions)
  const conditionLabels = conditions.map(formatGrowthNumericCondition).filter((label): label is string => label !== null)
  const scopeLabel = conditionLabels.length > 0 ? conditionLabels.join('・') : '全キャラクター'
  const stats = getGrowthStatistics(filtered, metric)
  const upperBound = getHistogramUpperBound(eligible, binWidth)
  const bins = buildGrowthHistogram(filtered, metric, binWidth, upperBound)
  const selected = selectedBin === null ? null : bins[selectedBin] ?? null
  const selectedIds = selected === null ? null : new Set(selected.characterIds)
  const characters = filtered.filter(character => character.rates[metric] !== null && Number.isFinite(character.rates[metric]) && character.rates[metric]! >= 0 && (selectedIds === null || selectedIds.has(character.id)))
    .sort((a, b) => b.rates[metric]! - a.rates[metric]! || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id))
  const visibleCharacters = showAll ? characters : characters.slice(0, 10)
  const metricLabel = GROWTH_STATS.find(stat => stat.key === metric)!.label
  const unverifiedCount = eligible.filter(character => character.status === 'unverified').length
  const sampleCount = data.characters.length - eligible.length
  const summary: [string, number | null, string, string?][] = [
    ['最小', stats.min, '%'], ['第1四分位', stats.q1, '%'], ['中央値', stats.median, '%'],
    ['第3四分位', stats.q3, '%'], ['最大', stats.max, '%'], ['有効データ', stats.count, '人'],
    ['平均', stats.mean, '%'], ['標準偏差', stats.standardDeviation, 'pt'],
    ['変動係数（CV）', stats.coefficientOfVariation === null ? null : stats.coefficientOfVariation * 100, '%'],
    ['正規化IQR', stats.normalizedIqr === null ? null : stats.normalizedIqr * 100, '%', `IQR ${format(stats.iqr)}${stats.iqr === null ? '' : 'pt'}`],
  ]
  let cumulativeCount = 0
  const frequencyRows = bins.map(bin => {
    cumulativeCount += bin.count
    return { bin, cumulativeCount }
  })

  function clearSelection() {
    setSelectedBin(null)
    setShowAll(false)
  }

  const previewAspect = imageAspect.preset === 'auto' ? undefined : Number(imageAspect.width) / Number(imageAspect.height)

  function openImageSaveDialog() {
    if (stats.count === 0 || savingImageRef.current) return
    setImageMessage('')
    setImageError(false)
    const filterLabel = scopeLabel
    const sourceIds = new Set(filtered.filter(character => character.rates[metric] !== null).map(character => character.sourceId))
    const sources = data.sources.filter(source => sourceIds.has(source.id))
    const unverifiedImageCount = filtered.filter(character => character.rates[metric] !== null && character.status === 'unverified').length
    setImageData({
      bins, metricLabel, count: stats.count, measure, mean: stats.mean, median: stats.median, showMean, showMedian, showPercentages, showBinRanges, selectedBin,
      filename: createChartImageFilename('成長率', [metricLabel, 'ヒストグラム', measure === 'count' ? '人数' : '割合', filterLabel, `幅${binWidth}`, showMean && '平均', showMedian && '中央値', showPercentages && '割合表示', showBinRanges && '階級範囲', selected && `選択${selected.lower}-${selected.upper}%`]),
      conditions: [filterLabel, `${stats.count}人`, `階級幅 ${binWidth}pt`,
        ...(stats.missingCount > 0 ? [`値なし ${stats.missingCount}人を除外`] : []),
        ...(selected ? [`選択 ${selected.lower}%以上${selected.upper}%未満`] : []),
      ].join(' · '),
      statusLabel: unverifiedImageCount === stats.count ? 'ゲーム内未照合' : unverifiedImageCount > 0 ? '未照合データを含む' : '',
      sourceLabel: sources.map(source => source.name).join(' / '),
    })
  }

  async function saveImage(filename: string, aspectRatio?: number) {
    if (!imageData || savingImageRef.current) return
    savingImageRef.current = true
    setSavingImage(true)
    setImageError(false)
    try {
      const destination = await selectChartImageDestination(filename, getChartImageSavePicker())
      if (destination.type === 'cancelled') return
      const layout = getChartImageLayout({ naturalChartHeight: 334, aspectRatio })
      await saveComparisonChartImage({
        chart: <GrowthHistogramImage data={imageData} aspectRatio={aspectRatio} />,
        width: layout.width,
        filename,
        writeBlob: destination.type === 'file' ? destination.write : undefined,
      })
      setImageMessage(destination.type === 'file' ? 'PNG画像を保存しました。' : 'PNG画像のダウンロードを開始しました。')
      setImageData(null)
    } catch {
      setImageError(true)
    } finally {
      savingImageRef.current = false
      setSavingImage(false)
    }
  }

  return (
    <section className="growth-analysis" aria-label="成長率の統計分析">
      <div className="analysis-page-actions">
        <div className="analysis-data-status">
          {unverifiedCount > 0 && <span className="growth-data-status">{unverifiedCount === eligible.length ? 'ゲーム内未照合' : '未照合データを含む'}</span>}
          {sampleCount > 0 && <span className="growth-data-status">仮データ {sampleCount}人を除外</span>}
        </div>
        <a href="#/growth-rates">成長率一覧へ →</a>
      </div>

      <CollapsibleAnalysisPanel id="growth-summary" number="01" title="統計サマリー" summary={`${metricLabel} · ${scopeLabel} · 値なし ${stats.missingCount}人`} collapsedLabel="展開" bodyClassName="analysis-panel-body">
        <div className="analysis-summary-body">
          <label className="analysis-summary-setting">統計を見るステータス
            <select value={metric} onChange={event => { setMetric(event.target.value as StatKey); clearSelection() }}><StatOptions /></select>
          </label>
          <dl className="analysis-summary" aria-label={`${metricLabel}の統計量`}>{summary.map(([name, value, unit, detail]) => <div key={name}><dt>{name}</dt><dd>{format(value)}{value !== null && <small> {unit}</small>}{detail && <small className="analysis-summary-note">{detail}</small>}</dd></div>)}</dl>
          <details className="analysis-summary-help"><summary>統計量の見方</summary>
            <dl>
              <div><dt>有効データ・値なし</dt><dd>数値のないデータは能力ごとに除外します。0%は有効データに含めます。</dd></div>
              <div><dt>第1・第3四分位</dt><dd>データを小さい順に並べたときの25%点・75%点です。</dd></div>
              <div><dt>変動係数（CV）</dt><dd>標準偏差 ÷ 平均を%で表示します。平均が0のときは「—」を表示します。</dd></div>
              <div><dt>四分位範囲（IQR）</dt><dd>第3四分位 − 第1四分位です。</dd></div>
              <div><dt>正規化IQR</dt><dd>IQR ÷ 中央値を%で表示します。中央値が0のときは「—」を表示します。</dd></div>
            </dl>
          </details>
        </div>
      </CollapsibleAnalysisPanel>

      <CollapsibleAnalysisPanel id="growth-distribution" number="02" title="分布グラフ" summary={`${metricLabel} · ヒストグラム · ${scopeLabel} · 対象 ${stats.count}人`} collapsedLabel="展開" bodyClassName="analysis-panel-body">
        <div className="analysis-distribution-body">
          <div className="analysis-filters" role="group" aria-label="集計対象の絞り込み">
            <GrowthNumericFilter conditions={conditions} onChange={next => { setConditions(next); clearSelection() }} />
            <div className="analysis-filter-result">
              <span role="status">対象 <strong>{filtered.length}</strong> / {eligible.length}人</span>
              <span>{scopeLabel}</span>
            </div>
          </div>
          <fieldset className="analysis-metric-setting">
            <legend>分布を見るステータス</legend>
            <div className="analysis-metric-selector" role="group" aria-label="分布を見るステータス">
              {GROWTH_STATS.map(stat => <button key={stat.key} type="button" aria-pressed={metric === stat.key} onClick={() => { setMetric(stat.key); clearSelection() }}>{stat.label}</button>)}
            </div>
          </fieldset>
          <div className="analysis-chart-toolbar">
            <fieldset className="analysis-axis-setting"><legend>縦軸</legend>
              <div className="analysis-segmented" role="group" aria-label="縦軸の表示">
                <button type="button" aria-pressed={measure === 'count'} onClick={() => setMeasure('count')}>人数</button>
                <button type="button" aria-pressed={measure === 'percent'} onClick={() => setMeasure('percent')}>割合</button>
              </div>
            </fieldset>
            <button className="analysis-button analysis-image-save-button" type="button" disabled={stats.count === 0 || savingImage} onClick={openImageSaveDialog}>画像を保存</button>
          </div>
          <div className="analysis-histogram-settings">
            <strong>ヒストグラム設定</strong>
            <label className="analysis-field">階級幅<select value={binWidth} onChange={event => { setBinWidth(Number(event.target.value) as 5 | 10); clearSelection() }}><option value="5">5ポイント</option><option value="10">10ポイント</option></select></label>
          </div>
          <figure className="analysis-figure">
            <figcaption>
              <div><strong>{metricLabel}のヒストグラム</strong>
                <span>横軸：成長率（%） · 縦軸：{measure === 'count' ? '人数' : '割合（%）'}</span>
                {showPercentages && stats.count > 0 && <span>割合の基準：{scopeLabel} · {stats.count}人（有効データ）</span>}
              </div>
              <div className="analysis-display-controls">
                <label className="analysis-check"><input type="checkbox" checked={showPercentages} onChange={event => setShowPercentages(event.target.checked)} />割合を表示</label>
                <label className="analysis-check"><input type="checkbox" checked={showBinRanges} onChange={event => setShowBinRanges(event.target.checked)} />階級の範囲を表示</label>
                <div className="analysis-chart-legend">
                  <label className="analysis-check"><input type="checkbox" checked={showMean} onChange={event => setShowMean(event.target.checked)} /><i className="analysis-mean-swatch" />平均</label>
                  <label className="analysis-check"><input type="checkbox" checked={showMedian} onChange={event => setShowMedian(event.target.checked)} /><i className="analysis-median-swatch" />中央値</label>
                </div>
              </div>
            </figcaption>
            <GrowthHistogram bins={bins} metricLabel={metricLabel} count={stats.count} measure={measure} mean={stats.mean} median={stats.median} showMean={showMean} showMedian={showMedian} showPercentages={showPercentages} showBinRanges={showBinRanges} selectedBin={selectedBin} onSelectBin={index => { setSelectedBin(index); setShowAll(false) }} />
            {stats.count > 0 && <details className="analysis-frequency" open={frequencyOpen} onToggle={event => setFrequencyOpen(event.currentTarget.open)}><summary><span>度数分布表</span><small>{bins.length}階級</small></summary>
              <div className="analysis-frequency-meta"><span>階級幅 <strong>{binWidth}pt</strong></span><span>範囲 <strong>0%以上・{upperBound}%未満</strong></span></div>
              <div className="data-table-scroll" role="region" aria-label="度数分布表" tabIndex={0}><table className="data-table analysis-table">
                <caption className="visually-hidden">{metricLabel}の度数分布表。階級を選ぶと該当するキャラクターを表示します。</caption>
                <thead><tr><th scope="col">階級</th><th scope="col" className="table-number">人数</th><th scope="col" className="table-number">割合（%）</th><th scope="col" className="table-number">累積割合（%）</th></tr></thead>
                <tbody>{frequencyRows.map(({ bin, cumulativeCount: cumulative }) => <tr key={bin.index}><th scope="row"><button className="analysis-bin-button" type="button" aria-pressed={selectedBin === bin.index} onClick={() => { setSelectedBin(bin.index); setShowAll(false) }}>{format(bin.lower)}%以上・{format(bin.upper)}%未満</button></th><td className="table-number">{bin.count}</td><td className="table-number">{format(bin.count / stats.count * 100)}</td><td className="table-number" title={`累積：${cumulative}人`}>{format(cumulative / stats.count * 100)}</td></tr>)}</tbody>
              </table></div>
            </details>}
          </figure>
          <p className="visually-hidden" role="status">{imageMessage}</p>
        </div>
      </CollapsibleAnalysisPanel>

      <CollapsibleAnalysisPanel id="growth-characters" number="03" title="対象キャラクター" summary={`${metricLabel} · ${characters.length}人`} collapsedLabel="展開" bodyClassName="analysis-panel-body">
        <div className="analysis-panel-content">
          <div className="analysis-selection"><span ref={selectionStatusRef} tabIndex={-1} role="status">{selected ? `${metricLabel} ${format(selected.lower)}%以上・${format(selected.upper)}%未満：${characters.length}人` : '全範囲'}</span>{selected && <button className="analysis-button" type="button" onClick={() => { clearSelection(); selectionStatusRef.current?.focus() }}>選択を解除</button>}</div>
          {characters.length === 0 ? <p className="analysis-empty">該当するキャラクターがいません。</p> : <div className="data-table-scroll" role="region" aria-label="集計対象のキャラクター" tabIndex={0}><table className="data-table analysis-table analysis-characters-table">
            <caption className="visually-hidden">選択範囲のキャラクター。成長率の降順です。</caption>
            <thead><tr><th scope="col">キャラクター</th><th scope="col" className="table-number">{metricLabel}（%）</th><th scope="col" className="table-number">平均との差（pt）</th></tr></thead>
            <tbody>{visibleCharacters.map(character => <tr key={character.id}><th scope="row">{japaneseNames.get(character.id) ?? character.name}{unverifiedCount < eligible.length && character.status === 'unverified' && <span className="analysis-row-status">未照合</span>}</th><td className="table-number">{format(character.rates[metric])}</td><td className="table-number">{stats.mean === null ? '—' : differenceFormat.format(character.rates[metric]! - stats.mean)}</td></tr>)}</tbody>
          </table></div>}
          {characters.length > 10 && <button className="analysis-button analysis-show-all" type="button" onClick={() => setShowAll(!showAll)}>{showAll ? '10人に戻す' : `残り${characters.length - 10}人を表示`}</button>}
        </div>
      </CollapsibleAnalysisPanel>
      <details className="analysis-help"><summary>集計方法</summary>
        <p>個人成長率を1人1件、同じ重みで集計します。兵種補正・育成後の能力値は含みません。仮データは除外し、値なしは能力ごとに除外します。0%は集計に含めます。</p>
        <p>四分位数は昇順の位置 (n−1)p を線形補間します。標準偏差は表示中の集団を対象に分母 n で計算します。pt はパーセントポイントです。表示は小数第1位に丸め、計算には丸める前の値を使います。</p>
        <p>階級は下端を含み、上端を含みません。軸の上限は全能力・全対象の最大値より大きい階級境界に揃えます。能力・数値条件を変えても、同じ階級幅では軸の範囲を維持します。</p>
        <p>数値条件はすべてを満たすキャラクターに絞り込み、統計全体に反映します。空欄や入力エラーのある条件は適用しません。階級の選択はキャラクター一覧だけに反映します。平均との差は数値条件を適用した集団との比較です。</p>
        <p>「割合を表示」は各階級の人数を有効データの人数で割った割合を棒の上に表示します。「階級の範囲を表示」は各棒の下に下端〜上端を表示し、文字が収まらない幅では通常の目盛りに戻します。</p>
      </details>
      <details className="growth-sources analysis-sources"><summary>データの出典</summary>
        {data.sources.map(source => <div className="growth-source" key={source.id}>
          <p className="growth-source-name">{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}</p>
          {source.note && <p>{source.note}</p>}
          <dl><dt>取得日</dt><dd>{source.retrievedAt ?? '未取得'}</dd><dt>元データの版</dt><dd>{source.sourceVersion ?? '不明'}</dd><dt>ゲームの版</dt><dd>{source.gameVersion ?? '不明'}</dd></dl>
        </div>)}
      </details>
      {imageData && <ChartImageSaveDialog initialFilename={imageData.filename}
        getDefaultFilename={ratio => withChartImageAspect(imageData.filename, ratio)}
        aspect={imageAspect} onAspectChange={setImageAspect} canChooseLocation={Boolean(getChartImageSavePicker())}
        saving={savingImage} error={imageError} helpMode="popover"
        preview={<GrowthHistogramImagePreview key={`${imageData.filename}-${previewAspect}`} data={imageData} aspectRatio={previewAspect} />}
        onClose={() => { if (!savingImageRef.current) { setImageData(null); setImageError(false) } }}
        onSave={(filename, ratio) => { void saveImage(filename, ratio) }} />}
    </section>
  )
}

export function GrowthAnalysisPage() {
  if (!growthData.data) return <p role="alert">{growthData.error}</p>
  return <PanelStateScope value="growth-analysis"><GrowthAnalysisContent data={growthData.data} /></PanelStateScope>
}
