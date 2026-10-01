import type { CharacterSkill, KnownUniqueSkill } from '../types/character-skills.ts'

/** Count the loaded roster, not filtered search results or an assumed complete skill list. */
export function getUniqueSkillCoverage(
  roster: readonly { id: string }[],
  skills: readonly CharacterSkill[],
  knownSkills: readonly KnownUniqueSkill[] = [],
) {
  const rosterIds = new Set(roster.map(character => character.id))
  const uniqueSkills = skills.filter(skill => skill.kind === 'unique' && rosterIds.has(skill.characterId))
  const collectedIds = new Set(uniqueSkills.map(skill => skill.characterId))
  const observations = knownSkills.filter(skill => rosterIds.has(skill.characterId))
  const observedIds = new Set(observations.map(skill => skill.characterId))

  return {
    characterCount: roster.length,
    skills: uniqueSkills,
    charactersWithSkills: roster.filter(character => collectedIds.has(character.id)).map(character => character.id),
    missingKnownSkills: observations.filter(observation => !uniqueSkills.some(skill =>
      skill.characterId === observation.characterId
      && (skill.englishName === observation.englishName || skill.name === observation.englishName),
    )),
    presenceUnconfirmedCharacterIds: roster.filter(character =>
      !collectedIds.has(character.id) && !observedIds.has(character.id),
    ).map(character => character.id),
    unknownLevelSkills: uniqueSkills.filter(skill => skill.level === null),
    // Imported records retain the English name as the display name until a Japanese name is confirmed.
    englishNameOnlySkills: uniqueSkills.filter(skill => skill.englishName !== null && skill.name === skill.englishName),
    unverifiedSkills: uniqueSkills.filter(skill => skill.status === 'unverified'),
  }
}
