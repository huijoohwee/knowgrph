import {
  buildCanvasTabSchemaPublishPlan,
  buildCanvasTabSchemaTaskKey,
  buildCanvasTabSelectionPublishPlan,
  buildCanvasTabSelectionTaskKey,
  canPublishCanvasTabSync,
} from '@/features/canvas/canvasTabSyncPublishPlan'
import {
  publishCanvasTabSchemaMessage,
  publishCanvasTabSelectionMessage,
} from '@/features/canvas/canvasTabSyncOutbound'
import { scheduleCanvasTabSyncPublish } from '@/features/canvas/canvasTabSyncSchedule'
import type {
  CanvasTabSyncBooleanRef,
  CanvasTabSyncRef,
  CanvasTabSyncSelectionRef,
  CanvasTabSyncStringRef,
} from '@/features/canvas/canvasTabSyncShared'

export function runCanvasTabSelectionPublishLifecycle(args: {
  graphId: string | null | undefined
  tabId: string | null | undefined
  selectedNodeId: string | null | undefined
  selectedEdgeId: string | null | undefined
  syncRef: CanvasTabSyncRef
  applyingRemoteRef: CanvasTabSyncBooleanRef
  lastSelectionRef: CanvasTabSyncSelectionRef
}): string {
  const {
    graphId,
    tabId,
    selectedNodeId,
    selectedEdgeId,
    syncRef,
    applyingRemoteRef,
    lastSelectionRef,
  } = args

  const taskKey = buildCanvasTabSelectionTaskKey(graphId, tabId)
  if (!syncRef.current) return taskKey
  if (!canPublishCanvasTabSync(applyingRemoteRef.current)) return taskKey
  const selectionPlan = buildCanvasTabSelectionPublishPlan({
    selectedNodeId,
    selectedEdgeId,
    lastSelection: lastSelectionRef.current,
  })
  if (!selectionPlan) return taskKey

  lastSelectionRef.current = selectionPlan.nextLastSelection
  scheduleCanvasTabSyncPublish({
    taskKey,
    delayMs: 32,
    signature: selectionPlan.signature,
    applyingRemoteRef,
    getSync: () => syncRef.current,
    publish: sync => {
      publishCanvasTabSelectionMessage({
        sync,
        graphId,
        tabId,
        signature: selectionPlan.signature,
      })
    },
  })
  return taskKey
}

export function runCanvasTabSchemaPublishLifecycle(args: {
  graphId: string | null | undefined
  tabId: string | null | undefined
  schema: unknown
  syncRef: CanvasTabSyncRef
  applyingRemoteRef: CanvasTabSyncBooleanRef
  lastSchemaHashRef: CanvasTabSyncStringRef
}): string {
  const {
    graphId,
    tabId,
    schema,
    syncRef,
    applyingRemoteRef,
    lastSchemaHashRef,
  } = args

  const taskKey = buildCanvasTabSchemaTaskKey(graphId, tabId)
  if (!syncRef.current) return taskKey
  if (!canPublishCanvasTabSync(applyingRemoteRef.current)) return taskKey
  const schemaPlan = buildCanvasTabSchemaPublishPlan({
    schema,
    lastSchemaHash: lastSchemaHashRef.current,
  })
  if (!schemaPlan) return taskKey

  lastSchemaHashRef.current = schemaPlan.nextLastSchemaHash
  scheduleCanvasTabSyncPublish({
    taskKey,
    delayMs: 64,
    signature: schemaPlan.signature,
    applyingRemoteRef,
    getSync: () => syncRef.current,
    publish: sync => {
      publishCanvasTabSchemaMessage({
        sync,
        graphId,
        tabId,
        signature: schemaPlan.signature,
      })
    },
    swallowPublishErrors: true,
  })
  return taskKey
}
