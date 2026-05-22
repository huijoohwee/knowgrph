import { cancelWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  runCanvasTabSchemaPublishLifecycle,
  runCanvasTabSelectionPublishLifecycle,
} from '@/features/canvas/canvasTabSyncPublishLifecycle'
import type {
  CanvasTabSyncBooleanRef,
  CanvasTabSyncRef,
  CanvasTabSyncSelectionRef,
  CanvasTabSyncStringRef,
} from '@/features/canvas/canvasTabSyncShared'

export function mountCanvasTabSelectionPublishEffect(args: {
  graphId: string | null | undefined
  tabId: string | null | undefined
  selectedNodeId: string | null | undefined
  selectedEdgeId: string | null | undefined
  syncRef: CanvasTabSyncRef
  applyingRemoteRef: CanvasTabSyncBooleanRef
  lastSelectionRef: CanvasTabSyncSelectionRef
}): () => void {
  const taskKey = runCanvasTabSelectionPublishLifecycle(args)
  return () => {
    cancelWorkspaceSyncTask(taskKey)
  }
}

export function mountCanvasTabSchemaPublishEffect(args: {
  graphId: string | null | undefined
  tabId: string | null | undefined
  schema: unknown
  syncRef: CanvasTabSyncRef
  applyingRemoteRef: CanvasTabSyncBooleanRef
  lastSchemaHashRef: CanvasTabSyncStringRef
}): () => void {
  const taskKey = runCanvasTabSchemaPublishLifecycle(args)
  return () => {
    cancelWorkspaceSyncTask(taskKey)
  }
}
