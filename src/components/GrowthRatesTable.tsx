import { useState } from 'react'
import { GROWTH_STATS, type CharacterGrowth, type GrowthSort, type GrowthSortKey } from '../types/growth'
import type { CharacterSkill } from '../types/character-skills'
import { getGrowthCharacterName } from '../lib/growth'
import { CharacterSkillsDialog } from './CharacterSkillsDialog'
import './DataTable.css'
import './GrowthRatesTable.css'

type GrowthRatesTableProps = {
  characters: CharacterGrowth[]
  displayNames?: ReadonlyMap<string, string>
  skillsByCharacter?: ReadonlyMap<string, readonly CharacterSkill[]>
  sort: GrowthSort
  onSort: (key: GrowthSortKey) => void
  showSampleLabels: boolean
  showUnverifiedLabels: boolean
}

const skillColumns = [
  { kind: 'personal' as const, label: '個人スキル' },
  { kind: 'unique' as const, label: '固有習得スキル' },
]

export function GrowthRatesTable({ characters, displayNames, skillsByCharacter, sort, onSort, showSampleLabels, showUnverifiedLabels }: GrowthRatesTableProps) {
  const [selectedSkills, setSelectedSkills] = useState<{ character: CharacterGrowth; kind: CharacterSkill['kind'] } | null>(null)

  function sortableHeader(key: GrowthSortKey, label: string) {
    const selected = sort.key === key
    const nextDirection = selected ? (sort.direction === 'asc' ? '降順' : '昇順') : (key === 'name' ? '昇順' : '降順')
    return (
      <th key={key} scope="col" aria-sort={selected ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
        <button className="table-sort-button" type="button" onClick={() => onSort(key)} aria-label={`${label}を${nextDirection}に並べ替え`}>
          <span>{label}</span>
          <span className="table-sort-indicator" aria-hidden="true">{selected ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
        </button>
      </th>
    )
  }

  return (
    <>
    <div className="data-table-scroll" role="region" aria-label="個人成長率の表。横にスクロールできます" tabIndex={0}>
      <table className="data-table growth-table">
        <caption className="visually-hidden">個人成長率（%）と個人・固有習得スキル。—は未確認の値です。</caption>
        <colgroup>
          <col className="growth-name-column" />
          <col className="growth-personal-skill-column" />
          <col className="growth-unique-skill-column" />
          <col span={GROWTH_STATS.length} />
        </colgroup>
        <thead>
          <tr>
            {sortableHeader('name', 'キャラクター')}
            {skillColumns.map(({ kind, label }) => <th key={kind} scope="col"><span className="growth-skill-heading">{label}</span></th>)}
            {GROWTH_STATS.map(({ key, label }) => sortableHeader(key, label))}
          </tr>
        </thead>
        <tbody>
          {characters.map((character) => (
            <tr key={character.id}>
              <th scope="row">
                {getGrowthCharacterName(character, displayNames)}
                {showUnverifiedLabels && character.status === 'unverified' && <span className="growth-row-status">未照合</span>}
                {showSampleLabels && character.status === 'sample' && <span className="growth-row-status">仮データ</span>}
              </th>
              {skillColumns.map(({ kind, label }) => {
                const skills = skillsByCharacter?.get(character.id)?.filter((skill) => skill.kind === kind) ?? []
                const firstSkill = skills[0]
                return (
                  <td key={kind} className="growth-skill-cell">
                    {firstSkill ? (
                      <button type="button" className="growth-skill-button" aria-haspopup="dialog"
                        aria-label={`${getGrowthCharacterName(character, displayNames)}の${label}：${firstSkill.name}${skills.length > 1 ? `、ほか${skills.length - 1}件` : ''}の詳細を表示`}
                        onClick={() => setSelectedSkills({ character, kind })}>
                        <span className="growth-skill-name">
                          {kind === 'unique' && firstSkill.level !== null && <span className="growth-skill-level">Lv.{firstSkill.level} </span>}
                          {firstSkill.name}
                        </span>
                        {skills.length > 1 && <span className="growth-skill-count">ほか{skills.length - 1}件</span>}
                        <span className="growth-skill-open" aria-hidden="true">›</span>
                      </button>
                    ) : <span className="growth-missing growth-skill-missing" aria-label="未確認">—</span>}
                  </td>
                )
              })}
              {GROWTH_STATS.map(({ key }) => (
                <td className="table-number" key={key}>
                  {character.rates[key] === null ? <span className="growth-missing" aria-label="未確認">—</span> : character.rates[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {selectedSkills && <CharacterSkillsDialog
      characterName={getGrowthCharacterName(selectedSkills.character, displayNames)}
      kind={selectedSkills.kind}
      skills={skillsByCharacter?.get(selectedSkills.character.id) ?? []}
      onClose={() => setSelectedSkills(null)}
    />}
    </>
  )
}
