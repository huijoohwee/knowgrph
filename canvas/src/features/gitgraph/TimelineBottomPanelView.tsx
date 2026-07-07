import React from 'react'
import { GanttTimelineTransportPanel } from './GanttTimelineTransportPanel'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'

export function TimelineBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code: mediaGanttCode } = useMermaidGanttDocument({ purpose: 'media' })
  return <GanttTimelineTransportPanel code={mediaGanttCode} compact={compact} mode="media" />
}
