import React from 'react'

import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { filterGraphToFlowWidgetEligible } from '@/lib/graph/flowWidgetEligibility'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
} from '@/lib/config'
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

export function isCanonicalFrontmatterBuiltInWidgetNode(node: Pick<GraphNode, 'id' | 'type'> | null | undefined): boolean {
  const nodeType = String(node?.type || '').trim()
  return nodeType === FLOW_TEXT_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    || nodeType === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID
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

type FlowEditorWidgetOverlayProps = {
  visible?: boolean
  active: boolean
  node: GraphNode
  graphMetaKind?: string | null
  edges: ReadonlyArray<GraphEdge>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  viewportW: number
  viewportH: number
  canvasWindowOffset: { left: number; top: number }
  zoomViewKey: string | null
  autoRevealKey?: number
  forcePinnedToCanvas?: boolean
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
      node={args.node}
      graphMetaKind={args.graphMetaKind}
      edges={args.edges}
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
      forcePinnedToCanvas={args.forcePinnedToCanvas}
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
