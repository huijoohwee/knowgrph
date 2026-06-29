import { FLOW_RICH_MEDIA_PANEL_NODE_LABEL, FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config'
import { bumpFlowEditorDraftGraphDataRevision } from '@/lib/flowEditor/flowEditorDraftGraphData'
import type { GraphData, GraphNode } from '@/lib/graph/types'

import {
  listFlowEditorWorkflowNodesAcrossGraphs,
  type FlowEditorWorkflowNodeResolutionContext,
} from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'
import {
  areFlowEditorWorkflowRecordValuesEqual,
} from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowWriteback'

function cleanString(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return cleanString((value as { value?: unknown }).value)
  }
  return typeof value === 'string' ? value.trim() : ''
}

function listFlowEditorWorkflowRichMediaPanelSearchNodes(args: {
  context: FlowEditorWorkflowNodeResolutionContext
  graphForRun: GraphData | null
  readLiveDraftGraphData: () => GraphData | null
}): GraphNode[] {
  const out: GraphNode[] = []
  const liveDraft = args.readLiveDraftGraphData()
  const liveDraftNodes = Array.isArray(liveDraft?.nodes) ? (liveDraft!.nodes as GraphNode[]) : []
  for (let i = 0; i < liveDraftNodes.length; i += 1) out.push(liveDraftNodes[i]!)
  const fallbackNodes = listFlowEditorWorkflowNodesAcrossGraphs({
    context: args.context,
    graphForRun: args.graphForRun,
  })
  for (let i = 0; i < fallbackNodes.length; i += 1) out.push(fallbackNodes[i]!)
  return out
}

export function resolveFlowEditorWorkflowRichMediaPanelTargetNodeId(args: {
  context: FlowEditorWorkflowNodeResolutionContext
  graphForRun: GraphData | null
  readLiveDraftGraphData: () => GraphData | null
}): string | null {
  const allNodes = listFlowEditorWorkflowRichMediaPanelSearchNodes(args)
  const panels = allNodes.filter(n => cleanString(n.type) === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID)
  if (panels.length === 0) return null
  const activePanel = panels.find(n => {
    const p = (n.properties || {}) as Record<string, unknown>
    return (typeof p.outputSrcDoc === 'string' && p.outputSrcDoc.trim()) || (typeof p.output === 'string' && p.output.trim())
  })
  return String((activePanel || panels[0])?.id || '').trim() || null
}

export function ensureFlowEditorWorkflowRichMediaPanelNodeId(args: {
  context: FlowEditorWorkflowNodeResolutionContext
  graphForRun: GraphData | null
  allowCreateRichMediaPanel: boolean
  anchorNode: GraphNode
  readLiveDraftGraphData: () => GraphData | null
  appendDraftNode: (args: {
    id?: string | null
    type: string
    label?: string | null
    x: number
    y: number
    properties?: Record<string, unknown>
  }) => string
}): string | null {
  const existing = resolveFlowEditorWorkflowRichMediaPanelTargetNodeId({
    context: args.context,
    graphForRun: args.graphForRun,
    readLiveDraftGraphData: args.readLiveDraftGraphData,
  })
  if (existing) return existing
  if (!args.allowCreateRichMediaPanel) return null
  if (!args.readLiveDraftGraphData()) return null
  return args.appendDraftNode({
    id: null,
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
    x: (Number.isFinite(args.anchorNode.x) ? args.anchorNode.x : 0) + 520,
    y: Number.isFinite(args.anchorNode.y) ? args.anchorNode.y : 0,
    properties: { media_interactive: true },
  })
}

export function applyFlowEditorWorkflowRichMediaPanelDraftPatch(args: {
  panelNodeId: string
  patch: Record<string, unknown>
  readLiveDraftGraphData: () => GraphData | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
}): GraphNode | null {
  const panelNodeId = String(args.panelNodeId || '').trim()
  if (!panelNodeId) return null
  const currentDraft = args.readLiveDraftGraphData()
  const currentPanel = Array.isArray(currentDraft?.nodes)
    ? currentDraft!.nodes.find(existing => String(existing?.id || '').trim() === panelNodeId) || null
    : null
  const currentProps = (currentPanel?.properties || {}) as Record<string, unknown>
  if (currentPanel && areFlowEditorWorkflowRecordValuesEqual(currentProps, { ...currentProps, ...args.patch })) return currentPanel
  if (!currentDraft || !Array.isArray(currentDraft.nodes) || currentDraft.nodes.length === 0) return currentPanel

  let changed = false
  let updatedPanel: GraphNode | null = null
  const nextNodes = currentDraft.nodes.map(existing => {
    const existingId = String(existing?.id || '').trim()
    if (existingId !== panelNodeId) return existing
    const existingProps = (existing.properties || {}) as Record<string, unknown>
    const nextProps = { ...existingProps, ...args.patch }
    if (areFlowEditorWorkflowRecordValuesEqual(existingProps, nextProps)) {
      updatedPanel = existing || null
      return existing
    }
    changed = true
    updatedPanel = { ...existing, properties: nextProps as never }
    return updatedPanel
  })
  if (!changed) return updatedPanel || currentPanel

  const nextDraft = bumpFlowEditorDraftGraphDataRevision({ ...currentDraft, nodes: nextNodes })
  args.commitDraftGraphDataUpdate(currentDraft, nextDraft)
  args.scheduleWorkflowOutputEdgeRefresh()
  return updatedPanel
}
