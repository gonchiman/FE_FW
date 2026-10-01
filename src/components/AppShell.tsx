import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NAVIGATION_ITEMS, type NavigationPage } from '../lib/navigation'
import './AppShell.css'

type AppShellProps = {
  title: string
  activePage: NavigationPage | null
  children?: ReactNode
}

type SidebarContentProps = {
  activePage: NavigationPage | null
  onNavigate?: () => void
  onClose?: () => void
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GrowthTableIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 10h18M9 4v16M15 10v10" />
    </svg>
  )
}

function GrowthAnalysisIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 3v18h18M7 17v-5h4v5M11 17V7h4v10M15 17V4h4v13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CharacterNamesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 5h10M8 3v2M5 5c0 5 4 8 8 10M12 5c0 5-4 8-9 10M13 21l4-10 4 10M15 17h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SidebarContent({ activePage, onNavigate, onClose }: SidebarContentProps) {
  return (
    <div className="sidebar-inner">
      <div className="sidebar-brand-row">
        <a className="site-brand" href="#/" onClick={onNavigate} aria-label="FE FW ホーム">
          <span className="brand-mark" aria-hidden="true">FE</span>
          <span className="brand-copy">
            <span className="brand-series">FIRE EMBLEM</span>
            <span className="brand-title">万紫千紅</span>
          </span>
        </a>
        {onClose && (
          <button className="icon-button" type="button" onClick={onClose} aria-label="メニューを閉じる" autoFocus>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <nav className="sidebar-navigation" aria-label="ページ">
        <p className="sidebar-section-label">ページ</p>
        <ul className="sidebar-links">
          {NAVIGATION_ITEMS.map((item) => (
            <li key={item.id}>
              <a
                className="sidebar-link"
                href={item.href}
                aria-current={item.id === activePage ? 'page' : undefined}
                onClick={onNavigate}
              >
                {item.id === 'home' && <HomeIcon />}
                {item.id === 'growth-rates' && <GrowthTableIcon />}
                {item.id === 'classes' && <GrowthTableIcon />}
                {item.id === 'growth-analysis' && <GrowthAnalysisIcon />}
                {item.id === 'character-names' && <CharacterNamesIcon />}
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function AppShell({ title, activePage, children }: AppShellProps) {
  const menuRef = useRef<HTMLDialogElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mainContentRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    menuRef.current?.close()
  }

  function openMenu() {
    menuRef.current?.showModal()
    setMenuOpen(true)
  }

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1141px)')
    const closeOnDesktop = () => {
      if (desktop.matches) menuRef.current?.close()
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        mainContentRef.current?.focus()
        mainContentRef.current?.scrollIntoView({ block: 'start' })
      }}>本文へ移動</a>

      <aside className="desktop-sidebar" aria-label="サイドバー">
        <SidebarContent activePage={activePage} />
      </aside>

      <div className="app-workspace">
        <header className="app-header">
          <button
            ref={menuButtonRef}
            className="icon-button menu-toggle"
            type="button"
            aria-label="メニューを開く"
            aria-controls="mobile-menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={openMenu}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <h1 className="page-title">{title}</h1>
        </header>

        <main ref={mainContentRef} className="app-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      <dialog
        ref={menuRef}
        className="mobile-menu"
        id="mobile-menu"
        aria-label="メインメニュー"
        onClose={() => {
          setMenuOpen(false)
          if (window.matchMedia('(max-width: 1140px)').matches) menuButtonRef.current?.focus()
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          const bounds = event.currentTarget.getBoundingClientRect()
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            closeMenu()
          }
        }}
      >
        <SidebarContent activePage={activePage} onNavigate={closeMenu} onClose={closeMenu} />
      </dialog>
    </div>
  )
}
