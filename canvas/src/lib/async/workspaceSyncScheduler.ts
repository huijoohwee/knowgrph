import { cancelCoalescedTask, scheduleCoalescedTask } from '@/lib/async/coalescedScheduler'

const WORKSPACE_SYNC_SCHEDULER_KEY = 'workspace:sync:runtime-persistence'
const WORKSPACE_SYNC_SIGNATURE_LIMIT = 400
type WorkspaceSyncTaskEntry = {
  fn: () => void
  signature: string | null
}

export type WorkspaceSyncTaskOptions = {
  signature?: string | null
}

const pendingWorkspaceSyncTasks = new Map<string, WorkspaceSyncTaskEntry>()
const lastExecutedWorkspaceSyncTaskSignature = new Map<string, string>()

const setLastExecutedSignature = (key: string, signature: string): void => {
  if (!key || !signature) return
  if (lastExecutedWorkspaceSyncTaskSignature.has(key)) {
    lastExecutedWorkspaceSyncTaskSignature.delete(key)
  }
  lastExecutedWorkspaceSyncTaskSignature.set(key, signature)
  if (lastExecutedWorkspaceSyncTaskSignature.size <= WORKSPACE_SYNC_SIGNATURE_LIMIT) return
  const oldestKey = lastExecutedWorkspaceSyncTaskSignature.keys().next().value
  if (typeof oldestKey === 'string' && oldestKey) {
    lastExecutedWorkspaceSyncTaskSignature.delete(oldestKey)
  }
}

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
          setLastExecutedSignature(taskName, task.signature)
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
  lastExecutedWorkspaceSyncTaskSignature.delete(key)
  if (pendingWorkspaceSyncTasks.size > 0) return
  cancelCoalescedTask(WORKSPACE_SYNC_SCHEDULER_KEY)
}
