import { readFileSync, writeFileSync } from 'node:fs'
import { importGrowthSnapshot } from './lib/import-growths.ts'

const args = process.argv.slice(2)

try {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: node scripts/import-growths.ts [--check]')
  }
  const snapshotPath = new URL('../data/sources/fortunes-weave-growths.json', import.meta.url)
  const outputPath = new URL('../src/data/character-growths.json', import.meta.url)
  const dataset = importGrowthSnapshot(JSON.parse(readFileSync(snapshotPath, 'utf8')))
  const expected = `${JSON.stringify(dataset, null, 2)}\n`

  if (args[0] === '--check') {
    // Git may check the generated JSON out with Windows line endings.
    const actual = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n')
    if (actual !== expected) {
      throw new Error('character-growths.json is out of date. Run npm run data:import.')
    }
    console.log(`Growth data matches the recorded snapshot (${dataset.characters.length} characters).`)
  } else {
    writeFileSync(outputPath, expected, 'utf8')
    console.log(`Imported personal growth rates for ${dataset.characters.length} characters.`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
