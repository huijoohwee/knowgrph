import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'

import { GraphEditorToolRail, type GraphEditorToolId } from '@/features/graph-editor/GraphEditorToolRail'
import { GraphEditorRightPanel } from '@/features/graph-editor/GraphEditorRightPanel'
import { UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME, UI_RESPONSIVE_SIDE_PANEL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

import '@/features/graph-editor/plugins/init'

export function GraphEditorOverlay(props: { active: boolean }) {
  const { active } = props
  const { workspaceViewMode, graphData } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      graphData: s.graphData,
    })),
  )

  const [toolId, setToolId] = React.useState<GraphEditorToolId>('select')

  React.useEffect(() => {
    const next = toolId === 'pan' ? 'pan' : 'select'
    useGraphStore.getState().setCanvasPointerMode2d(next)
  }, [toolId])

  if (!active) return null
  if (workspaceViewMode !== 'editor') return null

  return (
    <section className={UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME} aria-label="Graph editor overlay">
      <section className="absolute top-3 left-3 z-[260] pointer-events-auto">
        <GraphEditorToolRail
          activeToolId={toolId}
          onSelectTool={setToolId}
          disabled={!graphData}
        />
      </section>

      <section className={`absolute z-[260] pointer-events-auto ${UI_RESPONSIVE_SIDE_PANEL_CLASSNAME}`}>
        <GraphEditorRightPanel />
      </section>
    </section>
  )
}
