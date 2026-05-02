import React from 'react'

import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { filterGraphToFlowWidgetEligible } from '@/lib/graph/flowWidgetEligibility'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { buildNodeZKeyById, compareNodeZKey } from '@/lib/canvas/groupZOrder'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { isCanonicalFrontmatterBuiltInWidgetNode } from '@/lib/flowEditor/widgetPlacementAuthority'
export {
  isCanonicalFrontmatterBuiltInWidgetNode,
  resolveDefaultFlowWidgetPinnedInCanvas,
  shouldAutoPlaceFlowEditorWidget,
  shouldUseFlowEditorWidgetFloatingScreenAuthority,
  stripFrontmatterAutoManagedWidgetScreenPositions,
} from '@/lib/flowEditor/widgetPlacementAuthority'
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

export function resolveGraphNodeIdByCanonicalId(graph: GraphData | null | undefined, rawId: unknown): string {
  return String(resolveGraphNodeByCanonicalId(graph, rawId)?.id || '').trim()
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
  const snapSizeRaw = typeof snapGrid?.size === 'number' && Number.isFinite(snapGrid.size) ? snapGrid.size : 20
  const snapSize = Math.max(6, Math.min(160, Math.floor(snapSizeRaw)))
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
  const filtered = args.forceFrontmatterFlow === true ? filterGraphToFlowWidgetEligible(base) : base
  if (!Array.isArray(args.collapsedGroupIds) || args.collapsedGroupIds.length === 0) return filtered
  return deriveGraphDataWithGroupCollapse({
    graphData: filtered,
    collapsedGroupIds: args.collapsedGroupIds,
  })
}

export function deriveFrontmatterFlowOverlayNodeIds(graphData: GraphData | null | undefined): string[] {
  if (!graphData || !isFrontmatterFlowGraph(graphData)) return []
  const metadata = ((graphData.metadata || {}) as Record<string, unknown>)
  const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
  if (nodes.length === 0) return []

  const eligibleIds = buildFlowWidgetEligibleNodeIdSet(nodes)
  const nodeZKeyById = buildNodeZKeyById({ nodes, groups: [] })
  const compareNodeIdsByVisualIndex = (aId: string, bId: string): number => {
    if (!aId || !bId) return String(aId || '').localeCompare(String(bId || ''))
    if (aId === bId) return 0
    const aKey = nodeZKeyById.get(aId)
    const bKey = nodeZKeyById.get(bId)
    if (aKey && bKey) return compareNodeZKey(aKey, bKey)
    if (aKey || bKey) return aKey ? -1 : 1
    return aId.localeCompare(bId)
  }

  const registryRaw = metadata[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  const registry = Array.isArray(registryRaw) ? (registryRaw as Array<Record<string, unknown>>) : []
  const allowedFlowNodeIds = new Set<string>()
  for (let i = 0; i < registry.length; i += 1) {
    const entry = registry[i]
    const formId = typeof entry?.formId === 'string' ? String(entry.formId).trim() : ''
    if (!formId || !formId.startsWith('fm:')) continue
    const nodeId = formId.slice('fm:'.length).trim()
    if (!nodeId) continue
    allowedFlowNodeIds.add(nodeId)
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id || !isCanonicalFrontmatterBuiltInWidgetNode(n)) continue
    allowedFlowNodeIds.add(id)
  }
  if (allowedFlowNodeIds.size === 0) {
    for (const id of eligibleIds) allowedFlowNodeIds.add(id)
  }
  if (allowedFlowNodeIds.size === 0) return []

  const next: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id || seen.has(id)) continue
    if (String(n?.type || '') === 'Section') continue
    if (!allowedFlowNodeIds.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next.sort(compareNodeIdsByVisualIndex)
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
    if (isFlowEditorOverlayExcludedNode(nodeById?.get(id) || null)) return false
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
  node: GraphNode
  graphMetaKind?: string | null
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
      node={args.node}
      graphMetaKind={args.graphMetaKind}
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
