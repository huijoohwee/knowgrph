import React from 'react'

import { LS_KEYS } from '@/lib/config'
import { getLocalStorage, readBoolFromStorage, writeBoolToStorage } from '@/lib/persistence'

const MINIMAP_COLLAPSED_DEFAULT = false
const MINIMAP_COLLAPSED_EVENT = 'kg:minimap-collapsed-change'

const isMinimapCollapsedStorageKey = (key: string | null | undefined): boolean => {
  const text = String(key || '').trim()
  if (!text) return false
  return text === LS_KEYS.minimapCollapsed || text.endsWith(`::${LS_KEYS.minimapCollapsed}`)
}

export const readMinimapCollapsed = (): boolean => {
  try {
    return readBoolFromStorage(getLocalStorage(), LS_KEYS.minimapCollapsed, MINIMAP_COLLAPSED_DEFAULT)
  } catch {
    return MINIMAP_COLLAPSED_DEFAULT
  }
}

const notifyMinimapCollapsedSubscribers = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MINIMAP_COLLAPSED_EVENT))
}

export const writeMinimapCollapsed = (collapsed: boolean): boolean => {
  const next = !!collapsed
  let written = next
  try {
    written = writeBoolToStorage(getLocalStorage(), LS_KEYS.minimapCollapsed, next)
  } catch {
    written = next
  }
  notifyMinimapCollapsedSubscribers()
  return written
}

const subscribeMinimapCollapsed = (onStoreChange: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined
  const onStorage = (event: StorageEvent) => {
    if (!isMinimapCollapsedStorageKey(event.key)) return
    onStoreChange()
  }
  window.addEventListener(MINIMAP_COLLAPSED_EVENT, onStoreChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(MINIMAP_COLLAPSED_EVENT, onStoreChange)
    window.removeEventListener('storage', onStorage)
  }
}

export const useMinimapCollapsed = (): readonly [boolean, (collapsed: boolean) => void] => {
  const minimapCollapsed = React.useSyncExternalStore(
    subscribeMinimapCollapsed,
    readMinimapCollapsed,
    () => MINIMAP_COLLAPSED_DEFAULT,
  )
  const setMinimapCollapsed = React.useCallback((collapsed: boolean) => {
    writeMinimapCollapsed(collapsed)
  }, [])
  return [minimapCollapsed, setMinimapCollapsed] as const
}
