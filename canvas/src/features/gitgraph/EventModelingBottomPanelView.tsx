import React from 'react'
import { buildMermaidGanttWorkflowCodeFromEventModelingCode } from '@/lib/mermaid/mermaidDiagramCode'
import { GanttTimelineTransportPanel } from './GanttTimelineTransportPanel'
import { useMermaidStructuredDiagramDocument } from './useMermaidStructuredDiagramDocument'

export function EventModelingBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code } = useMermaidStructuredDiagramDocument('eventmodeling')
  const eventModelTimelineCode = React.useMemo(() => buildMermaidGanttWorkflowCodeFromEventModelingCode(code), [code])
  return <GanttTimelineTransportPanel code={eventModelTimelineCode} compact={compact} mode="workflow" />
}
