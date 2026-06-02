import React from 'react'

import {
  FlowEditorWidgetOverlay,
  type ToolMode,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { resolveNodeWidgetIdentity } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { emitMainPanelOpen } from '@/features/panels/utils/useMainPanelRect'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'

const EMPTY_GRAPH_EDGES: GraphEdge[] = []

export function buildOverlayEditorElements(args: {
  overlayVisibilityActive: boolean
  renderGraphNodeById: ReadonlyMap<string, GraphNode>
  renderGraphIncidentEdgesByNodeId: ReadonlyMap<string, ReadonlyArray<GraphEdge>> | null
  renderGraphMetaKind: string | null
  renderGraphDataOverride: GraphData | null
  lastStableRenderGraphDataOverride: GraphData | null
  pendingOverlayNodeIdRef: React.MutableRefObject<string | null>
  pendingOverlayNode: GraphNode | null
  overlayEditorNodeIds: readonly string[]
  connectedValuesByNodeId: ReadonlyMap<string, FlowConnectedValuesBySchemaPath>
  flowEditorSurfaceId: string
  renderGraphSemanticKey: string
  canEdit: boolean
  widgetRegistry: ReadonlyArray<WidgetRegistryEntry>
  toolMode: ToolMode
  pendingEdgeSourceId: string | null
  viewportW: number
  viewportH: number
  canvasWindowOffset: { left: number; top: number }
  zoomViewKey: string | null
  lastDroppedWidgetNodeIdRef: React.MutableRefObject<string | null>
  lastDroppedWidgetToken: number
  getLiveNodeWorldPos?: (nodeId: string) => { x: number; y: number } | null
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  getLiveContainmentGroupAabbForNode?: (nodeId: string) => { groupId: string; minX: number; minY: number; maxX: number; maxY: number } | null
  beginAddEdgeFromNode: (nodeId: string, portKey?: string | null) => void
  finalizePendingEdge: (nodeId: string, portKey?: string | null) => void
  setNodeLabelById: (nodeId: string, label: string) => void
  setNodeTypeById: (nodeId: string, type: string) => void
  patchNodePropertiesById: (nodeId: string, patch: Record<string, unknown>) => void
  setNodePropertiesById: (nodeId: string, properties: Record<string, unknown>) => void
  validateNodeById: (nodeId: string) => void
  runWorkflowNode: (nodeId: string) => Promise<void> | void
  duplicateNodeById: (nodeId: string) => void
  removeNodeById: (nodeId: string) => void
  clearNodeOutputById: (nodeId: string) => void
  showNodeEditorHelp: () => void
  convertNodeToLoopById: (nodeId: string) => void
  enableHandlesForAllInputs: () => void
  renameSchemaFieldIdByNodeId: (nodeId: string, prevId: string, nextId: string) => void
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
  flowWidgetPinnedByNodeId?: Record<string, boolean>
  handlePinnedInCanvasChange: (pinnedInCanvas: boolean) => void
}): React.ReactElement[] {
  if (!args.overlayVisibilityActive) return []

  const graphMetaKind = args.renderGraphMetaKind
  const graphMetaKey = buildGraphMetaKeyIgnoringPending(args.renderGraphDataOverride)
  const resolveNode = (id: string) => {
    const found = args.renderGraphNodeById.get(id) || null
    if (found) return found
    const canonicalMatch = resolveGraphNodeByCanonicalId(args.renderGraphDataOverride, id)
    if (canonicalMatch) return canonicalMatch
    const stableCanonicalMatch = resolveGraphNodeByCanonicalId(args.lastStableRenderGraphDataOverride, id)
    if (stableCanonicalMatch) return stableCanonicalMatch
    const pending = args.pendingOverlayNodeIdRef.current
    if (pending && pending === id) return args.pendingOverlayNode
    return null
  }
  const elements: React.ReactElement[] = []

  for (let stackIndex = 0; stackIndex < args.overlayEditorNodeIds.length; stackIndex += 1) {
    const id = args.overlayEditorNodeIds[stackIndex]
    const node = resolveNode(id)
    if (!node) continue
    if (String(node.type || '') === 'Section') continue

    const autoRevealKey = id === String(args.lastDroppedWidgetNodeIdRef.current || '') ? args.lastDroppedWidgetToken : 0
    const connectedValuesBySchemaPath = args.connectedValuesByNodeId.get(id) || undefined
    const portHandleEdges = args.renderGraphIncidentEdgesByNodeId?.get(id) || EMPTY_GRAPH_EDGES
    const overlayInstanceKey = [
      'qe',
      String(args.flowEditorSurfaceId || '').trim() || 'surface',
      String(args.renderGraphSemanticKey || '').trim() || String(graphMetaKey || '').trim() || 'graph',
      id,
    ].join(':')

    elements.push(
      <FlowEditorWidgetOverlay
        key={overlayInstanceKey}
        visible={args.overlayVisibilityActive}
        active={args.canEdit}
        flowEditorSurfaceId={args.flowEditorSurfaceId}
        overlayCollectiveCount={args.overlayEditorNodeIds.length}
        node={node}
        graphMetaKind={graphMetaKind}
        graphMetaKey={graphMetaKey}
        portHandleEdges={portHandleEdges}
        registryEntries={args.widgetRegistry}
        connectedValuesBySchemaPath={connectedValuesBySchemaPath}
        toolMode={args.toolMode}
        pendingEdgeSourceId={args.pendingEdgeSourceId}
        onBeginAddEdgeFromNode={args.beginAddEdgeFromNode}
        onFinalizeAddEdgeToNode={args.finalizePendingEdge}
        viewportW={args.viewportW}
        viewportH={args.viewportH}
        canvasWindowOffset={args.canvasWindowOffset}
        zoomViewKey={args.zoomViewKey}
        autoRevealKey={autoRevealKey}
        stackIndex={stackIndex}
        getLiveNodeWorldPos={args.getLiveNodeWorldPos}
        getLiveZoomTransform={args.getLiveZoomTransform}
        getLiveContainmentGroupAabbForNode={args.getLiveContainmentGroupAabbForNode}
        onSetLabel={(label) => args.setNodeLabelById(id, label)}
        onSetType={(type) => args.setNodeTypeById(id, type)}
        onPatchProperties={(patch) => args.patchNodePropertiesById(id, patch)}
        onSetProperties={(props) => args.setNodePropertiesById(id, props)}
        onValidate={() => args.validateNodeById(id)}
        onRun={() => {
          void args.runWorkflowNode(id)
        }}
        onDuplicate={() => {
          const pinnedMap = args.flowWidgetPinnedByNodeId || {}
          const pinned = pinnedMap[id] === true
          if (pinned) {
            args.upsertUiToast({
              id: `flow-editor-node-duplicate-disabled-${id}`,
              kind: 'warning',
              message: 'Pinned widget blocks duplicate copy.',
              ttlMs: 2200,
            })
            return
          }
          args.duplicateNodeById(id)
        }}
        onRemove={() => args.removeNodeById(id)}
        onClearOutput={() => args.clearNodeOutputById(id)}
        onHelp={args.showNodeEditorHelp}
        onConvertToLoopNode={() => args.convertNodeToLoopById(id)}
        onEnableHandlesForAllInputs={args.enableHandlesForAllInputs}
        onUpdateKvEntry={() => {
          if (typeof window === 'undefined') return
          const resolvedWidgetRegistryEntry = resolveWidgetRegistryEntry({
            node,
            registry: args.widgetRegistry,
            graphMetaKind,
          })
          const widgetIdentity = resolveNodeWidgetIdentity({ node, registryEntry: resolvedWidgetRegistryEntry })
          const searchQuery = [
            String(resolvedWidgetRegistryEntry?.id || '').trim(),
            String(node.type || '').trim(),
            widgetIdentity.widgetTypeId,
            widgetIdentity.formId,
          ].filter(Boolean).join(' ')
          emitMainPanelOpen({
            tab: 'workflowManager' as const,
            workflowManagerTab: 'mapping' as const,
            searchQuery,
          })
        }}
        onPinnedInCanvasChange={args.handlePinnedInCanvasChange}
        onRenameSchemaFieldId={({ prevId, nextId }) => args.renameSchemaFieldIdByNodeId(id, prevId, nextId)}
      />,
    )
  }

  return elements
}
