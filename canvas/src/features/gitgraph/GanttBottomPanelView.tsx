import React from 'react'
import { GanttTimelineTransportPanel } from './GanttTimelineTransportPanel'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'

export function GanttBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code: workflowGanttCode } = useMermaidGanttDocument({ purpose: 'workflow' })
  return <GanttTimelineTransportPanel code={workflowGanttCode} compact={compact} mode="workflow" />
}
