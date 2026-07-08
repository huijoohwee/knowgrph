import React from 'react'
import { getLocalStorage, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'
import { hashArrayOfObjectsSignature, hashSignatureParts } from '@/lib/hash/signature'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { WORKSPACE_SYNC_SCOPE_CHAT_HISTORY_RUNTIME_PERSISTENCE } from '@/lib/async/workspaceSyncKeys'
import type { ChatMessage, StreamingAssistantState } from '../FloatingPanelChatSections'
import {
  CHAT_HISTORY_COALESCE_DELAY_MS,
  getCachedChatHistory,
  putChatHistoryCache,
  resolveChatHistoryHydrationAction,
  toHistoryTaskKey,
} from './floatingPanelChatRuntime'

const parseChatHistory = (raw: unknown): ChatMessage[] | null => {
  if (!Array.isArray(raw)) return null
  const next: ChatMessage[] = []
  raw.forEach(item => {
    if (!item || typeof item !== 'object') return
    const id = typeof (item as { id?: unknown }).id === 'string' ? String((item as { id: unknown }).id) : ''
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if (!id) return
    if (role !== 'user' && role !== 'assistant') return
    if (typeof content !== 'string') return
    next.push({ id, role, content })
  })
  return next
}

export const useFloatingPanelChatHistory = (args: {
  historyKey: string
  isLoading: boolean
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  streamingAssistant: StreamingAssistantState | null
}): void => {
  const {
    historyKey,
    isLoading,
    messages,
    setMessages,
    streamingAssistant,
  } = args
  const lastLoadedHistoryKeyRef = React.useRef<string | null>(null)
  const streamingAssistantId = streamingAssistant?.id || ''

  React.useEffect(() => {
    const hydrationAction = resolveChatHistoryHydrationAction({
      historyKey,
      lastLoadedHistoryKey: lastLoadedHistoryKeyRef.current,
      isLoading,
    })
    if (hydrationAction === 'skip') return
    lastLoadedHistoryKeyRef.current = historyKey
    if (hydrationAction === 'mark-loaded') return
    const cached = getCachedChatHistory(historyKey)
    if (cached) {
      setMessages(cached)
      return
    }
    const storage = getLocalStorage()
    if (!storage) {
      setMessages([])
      return
    }
    const next = readJsonFromStorage(storage, historyKey, [] as ChatMessage[], parseChatHistory)
    const trimmed = next.slice(-80)
    putChatHistoryCache(historyKey, trimmed)
    setMessages(trimmed)
  }, [historyKey, isLoading, setMessages])

  React.useEffect(() => {
    const history = (() => {
      const base = messages.slice(-80)
      if (!streamingAssistantId) return base
      return base.filter(m => !(m.id === streamingAssistantId && m.role === 'assistant' && !String(m.content || '').trim()))
    })()
    putChatHistoryCache(historyKey, history)
    const taskKey = toHistoryTaskKey(historyKey)
    const signature = hashSignatureParts([
      historyKey,
      history.length,
      hashArrayOfObjectsSignature(history, { maxItems: 24, maxKeysPerItem: 4 }),
    ])
    scheduleWorkspaceSyncTask(taskKey, () => {
      const storage = getLocalStorage()
      if (!storage) return
      writeJsonToStorage(storage, historyKey, history)
    }, CHAT_HISTORY_COALESCE_DELAY_MS, {
      signature,
      scopeKey: WORKSPACE_SYNC_SCOPE_CHAT_HISTORY_RUNTIME_PERSISTENCE,
    })
  }, [historyKey, messages, streamingAssistantId])

  React.useEffect(() => {
    return () => {
      cancelWorkspaceSyncTask(toHistoryTaskKey(historyKey))
    }
  }, [historyKey])
}
