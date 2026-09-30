import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPageFromHash } from '../src/lib/navigation.ts'

test('empty hash and home URL select the home page', () => {
  for (const hash of ['', '#', '#/']) assert.equal(getPageFromHash(hash)?.id, 'home')
})

test('growth URL selects the growth page and unknown routes stay unmatched', () => {
  assert.equal(getPageFromHash('#/growth-rates')?.id, 'growth-rates')
  assert.equal(getPageFromHash('#/analysis/growth-rates')?.id, 'growth-analysis')
  assert.equal(getPageFromHash('#/character-names')?.id, 'character-names')
  assert.equal(getPageFromHash('#/unknown'), undefined)
  assert.equal(getPageFromHash('#main-content'), undefined)
})
