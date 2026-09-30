import assert from 'node:assert/strict'
import test from 'node:test'
import { getPanelStorageKey, readPanelOpen, writePanelOpen } from '../src/lib/panelPreferences.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

test('panels keep independent preferences across pages and from the Arknights app', () => {
  const storage = memoryStorage()
  const analysis = getPanelStorageKey('growth-analysis', 'summary')
  const other = getPanelStorageKey('other-analysis', 'summary')
  storage.values.set('arknights-panel-open-v1:growth-analysis:summary', 'true')
  writePanelOpen(analysis, false, storage)
  writePanelOpen(other, true, storage)
  assert.match(analysis, /^fe-fw-panel-open-v1:/)
  assert.equal(readPanelOpen(analysis, true, storage), false)
  assert.equal(readPanelOpen(other, false, storage), true)
  assert.equal(storage.values.get('arknights-panel-open-v1:growth-analysis:summary'), 'true')
})

test('new and malformed preferences preserve both open and closed defaults', () => {
  const storage = memoryStorage()
  for (const value of [undefined, '', 'invalid', '0', 'null', '{}']) {
    if (value === undefined) storage.values.delete('panel')
    else storage.values.set('panel', value)
    assert.equal(readPanelOpen('panel', true, storage), true)
    assert.equal(readPanelOpen('panel', false, storage), false)
  }
})

test('both saved states are restored independently of the default', () => {
  const storage = memoryStorage()
  for (const open of [true, false]) {
    writePanelOpen('panel', open, storage)
    assert.equal(readPanelOpen('panel', !open, storage), open)
  }
})

test('separator characters cannot collide across page and panel scopes', () => {
  assert.notEqual(getPanelStorageKey('a:b', 'c'), getPanelStorageKey('a', 'b:c'))
  assert.notEqual(getPanelStorageKey('a%3Ab', 'c'), getPanelStorageKey('a:b', 'c'))
  assert.match(getPanelStorageKey('growth-analysis', '__proto__'), /^fe-fw-panel-open-v1:/)
})

test('unavailable storage and read/write failures leave defaults usable', () => {
  const denied = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('full') } }
  assert.equal(readPanelOpen('panel', false, denied), false)
  assert.equal(readPanelOpen('panel', true, denied), true)
  assert.doesNotThrow(() => writePanelOpen('panel', false, denied))
  assert.equal(readPanelOpen('panel', false), false)
  assert.doesNotThrow(() => writePanelOpen('panel', true))
})
