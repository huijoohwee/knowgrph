import { getChatHistoryStorageKey } from '@/lib/config'
import type { GraphData } from '@/lib/graph/types'
import type { ChatMessage } from '../FloatingPanelChatSections'

export const toShortId = (): string => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const parseLine = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const buildHistoryKey = (graphData: GraphData | null): string => {
  const meta = graphData?.metadata || null
  const getString = (k: string) => {
    const raw = meta ? meta[k] : null
    return typeof raw === 'string' ? raw.trim() : ''
  }
  const idish =
    getString('graphId') ||
    getString('id') ||
    getString('source') ||
    getString('path') ||
    getString('dataset') ||
    getString('name')
  const fallback = (() => {
    if (!graphData) return 'empty'
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes.length : 0
    const edges = Array.isArray(graphData.edges) ? graphData.edges.length : 0
    const type = typeof graphData.type === 'string' ? graphData.type : 'graph'
    return `${type}:${nodes}:${edges}`
  })()
  return getChatHistoryStorageKey(idish || fallback)
}

export type ChatHistoryHydrationAction = 'skip' | 'mark-loaded' | 'hydrate'

export type ChatHistoryPersistenceAction = 'skip-hydration-commit' | 'persist'

export const resolveChatHistoryHydrationAction = (args: {
  historyKey: string
  lastLoadedHistoryKey: string | null
  isLoading: boolean
}): ChatHistoryHydrationAction => {
  const historyKey = String(args.historyKey || '').trim()
  if (!historyKey || String(args.lastLoadedHistoryKey || '') === historyKey) return 'skip'
  return args.isLoading ? 'mark-loaded' : 'hydrate'
}

export const resolveChatHistoryPersistenceAction = (args: {
  historyKey: string
  pendingHydrationHistoryKey: string | null
}): ChatHistoryPersistenceAction => (
  String(args.historyKey || '').trim() &&
  String(args.pendingHydrationHistoryKey || '').trim() === String(args.historyKey || '').trim()
    ? 'skip-hydration-commit'
    : 'persist'
)

export const createPendingChatRequestMessageId = (assistantMessageId: string): string => {
  const safeAssistantMessageId = String(assistantMessageId || '').trim()
  return `${safeAssistantMessageId || 'assistant'}-request`
}

export const upsertPendingChatRequestTurn = (args: {
  messages: ChatMessage[]
  requestText: string
  requestMessageId: string
  assistantMessageId: string
  dedupeRequestContent?: boolean
}): ChatMessage[] => {
  const requestText = String(args.requestText || '').trim()
  const requestMessageId = String(args.requestMessageId || '').trim()
  const assistantMessageId = String(args.assistantMessageId || '').trim()
  if (!requestText && !assistantMessageId) return args.messages

  const next = args.messages.slice()
  let changed = false
  const assistantIndex = assistantMessageId
    ? next.findIndex(message => message.id === assistantMessageId)
    : -1
  const requestIndexById = requestMessageId
    ? next.findIndex(message => message.id === requestMessageId)
    : -1
  const requestIndexByContent = args.dedupeRequestContent && requestText
    ? (() => {
        for (let index = next.length - 1; index >= 0; index -= 1) {
          const message = next[index]
          if (message?.role === 'user' && String(message.content || '').trim() === requestText) return index
        }
        return -1
      })()
    : -1
  const requestIndex = requestIndexById >= 0 ? requestIndexById : requestIndexByContent

  if (requestText) {
    if (requestIndex >= 0) {
      const current = next[requestIndex]
      if (current.role !== 'user' || current.content !== requestText) {
        next[requestIndex] = { ...current, role: 'user', content: requestText }
        changed = true
      }
    } else {
      const insertAt = assistantIndex >= 0 ? assistantIndex : next.length
      next.splice(insertAt, 0, {
        id: requestMessageId || createPendingChatRequestMessageId(assistantMessageId),
        role: 'user',
        content: requestText,
      })
      changed = true
    }
  }

  if (assistantMessageId && !next.some(message => message.id === assistantMessageId)) {
    next.push({ id: assistantMessageId, role: 'assistant', content: '' })
    changed = true
  }

  return changed ? next : args.messages
}

export const CHAT_HISTORY_COALESCE_DELAY_MS = 220

const CHAT_HISTORY_CACHE_LIMIT = 80
const CHAT_HISTORY_TRANSITION_REPLAY_MS = 5_000
const chatHistoryCache = new Map<string, ChatMessage[]>()
const chatHistoryCacheListeners = new Map<string, Set<(messages: ChatMessage[]) => void>>()
const chatHistoryTransitionListeners = new Map<string, Set<(messages: ChatMessage[]) => void>>()
type ChatHistoryTransitionRecord = {
  historyKeys: Set<string>
  messages: ChatMessage[]
  publishedAtMs: number
}
const latestChatHistoryTransitions = new Map<string, ChatHistoryTransitionRecord>()

const areChatHistoryMessagesEqual = (left: ChatMessage[] | undefined, right: ChatMessage[]): boolean => {
  if (!left || left.length !== right.length) return false
  return left.every((message, index) => {
    const candidate = right[index]
    return candidate?.id === message.id && candidate.role === message.role && candidate.content === message.content
  })
}

const haveSameChatHistoryMessageIdentity = (left: ChatMessage[], right: ChatMessage[]): boolean => (
  left.length === right.length
  && left.every((message, index) => message.id === right[index]?.id && message.role === right[index]?.role)
)

const trimChatHistoryTransitions = (): void => {
  while (latestChatHistoryTransitions.size > CHAT_HISTORY_CACHE_LIMIT) {
    const oldestKey = latestChatHistoryTransitions.keys().next().value
    if (typeof oldestKey !== 'string') break
    latestChatHistoryTransitions.delete(oldestKey)
  }
}

export const getCachedChatHistory = (key: string): ChatMessage[] | null => {
  const v = chatHistoryCache.get(String(key || ''))
  return Array.isArray(v) ? v : null
}

export const putChatHistoryCache = (key: string, value: ChatMessage[]): void => {
  if (!key) return
  const previous = chatHistoryCache.get(key)
  if (chatHistoryCache.has(key)) {
    chatHistoryCache.delete(key)
  }
  chatHistoryCache.set(key, value)
  if (!areChatHistoryMessagesEqual(previous, value)) {
    for (const listener of chatHistoryCacheListeners.get(key) || []) listener(value)
  }
  if (chatHistoryCache.size <= CHAT_HISTORY_CACHE_LIMIT) return
  const oldestKey = chatHistoryCache.keys().next().value
  if (typeof oldestKey === 'string' && oldestKey) {
    chatHistoryCache.delete(oldestKey)
  }
}

export const subscribeToChatHistoryCache = (
  key: string,
  listener: (messages: ChatMessage[]) => void,
): (() => void) => {
  const historyKey = String(key || '').trim()
  if (!historyKey) return () => undefined
  const listeners = chatHistoryCacheListeners.get(historyKey) || new Set<(messages: ChatMessage[]) => void>()
  listeners.add(listener)
  chatHistoryCacheListeners.set(historyKey, listeners)
  return () => {
    const current = chatHistoryCacheListeners.get(historyKey)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) chatHistoryCacheListeners.delete(historyKey)
  }
}

export const publishChatHistoryTransition = (args: {
  historyKeys: readonly string[]
  messages: ChatMessage[]
}): ChatMessage[] => {
  const requestedHistoryKeys = [...new Set(args.historyKeys.map(key => String(key || '').trim()).filter(Boolean))]
  const publishedAtMs = Date.now()
  const historyKeys = new Set(requestedHistoryKeys)
  for (const historyKey of requestedHistoryKeys) {
    const previous = latestChatHistoryTransitions.get(historyKey)
    if (
      previous
      && publishedAtMs - previous.publishedAtMs <= CHAT_HISTORY_TRANSITION_REPLAY_MS
      && haveSameChatHistoryMessageIdentity(previous.messages, args.messages)
    ) {
      for (const transitionedHistoryKey of previous.historyKeys) historyKeys.add(transitionedHistoryKey)
    }
  }
  const transition: ChatHistoryTransitionRecord = { historyKeys, messages: args.messages, publishedAtMs }
  for (const historyKey of historyKeys) {
    if (latestChatHistoryTransitions.has(historyKey)) latestChatHistoryTransitions.delete(historyKey)
    latestChatHistoryTransitions.set(historyKey, transition)
    for (const listener of chatHistoryTransitionListeners.get(historyKey) || []) listener(args.messages)
  }
  trimChatHistoryTransitions()
  return args.messages
}

export const adoptLatestChatHistoryTransition = (args: {
  historyKey: string
  previousHistoryKey: string | null
  currentMessages: ChatMessage[]
}): ChatMessage[] | null => {
  const historyKey = String(args.historyKey || '').trim()
  const previousHistoryKey = String(args.previousHistoryKey || '').trim()
  if (!historyKey || !previousHistoryKey || historyKey === previousHistoryKey) return null
  const transition = latestChatHistoryTransitions.get(previousHistoryKey)
  if (!transition || Date.now() - transition.publishedAtMs > CHAT_HISTORY_TRANSITION_REPLAY_MS) return null
  if (!areChatHistoryMessagesEqual(args.currentMessages, transition.messages)) return null
  transition.historyKeys.add(historyKey)
  if (latestChatHistoryTransitions.has(historyKey)) latestChatHistoryTransitions.delete(historyKey)
  latestChatHistoryTransitions.set(historyKey, transition)
  trimChatHistoryTransitions()
  putChatHistoryCache(historyKey, transition.messages)
  return transition.messages
}

export const subscribeToChatHistoryTransition = (
  key: string,
  listener: (messages: ChatMessage[]) => void,
): (() => void) => {
  const historyKey = String(key || '').trim()
  if (!historyKey) return () => undefined
  const listeners = chatHistoryTransitionListeners.get(historyKey) || new Set<(messages: ChatMessage[]) => void>()
  listeners.add(listener)
  chatHistoryTransitionListeners.set(historyKey, listeners)
  const latest = latestChatHistoryTransitions.get(historyKey)
  if (latest && Date.now() - latest.publishedAtMs <= CHAT_HISTORY_TRANSITION_REPLAY_MS) {
    listener(latest.messages)
  }
  return () => {
    const current = chatHistoryTransitionListeners.get(historyKey)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) chatHistoryTransitionListeners.delete(historyKey)
  }
}

export const cacheChatHistoryMessagesForKeys = (args: {
  historyKeys: readonly string[]
  messages: ChatMessage[]
}): ChatMessage[] => {
  const messages = args.messages.slice(-80)
  const historyKeys = [...new Set(args.historyKeys.map(key => String(key || '').trim()).filter(Boolean))]
  for (const historyKey of historyKeys) putChatHistoryCache(historyKey, messages)
  return messages
}

export const toHistoryTaskKey = (historyKey: string): string => {
  const safe = String(historyKey || '').trim() || 'default'
  return `chat:history:persist:${safe}`
}

export const persistChatExchangeLog = async (payload: {
  request: string
  response: string
  status: 'ok' | 'error' | 'aborted'
  model: string
  timestampMs: number
}): Promise<void> => {
  try {
    await fetch('/__chat_log_append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    void 0
  }
}
