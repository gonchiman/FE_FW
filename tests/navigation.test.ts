import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getClassDetailHref, getClassIdFromHash, getNameTabFromHash, getNameTabHref, getPageFromHash } from '../src/lib/navigation.ts'

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

test('name tab links retain the existing route and can be restored from their hash', () => {
  for (const tab of ['characters', 'classes'] as const) {
    const href = getNameTabHref(tab)
    assert.equal(getPageFromHash(href)?.id, 'character-names')
    assert.equal(getNameTabFromHash(href), tab)
  }
  assert.equal(getNameTabHref('characters'), '#/character-names')
  assert.equal(getNameTabHref('classes'), '#/character-names?tab=classes')
  assert.equal(getPageFromHash('#/character-names?tab=classes')?.title, '名前対応表')
  assert.equal(getNameTabFromHash('#/character-names?other=value&tab=classes'), 'classes')
})

test('missing or unsupported name tabs default to characters without matching unknown pages', () => {
  for (const hash of ['#/character-names', '#/character-names?', '#/character-names?tab=',
    '#/character-names?tab=characters', '#/character-names?tab=unknown', '#/growth-rates?tab=classes',
    '#/unknown?tab=classes', '#main-content?tab=classes']) {
    assert.equal(getNameTabFromHash(hash), 'characters', hash)
  }
  assert.equal(getPageFromHash('#/growth-rates?tab=classes')?.id, 'growth-rates')
  assert.equal(getPageFromHash('#/unknown?tab=classes'), undefined)
  assert.equal(getPageFromHash('#main-content?tab=classes'), undefined)
})

test('class detail links retain the classes navigation and round-trip upstream IDs', () => {
  assert.equal(getPageFromHash('#/classes')?.id, 'classes')
  assert.equal(getClassIdFromHash('#/classes'), null)
  for (const id of ['Myrmidon', 'Light Cavalry', "King’s Guard", 'A?B#C']) {
    const href = getClassDetailHref(id)
    assert.equal(getPageFromHash(href)?.id, 'classes')
    assert.equal(getClassIdFromHash(href), id)
    assert.equal(getClassIdFromHash(`${href}?view=growths`), id)
  }
})

test('malformed class detail paths do not become list routes or throw', () => {
  for (const hash of ['#/classes/', '#/classes/%', '#/classes/%E0%A4%A', '#/classes/a/b', '#/classes/%2F', '#/classes/%20']) {
    assert.equal(getClassIdFromHash(hash), null, hash)
    assert.equal(getPageFromHash(hash), undefined, hash)
  }
  assert.equal(getPageFromHash('#/classes/unknown')?.id, 'classes')
})
