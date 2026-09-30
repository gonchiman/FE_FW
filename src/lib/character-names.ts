import { validateAndMergeNames } from './name-mappings.ts'
import type { CharacterGrowth } from '../types/growth.ts'
import type { CharacterNameDataset } from '../types/character-names.ts'

export { filterAndSortNames as filterAndSortCharacterNames } from './name-mappings.ts'

/** Preserve the character dataset API used by growth views. */
export function validateAndMergeCharacterNames(
  input: unknown,
  roster: readonly Pick<CharacterGrowth, 'id' | 'name'>[],
): CharacterNameDataset {
  const { sources, entries } = validateAndMergeNames(input, roster, 'characterId')
  return { sources, characters: entries }
}
