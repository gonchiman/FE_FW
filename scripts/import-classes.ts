import { readFileSync, writeFileSync } from 'node:fs'
import { importClassSnapshot } from './lib/import-classes.ts'

try {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: node scripts/import-classes.ts [--check]')
  }
  const snapshotPath = new URL('../data/sources/fortunes-weave-class-details.json', import.meta.url)
  const outputPath = new URL('../src/data/class-details.json', import.meta.url)
  const dataset = importClassSnapshot(JSON.parse(readFileSync(snapshotPath, 'utf8')))
  const expected = `${JSON.stringify(dataset, null, 2)}\n`
  if (args[0] === '--check') {
    const actual = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n')
    if (actual !== expected) throw new Error('class-details.json is out of date. Run npm run data:import:classes.')
    console.log(`Class data matches the recorded snapshot (${dataset.classes.length} classes).`)
  } else {
    writeFileSync(outputPath, expected, 'utf8')
    console.log(`Imported class information for ${dataset.classes.length} classes.`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
