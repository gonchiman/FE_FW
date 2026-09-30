import { useEffect, useId, useRef, useState } from 'react'
import {
  GROWTH_NUMERIC_FILTER_OPERATORS,
  parseGrowthNumericFilterValue,
  type GrowthNumericCondition,
} from '../lib/growth-numeric-filters'
import { GROWTH_STATS } from '../types/growth'
import './GrowthNumericFilter.css'

export function GrowthNumericFilter({ conditions, onChange }: {
  conditions: readonly GrowthNumericCondition[]
  onChange: (conditions: readonly GrowthNumericCondition[]) => void
}) {
  const nextId = useRef(1)
  const pendingFocus = useRef<{ id: number; control: 'input' | 'select' } | 'add' | null>(null)
  const rowsRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    if (target === 'add') addRef.current?.focus()
    else rowsRef.current?.querySelector<HTMLElement>(`[data-condition-id="${target.id}"] ${target.control}`)?.focus()
    pendingFocus.current = null
  }, [conditions])

  const addCondition = () => {
    const id = Math.max(nextId.current, ...conditions.map(condition => condition.id + 1))
    nextId.current = id + 1
    pendingFocus.current = { id, control: 'input' }
    onChange([...conditions, { id, field: conditions.length === 0 ? 'str' : 'spd', operator: 'gte', value: '' }])
  }

  const removeCondition = (id: number) => {
    const index = conditions.findIndex(condition => condition.id === id)
    const remaining = conditions.filter(condition => condition.id !== id)
    const next = remaining[Math.min(index, remaining.length - 1)]
    pendingFocus.current = next ? { id: next.id, control: 'select' } : 'add'
    onChange(remaining)
  }

  return <fieldset className="growth-numeric-filter">
    <legend>数値条件 <span>すべて満たす</span></legend>
    <div className="growth-numeric-conditions" ref={rowsRef}>
      {conditions.map((condition, index) => <GrowthNumericConditionRow key={condition.id}
        condition={condition} index={index}
        onChange={updated => onChange(conditions.map(current => current.id === updated.id ? updated : current))}
        onRemove={() => removeCondition(condition.id)} />)}
    </div>
    <div className="growth-numeric-actions">
      <button type="button" className="growth-numeric-add" ref={addRef} onClick={addCondition}>＋ 条件を追加</button>
      <button type="button" disabled={conditions.length === 0} onClick={() => {
        pendingFocus.current = 'add'
        onChange([])
      }}>数値条件を解除</button>
    </div>
  </fieldset>
}

function GrowthNumericConditionRow({ condition, index, onChange, onRemove }: {
  condition: GrowthNumericCondition
  index: number
  onChange: (condition: GrowthNumericCondition) => void
  onRemove: () => void
}) {
  const errorId = useId()
  const [badInput, setBadInput] = useState(false)
  const invalid = badInput || (condition.value.trim() !== '' && parseGrowthNumericFilterValue(condition.value) === null)

  return <div className="growth-numeric-condition" data-condition-id={condition.id}>
    <label><span>能力</span>
      <select aria-label={`条件${index + 1}の能力`} value={condition.field} onChange={event => {
        const selected = GROWTH_STATS.find(option => option.key === event.target.value)
        if (selected) onChange({ ...condition, field: selected.key })
      }}>
        {GROWTH_STATS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
    </label>
    <label><span>比較</span>
      <select aria-label={`条件${index + 1}の比較`} value={condition.operator} onChange={event => {
        const selected = GROWTH_NUMERIC_FILTER_OPERATORS.find(option => option.key === event.target.value)
        if (selected) onChange({ ...condition, operator: selected.key })
      }}>
        {GROWTH_NUMERIC_FILTER_OPERATORS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
    </label>
    <label><span>成長率（%）</span>
      <input type="number" min="0" step="any" aria-label={`条件${index + 1}の成長率（%）`}
        aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}
        placeholder="未指定" value={condition.value}
        onInput={event => setBadInput(event.currentTarget.validity.badInput)}
        onChange={event => onChange({ ...condition, value: event.target.value })} />
    </label>
    <button type="button" aria-label={`条件${index + 1}を削除`} onClick={onRemove}>削除</button>
    {invalid && <span className="growth-numeric-error" id={errorId} role="alert">0以上の数値を入力してください</span>}
  </div>
}
