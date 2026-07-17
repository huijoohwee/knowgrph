import React from 'react'
import { GanttTimelineTransportPanel } from './GanttTimelineTransportPanel'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'
import { useGraphStore } from '@/hooks/useGraphStore'
import { XrCameraMotionSection } from '@/features/three/XrCameraMotionSection'

function MediaTimelineBottomPanelView({ compact }: { compact: boolean }) {
  const { code: mediaGanttCode } = useMermaidGanttDocument({ purpose: 'media' })
  return <GanttTimelineTransportPanel code={mediaGanttCode} compact={compact} mode="media" />
}

export function TimelineBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const xrTimelineContext = useGraphStore(state => state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr')

  if (xrTimelineContext) return <XrCameraMotionSection />

  return <MediaTimelineBottomPanelView compact={compact} />
}
