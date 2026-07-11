import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import GraphRecordSelectionInspector from '@/features/graph-inspector/ui/GraphRecordSelectionInspector'
import { useGraphStore } from '@/hooks/useGraphStore'
import { STORYBOARD_WIDGET_INSPECTOR_PORTAL_SLOT_ID } from '@/lib/config'
import { isStoryboardCanvas2dRenderer } from '@/lib/config.render'

export default function WorkflowManagerInspectorPanel() {
  const { workspaceViewMode, canvasRenderMode, canvas2dRenderer } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
    })),
  )

  const storyboardWidgetCanvasInspector = workspaceViewMode === 'canvas' &&
    canvasRenderMode === '2d' &&
    isStoryboardCanvas2dRenderer(canvas2dRenderer)

  if (storyboardWidgetCanvasInspector) {
    return <section id={STORYBOARD_WIDGET_INSPECTOR_PORTAL_SLOT_ID} className="h-full" aria-label="Workflow inspector slot" />
  }

  return <GraphRecordSelectionInspector />
}
