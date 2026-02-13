import type { GraphState, UiToast, UiToastInput } from '@/hooks/store/types'
import { createId } from '@/lib/id'

const MAX_TOASTS = 3
const DEFAULT_TTL_MS = 10_000

const coerceId = (raw: unknown): string => String(raw || '').trim()

const coerceNow = (raw: unknown): number => {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : Date.now()
  return n > 0 ? Math.floor(n) : Date.now()
}

const coerceTtlMs = (raw: unknown): number | null => {
  if (raw == null) return null
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  return Math.max(250, Math.min(60_000, Math.floor(n)))
}

const resolveTtlMs = (raw: unknown): number | null => {
  if (typeof raw === 'undefined') return DEFAULT_TTL_MS
  return coerceTtlMs(raw)
}

const coerceDismissible = (raw: unknown, fallback: boolean): boolean => {
  if (typeof raw === 'boolean') return raw
  return fallback
}

const buildToast = (input: UiToastInput, nowMs: number): UiToast => {
  const id = coerceId(input.id)
  const message = String(input.message || '').trim()
  const ttlMs = resolveTtlMs(input.ttlMs)
  const expiresAtMs = ttlMs ? nowMs + ttlMs : null
  const dismissible = coerceDismissible(input.dismissible, true)
  const kind = input.kind || 'neutral'
  return { id, kind, message, createdAtMs: nowMs, expiresAtMs, dismissible }
}

const appendToastLog = (args: { state: GraphState; toast: UiToast; source: string }): Partial<GraphState> => {
  const cur = args.state.uiLogEntries || []
  const next = [
    {
      id: createId('log'),
      kind: args.toast.kind,
      message: args.toast.message,
      tsMs: args.toast.createdAtMs,
      source: args.source,
    },
    ...cur,
  ].slice(0, 250)
  return { uiLogEntries: next }
}

export const createUiToastSlice = (
  set: (fn: (state: GraphState) => Partial<GraphState>) => void,
): Pick<GraphState, 'uiToasts' | 'pushUiToast' | 'upsertUiToast' | 'dismissUiToast' | 'pruneUiToasts'> => {
  return {
    uiToasts: [],
    pushUiToast: (toast) => {
      const id = coerceId(toast?.id)
      const message = String(toast?.message || '').trim()
      if (!id || !message) return
      set((state) => {
        const shouldLog = toast?.log !== false
        const nowMs = Date.now()
        const nextToast = buildToast(toast, nowMs)
        const cur = state.uiToasts || []
        const deduped = cur.filter(t => t.id !== id)
        const next = [nextToast, ...deduped].slice(0, MAX_TOASTS)
        return shouldLog
          ? { uiToasts: next, ...appendToastLog({ state, toast: nextToast, source: 'toast:push' }) }
          : { uiToasts: next }
      })
    },
    upsertUiToast: (toast) => {
      const id = coerceId(toast?.id)
      const message = String(toast?.message || '').trim()
      if (!id || !message) return
      set((state) => {
        const shouldLog = toast?.log !== false
        const nowMs = Date.now()
        const cur = state.uiToasts || []
        const idx = cur.findIndex(t => t.id === id)
        const nextToast = buildToast(toast, nowMs)
        if (idx < 0) {
          const deduped = cur.filter(t => t.id !== id)
          const next = [nextToast, ...deduped].slice(0, MAX_TOASTS)
          return shouldLog
            ? { uiToasts: next, ...appendToastLog({ state, toast: nextToast, source: 'toast:upsert' }) }
            : { uiToasts: next }
        }
        const prev = cur[idx]
        const ttlMs = nextToast.expiresAtMs == null ? null : Math.max(0, nextToast.expiresAtMs - nowMs)
        const nextExpiresAtMs =
          ttlMs == null || ttlMs <= 0 ? null : Math.max(0, Math.floor(prev.createdAtMs + ttlMs))
        const merged: UiToast = {
          ...prev,
          ...nextToast,
          createdAtMs: prev.createdAtMs,
          expiresAtMs: nextExpiresAtMs,
        }
        const rest = cur.filter(t => t.id !== id)
        return shouldLog
          ? {
              uiToasts: [merged, ...rest].slice(0, MAX_TOASTS),
              ...appendToastLog({ state, toast: nextToast, source: 'toast:upsert' }),
            }
          : { uiToasts: [merged, ...rest].slice(0, MAX_TOASTS) }
      })
    },
    dismissUiToast: (id) => {
      const target = coerceId(id)
      if (!target) return
      set((state) => {
        const cur = state.uiToasts || []
        const next = cur.filter(t => t.id !== target)
        return next.length === cur.length ? {} : { uiToasts: next }
      })
    },
    pruneUiToasts: (nowMs) => {
      const ts = coerceNow(nowMs)
      set((state) => {
        const cur = state.uiToasts || []
        const next = cur.filter(t => t.expiresAtMs == null || t.expiresAtMs > ts)
        return next.length === cur.length ? {} : { uiToasts: next }
      })
    },
  }
}
