import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateGrowthDataset } from '../src/lib/growth.ts'

test('the checked-in dataset passes validation and can populate the page', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/character-growths.json', import.meta.url), 'utf8'))
  const data = validateGrowthDataset(raw)
  assert.ok(data.characters.length > 0)
})
