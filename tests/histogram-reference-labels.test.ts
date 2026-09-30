import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layoutHistogramReferenceLabels } from '../src/lib/histogramReferenceLabels.ts'

test('screen labels that collide after right-edge clamping use separate rows', () => {
  // A 520px chart with domain 0–75, mean 57.5 and median 70.
  const layout = layoutHistogramReferenceLabels([
    { key: 'mean', x: 397, width: 48 },
    { key: 'median', x: 472, width: 62 },
  ], 52, 502, false)
  const [mean, median] = layout.labels
  assert.equal(mean.x, 401)
  assert.equal(median.x + median.width, 502)
  assert.ok(mean.x + mean.width > median.x)
  assert.equal(mean.y, 14)
  assert.equal(median.y, 29)
  assert.equal(layout.top, 44)
})

test('compact image labels also resolve overlap after clamping at either edge', () => {
  for (const positions of [[492, 500], [52, 55]]) {
    const layout = layoutHistogramReferenceLabels([
      { key: 'mean', x: positions[0], width: 65 },
      { key: 'median', x: positions[1], width: 62 },
    ], 52, 502, true)
    assert.ok(layout.labels.every(label => label.x >= 52 && label.x + label.width <= 502))
    assert.equal(layout.labels[0].y, 10)
    assert.equal(layout.labels[1].y, 26)
    assert.equal(layout.top, 32)
  }
})

test('separated labels stay on one row and placement preserves source coordinates', () => {
  const references = Object.freeze([
    Object.freeze({ key: 'mean', x: 100, width: 35 }),
    Object.freeze({ key: 'median', x: 200, width: 40 }),
  ])
  for (const compact of [false, true]) {
    const layout = layoutHistogramReferenceLabels(references, 52, 502, compact)
    assert.equal(layout.labels[0].y, layout.labels[1].y)
    assert.ok(layout.labels[0].x + layout.labels[0].width + 6 <= layout.labels[1].x)
    assert.equal(layout.top, compact ? 16 : 44)
  }
  assert.deepEqual(references.map(label => label.x), [100, 200])
})

test('one or no visible references do not reserve an unnecessary second row', () => {
  for (const compact of [false, true]) {
    assert.deepEqual(layoutHistogramReferenceLabels([], 52, 502, compact), { labels: [], top: compact ? 16 : 44 })
    const layout = layoutHistogramReferenceLabels([{ x: 500, width: 60 }], 52, 502, compact)
    assert.equal(layout.labels[0].x, 442)
    assert.equal(layout.labels[0].y, compact ? 10 : 14)
    assert.equal(layout.top, compact ? 16 : 44)
  }
})
