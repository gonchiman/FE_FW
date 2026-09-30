import { validateGrowthDataset } from '../../src/lib/growth.ts'
import type { CharacterGrowth, GrowthDataset, StatKey } from '../../src/types/growth.ts'

const STAT_MAPPING = {
  HP: 'hp',
  Str: 'str',
  Mag: 'mag',
  Dex: 'dex',
  Spd: 'spd',
  Lck: 'lck',
  Def: 'def',
  Res: 'res',
  Cha: 'cha',
} as const satisfies Record<string, StatKey>

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${path} must be a non-empty string without surrounding whitespace`)
  }
  return value
}

function requireSha(value: unknown, path: string): string {
  const sha = requireString(value, path)
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new TypeError(`${path} must be a full Git SHA`)
  return sha
}

function requireHttpsUrl(value: unknown, path: string): string {
  const text = requireString(value, path)
  const url = new URL(text)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new TypeError(`${path} must be an HTTPS URL without credentials`)
  }
  return text
}

/** Convert a recorded upstream snapshot; never infer, sum, or add class growths. */
export function importGrowthSnapshot(input: unknown): GrowthDataset {
  const snapshot = requireRecord(input, 'snapshot')
  const provenance = requireRecord(snapshot.provenance, 'provenance')
  const repository = requireString(provenance.repository, 'provenance.repository')
  if (repository !== 'Rico0319/Fortunes-Weave-Helper') {
    throw new TypeError('provenance.repository must identify Rico0319/Fortunes-Weave-Helper')
  }
  const revision = requireSha(provenance.revision, 'provenance.revision')
  requireSha(provenance.fileBlobSha, 'provenance.fileBlobSha')
  const sourcePath = requireString(provenance.path, 'provenance.path')
  if (sourcePath !== 'data/fwe.json') throw new TypeError('provenance.path must be data/fwe.json')
  const upstreamUrl = requireHttpsUrl(provenance.upstreamUrl, 'provenance.upstreamUrl')
  if (upstreamUrl !== `https://github.com/${repository}/blob/${revision}/${sourcePath}`) {
    throw new TypeError('provenance.upstreamUrl must match the recorded repository, revision, and path')
  }
  const originalSourceUrl = requireHttpsUrl(provenance.originalSourceUrl, 'provenance.originalSourceUrl')
  const retrievedAt = requireString(provenance.retrievedAt, 'provenance.retrievedAt')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(retrievedAt) || !Number.isFinite(Date.parse(retrievedAt))) {
    throw new TypeError('provenance.retrievedAt must be a UTC ISO timestamp')
  }
  const gameVersion = provenance.gameVersion === null
    ? null
    : requireString(provenance.gameVersion, 'provenance.gameVersion')

  const units = requireRecord(snapshot.units, 'units')
  const names = Object.keys(units).sort()
  if (names.length === 0) throw new TypeError('units must contain at least one character')
  const ids = new Set<string>()
  const characters = names.map((key): CharacterGrowth => {
    const path = `units.${key}`
    const unit = requireRecord(units[key], path)
    const name = requireString(unit.name, `${path}.name`)
    if (key !== name) throw new TypeError(`${path}.name must match its unit key`)
    const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!slug) throw new TypeError(`${path}.name must produce a non-empty identifier`)
    const id = `fwe-${slug}`
    if (ids.has(id)) throw new TypeError(`${path}.name produces a duplicate identifier: ${id}`)
    ids.add(id)

    const growths = requireRecord(unit.growths, `${path}.growths`)
    if (Object.keys(growths).length !== Object.keys(STAT_MAPPING).length) {
      throw new TypeError(`${path}.growths must contain exactly the nine growth stats`)
    }
    const rates = {} as CharacterGrowth['rates']
    for (const [upstreamKey, localKey] of Object.entries(STAT_MAPPING)) {
      const rate = growths[upstreamKey]
      if (rate !== null && (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0)) {
        throw new TypeError(`${path}.growths.${upstreamKey} must be null or a finite non-negative number`)
      }
      rates[localKey] = rate
    }
    return { id, name, sourceId: 'fortunes-weave-helper', status: 'unverified', rates }
  })

  return validateGrowthDataset({
    sources: [{
      id: 'fortunes-weave-helper',
      name: 'Fortunes-Weave-Helper / Game8',
      url: upstreamUrl,
      retrievedAt,
      sourceVersion: revision,
      gameVersion,
      note: `Game8の攻略記事から収集された個人成長率です。ゲーム内の数値との照合は未実施です。元記事: ${originalSourceUrl}`,
    }],
    characters,
  })
}
