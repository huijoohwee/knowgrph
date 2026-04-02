import { cancelCoalescedTask, scheduleCoalescedTask } from '@/lib/async/coalescedScheduler'

const WORKSPACE_SYNC_SCHEDULER_KEY = 'workspace:sync:runtime-persistence'
type WorkspaceSyncTaskEntry = {
  fn: () => void
  signature: string | null
}

export type WorkspaceSyncTaskOptions = {
  signature?: string | null
}

const pendingWorkspaceSyncTasks = new Map<string, WorkspaceSyncTaskEntry>()
const lastExecutedWorkspaceSyncTaskSignature = new Map<string, string>()

export const scheduleWorkspaceSyncTask = (
  taskKey: string,
  fn: () => void,
  delayMs: number,
  options?: WorkspaceSyncTaskOptions,
): void => {
  const key = String(taskKey || '').trim() || 'default'
  const signatureRaw = typeof options?.signature === 'string' ? options.signature : null
  const signature = signatureRaw && signatureRaw.length > 0 ? signatureRaw : null
  const pending = pendingWorkspaceSyncTasks.get(key)
  if (signature && pending?.signature === signature) return
  if (signature && lastExecutedWorkspaceSyncTaskSignature.get(key) === signature) return
  pendingWorkspaceSyncTasks.set(key, { fn, signature })
  scheduleCoalescedTask(WORKSPACE_SYNC_SCHEDULER_KEY, () => {
    const run = [...pendingWorkspaceSyncTasks.entries()]
    pendingWorkspaceSyncTasks.clear()
    for (let i = 0; i < run.length; i += 1) {
      const [taskName, task] = run[i]
      try {
        task.fn()
        if (task.signature) {
          lastExecutedWorkspaceSyncTaskSignature.set(taskName, task.signature)
        }
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
