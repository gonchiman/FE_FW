import { CLASS_TIERS, validateClassDataset } from '../../src/lib/class-data.ts'
import type { ClassDataset, ClassInfo, ClassSkill, ClassTier } from '../../src/types/classes.ts'
import type { StatKey } from '../../src/types/growth.ts'

const STAT_MAPPING = {
  HP: 'hp', Str: 'str', Mag: 'mag', Dex: 'dex', Spd: 'spd', Lck: 'lck', Def: 'def', Res: 'res', Cha: 'cha',
} as const satisfies Record<string, StatKey>

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} must be an object`)
  return value as Record<string, unknown>
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`)
  return value
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || value !== value.trim()) {
    throw new TypeError(`${path} must be a trimmed string${allowEmpty ? '' : ' that is not empty'}`)
  }
  return value
}

function sourceText(value: unknown, path: string): string | null {
  if (value === null) return null
  return string(value, path, true) || null
}

function httpsUrl(value: unknown, path: string): string {
  const text = string(value, path)
  const url = new URL(text)
  if (url.protocol !== 'https:' || url.username || url.password) throw new TypeError(`${path} must be an HTTPS URL without credentials`)
  return text
}

function finiteNumber(value: unknown, path: string): number | null {
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError(`${path} must be null or a finite number`)
  }
  return value
}

function stats(value: unknown, path: string): ClassInfo['growths'] {
  const raw = record(value, path)
  if (Object.keys(raw).length !== Object.keys(STAT_MAPPING).length) throw new TypeError(`${path} must contain exactly nine stats`)
  return Object.fromEntries(Object.entries(STAT_MAPPING).map(([upstream, local]) => [local, finiteNumber(raw[upstream], `${path}.${upstream}`)])) as ClassInfo['growths']
}

function unknownStats(): ClassInfo['bonuses'] {
  return Object.fromEntries(Object.values(STAT_MAPPING).map(key => [key, null])) as ClassInfo['bonuses']
}

function movement(value: unknown, path: string): number | null {
  const text = sourceText(value, path)
  if (text === null) return null
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) throw new TypeError(`${path} must contain a non-negative integer`)
  return Number(text)
}

interface SourceTable {
  heading: string
  rows: string[][]
}

/** Scraped image alt text sometimes repeats exactly the whole skill name. */
function skillName(text: string): string {
  const repeated = /^(.*?) \1$/.exec(text)
  return repeated?.[1] || text
}

function readSkills(tables: SourceTable[], heading: string, path: string): ClassSkill[] | null {
  const matches = tables.filter(table => table.heading === heading)
  if (matches.length === 0) return null
  if (matches.length > 1) throw new TypeError(`${path} contains duplicate ${heading} tables`)
  if (matches[0].rows.length === 0) return null
  return matches[0].rows.map((row, index) => {
    if (row.length !== 2) throw new TypeError(`${path}.${heading}[${index}] must contain a skill name and effect`)
    const name = skillName(string(row[0], `${path}.${heading}[${index}].name`))
    const sourceEffect = string(row[1], `${path}.${heading}[${index}].effect`, true)
    return { name, effect: sourceEffect === '' || sourceEffect === 'TBD' ? null : sourceEffect }
  })
}

/** Import only recorded values. Generic skill tables preserve every ability row. */
export function importClassSnapshot(input: unknown): ClassDataset {
  const snapshot = record(input, 'snapshot')
  if (snapshot.schemaVersion !== 1) throw new TypeError('snapshot.schemaVersion must be 1')
  const provenance = record(snapshot.provenance, 'provenance')
  const repository = string(provenance.repository, 'provenance.repository')
  if (repository !== 'Rico0319/Fortunes-Weave-Helper') throw new TypeError('provenance.repository is not the class source repository')
  const revision = string(provenance.sourceVersion, 'provenance.sourceVersion')
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new TypeError('provenance.sourceVersion must be a full Git SHA')
  const retrievedAt = string(provenance.retrievedAt, 'provenance.retrievedAt')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(retrievedAt) || !Number.isFinite(Date.parse(retrievedAt))
    || new Date(retrievedAt).toISOString().replace('.000Z', 'Z') !== retrievedAt) {
    throw new TypeError('provenance.retrievedAt must be a valid UTC ISO timestamp')
  }
  const gameVersion = provenance.gameVersion === null ? null : string(provenance.gameVersion, 'provenance.gameVersion')
  const filePaths = new Set<string>()
  const files = array(provenance.files, 'provenance.files').map((value, index) => {
    const path = `provenance.files[${index}]`
    const file = record(value, path)
    const sourcePath = string(file.path, `${path}.path`)
    if (!['data/fwe.json', 'data/fwe.db'].includes(sourcePath) || filePaths.has(sourcePath)) throw new TypeError(`${path}.path must identify a unique source file`)
    filePaths.add(sourcePath)
    const sha256 = string(file.sha256, `${path}.sha256`)
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new TypeError(`${path}.sha256 must be a SHA-256 hash`)
    const url = httpsUrl(file.url, `${path}.url`)
    if (url !== `https://github.com/${repository}/blob/${revision}/${sourcePath}`) throw new TypeError(`${path}.url must match the recorded version and file`)
    return { sourcePath, sha256, url }
  })
  if (filePaths.size !== 2) throw new TypeError('provenance.files must contain both source files')

  const rawClasses = record(snapshot.classes, 'classes')
  const classes = Object.keys(rawClasses).sort().map((name): ClassInfo => {
    string(name, 'class key')
    const raw = record(rawClasses[name], `classes.${name}`)
    const tier = string(raw.tier, `classes.${name}.tier`)
    if (!CLASS_TIERS.includes(tier as ClassTier)) throw new TypeError(`classes.${name}.tier is unknown: ${tier}`)
    return {
      id: name, name, tier: tier as ClassTier, status: 'unverified', unitType: null, movement: null,
      weapons: null, bonuses: unknownStats(), growths: stats(raw.growths, `classes.${name}.growths`),
      abilities: null, masterSkills: null, sourcePageUrl: null,
    }
  })
  const classesById = new Map(classes.map(item => [item.id, item]))
  const database = record(snapshot.database, 'database')
  const detailRows = new Map<string, Record<string, unknown>>()
  const classByPageId = new Map<string, ClassInfo>()
  for (const [index, entry] of array(database.classes, 'database.classes').entries()) {
    const path = `database.classes[${index}]`
    const row = record(entry, path)
    const name = string(row.name, `${path}.name`)
    const item = classesById.get(name)
    if (!item) throw new TypeError(`${path}.name references an unknown class: ${name}`)
    if (detailRows.has(name)) throw new TypeError(`${path}.name is duplicated: ${name}`)
    if (row.tier !== item.tier) throw new TypeError(`${path}.tier disagrees with the roster`)
    const pageId = string(row.page_id, `${path}.page_id`)
    if (!/^\d+$/.test(pageId) || classByPageId.has(pageId)) throw new TypeError(`${path}.page_id must be unique and numeric`)
    detailRows.set(name, row)
    classByPageId.set(pageId, item)
    item.unitType = sourceText(row.type, `${path}.type`)
    item.movement = movement(row.movement, `${path}.movement`)
    const weapons = sourceText(row.weapons, `${path}.weapons`)
    item.weapons = weapons === null ? null : weapons.split(',').map((weapon, index) => string(weapon.trim(), `${path}.weapons[${index}]`))
  }

  const pageIds = new Set<string>()
  for (const [index, entry] of array(database.pages, 'database.pages').entries()) {
    const path = `database.pages[${index}]`
    const row = record(entry, path)
    const id = string(row.id, `${path}.id`)
    const item = classByPageId.get(id)
    if (!item || pageIds.has(id)) throw new TypeError(`${path}.id must identify a unique class page`)
    const url = httpsUrl(row.url, `${path}.url`)
    if (url !== `https://game8.co/games/Fire-Emblem-Fortunes-Weave/archives/${id}`) throw new TypeError(`${path}.url must match its class page`)
    item.sourcePageUrl = url
    pageIds.add(id)
  }
  if (pageIds.size !== detailRows.size) throw new TypeError('database.pages must include every recorded class detail page')

  const growthKeys = new Set<string>()
  for (const [index, entry] of array(database.growths, 'database.growths').entries()) {
    const path = `database.growths[${index}]`
    const row = record(entry, path)
    const name = string(row.class, `${path}.class`)
    const item = classesById.get(name)
    if (!item || !detailRows.has(name)) throw new TypeError(`${path}.class must reference a recorded class detail`)
    const stat = string(row.stat, `${path}.stat`)
    if (!Object.hasOwn(STAT_MAPPING, stat)) throw new TypeError(`${path}.stat is unknown: ${stat}`)
    const local = STAT_MAPPING[stat as keyof typeof STAT_MAPPING]
    const kind = row.kind
    if (kind !== 'bonus' && kind !== 'growth') throw new TypeError(`${path}.kind must be bonus or growth`)
    const key = `${name}:${kind}:${stat}`
    if (growthKeys.has(key)) throw new TypeError(`${path} contains a duplicate stat: ${key}`)
    growthKeys.add(key)
    const value = finiteNumber(row.value, `${path}.value`)
    if (kind === 'bonus') item.bonuses[local] = value
    else if (item.growths[local] !== value) throw new TypeError(`${path}.value disagrees with the JSON growth rate`)
  }
  for (const [name, raw] of detailRows) {
    for (const [upstream, local] of Object.entries(STAT_MAPPING)) {
      for (const kind of ['bonus', 'growth']) {
        if (!growthKeys.has(`${name}:${kind}:${upstream}`)) throw new TypeError(`database.growths is missing ${name}.${kind}.${upstream}`)
      }
      if (finiteNumber(raw[`growth_${local}`], `database.classes.${name}.growth_${local}`) !== classesById.get(name)!.growths[local]) {
        throw new TypeError(`database.classes.${name}.growth_${local} disagrees with the JSON growth rate`)
      }
    }
  }

  const tablesByPageId = new Map<string, SourceTable[]>()
  const tableKeys = new Set<string>()
  for (const [index, entry] of array(database.tables, 'database.tables').entries()) {
    const path = `database.tables[${index}]`
    const row = record(entry, path)
    const pageId = string(row.page_id, `${path}.page_id`)
    if (!classByPageId.has(pageId)) throw new TypeError(`${path}.page_id references an unknown page`)
    if (typeof row.idx !== 'number' || !Number.isInteger(row.idx) || row.idx < 0) throw new TypeError(`${path}.idx must be a non-negative integer`)
    const key = `${pageId}:${row.idx}`
    if (tableKeys.has(key)) throw new TypeError(`${path} contains a duplicate table: ${key}`)
    tableKeys.add(key)
    const heading = string(row.heading, `${path}.heading`)
    if (typeof row.ncols !== 'number' || !Number.isInteger(row.ncols) || row.ncols < 1) throw new TypeError(`${path}.ncols must be a positive integer`)
    const header = array(JSON.parse(string(row.header, `${path}.header`)), `${path}.header`)
    header.forEach((cell, cellIndex) => string(cell, `${path}.header[${cellIndex}]`, true))
    if (header.length !== 0 && header.length !== row.ncols) throw new TypeError(`${path}.header width differs from ncols`)
    const rows = array(JSON.parse(string(row.rows, `${path}.rows`)), `${path}.rows`).map((entry, rowIndex) => {
      const cells = array(entry, `${path}.rows[${rowIndex}]`)
      if (cells.length !== row.ncols) throw new TypeError(`${path}.rows[${rowIndex}] width differs from ncols`)
      return cells.map((cell, cellIndex) => string(cell, `${path}.rows[${rowIndex}][${cellIndex}]`, true))
    })
    const tables = tablesByPageId.get(pageId) ?? []
    tables.push({ heading, rows })
    tablesByPageId.set(pageId, tables)
  }
  for (const [pageId, item] of classByPageId) {
    const tables = tablesByPageId.get(pageId) ?? []
    item.abilities = readSkills(tables, 'Class Ability', `database.tables.${item.name}`)
    item.masterSkills = readSkills(tables, 'Master Ability', `database.tables.${item.name}`)
  }

  return validateClassDataset({
    sources: files.map(file => ({
      id: file.sourcePath.endsWith('.json') ? 'fortunes-weave-class-roster' : 'fortunes-weave-class-details',
      name: `Fortunes-Weave-Helper / Game8 (${file.sourcePath.endsWith('.json') ? 'クラス名簿・成長率' : 'クラス詳細'})`,
      url: file.url, retrievedAt, sourceVersion: revision, gameVersion,
      note: `非公式の収集データです。ゲーム内未照合。元ファイル SHA-256: ${file.sha256}`,
    })),
    classes,
  })
}
