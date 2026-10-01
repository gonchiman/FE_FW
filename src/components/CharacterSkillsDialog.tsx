import type { CharacterSkill } from '../types/character-skills'
import { Modal } from './Modal'
import './CharacterSkillsDialog.css'

export function CharacterSkillsDialog({ characterName, kind, skills, onClose }: {
  characterName: string
  kind: CharacterSkill['kind']
  skills: readonly CharacterSkill[]
  onClose: () => void
}) {
  const label = kind === 'personal' ? '個人スキル' : '固有習得スキル'
  const entries = skills.filter((skill) => skill.kind === kind)

  return (
    <Modal title={`${characterName} · ${label}`} closeLabel={`${label}の詳細を閉じる`}
      className="character-skills-dialog" onClose={onClose}>
      <div className="character-skills-list">
        {entries.map((skill) => {
          const originalSkill = skill.upgradesSkillId === null ? undefined : skills.find((entry) => entry.id === skill.upgradesSkillId)
          return (
            <section className="character-skill-detail" key={skill.id} aria-label={skill.name}>
              <div className="character-skill-detail-heading">
                <h3>{skill.name}</h3>
                {skill.status === 'unverified' && <span className="character-skill-status">ゲーム内未照合</span>}
              </div>
              {skill.englishName && skill.englishName !== skill.name && <p className="character-skill-english-name" lang="en">{skill.englishName}</p>}
              {(kind === 'unique' || skill.level !== null || skill.acquisition || originalSkill) && <dl className="character-skill-acquisition">
                {(kind === 'unique' || skill.level !== null) && <><dt>習得Lv.</dt><dd>{skill.level ?? '未確認'}</dd></>}
                {skill.acquisition && <><dt>習得条件</dt><dd>{skill.acquisition}</dd></>}
                {originalSkill && originalSkill.id !== skill.id && <><dt>強化元</dt><dd>{originalSkill.name}</dd></>}
              </dl>}
              <p className={`character-skill-description${skill.description === null ? ' character-skill-description-missing' : ''}`}>
                {skill.description ?? '効果未確認'}
              </p>
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
