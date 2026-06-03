import React from 'react'

import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { filterGraphToFlowWidgetEligible } from '@/lib/graph/flowWidgetEligibility'
import { isFlowWidgetOverlayEligibleNode } from '@/lib/graph/flowWidgetEligibility'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { filterSubgraphsByRetainedNodeIds } from '@/lib/graph/subgraphs'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { isCanonicalFrontmatterBuiltInWidgetNode } from '@/lib/flowEditor/widgetPlacementAuthority'
import {
  deriveFrontmatterFlowOverlayNodeIds,
  resolveGraphNodeIdByCanonicalId,
} from '@/lib/flowEditor/frontmatterOverlayNodeIds'
import { readSnapGridScalarSize } from '@/lib/canvas/snapGridSize'
export {
  isCanonicalFrontmatterBuiltInWidgetNode,
  resolveDefaultFlowWidgetPinnedInCanvas,
  shouldAutoPlaceFlowEditorWidget,
  shouldUseFlowEditorWidgetFloatingScreenAuthority,
  stripFrontmatterAutoManagedWidgetScreenPositions,
} from '@/lib/flowEditor/widgetPlacementAuthority'
export {
  deriveFrontmatterFlowOverlayNodeIds,
  resolveGraphNodeIdByCanonicalId,
} from '@/lib/flowEditor/frontmatterOverlayNodeIds'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export type ToolMode = 'select' | 'addEdge'

export const OVERLAY_NODE_OVERRIDE_LOCK_MS = 4000
export const WIDGET_DROP_DEDUPE_WINDOW_MS = 250
export const FORCE_SELECT_TICK_MS = 30
export const FORCE_SELECT_MAX_TICKS = 80
export const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function pickFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const parsed = Number(v)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function readFiniteGeoLatLng(properties: Record<string, unknown>): { lat: number; lng: number } | null {
  const geoRaw = isRecord(properties.geo) ? properties.geo : null
  const lat = pickFiniteNumber(geoRaw?.lat)
  const lng = pickFiniteNumber(geoRaw?.lng)
  if (lat == null || lng == null) return null
  return { lat, lng }
}

function normalizeGraphFilterNodeIdSet(
  graphData: GraphData | null | undefined,
  rawIds: ReadonlyArray<string> | null | undefined,
): Set<string> {
  const out = new Set<string>()
  for (const rawId of rawIds || []) {
    const id = String(rawId || '').trim()
    if (!id) continue
    out.add(id)
    const resolvedId = resolveGraphNodeIdByCanonicalId(graphData, id)
    if (resolvedId) out.add(resolvedId)
  }
  return out
}

export function snapToGridPx(value: number, stepPx: number): number {
  if (!Number.isFinite(value)) return 0
  const step = Number.isFinite(stepPx) ? Math.max(1, Math.floor(stepPx)) : 1
  if (step <= 1) return value
  return Math.round(value / step) * step
}

export function readWidgetGridLayoutSettings(schema: unknown): {
  gridEnabled: boolean
  stepPx: number
  gapPx: number
} {
  const behavior =
    schema && typeof schema === 'object' && !Array.isArray(schema)
      ? ((schema as { behavior?: unknown }).behavior as Record<string, unknown> | undefined)
      : undefined
  const snapGrid =
    behavior && typeof behavior.snapGrid === 'object' && behavior.snapGrid !== null
      ? (behavior.snapGrid as Record<string, unknown>)
      : null
  const canvasGrid =
    behavior && typeof behavior.canvasGrid === 'object' && behavior.canvasGrid !== null
      ? (behavior.canvasGrid as Record<string, unknown>)
      : null
  const snapEnabled = snapGrid?.enabled === true
  const canvasEnabled = canvasGrid?.enabled === true
  const gridEnabled = snapEnabled || canvasEnabled
  const snapSize = Math.max(6, Math.min(160, readSnapGridScalarSize(snapGrid?.size)))
  const majorEveryRaw = typeof canvasGrid?.majorEvery === 'number' && Number.isFinite(canvasGrid.majorEvery) ? canvasGrid.majorEvery : 5
  const majorEvery = Math.max(2, Math.min(20, Math.floor(majorEveryRaw)))
  const stepPx = gridEnabled ? (snapEnabled ? snapSize : Math.max(8, Math.min(200, snapSize * majorEvery))) : 1
  const gapPx = gridEnabled ? Math.max(12, Math.min(80, Math.round(stepPx * 0.8))) : 12
  return { gridEnabled, stepPx, gapPx }
}

export function deriveFlowEditorViewGraph(args: {
  graphData: GraphData | null
  collapsedGroupIds: string[]
  forceFrontmatterFlow?: boolean
}): GraphData | null {
  const base = args.graphData
  if (!base) return null
  const filteredByPolicy = args.forceFrontmatterFlow === true ? filterGraphToFlowWidgetEligible(base) : base
  const filtered = (() => {
    if (args.forceFrontmatterFlow !== true || !isFrontmatterFlowGraph(filteredByPolicy)) return filteredByPolicy
    const frontmatterOverlayNodeIds = deriveFrontmatterFlowOverlayNodeIds(filteredByPolicy)
    if (frontmatterOverlayNodeIds.length === 0) return filteredByPolicy
    return filterGraphByIncludedNodeIds({
      graphData: filteredByPolicy,
      includedNodeIds: frontmatterOverlayNodeIds,
    })
  })()
  if (!Array.isArray(args.collapsedGroupIds) || args.collapsedGroupIds.length === 0) return filtered
  return deriveGraphDataWithGroupCollapse({
    graphData: filtered,
    collapsedGroupIds: args.collapsedGroupIds,
  })
}

export function filterGraphByExcludedNodeIds(args: {
  graphData: GraphData | null | undefined
  excludedNodeIds: ReadonlyArray<string> | null | undefined
}): GraphData | null {
  const graphData = args.graphData
  if (!graphData) return null
  const excludedNodeIds = Array.from(new Set((args.excludedNodeIds || []).map(id => String(id || '').trim()).filter(Boolean)))
  if (excludedNodeIds.length === 0) return graphData
  const excluded = normalizeGraphFilterNodeIdSet(graphData, excludedNodeIds)
  const nodes = Array.isArray(graphData.nodes)
    ? graphData.nodes.filter(node => !excluded.has(String(node?.id || '').trim()))
    : []
  const edges = Array.isArray(graphData.edges)
    ? graphData.edges.filter(edge => {
      const { src, tgt } = readGraphEdgeEndpoints(edge)
      return Boolean(src && tgt && !excluded.has(src) && !excluded.has(tgt))
    })
    : []
  const retainedNodeIds = new Set(nodes.map(node => String(node?.id || '').trim()).filter(Boolean))
  return filterSubgraphsByRetainedNodeIds({ ...graphData, nodes, edges }, retainedNodeIds)
}

export function filterGraphByIncludedNodeIds(args: {
  graphData: GraphData | null | undefined
  includedNodeIds: ReadonlyArray<string> | null | undefined
}): GraphData | null {
  const graphData = args.graphData
  if (!graphData) return null
  const includedNodeIds = Array.from(new Set((args.includedNodeIds || []).map(id => String(id || '').trim()).filter(Boolean)))
  if (includedNodeIds.length === 0) return filterSubgraphsByRetainedNodeIds({ ...graphData, nodes: [], edges: [] }, new Set<string>())
  const included = normalizeGraphFilterNodeIdSet(graphData, includedNodeIds)
  const nodes = Array.isArray(graphData.nodes)
    ? graphData.nodes.filter(node => included.has(String(node?.id || '').trim()))
    : []
  const edges = Array.isArray(graphData.edges)
    ? graphData.edges.filter(edge => {
      const { src, tgt } = readGraphEdgeEndpoints(edge)
      return Boolean(src && tgt && included.has(src) && included.has(tgt))
    })
    : []
  const retainedNodeIds = new Set(nodes.map(node => String(node?.id || '').trim()).filter(Boolean))
  return filterSubgraphsByRetainedNodeIds({ ...graphData, nodes, edges }, retainedNodeIds)
}

function isFlowEditorOverlayExcludedNode(node: GraphNode | null | undefined): boolean {
  return String(node?.type || '') === 'Section'
}

export function deriveOpenWidgetOverlayNodeIds(args: {
  graphData: GraphData | null | undefined
  openWidgetNodeIds: ReadonlyArray<string> | null | undefined
  eligibleNodeIds?: ReadonlySet<string> | null | undefined
  nodeById?: ReadonlyMap<string, GraphNode> | null | undefined
  selectedNodeId?: string | null | undefined
}): string[] {
  const next: string[] = []
  const seen = new Set<string>()
  const eligibleNodeIds = args.eligibleNodeIds || null
  const nodeById = args.nodeById || null

  const canIncludeNodeId = (id: string): boolean => {
    if (!id || seen.has(id)) return false
    if (eligibleNodeIds && eligibleNodeIds.size > 0 && !eligibleNodeIds.has(id)) return false
    const node = nodeById?.get(id) || null
    if (isFlowEditorOverlayExcludedNode(node)) return false
    if (node && !isFlowWidgetOverlayEligibleNode(node)) return false
    return true
  }

  const pushResolvedOverlayNodeId = (rawId: unknown) => {
    const resolvedId = resolveGraphNodeIdByCanonicalId(args.graphData, rawId)
    const id = resolvedId || String(rawId || '').trim()
    if (!canIncludeNodeId(id)) return
    seen.add(id)
    next.push(id)
  }

  const openWidgetNodeIds = Array.isArray(args.openWidgetNodeIds) ? args.openWidgetNodeIds : []
  for (let i = 0; i < openWidgetNodeIds.length; i += 1) {
    pushResolvedOverlayNodeId(openWidgetNodeIds[i])
  }

  const selectedNodeId = String(args.selectedNodeId || '').trim()
  if (selectedNodeId) pushResolvedOverlayNodeId(selectedNodeId)
  return next
}

type FlowEditorWidgetOverlayProps = {
  visible?: boolean
  active: boolean
  flowEditorSurfaceId?: string
  overlayCollectiveCount?: number
  node: GraphNode
  graphMetaKind?: string | null
  graphMetaKey?: string | null
  portHandleEdges?: ReadonlyArray<GraphEdge>
  registryEntries?: ReadonlyArray<WidgetRegistryEntry>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  viewportW: number
  viewportH: number
  canvasWindowOffset: { left: number; top: number }
  zoomViewKey: string | null
  autoRevealKey?: number
  stackIndex?: number
  getLiveNodeWorldPos?: (nodeId: string) => { x: number; y: number } | null
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  getLiveContainmentGroupAabbForNode?: (nodeId: string) => { groupId: string; minX: number; minY: number; maxX: number; maxY: number } | null
  toolMode: ToolMode
  pendingEdgeSourceId: string | null
  onBeginAddEdgeFromNode: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode: (nodeId: string, portKey?: string | null) => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onRun: () => void
  onDuplicate: () => void
  onRemove: () => void
  onClearOutput: () => void
  onHelp: () => void
  onConvertToLoopNode: () => void
  onEnableHandlesForAllInputs: () => void
  onUpdateKvEntry?: () => void
  onPinnedInCanvasChange: (pinnedInCanvas: boolean) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void
}

export const FlowEditorWidgetOverlay = React.memo(function FlowEditorWidgetOverlay(args: FlowEditorWidgetOverlayProps) {
  return (
    <NodeOverlayEditor
      visible={args.visible}
      active={args.active}
      flowEditorSurfaceId={args.flowEditorSurfaceId}
      overlayCollectiveCount={args.overlayCollectiveCount}
      node={args.node}
      graphMetaKind={args.graphMetaKind}
      graphMetaKey={args.graphMetaKey}
      portHandleEdges={args.portHandleEdges}
      registryEntries={args.registryEntries}
      connectedValuesBySchemaPath={args.connectedValuesBySchemaPath}
      toolMode={args.toolMode}
      pendingEdgeSourceId={args.pendingEdgeSourceId}
      zoomViewKey={args.zoomViewKey}
      onBeginAddEdgeFromNode={args.onBeginAddEdgeFromNode}
      onFinalizeAddEdgeToNode={args.onFinalizeAddEdgeToNode}
      viewportW={args.viewportW}
      viewportH={args.viewportH}
      canvasWindowOffset={args.canvasWindowOffset}
      autoRevealKey={args.autoRevealKey}
      stackIndex={args.stackIndex}
      getLiveNodeWorldPos={args.getLiveNodeWorldPos}
      getLiveZoomTransform={args.getLiveZoomTransform}
      getLiveContainmentGroupAabbForNode={args.getLiveContainmentGroupAabbForNode}
      onSetLabel={args.onSetLabel}
      onSetType={args.onSetType}
      onPatchProperties={args.onPatchProperties}
      onSetProperties={args.onSetProperties}
      onValidate={args.onValidate}
      onRun={args.onRun}
      onDuplicate={args.onDuplicate}
      onRemove={args.onRemove}
      onClearOutput={args.onClearOutput}
      onHelp={args.onHelp}
      onConvertToLoopNode={args.onConvertToLoopNode}
      onEnableHandlesForAllInputs={args.onEnableHandlesForAllInputs}
      onUpdateKvEntry={args.onUpdateKvEntry}
      onPinnedInCanvasChange={args.onPinnedInCanvasChange}
      onRenameSchemaFieldId={args.onRenameSchemaFieldId}
    />
  )
})
