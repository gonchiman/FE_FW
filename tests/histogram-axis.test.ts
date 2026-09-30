import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getHistogramAxisTicks } from '../src/lib/histogram-axis.ts'

test('labels use equal ten-point increments without appending an uneven endpoint', () => {
  assert.deepEqual(getHistogramAxisTicks(0, 75, 5, 600), [0, 10, 20, 30, 40, 50, 60, 70])
  assert.deepEqual(getHistogramAxisTicks(0, 80, 10, 600), [0, 10, 20, 30, 40, 50, 60, 70, 80])
})

test('narrow charts increase the numeric step instead of shrinking labels', () => {
  assert.deepEqual(getHistogramAxisTicks(0, 75, 5, 184), [0, 20, 40, 60])
  assert.deepEqual(getHistogramAxisTicks(0, 80, 10, 184), [0, 20, 40, 60, 80])
  assert.deepEqual(getHistogramAxisTicks(0, 75, 5, 800), Array.from({ length: 16 }, (_, i) => i * 5))
})

test('single bins and data above 100 retain readable uniform boundary ticks', () => {
  assert.deepEqual(getHistogramAxisTicks(0, 5, 5, 600), [0, 5])
  assert.deepEqual(getHistogramAxisTicks(0, 130, 5, 300), [0, 20, 40, 60, 80, 100, 120])
  for (const binWidth of [5, 10]) {
    for (const width of [120, 184, 400, 600, 1000]) {
      const ticks = getHistogramAxisTicks(0, 130, binWidth, width)
      const step = ticks[1] - ticks[0]
      assert.ok(ticks.every(value => value >= 0 && value <= 130 && value % binWidth === 0))
      assert.ok(ticks.slice(1).every((value, index) => value - ticks[index] === step))
      assert.ok(step / 130 * width >= 45)
    }
  }
})

test('unusable chart geometry has no invalid or fabricated tick labels', () => {
  for (const args of [[0, 0, 5, 100], [0, 75, 0, 100], [0, 75, 5, 0], [0, Infinity, 5, 100], [NaN, 75, 5, 100]]) {
    assert.deepEqual(getHistogramAxisTicks(...args as [number, number, number, number]), [])
  }
})
