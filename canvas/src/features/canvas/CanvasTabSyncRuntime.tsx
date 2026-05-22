import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CanvasTabSyncEffects } from '@/features/canvas/CanvasTabSyncEffects'
import { buildCanvasTabSyncRuntimeProps } from '@/features/canvas/canvasTabSyncRuntimeContract'
import { useGraphStore } from '@/hooks/useGraphStore'
import { selectCanvasTabSyncStoreSnapshot } from '@/features/canvas/canvasTabSyncStoreSelector'
import { useCanvasTabSyncRefs } from '@/features/canvas/useCanvasTabSyncRefs'

export function CanvasTabSyncRuntime() {
  const {
    graphId,
    tabId,
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    schema,
    setSchema,
  } = useGraphStore(
    useShallow(selectCanvasTabSyncStoreSnapshot),
  )

  const {
    syncRef,
    applyingRemoteRef,
    lastSelectionRef,
    lastSelectionRemoteTimestampRef,
    lastSchemaHashRef,
    lastSchemaRemoteTimestampRef,
  } = useCanvasTabSyncRefs()

  const runtimeProps = buildCanvasTabSyncRuntimeProps({
    graphId,
    tabId,
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    schema,
    setSchema,
    syncRef,
    applyingRemoteRef,
    lastSelectionRef,
    lastSelectionRemoteTimestampRef,
    lastSchemaHashRef,
    lastSchemaRemoteTimestampRef,
  })

  return <CanvasTabSyncEffects {...runtimeProps} />
}
