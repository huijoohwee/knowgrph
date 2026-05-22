import { scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { WORKSPACE_SYNC_SCOPE_CANVAS_TAB_SYNC_RUNTIME_PERSISTENCE } from '@/lib/async/workspaceSyncKeys'
import { canPublishCanvasTabSync } from '@/features/canvas/canvasTabSyncPublishPlan'

type BooleanRef = { current: boolean }

export function scheduleCanvasTabSyncPublish<SyncType>(args: {
  taskKey: string
  delayMs: number
  signature: string | null
  applyingRemoteRef: BooleanRef
  getSync: () => SyncType | null
  publish: (sync: SyncType) => void
  swallowPublishErrors?: boolean
}): void {
  const {
    taskKey,
    delayMs,
    signature,
    applyingRemoteRef,
    getSync,
    publish,
    swallowPublishErrors = false,
  } = args

  scheduleWorkspaceSyncTask(
    taskKey,
    () => {
      if (!canPublishCanvasTabSync(applyingRemoteRef.current)) return
      const sync = getSync()
      if (!sync) return
      if (swallowPublishErrors) {
        try {
          publish(sync)
        } catch {
          void 0
        }
        return
      }
      publish(sync)
    },
    delayMs,
    {
      signature,
      scopeKey: WORKSPACE_SYNC_SCOPE_CANVAS_TAB_SYNC_RUNTIME_PERSISTENCE,
    },
  )
}
