import assert from 'node:assert/strict'
import { test } from 'node:test'
import { placeGroupedBarValueLabels } from '../src/lib/groupedBarValueLabels.ts'
import { avoidHistogramReferenceLines, formatHistogramPercentage } from '../src/lib/histogramPercentageLabels.ts'
import { formatHistogramBinRangeLines, getHistogramBinRangeLabelCenters } from '../src/lib/histogramBinRangeLabels.ts'
import { buildGrowthHistogram, getGrowthStatistics } from '../src/lib/growth-statistics.ts'
import { GROWTH_STATS, type CharacterGrowth } from '../src/types/growth.ts'

test('percentage labels match arknights formatting, including zero and tiny positive shares', () => {
  assert.equal(formatHistogramPercentage(13, 62), '21.0%')
  assert.equal(formatHistogramPercentage(11, 62), '17.7%')
  assert.equal(formatHistogramPercentage(0, 62), '0.0%')
  assert.equal(formatHistogramPercentage(1, 1), '100.0%')
  assert.equal(formatHistogramPercentage(1, 1_000), '0.1%')
  assert.equal(formatHistogramPercentage(1, 1_001), '<0.1%')
  assert.equal(formatHistogramPercentage(Number.MIN_VALUE, Number.MAX_VALUE), '<0.1%')
  for (const [count, total] of [[0, 0], [1, 0], [-1, 10], [11, 10], [NaN, 10], [1, Infinity]]) {
    assert.equal(formatHistogramPercentage(count, total), null)
  }
})

test('range labels show both exact class boundaries, with no invented inclusive upper endpoint', () => {
  assert.deepEqual(formatHistogramBinRangeLines({ lower: 35, upper: 40 }), ['35〜', '40'])
  assert.deepEqual(formatHistogramBinRangeLines({ lower: 0, upper: 5 }), ['0〜', '5'])
  assert.deepEqual(formatHistogramBinRangeLines({ lower: 0.1, upper: 0.25 }), ['0.1〜', '0.25'])
  for (const [lower, upper] of [[0, 0], [5, 0], [NaN, 1], [0, Infinity]]) {
    assert.deepEqual(formatHistogramBinRangeLines({ lower, upper }), [])
  }
})

test('percentages use only valid observations while keeping genuine zero growth in the first bin', () => {
  const characters: CharacterGrowth[] = [0, 0, 10, null].map((rate, index) => ({
    id: String(index), name: String(index), sourceId: 'test', status: 'unverified',
    rates: Object.fromEntries(GROWTH_STATS.map(({ key }) => [key, rate])) as CharacterGrowth['rates'],
  }))
  const statistics = getGrowthStatistics(characters, 'spd')
  assert.equal(statistics.count, 3)
  assert.equal(statistics.missingCount, 1)
  assert.deepEqual(buildGrowthHistogram(characters, 'spd', 5, 15).map((bin) => formatHistogramPercentage(bin.count, statistics.count)), ['66.7%', '0.0%', '33.3%'])
})

test('all ranges must fit at their own bars; narrow charts fall back without shrinking text', () => {
  const atWidth = (width: number) => Array.from({ length: 15 }, (_, index) => ({ center: (index + 0.5) * width / 15, width: 26 }))
  assert.deepEqual(getHistogramBinRangeLabelCenters(atWidth(600), 0, 600, 2), atWidth(600).map(({ center }) => center))
  assert.equal(getHistogramBinRangeLabelCenters(atWidth(184), 0, 184, 2), null)
  assert.deepEqual(getHistogramBinRangeLabelCenters([{ center: 2, width: 10 }, { center: 98, width: 10 }], 0, 100), [5, 95])
  assert.equal(getHistogramBinRangeLabelCenters([{ center: 80, width: 24 }, { center: 96, width: 24 }], 0, 100), null)
  assert.equal(getHistogramBinRangeLabelCenters([], 0, 100), null)
  assert.equal(getHistogramBinRangeLabelCenters([{ center: 50, width: NaN }], 0, 100), null)
})

function separated(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x + a.width + 4 <= b.x + 1e-8 || b.x + b.width + 4 <= a.x + 1e-8
    || a.y + a.height + 4 <= b.y + 1e-8 || b.y + b.height + 4 <= a.y + 1e-8
}

test('dense labels keep every value, avoid bars and neighbors, and reserve required headroom', () => {
  const bars = Array.from({ length: 15 }, (_, index) => ({ x: index * 12, y: index % 3 * 30, width: 10, height: 180 - index % 3 * 30 }))
  const labels = bars.map((bar, index) => ({ id: String(index), anchorX: bar.x + bar.width / 2, anchorY: bar.y, width: 38, height: 20, direction: 'above' as const }))
  const options = { labels, width: 184, height: 180, obstacles: bars }
  const before = structuredClone(options)
  const result = placeGroupedBarValueLabels(options)
  assert.equal(result.labels.length, 15)
  assert.ok(result.extraTop > 0)
  assert.deepEqual(result, placeGroupedBarValueLabels(options))
  assert.deepEqual(options, before)
  for (const [index, label] of result.labels.entries()) {
    assert.ok(label.x >= 0 && label.x + label.width <= 184)
    assert.ok(label.y >= -result.extraTop)
    assert.equal(label.anchorX, labels[index].anchorX)
    assert.equal(label.anchorY, labels[index].anchorY)
    for (const obstacle of [...bars, ...result.labels.slice(index + 1)]) assert.ok(separated(label, obstacle))
  }
})

test('percentage placement avoids both mean and median without moving unaffected labels', () => {
  const moving = { id: 'moving', x: 40, y: 20, width: 20, height: 12, anchorX: 50, anchorY: 36, shifted: false }
  const fixed = { ...moving, id: 'fixed', x: 90, anchorX: 100 }
  const layout = { labels: [moving, fixed], extraTop: 0, extraBottom: 0 }
  const before = structuredClone(layout)
  const result = avoidHistogramReferenceLines({ layout, referenceXs: [45, 55, 45], width: 120, height: 100, bars: [] })
  assert.deepEqual(result.labels[0], { ...moving, x: 20, shifted: true })
  assert.strictEqual(result.labels[1], fixed)
  assert.deepEqual(layout, before)
  for (const x of [45, 55]) assert.ok(result.labels[0].x + result.labels[0].width <= x - 5)
  assert.strictEqual(avoidHistogramReferenceLines({ layout, referenceXs: [], width: 120, height: 100, bars: [] }), layout)
})

test('when bars block horizontal movement, the label gains headroom without crossing a reference line', () => {
  const label = { id: 'value', x: 40, y: 20, width: 20, height: 12, anchorX: 50, anchorY: 36, shifted: false }
  const bars = [{ x: 0, y: 10, width: 35, height: 90 }, { x: 65, y: 10, width: 55, height: 90 }]
  const result = avoidHistogramReferenceLines({ layout: { labels: [label], extraTop: 0, extraBottom: 0 }, referenceXs: [50], width: 120, height: 100, bars })
  assert.deepEqual(result.labels[0], { ...label, x: 25, y: -6, shifted: true })
  assert.equal(result.extraTop, 6)
  for (const bar of bars) assert.ok(separated(result.labels[0], bar))
})
