import { FLOW_RICH_MEDIA_PANEL_NODE_LABEL, FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config'
import { createUniqueId } from '@/lib/ids'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import {
  IMAGE_TO_THREEJS_OUTPUT_PANEL_ANCHOR_ID_PROPERTY,
  IMAGE_TO_THREEJS_OUTPUT_PANEL_LABEL,
  IMAGE_TO_THREEJS_OUTPUT_PANEL_PROPERTY,
  isImageToThreeJsOutputPanel,
} from '@/features/image-to-threejs/imageToThreeJsContract'
import {
  IMAGE_TO_GLB_OUTPUT_PANEL_ANCHOR_ID_PROPERTY,
  IMAGE_TO_GLB_OUTPUT_PANEL_LABEL,
  IMAGE_TO_GLB_OUTPUT_PANEL_PROPERTY,
  isImageToGlbOutputPanel,
} from '@/features/image-to-glb/imageToGlbContract'
import { bumpStoryboardWidgetDraftGraphDataRevision } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { normalizeGeneratedRichMediaTableProperties } from '@/features/rich-media/richMediaTablePersistence'

import {
  listStoryboardWidgetWorkflowNodesAcrossGraphs,
  type StoryboardWidgetWorkflowNodeResolutionContext,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRenderGraph'
import {
  areStoryboardWidgetWorkflowRecordValuesEqual,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowWriteback'

export {
  IMAGE_TO_THREEJS_OUTPUT_PANEL_ANCHOR_ID_PROPERTY,
  IMAGE_TO_THREEJS_OUTPUT_PANEL_LABEL,
  IMAGE_TO_THREEJS_OUTPUT_PANEL_PROPERTY,
}

export {
  IMAGE_TO_GLB_OUTPUT_PANEL_ANCHOR_ID_PROPERTY,
  IMAGE_TO_GLB_OUTPUT_PANEL_LABEL,
  IMAGE_TO_GLB_OUTPUT_PANEL_PROPERTY,
}

export const IMAGE_TO_THREEJS_OUTPUT_EDGE_PROPERTY = 'imageThreeJsOutputEdge' as const
export const IMAGE_TO_THREEJS_OUTPUT_EDGE_LABEL = 'image.to-threejs output' as const
export const IMAGE_TO_GLB_OUTPUT_EDGE_PROPERTY = 'imageGlbOutputEdge' as const
export const IMAGE_TO_GLB_OUTPUT_EDGE_LABEL = 'image.to-glb output' as const

export function mergeStoryboardWidgetWorkflowPropertyPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'undefined') delete next[key]
    else next[key] = value
  }
  return normalizeGeneratedRichMediaTableProperties({
    nodeType: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    properties: next,
  })
}

function cleanString(value: unknown): string {
  const unwrapped = unwrapGraphCellValue(value)
  return typeof unwrapped === 'string' ? unwrapped.trim() : ''
}

function listStoryboardWidgetWorkflowRichMediaPanelSearchNodes(args: {
  context: StoryboardWidgetWorkflowNodeResolutionContext
  graphForRun: GraphData | null
  readLiveDraftGraphData: () => GraphData | null
}): GraphNode[] {
  const out: GraphNode[] = []
  const seenNodeIds = new Set<string>()
  const appendUnique = (node: GraphNode) => {
    const nodeId = cleanString(node?.id)
    if (nodeId && seenNodeIds.has(nodeId)) return
    if (nodeId) seenNodeIds.add(nodeId)
    out.push(node)
  }
  const liveDraft = args.readLiveDraftGraphData()
  const liveDraftNodes = Array.isArray(liveDraft?.nodes) ? (liveDraft!.nodes as GraphNode[]) : []
  for (let i = 0; i < liveDraftNodes.length; i += 1) appendUnique(liveDraftNodes[i]!)
  const fallbackNodes = listStoryboardWidgetWorkflowNodesAcrossGraphs({
    context: args.context,
    graphForRun: args.graphForRun,
  })
  for (let i = 0; i < fallbackNodes.length; i += 1) appendUnique(fallbackNodes[i]!)
  return out
}

export function resolveStoryboardWidgetWorkflowRichMediaPanelTargetNodeId(args: {
  context: StoryboardWidgetWorkflowNodeResolutionContext
  graphForRun: GraphData | null
  readLiveDraftGraphData: () => GraphData | null
  anchorNodeId?: string | null
  outputKey?: string | null
}): string | null {
  const allNodes = listStoryboardWidgetWorkflowRichMediaPanelSearchNodes(args)
  const panels = allNodes.filter(n => cleanString(n.type) === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID)
  if (panels.length === 0) return null
  const anchorNodeId = cleanString(args.anchorNodeId)
  const outputKey = cleanString(args.outputKey)
  if (anchorNodeId && outputKey) {
    const exactPanel = panels.find(n => {
      const p = (n.properties || {}) as Record<string, unknown>
      return cleanString(p.workflowOutputAnchorNodeId) === anchorNodeId && cleanString(p.workflowOutputKey) === outputKey
    })
    if (exactPanel) return cleanString(exactPanel.id) || null

    // Adopt one legacy, unowned panel for the first named output. Once adopted,
    // every additional output key receives its own stable Rich Media Panel.
    const legacyPanels = panels.filter(n => {
      const p = (n.properties || {}) as Record<string, unknown>
      return !cleanString(p.workflowOutputAnchorNodeId) && !cleanString(p.workflowOutputKey)
    })
    const activeLegacyPanel = legacyPanels.find(n => {
      const p = (n.properties || {}) as Record<string, unknown>
      return (typeof p.outputSrcDoc === 'string' && p.outputSrcDoc.trim()) || (typeof p.output === 'string' && p.output.trim())
    })
    return cleanString((activeLegacyPanel || legacyPanels[0])?.id) || null
  }
  const activePanel = panels.find(n => {
    const p = (n.properties || {}) as Record<string, unknown>
    return (typeof p.outputSrcDoc === 'string' && p.outputSrcDoc.trim()) || (typeof p.output === 'string' && p.output.trim())
  })
  return cleanString((activePanel || panels[0])?.id) || null
}

export function ensureStoryboardWidgetWorkflowRichMediaPanelNodeId(args: {
  context: StoryboardWidgetWorkflowNodeResolutionContext
  graphForRun: GraphData | null
  allowCreateRichMediaPanel: boolean
  anchorNode: GraphNode
  readLiveDraftGraphData: () => GraphData | null
  outputKey?: string | null
  outputLabel?: string | null
  outputIndex?: number
  appendDraftNode: (args: {
    id?: string | null
    type: string
    label?: string | null
    x: number
    y: number
    properties?: Record<string, unknown>
  }) => string
}): string | null {
  const existing = resolveStoryboardWidgetWorkflowRichMediaPanelTargetNodeId({
    context: args.context,
    graphForRun: args.graphForRun,
    readLiveDraftGraphData: args.readLiveDraftGraphData,
    anchorNodeId: cleanString(args.anchorNode.id),
    outputKey: args.outputKey,
  })
  if (existing) return existing
  if (!args.allowCreateRichMediaPanel) return null
  if (!args.readLiveDraftGraphData()) return null
  return args.appendDraftNode({
    id: null,
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: cleanString(args.outputLabel) || FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
    x: (Number.isFinite(args.anchorNode.x) ? args.anchorNode.x : 0) + 520 + (typeof args.outputIndex === 'number' && Number.isFinite(args.outputIndex) ? Math.max(0, args.outputIndex) * 460 : 0),
    y: Number.isFinite(args.anchorNode.y) ? args.anchorNode.y : 0,
    properties: {
      media_interactive: true,
      ...(cleanString(args.outputKey) ? {
        workflowOutputAnchorNodeId: cleanString(args.anchorNode.id),
        workflowOutputKey: cleanString(args.outputKey),
      } : {}),
    },
  })
}

type ImageDerivedOutputPanelArgs = {
  context: StoryboardWidgetWorkflowNodeResolutionContext
  graphForRun: GraphData | null
  anchorNode: GraphNode
  readLiveDraftGraphData: () => GraphData | null
}

type ImageDerivedOutputPanelMarker = {
  anchorIdProperty: string
  label: string
  panelProperty: string
  isOutputPanel: (properties: unknown) => boolean
}

function resolveStoryboardWidgetImageDerivedOutputPanelNodeId(
  args: ImageDerivedOutputPanelArgs,
  marker: ImageDerivedOutputPanelMarker,
): string | null {
  const anchorNodeId = cleanString(args.anchorNode.id)
  if (!anchorNodeId) return null
  const liveDraft = args.readLiveDraftGraphData()
  const searchNodes = liveDraft && Array.isArray(liveDraft.nodes)
    ? liveDraft.nodes
    : listStoryboardWidgetWorkflowRichMediaPanelSearchNodes(args)
  const outputPanel = searchNodes.find(node => {
    if (cleanString(node.type) !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return false
    const properties = (node.properties || {}) as Record<string, unknown>
    return marker.isOutputPanel(properties)
      && cleanString(properties[marker.anchorIdProperty]) === anchorNodeId
  })
  return cleanString(outputPanel?.id) || null
}

type EnsureImageDerivedOutputPanelArgs = ImageDerivedOutputPanelArgs & {
  allowCreateRichMediaPanel: boolean
  appendDraftNode: (args: {
    id?: string | null
    type: string
    label?: string | null
    x: number
    y: number
    properties?: Record<string, unknown>
  }) => string
}

function ensureStoryboardWidgetImageDerivedOutputPanelNodeId(
  args: EnsureImageDerivedOutputPanelArgs,
  marker: ImageDerivedOutputPanelMarker,
): string | null {
  const existing = resolveStoryboardWidgetImageDerivedOutputPanelNodeId(args, marker)
  if (existing) return existing
  if (!args.allowCreateRichMediaPanel || !args.readLiveDraftGraphData()) return null
  const anchorNodeId = cleanString(args.anchorNode.id)
  if (!anchorNodeId) return null
  return args.appendDraftNode({
    id: null,
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: marker.label,
    x: (Number.isFinite(args.anchorNode.x) ? args.anchorNode.x : 0) + 520,
    y: Number.isFinite(args.anchorNode.y) ? args.anchorNode.y : 0,
    properties: {
      media_interactive: true,
      [marker.panelProperty]: true,
      [marker.anchorIdProperty]: anchorNodeId,
    },
  })
}

const IMAGE_TO_THREEJS_OUTPUT_MARKER: ImageDerivedOutputPanelMarker = {
  anchorIdProperty: IMAGE_TO_THREEJS_OUTPUT_PANEL_ANCHOR_ID_PROPERTY,
  label: IMAGE_TO_THREEJS_OUTPUT_PANEL_LABEL,
  panelProperty: IMAGE_TO_THREEJS_OUTPUT_PANEL_PROPERTY,
  isOutputPanel: isImageToThreeJsOutputPanel,
}

const IMAGE_TO_GLB_OUTPUT_MARKER: ImageDerivedOutputPanelMarker = {
  anchorIdProperty: IMAGE_TO_GLB_OUTPUT_PANEL_ANCHOR_ID_PROPERTY,
  label: IMAGE_TO_GLB_OUTPUT_PANEL_LABEL,
  panelProperty: IMAGE_TO_GLB_OUTPUT_PANEL_PROPERTY,
  isOutputPanel: isImageToGlbOutputPanel,
}

export function resolveStoryboardWidgetImageToThreeJsOutputPanelNodeId(args: ImageDerivedOutputPanelArgs): string | null {
  return resolveStoryboardWidgetImageDerivedOutputPanelNodeId(args, IMAGE_TO_THREEJS_OUTPUT_MARKER)
}

export function resolveStoryboardWidgetImageToGlbOutputPanelNodeId(args: ImageDerivedOutputPanelArgs): string | null {
  return resolveStoryboardWidgetImageDerivedOutputPanelNodeId(args, IMAGE_TO_GLB_OUTPUT_MARKER)
}

export function ensureStoryboardWidgetImageToThreeJsOutputPanelNodeId(args: EnsureImageDerivedOutputPanelArgs): string | null {
  return ensureStoryboardWidgetImageDerivedOutputPanelNodeId(args, IMAGE_TO_THREEJS_OUTPUT_MARKER)
}

export function ensureStoryboardWidgetImageToGlbOutputPanelNodeId(args: EnsureImageDerivedOutputPanelArgs): string | null {
  return ensureStoryboardWidgetImageDerivedOutputPanelNodeId(args, IMAGE_TO_GLB_OUTPUT_MARKER)
}

type ImageDerivedOutputEdgeMarker = {
  anchorIdProperty: string
  edgeLabel: string
  edgeProperty: string
  targetIdProperty: string
}

function ensureStoryboardWidgetImageDerivedOutputEdge(args: {
  anchorNode: GraphNode
  outputPanelNodeId: string
  readLiveDraftGraphData: () => GraphData | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
}, marker: ImageDerivedOutputEdgeMarker): GraphEdge | null {
  const sourceId = cleanString(args.anchorNode.id)
  const targetId = cleanString(args.outputPanelNodeId)
  if (!sourceId || !targetId || sourceId === targetId) return null

  const currentDraft = args.readLiveDraftGraphData()
  if (!currentDraft || !Array.isArray(currentDraft.edges)) return null
  const existing = currentDraft.edges.find(edge => {
    const endpoints = readGraphEdgeEndpoints(edge)
    return endpoints.src === sourceId && endpoints.tgt === targetId
  }) || null
  if (existing) return existing

  const usedEdgeIds = new Set(
    currentDraft.edges
      .map(edge => cleanString(edge?.id))
      .filter(Boolean),
  )
  const edge: GraphEdge = {
    id: createUniqueId('e', usedEdgeIds),
    source: sourceId,
    target: targetId,
    label: marker.edgeLabel,
    properties: {
      [marker.edgeProperty]: true,
      [marker.anchorIdProperty]: sourceId,
      [marker.targetIdProperty]: targetId,
    },
  }
  args.commitDraftGraphDataUpdate(
    currentDraft,
    bumpStoryboardWidgetDraftGraphDataRevision({ ...currentDraft, edges: [...currentDraft.edges, edge] }),
  )
  args.scheduleWorkflowOutputEdgeRefresh()
  return edge
}

export function ensureStoryboardWidgetImageToThreeJsOutputEdge(args: {
  anchorNode: GraphNode
  outputPanelNodeId: string
  readLiveDraftGraphData: () => GraphData | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
}): GraphEdge | null {
  return ensureStoryboardWidgetImageDerivedOutputEdge(args, {
    anchorIdProperty: IMAGE_TO_THREEJS_OUTPUT_PANEL_ANCHOR_ID_PROPERTY,
    edgeLabel: IMAGE_TO_THREEJS_OUTPUT_EDGE_LABEL,
    edgeProperty: IMAGE_TO_THREEJS_OUTPUT_EDGE_PROPERTY,
    targetIdProperty: 'imageThreeJsOutputPanelNodeId',
  })
}

export function ensureStoryboardWidgetImageToGlbOutputEdge(args: {
  anchorNode: GraphNode
  outputPanelNodeId: string
  readLiveDraftGraphData: () => GraphData | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
}): GraphEdge | null {
  return ensureStoryboardWidgetImageDerivedOutputEdge(args, {
    anchorIdProperty: IMAGE_TO_GLB_OUTPUT_PANEL_ANCHOR_ID_PROPERTY,
    edgeLabel: IMAGE_TO_GLB_OUTPUT_EDGE_LABEL,
    edgeProperty: IMAGE_TO_GLB_OUTPUT_EDGE_PROPERTY,
    targetIdProperty: 'imageGlbOutputPanelNodeId',
  })
}

function buildWorkflowOutputEdgeId(args: {
  sourceNodeId: string
  targetNodeId: string
  outputKey?: string | null
  usedEdgeIds: ReadonlySet<string>
}): string {
  const slug = ['workflow-output', args.sourceNodeId, cleanString(args.outputKey) || 'output', args.targetNodeId]
    .join('-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180) || 'workflow-output-edge'
  if (!args.usedEdgeIds.has(slug)) return slug
  let suffix = 2
  while (args.usedEdgeIds.has(`${slug}-${suffix}`)) suffix += 1
  return `${slug}-${suffix}`
}

export function ensureStoryboardWidgetWorkflowOutputEdge(args: {
  anchorNodeId: string
  panelNodeId: string
  outputKey?: string | null
  readLiveDraftGraphData: () => GraphData | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  scheduleWorkflowOutputEdgeRefresh: () => void
}): boolean {
  const currentDraft = args.readLiveDraftGraphData()
  if (!currentDraft) return false
  const sourceNodeId = cleanString(resolveGraphNodeByCanonicalId(currentDraft, args.anchorNodeId)?.id)
  const targetNodeId = cleanString(resolveGraphNodeByCanonicalId(currentDraft, args.panelNodeId)?.id)
  if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return false
  const edges = Array.isArray(currentDraft.edges) ? currentDraft.edges : []
  const existing = edges.some(edge => cleanString(edge?.source) === sourceNodeId && cleanString(edge?.target) === targetNodeId)
  if (existing) return false
  const edgeId = buildWorkflowOutputEdgeId({
    sourceNodeId,
    targetNodeId,
    outputKey: args.outputKey,
    usedEdgeIds: new Set(edges.map(edge => cleanString(edge?.id)).filter(Boolean)),
  })
  const outputKey = cleanString(args.outputKey) || 'output'
  const nextDraft = bumpStoryboardWidgetDraftGraphDataRevision({
    ...currentDraft,
    edges: [...edges, {
      id: edgeId,
      source: sourceNodeId,
      target: targetNodeId,
      label: outputKey,
      properties: {
        workflowOutputEdge: true,
        workflowOutputAnchorNodeId: sourceNodeId,
        workflowOutputKey: outputKey,
      } as never,
    }],
  })
  args.commitDraftGraphDataUpdate(currentDraft, nextDraft)
  args.scheduleWorkflowOutputEdgeRefresh()
  return true
}

export function applyStoryboardWidgetWorkflowRichMediaPanelDraftPatch(args: {
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
    ? currentDraft!.nodes.find(existing => cleanString(existing?.id) === panelNodeId) || null
    : null
  const currentProps = (currentPanel?.properties || {}) as Record<string, unknown>
  if (currentPanel && areStoryboardWidgetWorkflowRecordValuesEqual(currentProps, mergeStoryboardWidgetWorkflowPropertyPatch(currentProps, args.patch))) return currentPanel
  if (!currentDraft || !Array.isArray(currentDraft.nodes) || currentDraft.nodes.length === 0) return currentPanel

  let changed = false
  let updatedPanel: GraphNode | null = null
  const nextNodes = currentDraft.nodes.map(existing => {
    const existingId = cleanString(existing?.id)
    if (existingId !== panelNodeId) return existing
    const existingProps = (existing.properties || {}) as Record<string, unknown>
    const nextProps = mergeStoryboardWidgetWorkflowPropertyPatch(existingProps, args.patch)
    if (areStoryboardWidgetWorkflowRecordValuesEqual(existingProps, nextProps)) {
      updatedPanel = existing || null
      return existing
    }
    changed = true
    updatedPanel = { ...existing, properties: nextProps as never }
    return updatedPanel
  })
  if (!changed) return updatedPanel || currentPanel

  const nextDraft = bumpStoryboardWidgetDraftGraphDataRevision({ ...currentDraft, nodes: nextNodes })
  args.commitDraftGraphDataUpdate(currentDraft, nextDraft)
  args.scheduleWorkflowOutputEdgeRefresh()
  return updatedPanel
}
