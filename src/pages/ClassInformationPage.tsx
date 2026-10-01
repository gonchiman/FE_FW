import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { CollapsibleAnalysisPanel } from '../components/CollapsibleAnalysisPanel'
import { classData } from '../data/class-data'
import { classNameData } from '../data/class-names-data'
import {
  CLASS_TIERS, CLASS_VIEWS, changeClassView, createClassListState, filterAndSortClasses,
  formatClassModifier, getClassName, getClassTerm, getClassTierLabel, nextClassSort,
  type ClassSort, type ClassSortKey, type ClassView,
} from '../lib/classes'
import { getClassDetailHref } from '../lib/navigation'
import { PanelStateScope } from '../lib/PanelStateScope'
import type { ClassDataset, ClassInfo, ClassSkill } from '../types/classes'
import type { ClassTier } from '../types/class-names'
import { GROWTH_STATS } from '../types/growth'
import '../components/DataTable.css'
import './ClassInformationPage.css'

const japaneseNames = new Map(classNameData.data?.classes
  .filter(entry => entry.status === 'verified' && entry.japaneseName !== null)
  .map(entry => [entry.id, entry.japaneseName!] as const))

function MissingValue() {
  return <span className="class-missing" aria-label="未収録">—</span>
}

function Weapons({ weapons }: { weapons: string[] | null }) {
  return weapons === null ? <MissingValue /> : weapons.length === 0 ? 'なし' : weapons.map(getClassTerm).join('・')
}

function SortableHeader({ label, sortKey, sort, onSort }: {
  label: string; sortKey: ClassSortKey; sort: ClassSort; onSort: (key: ClassSortKey) => void
}) {
  const selected = sort.key === sortKey
  const direction = nextClassSort(sort, sortKey).direction === 'asc' ? '昇順' : '降順'
  return (
    <th scope="col" aria-sort={selected ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="table-sort-button" onClick={() => onSort(sortKey)} aria-label={`${label}を${direction}に並べ替え`}>
        <span>{label}</span>
        <span className="table-sort-indicator" aria-hidden="true">{selected ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  )
}

function ClassSources({ data, row }: { data: ClassDataset; row?: ClassInfo }) {
  const mapping = row ? classNameData.data?.classes.find(entry => entry.id === row.id) : null
  const discrepancies = classNameData.data?.classes.filter(entry => entry.note.includes('差異：')) ?? []
  const sourceIds = mapping?.sourceIds
  const nameSources = classNameData.data?.sources.filter(source => !sourceIds || sourceIds.includes(source.id)) ?? []
  return (
    <details className="class-sources">
      <summary>データの出典・確認状況</summary>
      <p>数値・スキルはゲーム内未照合です。日本語名の確認状況とは別に管理しています。</p>
      <p>成長率補正は個人成長率への加算値（pt）です。スキル名と効果は出典の英語表記を使用しています。—は未収録、0は出典に0と記録された値です。</p>
      {data.sources.map(source => (
        <div className="class-source" key={source.id}>
          <p className="class-source-name">{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}</p>
          {source.note && <p>{source.note}</p>}
          <dl>
            <dt>取得日</dt><dd>{source.retrievedAt ?? '未取得'}</dd>
            <dt>元データの版</dt><dd>{source.sourceVersion ?? '不明'}</dd>
            <dt>ゲームの版</dt><dd>{source.gameVersion ?? '不明'}</dd>
          </dl>
        </div>
      ))}
      {row?.sourcePageUrl && <p><a href={row.sourcePageUrl} target="_blank" rel="noreferrer">{getClassName(row, japaneseNames)}の参照ページ</a></p>}
      <details className="class-source-names">
        <summary>日本語名の照合</summary>
        {classNameData.error && <p>{classNameData.error}</p>}
        {mapping && <><p>{mapping.note}</p><p>照合日：{mapping.checkedAt ?? '未照合'}</p></>}
        {nameSources.map(source => (
          <div className="class-source" key={source.id}>
            <p><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></p>
            <dl>
              <dt>取得日</dt><dd>{source.retrievedAt}</dd>
              <dt>元データの版</dt><dd>{source.sourceVersion ?? '不明'}</dd>
              <dt>ゲームの版</dt><dd>{source.gameVersion ?? '不明'}</dd>
            </dl>
          </div>
        ))}
      </details>
      {!row && discrepancies.length > 0 && (
        <details className="class-source-discrepancies">
          <summary>出典間の差異（{discrepancies.length}クラス）</summary>
          <dl>{discrepancies.map(entry => <div key={entry.id}>
            <dt><a href={getClassDetailHref(entry.id)}>{entry.japaneseName ?? entry.englishName}</a></dt>
            <dd>{entry.note}</dd>
          </div>)}</dl>
        </details>
      )}
    </details>
  )
}

function SkillGroup({ title, skills }: { title: string; skills: ClassSkill[] | null }) {
  return (
    <section className="class-skill-group" aria-label={title}>
      <h3>{title}</h3>
      {skills === null ? <p className="class-empty-skill"><MissingValue /></p> : skills.length === 0 ? <p className="class-empty-skill">なし</p> : (
        <dl className="class-skills">
          {skills.map((skill, index) => <div key={`${skill.name}:${index}`}>
            <dt lang="en">{skill.name}</dt>
            <dd lang={skill.effect === null ? undefined : 'en'}>{skill.effect === null ? <MissingValue /> : skill.effect}</dd>
          </div>)}
        </dl>
      )}
    </section>
  )
}

function ClassDetail({ data, row, backRef }: {
  data: ClassDataset; row: ClassInfo | undefined; backRef: RefObject<HTMLAnchorElement | null>
}) {
  return (
    <section className="class-detail" aria-label={row ? `${getClassName(row, japaneseNames)}の詳細` : 'クラス詳細'}>
      <a ref={backRef} className="class-back" href="#/classes">← クラス一覧へ</a>
      {!row ? <p role="status" className="class-empty">クラスが見つかりません。</p> : <>
        <div className="class-detail-heading">
          <h2>{getClassName(row, japaneseNames)}</h2>
          <span lang="en">{row.name}</span>
          <span className="class-data-status">ゲーム内未照合</span>
        </div>
        <div className="class-detail-panels">
          <CollapsibleAnalysisPanel id="class-basics" number="01" title="基本情報" summary={getClassTierLabel(row.tier)} collapsedLabel="情報を表示">
            <dl className="class-properties">
              <div><dt>区分</dt><dd>{getClassTierLabel(row.tier)}</dd></div>
              <div><dt>タイプ</dt><dd>{row.unitType === null ? <MissingValue /> : getClassTerm(row.unitType)}</dd></div>
              <div><dt>移動</dt><dd>{row.movement ?? <MissingValue />}</dd></div>
              <div><dt>対応武器</dt><dd><Weapons weapons={row.weapons} /></dd></div>
            </dl>
          </CollapsibleAnalysisPanel>
          <CollapsibleAnalysisPanel id="class-modifiers" number="02" title="能力・成長率の補正" summary="9項目" collapsedLabel="補正を表示">
            <div className="data-table-scroll class-modifier-scroll" role="region" aria-label="能力補正と成長率補正の表。横にスクロールできます" tabIndex={0}>
              <table className="data-table class-table class-detail-table">
                <caption className="visually-hidden">{getClassName(row, japaneseNames)}の能力補正と成長率補正（pt）。—は未収録です。</caption>
                <colgroup><col className="class-modifier-column" /><col span={GROWTH_STATS.length} /></colgroup>
                <thead><tr><th scope="col">補正</th>{GROWTH_STATS.map(stat => <th scope="col" key={stat.key}>{stat.label}</th>)}</tr></thead>
                <tbody>{(['bonuses', 'growths'] as const).map(view => <tr key={view}>
                  <th scope="row">{view === 'bonuses' ? '能力補正' : '成長率補正（pt）'}</th>
                  {GROWTH_STATS.map(stat => <td className="table-number" key={stat.key}>
                    {row[view][stat.key] === null ? <MissingValue /> : formatClassModifier(row[view][stat.key])}
                  </td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </CollapsibleAnalysisPanel>
          <CollapsibleAnalysisPanel id="class-skills" number="03" title="スキル" summary="" collapsedLabel="スキルを表示">
            <SkillGroup title="兵種スキル" skills={row.abilities} />
            <SkillGroup title="マスタースキル" skills={row.masterSkills} />
          </CollapsibleAnalysisPanel>
        </div>
        <ClassSources key={row.id} data={data} row={row} />
      </>}
    </section>
  )
}

function ClassInformationContent({ data, classId }: { data: ClassDataset; classId: string | null }) {
  const [state, setState] = useState(createClassListState)
  const tableRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLAnchorElement>(null)
  const previousClass = useRef<string | null | undefined>(undefined)
  const listPosition = useRef({ top: 0, left: 0 })
  const rows = useMemo(() => filterAndSortClasses(data.classes, state, japaneseNames), [data, state])
  const detail = classId === null ? undefined : data.classes.find(row => row.id === classId)
  const viewLabel = CLASS_VIEWS.find(view => view.value === state.view)!.label

  // Keep the directory mounted, as in arknights_2, so filters and horizontal position survive details.
  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const rememberScroll = () => {
      if (window.location.hash.split('?')[0] === '#/classes') listPosition.current.top = window.scrollY
    }
    window.addEventListener('scroll', rememberScroll, { passive: true })
    return () => {
      window.history.scrollRestoration = previousRestoration
      window.removeEventListener('scroll', rememberScroll)
    }
  }, [])

  useLayoutEffect(() => {
    const previous = previousClass.current
    if (previous === classId) return
    if (previous === undefined && classId === null) {
      previousClass.current = null
      return
    }
    const frame = window.requestAnimationFrame(() => {
      previousClass.current = classId
      if (classId !== null) {
        backRef.current?.focus({ preventScroll: true })
        window.scrollTo({ top: 0, behavior: 'instant' })
      } else {
        if (tableRef.current) tableRef.current.scrollLeft = listPosition.current.left
        const trigger = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>('[data-class-id]') ?? [])]
          .find(link => link.dataset.classId === previous)
        trigger?.focus({ preventScroll: true })
        window.scrollTo({ top: listPosition.current.top, behavior: 'instant' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [classId])

  function changeView(view: ClassView) {
    setState(previous => changeClassView(previous, view))
    if (tableRef.current) tableRef.current.scrollLeft = 0
    listPosition.current.left = 0
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? CLASS_VIEWS.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + CLASS_VIEWS.length) % CLASS_VIEWS.length
    changeView(CLASS_VIEWS[next].value)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  const changeSort = (key: ClassSortKey) => setState(previous => ({ ...previous, sort: nextClassSort(previous.sort, key) }))

  return (
    <PanelStateScope.Provider value="classes">
      <section className="class-information" aria-label="クラス情報">
        <div ref={listRef} hidden={classId !== null}>
          <div className="class-toolbar">
            <label className="class-search" htmlFor="class-search">クラス名
              <span className="class-search-field">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" strokeLinecap="round" /></svg>
                <input id="class-search" type="search" placeholder="日本語・英語で検索" autoComplete="off" value={state.query} onChange={event => setState(previous => ({ ...previous, query: event.target.value }))} />
              </span>
            </label>
            <label className="class-tier-filter" htmlFor="class-tier">区分
              <select id="class-tier" value={state.tier} onChange={event => setState(previous => ({ ...previous, tier: event.target.value as ClassTier | 'all' }))}>
                <option value="all">すべて</option>{CLASS_TIERS.map(tier => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
              </select>
            </label>
            <button className="class-reset" type="button" onClick={() => setState(previous => ({ ...previous, query: '', tier: 'all' }))}>リセット</button>
            <div className="class-result-info"><span className="class-data-status">ゲーム内未照合</span><span role="status">{rows.length} / {data.classes.length}件</span></div>
          </div>
          <div className="class-tabs" role="tablist" aria-label="クラス情報の表示">
            {CLASS_VIEWS.map((view, index) => <button key={view.value} id={`class-tab-${view.value}`} type="button" role="tab" aria-selected={state.view === view.value} aria-controls="class-table-panel" tabIndex={state.view === view.value ? 0 : -1} onClick={() => changeView(view.value)} onKeyDown={event => handleTabKey(event, index)}>{view.label}</button>)}
          </div>
          <div id="class-table-panel" role="tabpanel" aria-labelledby={`class-tab-${state.view}`}>
            {rows.length === 0 ? <p className="class-empty">該当するクラスがありません。</p> : (
              <div ref={tableRef} className="data-table-scroll class-table-scroll" role="region" aria-label={`${viewLabel}の表。横にスクロールできます`} tabIndex={0} onScroll={event => { if (classId === null) listPosition.current.left = event.currentTarget.scrollLeft }}>
                <table className={`data-table class-table class-list-table ${state.view === 'basic' ? 'class-basic-table' : 'class-numeric-table'}`}>
                  <caption className="visually-hidden">クラスの{viewLabel}{state.view === 'growths' ? '（pt）' : ''}。—は未収録です。</caption>
                  <colgroup><col className="class-name-column" /><col className="class-tier-column" />{state.view === 'basic' ? <><col className="class-type-column" /><col className="class-movement-column" /><col /></> : <col span={GROWTH_STATS.length} />}</colgroup>
                  <thead><tr>
                    <SortableHeader label="クラス" sortKey="name" sort={state.sort} onSort={changeSort} />
                    <SortableHeader label="区分" sortKey="tier" sort={state.sort} onSort={changeSort} />
                    {state.view === 'basic' ? <><th scope="col">タイプ</th><SortableHeader label="移動" sortKey="movement" sort={state.sort} onSort={changeSort} /><th scope="col">対応武器</th></> : GROWTH_STATS.map(stat => <SortableHeader key={stat.key} label={stat.label} sortKey={stat.key} sort={state.sort} onSort={changeSort} />)}
                  </tr></thead>
                  <tbody>{rows.map(row => <tr key={row.id}>
                    <th scope="row"><a href={getClassDetailHref(row.id)} className="class-name-link" data-class-id={row.id} aria-label={`${getClassName(row, japaneseNames)}の詳細`} onClick={event => {
                      if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) listPosition.current = { top: window.scrollY, left: tableRef.current?.scrollLeft ?? 0 }
                    }}>{getClassName(row, japaneseNames)}</a></th>
                    <td>{getClassTierLabel(row.tier)}</td>
                    {state.view === 'basic' ? <>
                      <td>{row.unitType === null ? <MissingValue /> : getClassTerm(row.unitType)}</td>
                      <td className="table-number">{row.movement ?? <MissingValue />}</td>
                      <td><Weapons weapons={row.weapons} /></td>
                    </> : GROWTH_STATS.map(stat => <td className="table-number" key={stat.key}>{row[state.view as 'bonuses' | 'growths'][stat.key] === null ? <MissingValue /> : formatClassModifier(row[state.view as 'bonuses' | 'growths'][stat.key])}</td>)}
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
          <div className="class-table-meta"><span>{state.view === 'growths' ? '成長率への加算（pt）' : state.view === 'bonuses' ? '能力値への加算' : '基本情報'}</span><span>—：未収録</span></div>
          <ClassSources data={data} />
        </div>
        {classId !== null && <ClassDetail data={data} row={detail} backRef={backRef} />}
      </section>
    </PanelStateScope.Provider>
  )
}

export function ClassInformationPage({ classId }: { classId: string | null }) {
  if (!classData.data) return <p role="alert">{classData.error}</p>
  return <ClassInformationContent data={classData.data} classId={classId} />
}
