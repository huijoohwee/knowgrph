import type { ChatExchangeLogEntry, GraphState, UiLogEntry } from '@/hooks/store/types'
import { createId } from '@/lib/id'

const MAX_LOG_ENTRIES = 250
const MAX_CHAT_EXCHANGE_LOG_ENTRIES = 300

const coerceNow = (raw: unknown): number => {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : Date.now()
  return n > 0 ? Math.floor(n) : Date.now()
}

const coerceMessage = (raw: unknown): string => String(raw || '').trim()

export const createUiLogSlice = (
  set: (fn: (state: GraphState) => Partial<GraphState>) => void,
): Pick<GraphState, 'uiLogEntries' | 'pushUiLog' | 'clearUiLog' | 'chatExchangeLogs' | 'pushChatExchangeLog' | 'clearChatExchangeLogs'> => {
  return {
    uiLogEntries: [],
    chatExchangeLogs: [],
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
          actions: Array.isArray(entry?.actions) ? entry.actions : undefined,
        }
        const cur = state.uiLogEntries || []
        return { uiLogEntries: [next, ...cur].slice(0, MAX_LOG_ENTRIES) }
      })
    },
    clearUiLog: () => set(() => ({ uiLogEntries: [] })),
    pushChatExchangeLog: (entry) => {
      const request = coerceMessage(entry?.request)
      const response = coerceMessage(entry?.response)
      if (!request && !response) return
      const snippet = coerceMessage(entry?.snippet) || (response || request).slice(0, 240)
      set(state => {
        const nowMs = coerceNow(entry?.tsMs)
        const next: ChatExchangeLogEntry = {
          id: createId('chatlog'),
          request,
          response,
          snippet,
          tsMs: nowMs,
          status: entry?.status === 'error' || entry?.status === 'aborted' ? entry.status : 'ok',
          model: typeof entry?.model === 'string' && entry.model.trim() ? entry.model.trim() : null,
        }
        const cur = state.chatExchangeLogs || []
        return { chatExchangeLogs: [next, ...cur].slice(0, MAX_CHAT_EXCHANGE_LOG_ENTRIES) }
      })
    },
    clearChatExchangeLogs: () => set(() => ({ chatExchangeLogs: [] })),
  }
}
