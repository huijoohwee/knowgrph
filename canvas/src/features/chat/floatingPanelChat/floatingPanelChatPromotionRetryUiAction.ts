import { useGraphStore } from '@/hooks/useGraphStore'
import type { UiAction } from '@/hooks/store/types'
import { openFloatingPanelChatWithSeed } from './floatingPanelChatOpenSeed'

const CHAT_PROMOTION_RETRY_ACTION_PREFIX = 'chat-promotion-retry-action'
const CHAT_PROMOTION_RETRY_CONFIRMATION_TTL_MS = 3_200

const normalizeString = (value: unknown): string => String(value || '').trim()
const encodeToken = (value: string): string => encodeURIComponent(normalizeString(value))
const decodeToken = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return normalizeString(value)
  }
}

export const buildChatPromotionRetryInsertActionId = (command: string, toastId: string): string =>
  `${CHAT_PROMOTION_RETRY_ACTION_PREFIX}:insert-command:${encodeToken(command)}:${encodeToken(toastId)}`

export const buildChatPromotionRetryInsertAction = (command: string, toastId: string): UiAction => ({
  id: buildChatPromotionRetryInsertActionId(command, toastId),
  label: 'Insert Retry Command',
  tone: 'primary',
})

const parseChatPromotionRetryActionId = (actionId: string): { action: 'insert-command'; command: string; toastId: string } | null => {
  const parts = normalizeString(actionId).split(':')
  if (parts.length < 4) return null
  if (parts[0] !== CHAT_PROMOTION_RETRY_ACTION_PREFIX) return null
  if (parts[1] !== 'insert-command') return null
  const command = decodeToken(parts[2] || '')
  const toastId = decodeToken(parts.slice(3).join(':'))
  if (!command || !toastId) return null
  return { action: 'insert-command', command, toastId }
}

export const runChatPromotionRetryUiAction = async (actionId: string): Promise<boolean> => {
  const parsed = parseChatPromotionRetryActionId(actionId)
  if (!parsed) return false
  if (!openFloatingPanelChatWithSeed({ text: parsed.command, mode: 'append', delivery: 'appendEvent' })) {
    return false
  }
  useGraphStore.getState().upsertUiToast({
    id: parsed.toastId,
    kind: 'success',
    message: 'Retry command queued in chat composer.',
    ttlMs: CHAT_PROMOTION_RETRY_CONFIRMATION_TTL_MS,
    dismissible: true,
    log: false,
  })
  return true
}
