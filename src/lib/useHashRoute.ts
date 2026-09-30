import { useSyncExternalStore } from 'react'
import { getNameTabFromHash, getPageFromHash } from './navigation'

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useHashRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '#/')
  const page = getPageFromHash(hash)
  return page ? { ...page, nameTab: getNameTabFromHash(hash) } : undefined
}
