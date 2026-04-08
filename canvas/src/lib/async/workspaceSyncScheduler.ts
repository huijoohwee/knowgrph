import { cancelCoalescedTask, scheduleCoalescedTask } from '@/lib/async/coalescedScheduler'

const WORKSPACE_SYNC_SCHEDULER_KEY = 'workspace:sync:runtime-persistence'
const WORKSPACE_SYNC_SIGNATURE_LIMIT = 400
type WorkspaceSyncTaskEntry = {
  fn: () => void
  signature: string | null
  scopeKey: string
}

export type WorkspaceSyncTaskOptions = {
  signature?: string | null
  scopeKey?: string | null
}

const pendingWorkspaceSyncTasks = new Map<string, WorkspaceSyncTaskEntry>()
const lastExecutedWorkspaceSyncTaskSignature = new Map<string, string>()
let workspaceSyncFlushScheduled = false
let workspaceSyncFlushDelayMs = 0

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

const getOrCreatePendingTaskEntry = (key: string): WorkspaceSyncTaskEntry => {
  const existing = pendingWorkspaceSyncTasks.get(key)
  if (existing) return existing
  const next: WorkspaceSyncTaskEntry = { fn: () => void 0, signature: null, scopeKey: key }
  pendingWorkspaceSyncTasks.set(key, next)
  return next
}

const flushWorkspaceSyncTasks = (): void => {
  workspaceSyncFlushScheduled = false
  workspaceSyncFlushDelayMs = 0

  const run = [...pendingWorkspaceSyncTasks.entries()]
  pendingWorkspaceSyncTasks.clear()

  for (let i = 0; i < run.length; i += 1) {
    const [taskName, task] = run[i]
    try {
      task.fn()
      if (task.signature) {
        setLastExecutedSignature(task.scopeKey || taskName, task.signature)
      }
    } catch {
      void 0
    } finally {
      // Release references eagerly (avoid retaining closures across flush cycles).
      task.fn = () => void 0
      task.signature = null
      task.scopeKey = taskName
    }
  }
}

export const scheduleWorkspaceSyncTask = (
  taskKey: string,
  fn: () => void,
  delayMs: number,
  options?: WorkspaceSyncTaskOptions,
): void => {
  const key = String(taskKey || '').trim() || 'default'
  const scopeKey = String(options?.scopeKey || '').trim() || key
  const signatureRaw = typeof options?.signature === 'string' ? options.signature : null
  const signature = signatureRaw && signatureRaw.length > 0 ? signatureRaw : null
  if (signature && lastExecutedWorkspaceSyncTaskSignature.get(scopeKey) === signature) return

  const entry = getOrCreatePendingTaskEntry(key)
  entry.fn = fn
  entry.signature = signature
  entry.scopeKey = scopeKey
  const normalizedDelay = Number.isFinite(delayMs) && delayMs >= 0 ? Math.floor(delayMs) : 0
  if (!workspaceSyncFlushScheduled) {
    workspaceSyncFlushScheduled = true
    workspaceSyncFlushDelayMs = normalizedDelay
    scheduleCoalescedTask(WORKSPACE_SYNC_SCHEDULER_KEY, flushWorkspaceSyncTasks, normalizedDelay)
    return
  }
  if (normalizedDelay >= workspaceSyncFlushDelayMs) return
  workspaceSyncFlushDelayMs = normalizedDelay
  scheduleCoalescedTask(WORKSPACE_SYNC_SCHEDULER_KEY, flushWorkspaceSyncTasks, normalizedDelay)
}

export const cancelWorkspaceSyncTask = (taskKey: string): void => {
  const key = String(taskKey || '').trim() || 'default'
  pendingWorkspaceSyncTasks.delete(key)
  if (pendingWorkspaceSyncTasks.size > 0) return
  workspaceSyncFlushScheduled = false
  workspaceSyncFlushDelayMs = 0
  cancelCoalescedTask(WORKSPACE_SYNC_SCHEDULER_KEY)
}
