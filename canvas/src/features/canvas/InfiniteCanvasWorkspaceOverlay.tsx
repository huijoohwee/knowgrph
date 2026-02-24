import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { viewportCenterToWorld } from '@/lib/zoom/viewport'

export function InfiniteCanvasWorkspaceOverlay() {
  const { canvasRenderMode, canvas2dRenderer, workspaceViewMode, zoomState, canvasDims } = useGraphStore(
    useShallow(s => ({
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      workspaceViewMode: s.workspaceViewMode,
      zoomState: s.zoomState,
      canvasDims: s.canvasDims,
    })),
  )

  if (canvasRenderMode !== '2d') return null
  if (canvas2dRenderer !== 'd3') return null
  if (workspaceViewMode === 'editor') return null

  const center = viewportCenterToWorld({
    transform: zoomState,
    viewportW: canvasDims?.w ?? 1,
    viewportH: canvasDims?.h ?? 1,
  })
  const zoomPct = Math.round(((zoomState?.k ?? 1) * 100) / 1) || 100

  return (
    <section className="absolute inset-0 pointer-events-none" aria-label="Infinite canvas workspace overlay">
      <div className="absolute top-3 inset-x-0 z-[250] flex justify-center pointer-events-none">
        <div className={`pointer-events-auto rounded-full border px-3 py-1 text-xs ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.text.secondary} shadow-sm`} aria-label="Viewport readout">
          <span className="font-mono">Zoom {zoomPct}%</span>
          <span className="mx-2 opacity-60">·</span>
          <span className="font-mono">Center {Math.round(center.x)} {Math.round(center.y)}</span>
        </div>
      </div>
    </section>
  )
}
