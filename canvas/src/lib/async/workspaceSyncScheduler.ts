import { cancelCoalescedTask, scheduleCoalescedTask } from '@/lib/async/coalescedScheduler'

const WORKSPACE_SYNC_SCHEDULER_KEY = 'workspace:sync:runtime-persistence'
const pendingWorkspaceSyncTasks = new Map<string, () => void>()

export const scheduleWorkspaceSyncTask = (taskKey: string, fn: () => void, delayMs: number): void => {
  const key = String(taskKey || '').trim() || 'default'
  pendingWorkspaceSyncTasks.set(key, fn)
  scheduleCoalescedTask(WORKSPACE_SYNC_SCHEDULER_KEY, () => {
    const run = [...pendingWorkspaceSyncTasks.values()]
    pendingWorkspaceSyncTasks.clear()
    for (let i = 0; i < run.length; i += 1) {
      try {
        run[i]?.()
      } catch {
        void 0
      }
    }
  }, delayMs)
}

export const cancelWorkspaceSyncTask = (taskKey: string): void => {
  const key = String(taskKey || '').trim() || 'default'
  pendingWorkspaceSyncTasks.delete(key)
  if (pendingWorkspaceSyncTasks.size > 0) return
  cancelCoalescedTask(WORKSPACE_SYNC_SCHEDULER_KEY)
}
