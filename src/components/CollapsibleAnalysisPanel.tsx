import type { ReactNode } from 'react'
import { usePanelOpen } from '../lib/usePanelOpen'
import './CollapsibleAnalysisPanel.css'

export function CollapsibleAnalysisPanel({
  id,
  number,
  title,
  summary,
  defaultOpen = true,
  collapsedLabel,
  className = '',
  bodyClassName = '',
  children,
}: {
  id: string
  number: string
  title: string
  summary: ReactNode
  defaultOpen?: boolean
  collapsedLabel: string
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  const [open, setOpen] = usePanelOpen(id, defaultOpen)
  const headingId = `${id}-heading`
  const bodyId = `${id}-body`

  return (
    <section className={`collapsible-analysis-panel ${open ? 'open' : ''} ${className}`.trim()}>
      <h2 className="collapsible-analysis-title">
        <button
          type="button"
          id={headingId}
          className="collapsible-analysis-heading"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
        >
          <span className="collapsible-analysis-heading-title">
            <span>{number}</span>
            <span className="collapsible-analysis-heading-label">{title}</span>
          </span>
          <span className="collapsible-analysis-heading-summary">
            <span>{summary}</span>
            <em>{`${open ? '閉じる' : collapsedLabel} ${open ? '−' : '+'}`}</em>
          </span>
        </button>
      </h2>
      <div
        id={bodyId}
        className={`collapsible-analysis-body ${bodyClassName}`.trim()}
        role="region"
        aria-labelledby={headingId}
        hidden={!open}
      >
        {children}
      </div>
    </section>
  )
}
