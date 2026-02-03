import type { SsotChange, SsotFocus } from './types.js'

export const SSOT_CHANGED_EVENT = 'kg:ssotChanged'
export const SSOT_FOCUS_CHANGED_EVENT = 'kg:ssotFocusChanged'

export type SsotChangedDetail = SsotChange
export type SsotFocusChangedDetail = SsotFocus

export function emitSsotChanged(detail: SsotChangedDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<SsotChangedDetail>(SSOT_CHANGED_EVENT, { detail }))
}

export function emitSsotFocusChanged(detail: SsotFocusChangedDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<SsotFocusChangedDetail>(SSOT_FOCUS_CHANGED_EVENT, { detail }))
}

export function onSsotChanged(handler: (detail: SsotChangedDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const wrapped = (ev: Event) => {
    const e = ev as CustomEvent<SsotChangedDetail | undefined>
    if (!e.detail) return
    handler(e.detail)
  }
  window.addEventListener(SSOT_CHANGED_EVENT, wrapped as EventListener)
  return () => window.removeEventListener(SSOT_CHANGED_EVENT, wrapped as EventListener)
}

export function onSsotFocusChanged(handler: (detail: SsotFocusChangedDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const wrapped = (ev: Event) => {
    const e = ev as CustomEvent<SsotFocusChangedDetail | undefined>
    if (!e.detail) return
    handler(e.detail)
  }
  window.addEventListener(SSOT_FOCUS_CHANGED_EVENT, wrapped as EventListener)
  return () => window.removeEventListener(SSOT_FOCUS_CHANGED_EVENT, wrapped as EventListener)
}
