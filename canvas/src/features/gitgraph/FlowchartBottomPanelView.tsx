import React from 'react'
import { buildMermaidGanttWorkflowCodeFromFlowchartCode } from '@/lib/mermaid/mermaidDiagramCode'
import { GanttTimelineTransportPanel } from './GanttTimelineTransportPanel'
import { useMermaidStructuredDiagramDocument } from './useMermaidStructuredDiagramDocument'

export function FlowchartBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code } = useMermaidStructuredDiagramDocument('flowchart')
  const flowchartTimelineCode = React.useMemo(() => buildMermaidGanttWorkflowCodeFromFlowchartCode(code), [code])
  return <GanttTimelineTransportPanel code={flowchartTimelineCode} compact={compact} mode="workflow" />
}
