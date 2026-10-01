import { getUniqueSkillCoverage } from '../lib/unique-skill-coverage'
import type { CharacterSkill, UniqueSkillResearch } from '../types/character-skills'
import type { CharacterGrowth } from '../types/growth'
import './CharacterSkillCoverage.css'

export function CharacterSkillCoverage({ characters, skills, displayNames, research }: {
  characters: readonly CharacterGrowth[]
  skills: readonly CharacterSkill[]
  displayNames: ReadonlyMap<string, string>
  research: UniqueSkillResearch
}) {
  const coverage = getUniqueSkillCoverage(characters, skills, research.knownSkills)
  const names = new Map(characters.map(character => [character.id, displayNames.get(character.id) ?? character.name]))
  const missingIds = [...new Set(coverage.missingKnownSkills.map(skill => skill.characterId))]
  const sources = new Map(research.sources.map(source => [source.id, source]))

  return (
    <details className="character-skill-coverage">
      <summary>固有習得スキルの収録状況<span>{coverage.charactersWithSkills.length} / {coverage.characterCount}人</span></summary>
      <div className="character-skill-coverage-body">
        <dl className="character-skill-coverage-facts">
          <div><dt>収録あり</dt><dd>{coverage.charactersWithSkills.length} / {coverage.characterCount}人 · {coverage.skills.length}件</dd></div>
          <div><dt>存在確認・未収録</dt><dd>{missingIds.length}人 · {coverage.missingKnownSkills.length}件</dd></div>
          <div><dt>有無未確認</dt><dd>{coverage.presenceUnconfirmedCharacterIds.length}人</dd></div>
        </dl>

        {missingIds.length > 0 && <section aria-label="存在確認・未収録の固有習得スキル">
          <h3>存在確認・未収録</h3>
          <ul className="character-skill-coverage-missing">
            {missingIds.map(characterId => <li key={characterId}>
              <span className="character-skill-coverage-name">{names.get(characterId)}</span>
              <ul>{coverage.missingKnownSkills.filter(skill => skill.characterId === characterId).map(skill => {
                const source = sources.get(skill.sourceId)
                return <li key={skill.englishName}>
                  <span>Lv.{skill.level}</span> <span lang="en">{skill.englishName}</span>
                  {source?.url && <a href={source.url} target="_blank" rel="noreferrer" aria-label={`${names.get(characterId)} ${skill.englishName}の参照元`}>参照元</a>}
                </li>
              })}</ul>
            </li>)}
          </ul>
        </section>}

        {coverage.presenceUnconfirmedCharacterIds.length > 0 && <section aria-label="固有習得スキルの有無未確認のキャラクター">
          <h3>有無未確認</h3>
          <p>{coverage.presenceUnconfirmedCharacterIds.map(id => names.get(id)).join('、')}</p>
        </section>}

        <section aria-label="収録した固有習得スキルの確認状況">
          <h3>収録データの確認状況</h3>
          <dl className="character-skill-coverage-facts">
            <div><dt>習得Lv.未確認</dt><dd>{coverage.unknownLevelSkills.length}件</dd></div>
            <div><dt>日本語名未確認</dt><dd>{coverage.englishNameOnlySkills.length}件</dd></div>
            <div><dt>ゲーム内未照合</dt><dd>{coverage.unverifiedSkills.length} / {coverage.skills.length}件</dd></div>
          </dl>
        </section>

        <p className="character-skill-coverage-note">収録ありは全スキルの網羅を示しません。強化版は別件として数えています。有無未確認は「スキルなし」を意味しません。</p>
        <div className="character-skill-coverage-research">
          <span>未収録キャラの調査 {research.inspectedCharacterIds.length}人 · {research.checkedAt} · ゲームの版 不明</span>
          {research.sources.map(source => source.url && <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.name}</a>)}
        </div>
      </div>
    </details>
  )
}
