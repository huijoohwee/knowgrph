import React from 'react'
import { useGympgrphStore } from '@/lib/gympgrph/api'

const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (!a || !b) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) return false
  const aRec = a as Record<string, unknown>
  const bRec = b as Record<string, unknown>
  const aKeys = Object.keys(aRec)
  const bKeys = Object.keys(bRec)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bRec, k)) return false
    if (!Object.is(aRec[k], bRec[k])) return false
  }
  return true
}

export function useGympgrphExternalStore<T>(selector: (state: ReturnType<typeof useGympgrphStore.getState>) => T): T {
  const selectorRef = React.useRef(selector)
  selectorRef.current = selector

  const lastRef = React.useRef<T | null>(null)

  const getSnapshot = React.useCallback(() => {
    const next = selectorRef.current(useGympgrphStore.getState())
    const prev = lastRef.current
    if (prev != null && shallowEqual(prev as unknown, next as unknown)) return prev
    lastRef.current = next
    return next
  }, [])

  return React.useSyncExternalStore(useGympgrphStore.subscribe, getSnapshot, getSnapshot)
}
