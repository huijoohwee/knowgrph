import React from 'react'
import { GanttTimelineTransportPanel } from './GanttTimelineTransportPanel'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'
import { useGraphStore } from '@/hooks/useGraphStore'
import { XrTimelineSceneLane } from '@/features/three/XrTimelineSceneLane'

function MediaTimelineBottomPanelView({ compact }: { compact: boolean }) {
  const { code: mediaGanttCode } = useMermaidGanttDocument({ purpose: 'media' })
  return <GanttTimelineTransportPanel code={mediaGanttCode} compact={compact} mode="media" />
}

export function TimelineBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const xrTimelineContext = useGraphStore(state => (
    (state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr')
    || (state.floatingPanelOpen === true && state.floatingPanelView === 'xr')
  ))

  if (xrTimelineContext) return <XrTimelineSceneLane />

  return <MediaTimelineBottomPanelView compact={compact} />
}
