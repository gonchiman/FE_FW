import { useSyncExternalStore } from 'react'
import { getPageFromHash } from './navigation'

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useHashRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '#/')
  return getPageFromHash(hash)
}
