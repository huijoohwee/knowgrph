import { useShallow } from 'zustand/react/shallow'

import { DesignFloatingPanelView } from '@/features/design/DesignFloatingPanelView'
import { useGraphStore } from '@/hooks/useGraphStore'

export default function DesignEditorMainPanelView() {
  const state = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
    })),
  )
  const active = state.workspaceViewMode === 'canvas' && state.canvasRenderMode === '2d' && state.canvas2dRenderer === 'design'
  return <DesignFloatingPanelView active={active} />
}
