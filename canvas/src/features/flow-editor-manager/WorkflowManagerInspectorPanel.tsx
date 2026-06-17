import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID } from '@/lib/config'
import { isFlowEditorCanvas2dRenderer } from '@/lib/config.render'

const GraphRecordSelectionInspectorLazy = React.lazy(
  () => import('@/features/graph-inspector/ui/GraphRecordSelectionInspector'),
)

export default function WorkflowManagerInspectorPanel() {
  const { workspaceViewMode, canvasRenderMode, canvas2dRenderer } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
    })),
  )

  const flowEditorCanvasInspector = workspaceViewMode === 'canvas' &&
    canvasRenderMode === '2d' &&
    isFlowEditorCanvas2dRenderer(canvas2dRenderer)

  if (flowEditorCanvasInspector) {
    return <section id={FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID} className="h-full" aria-label="Workflow inspector slot" />
  }

  return (
    <React.Suspense fallback={null}>
      <GraphRecordSelectionInspectorLazy />
    </React.Suspense>
  )
}
