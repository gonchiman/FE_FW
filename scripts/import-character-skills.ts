import { readFileSync, writeFileSync } from 'node:fs'
import { validateCharacterSkillDataset } from '../src/lib/character-skills.ts'

const args = process.argv.slice(2)

try {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: node scripts/import-character-skills.ts [--check]')
  }
  const snapshotPath = new URL('../data/sources/character-skills.json', import.meta.url)
  const outputPath = new URL('../src/data/character-skills.json', import.meta.url)
  const rosterPath = new URL('../src/data/character-growths.json', import.meta.url)
  const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  const roster = JSON.parse(readFileSync(rosterPath, 'utf8')).characters
  // The recorded snapshot keeps observations and editorial notes separately.
  // Only validated game facts enter the browser bundle; unknowns stay null.
  const dataset = validateCharacterSkillDataset(snapshot, roster)
  const expected = `${JSON.stringify(dataset, null, 2)}\n`

  if (args[0] === '--check') {
    const actual = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n')
    if (actual !== expected) {
      throw new Error('character-skills.json is out of date. Run node scripts/import-character-skills.ts.')
    }
    console.log(`Character skill data matches the recorded snapshot (${dataset.skills.length} skills).`)
  } else {
    writeFileSync(outputPath, expected, 'utf8')
    console.log(`Imported ${dataset.skills.length} character skills.`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
