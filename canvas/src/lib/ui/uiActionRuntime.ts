import { runKnowgrphStorageConflictAction } from '@/lib/storage/knowgrphStorageConflictActions'

export const runUiAction = async (actionId: string): Promise<boolean> => {
  if (await runKnowgrphStorageConflictAction(actionId)) return true
  return false
}
