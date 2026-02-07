import type { GraphState, UiLogEntry } from '@/hooks/store/types'
import { createId } from '@/lib/id'

const MAX_LOG_ENTRIES = 250

const coerceNow = (raw: unknown): number => {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : Date.now()
  return n > 0 ? Math.floor(n) : Date.now()
}

const coerceMessage = (raw: unknown): string => String(raw || '').trim()

export const createUiLogSlice = (
  set: (fn: (state: GraphState) => Partial<GraphState>) => void,
): Pick<GraphState, 'uiLogEntries' | 'pushUiLog' | 'clearUiLog'> => {
  return {
    uiLogEntries: [],
    pushUiLog: (entry) => {
      const message = coerceMessage(entry?.message)
      if (!message) return
      set(state => {
        const nowMs = coerceNow(entry?.tsMs)
        const next: UiLogEntry = {
          id: createId('log'),
          kind: entry?.kind || 'neutral',
          message,
          tsMs: nowMs,
          source: entry?.source || null,
        }
        const cur = state.uiLogEntries || []
        return { uiLogEntries: [next, ...cur].slice(0, MAX_LOG_ENTRIES) }
      })
    },
    clearUiLog: () => set(() => ({ uiLogEntries: [] })),
  }
}
