import React from 'react'

import type { InspectorTab } from '@/components/FlowEditor/FlowEditorInspector'
import { safeJsonStringify } from '@/components/FlowEditor/flowEditorJson'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'

export function useFlowEditorInspectorState(args: {
  active: boolean
  draftGraphData: GraphData | null
  selectedDraftNode: GraphNode | null
  selectedDraftEdge: GraphEdge | null
}) {
  const [inspectorTab, setInspectorTab] = React.useState<InspectorTab>('node')
  const [nodePropsJson, setNodePropsJson] = React.useState('')
  const [nodeMetaJson, setNodeMetaJson] = React.useState('')
  const [edgePropsJson, setEdgePropsJson] = React.useState('')
  const [edgeMetaJson, setEdgeMetaJson] = React.useState('')
  const [workflowMetaJson, setWorkflowMetaJson] = React.useState('')
  const [workflowContextJson, setWorkflowContextJson] = React.useState('')
  const [jsonError, setJsonError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!args.active) return
    setJsonError(null)
    setNodePropsJson(safeJsonStringify(args.selectedDraftNode?.properties || {}))
    setNodeMetaJson(safeJsonStringify(args.selectedDraftNode?.metadata || {}))
    setEdgePropsJson(safeJsonStringify(args.selectedDraftEdge?.properties || {}))
    setEdgeMetaJson(safeJsonStringify(args.selectedDraftEdge?.metadata || {}))
    setWorkflowMetaJson(safeJsonStringify(args.draftGraphData?.metadata || {}))
    setWorkflowContextJson(safeJsonStringify(args.draftGraphData?.context ?? null))
  }, [args.active, args.draftGraphData, args.selectedDraftEdge, args.selectedDraftNode])

  return {
    edgeMetaJson,
    edgePropsJson,
    inspectorTab,
    jsonError,
    nodeMetaJson,
    nodePropsJson,
    setEdgeMetaJson,
    setEdgePropsJson,
    setInspectorTab,
    setJsonError,
    setNodeMetaJson,
    setNodePropsJson,
    setWorkflowContextJson,
    setWorkflowMetaJson,
    workflowContextJson,
    workflowMetaJson,
  }
}
