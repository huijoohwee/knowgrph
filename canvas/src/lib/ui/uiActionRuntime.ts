import { runChatPromotionRetryUiAction } from '@/features/chat/floatingPanelChat/floatingPanelChatPromotionRetryUiAction'
import { runKnowgrphStorageConflictAction } from '@/lib/storage/knowgrphStorageConflictActions'

export const runUiAction = async (actionId: string): Promise<boolean> => {
  if (await runChatPromotionRetryUiAction(actionId)) return true
  if (await runKnowgrphStorageConflictAction(actionId)) return true
  return false
}
