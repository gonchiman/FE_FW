import { useEffect, useRef, useState } from 'react'
import { GrowthHistogram } from '../components/GrowthHistogram'
import { growthData } from '../data/growth-data'
import {
  buildGrowthHistogram,
  filterGrowthAnalysisCharacters,
  getGrowthStatistics,
  getHistogramUpperBound,
  type GrowthCondition,
} from '../lib/growth-statistics'
import { GROWTH_STATS, type GrowthDataset, type StatKey } from '../types/growth'
import '../components/DataTable.css'
import './GrowthRatesPage.css'
import './GrowthAnalysisPage.css'

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 })
const differenceFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
const format = (value: number | null) => value === null ? '—' : numberFormat.format(value)

function StatOptions() {
  return GROWTH_STATS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)
}

export function GrowthAnalysisContent({ data }: { data: GrowthDataset }) {
  const [metric, setMetric] = useState<StatKey>('spd')
  const [binWidth, setBinWidth] = useState<5 | 10>(5)
  const [measure, setMeasure] = useState<'count' | 'percent'>('count')
  const [showMean, setShowMean] = useState(true)
  const [showMedian, setShowMedian] = useState(true)
  const [filterEnabled, setFilterEnabled] = useState(false)
  const [filterMetric, setFilterMetric] = useState<StatKey>('str')
  const [operator, setOperator] = useState<GrowthCondition['operator']>('gte')
  const [threshold, setThreshold] = useState('45')
  const [selectedBin, setSelectedBin] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const metricRef = useRef<HTMLSelectElement>(null)
  const conditionButtonRef = useRef<HTMLButtonElement>(null)
  const conditionMetricRef = useRef<HTMLSelectElement>(null)
  const previousFilterEnabled = useRef(filterEnabled)

  useEffect(() => {
    if (previousFilterEnabled.current === filterEnabled) return
    previousFilterEnabled.current = filterEnabled
    if (filterEnabled) conditionMetricRef.current?.focus()
    else conditionButtonRef.current?.focus()
  }, [filterEnabled])

  const parsedThreshold = Number(threshold)
  const invalidCondition = filterEnabled && (threshold.trim() === '' || !Number.isFinite(parsedThreshold) || parsedThreshold < 0)
  const eligible = filterGrowthAnalysisCharacters(data.characters, null)
  const filtered = invalidCondition ? [] : filterGrowthAnalysisCharacters(eligible, filterEnabled ? { stat: filterMetric, operator, value: parsedThreshold } : null)
  const stats = getGrowthStatistics(filtered, metric)
  const upperBound = getHistogramUpperBound(eligible, binWidth)
  const bins = buildGrowthHistogram(filtered, metric, binWidth, upperBound)
  const selected = selectedBin === null ? null : bins[selectedBin] ?? null
  const selectedIds = selected === null ? null : new Set(selected.characterIds)
  const characters = filtered.filter(character => character.rates[metric] !== null && (selectedIds === null || selectedIds.has(character.id)))
    .sort((a, b) => b.rates[metric]! - a.rates[metric]! || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id))
  const visibleCharacters = showAll ? characters : characters.slice(0, 10)
  const metricLabel = GROWTH_STATS.find(stat => stat.key === metric)!.label
  const unverifiedCount = eligible.filter(character => character.status === 'unverified').length
  const sampleCount = data.characters.length - eligible.length
  const summary: [string, number | null, string][] = [
    ['最小', stats.min, '%'], ['第1四分位', stats.q1, '%'], ['中央値', stats.median, '%'],
    ['第3四分位', stats.q3, '%'], ['最大', stats.max, '%'], ['有効データ', stats.count, '人'],
    ['平均', stats.mean, '%'], ['標準偏差', stats.standardDeviation, 'pt'],
    ['四分位範囲', stats.iqr, 'pt'], ['値なし', stats.missingCount, '人'],
  ]

  function clearSelection() {
    setSelectedBin(null)
    setShowAll(false)
  }

  return (
    <section className="growth-analysis" aria-label="成長率の統計分析">
      <div className="analysis-toolbar">
        <label className="analysis-field">分析する能力
          <select ref={metricRef} value={metric} onChange={event => { setMetric(event.target.value as StatKey); clearSelection() }}><StatOptions /></select>
        </label>
        {!filterEnabled && <button ref={conditionButtonRef} className="analysis-button" type="button" onClick={() => { setFilterEnabled(true); clearSelection() }}>＋ 数値条件</button>}
        <div className="analysis-scope">
          {unverifiedCount > 0 && <span className="growth-data-status">{unverifiedCount === eligible.length ? 'ゲーム内未照合' : '未照合データを含む'}</span>}
          {sampleCount > 0 && <span className="growth-data-status">仮データ {sampleCount}人を除外</span>}
          <span role="status">対象 {invalidCondition ? '—' : filtered.length} / {eligible.length}人</span>
        </div>
      </div>

      {filterEnabled && (
        <fieldset className="analysis-condition">
          <legend>数値条件</legend>
          <label className="analysis-field">能力<select ref={conditionMetricRef} value={filterMetric} onChange={event => { setFilterMetric(event.target.value as StatKey); clearSelection() }}><StatOptions /></select></label>
          <label className="analysis-field">成長率（%）<input type="number" min="0" step="any" required value={threshold} aria-invalid={invalidCondition} aria-describedby={invalidCondition ? 'analysis-condition-error' : undefined} onChange={event => { setThreshold(event.target.value); clearSelection() }} /></label>
          <label className="analysis-field">条件<select value={operator} onChange={event => { setOperator(event.target.value as GrowthCondition['operator']); clearSelection() }}><option value="gte">以上</option><option value="lte">以下</option></select></label>
          <button className="analysis-button" type="button" onClick={() => { setFilterEnabled(false); clearSelection() }}>条件を解除</button>
        </fieldset>
      )}

      {invalidCondition ? <p id="analysis-condition-error" className="analysis-error" role="alert">0以上の数値を入力してください。</p> : <>
        <section className="analysis-panel" aria-labelledby="analysis-summary-title">
          <div className="analysis-panel-heading"><h2 id="analysis-summary-title"><span>01</span>統計サマリー</h2><p>{metricLabel} · 値なし {stats.missingCount}人</p></div>
          <dl className="analysis-summary">{summary.map(([name, value, unit]) => <div key={name}><dt>{name}</dt><dd>{format(value)}{value !== null && <small> {unit}</small>}</dd></div>)}</dl>
        </section>

        <section className="analysis-panel" aria-labelledby="analysis-histogram-title">
          <div className="analysis-panel-heading"><h2 id="analysis-histogram-title"><span>02</span>ヒストグラム</h2><p>1人 = 1件</p></div>
          <div className="analysis-panel-content">
            <div className="analysis-chart-controls">
              <label className="analysis-field">階級幅<select value={binWidth} onChange={event => { setBinWidth(Number(event.target.value) as 5 | 10); clearSelection() }}><option value="5">5ポイント</option><option value="10">10ポイント</option></select></label>
              <label className="analysis-field">縦軸<select value={measure} onChange={event => setMeasure(event.target.value as 'count' | 'percent')}><option value="count">人数</option><option value="percent">割合</option></select></label>
              <label className="analysis-check"><input type="checkbox" checked={showMean} onChange={event => setShowMean(event.target.checked)} />平均</label>
              <label className="analysis-check"><input type="checkbox" checked={showMedian} onChange={event => setShowMedian(event.target.checked)} />中央値</label>
            </div>
            <GrowthHistogram bins={bins} metricLabel={metricLabel} count={stats.count} measure={measure} mean={stats.mean} median={stats.median} showMean={showMean} showMedian={showMedian} selectedBin={selectedBin} onSelectBin={index => { setSelectedBin(index); setShowAll(false) }} />
            {stats.count > 0 && <details className="analysis-frequency"><summary>度数分布表</summary>
              <div className="data-table-scroll"><table className="data-table analysis-table">
                <caption className="visually-hidden">{metricLabel}の度数分布表。階級を選ぶと該当するキャラクターを表示します。</caption>
                <thead><tr><th scope="col">階級</th><th scope="col" className="table-number">人数</th><th scope="col" className="table-number">割合（%）</th></tr></thead>
                <tbody>{bins.map(bin => <tr key={bin.index}><th scope="row"><button className="analysis-bin-button" type="button" aria-pressed={selectedBin === bin.index} onClick={() => { setSelectedBin(bin.index); setShowAll(false) }}>{format(bin.lower)}%以上・{format(bin.upper)}%未満</button></th><td className="table-number">{bin.count}</td><td className="table-number">{format(bin.count / stats.count * 100)}</td></tr>)}</tbody>
              </table></div>
            </details>}
          </div>
        </section>

        <section className="analysis-panel" aria-labelledby="analysis-characters-title">
          <div className="analysis-panel-heading"><h2 id="analysis-characters-title"><span>03</span>対象キャラクター</h2><p>{characters.length}人</p></div>
          <div className="analysis-panel-content">
            <div className="analysis-selection"><span role="status">{selected ? `${metricLabel} ${format(selected.lower)}%以上・${format(selected.upper)}%未満：${characters.length}人` : '全範囲'}</span>{selected && <button className="analysis-button" type="button" onClick={() => { clearSelection(); metricRef.current?.focus() }}>選択を解除</button>}</div>
            {characters.length === 0 ? <p className="analysis-empty">該当するキャラクターがいません。</p> : <div className="data-table-scroll" role="region" aria-label="集計対象のキャラクター" tabIndex={0}><table className="data-table analysis-table analysis-characters-table">
              <caption className="visually-hidden">選択範囲のキャラクター。成長率の降順です。</caption>
              <thead><tr><th scope="col">キャラクター</th><th scope="col" className="table-number">{metricLabel}（%）</th><th scope="col" className="table-number">平均との差（pt）</th></tr></thead>
              <tbody>{visibleCharacters.map(character => <tr key={character.id}><th scope="row">{character.name}{unverifiedCount < eligible.length && character.status === 'unverified' && <span className="analysis-row-status">未照合</span>}</th><td className="table-number">{format(character.rates[metric])}</td><td className="table-number">{stats.mean === null ? '—' : differenceFormat.format(character.rates[metric]! - stats.mean)}</td></tr>)}</tbody>
            </table></div>}
            {characters.length > 10 && <button className="analysis-button analysis-show-all" type="button" onClick={() => setShowAll(!showAll)}>{showAll ? '10人に戻す' : `残り${characters.length - 10}人を表示`}</button>}
          </div>
        </section>
      </>}

      <details className="analysis-help"><summary>集計方法</summary>
        <p>個人成長率を1人1件、同じ重みで集計します。兵種補正・育成後の能力値は含みません。仮データは除外し、値なしは能力ごとに除外します。0%は集計に含めます。</p>
        <p>四分位数は昇順の位置 (n−1)p を線形補間します。標準偏差は表示中の集団を対象に分母 n で計算します。pt はパーセントポイントです。表示は小数第1位に丸め、計算には丸める前の値を使います。</p>
        <p>階級は下端を含み、上端を含みません。軸の上限は全能力・全対象の最大値より大きい階級境界に揃えます。能力・数値条件を変えても、同じ階級幅では軸の範囲を維持します。</p>
        <p>数値条件は統計全体に、階級の選択はキャラクター一覧だけに反映します。平均との差は数値条件を適用した集団との比較です。</p>
      </details>
      <details className="growth-sources analysis-sources"><summary>データの出典</summary>
        {data.sources.map(source => <div className="growth-source" key={source.id}>
          <p className="growth-source-name">{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}</p>
          {source.note && <p>{source.note}</p>}
          <dl><dt>取得日</dt><dd>{source.retrievedAt ?? '未取得'}</dd><dt>元データの版</dt><dd>{source.sourceVersion ?? '不明'}</dd><dt>ゲームの版</dt><dd>{source.gameVersion ?? '不明'}</dd></dl>
        </div>)}
      </details>
    </section>
  )
}

export function GrowthAnalysisPage() {
  if (!growthData.data) return <p role="alert">{growthData.error}</p>
  return <GrowthAnalysisContent data={growthData.data} />
}
