type PanelStorage = Pick<Storage, 'getItem' | 'setItem'>

export function getPanelStorageKey(pageId: string, panelId: string): string {
  return `fe-fw-panel-open-v1:${encodeURIComponent(pageId)}:${encodeURIComponent(panelId)}`
}

function localStorageOrUndefined(): PanelStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export function readPanelOpen(key: string, defaultOpen: boolean, storage = localStorageOrUndefined()): boolean {
  try {
    const value = storage?.getItem(key)
    return value === 'true' ? true : value === 'false' ? false : defaultOpen
  } catch {
    return defaultOpen
  }
}

export function writePanelOpen(key: string, open: boolean, storage = localStorageOrUndefined()): void {
  try {
    storage?.setItem(key, String(open))
  } catch {
    // Blocked or full browser storage must not prevent opening and closing panels.
  }
}
