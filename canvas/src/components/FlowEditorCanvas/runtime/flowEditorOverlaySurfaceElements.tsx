import React from 'react'

import {
  FlowEditorWidgetOverlay,
  type ToolMode,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { resolveWidgetIdentity } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { emitMainPanelOpen } from '@/features/panels/utils/useMainPanelRect'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { orderFlowEditorOverlayNodeIdsByRenderGraph } from '@/components/FlowEditorCanvas/runtime/flowEditorOverlayNodeOrder'

const EMPTY_GRAPH_EDGES: GraphEdge[] = []

export function resolveFlowEditorOverlayElementIdentity(args: {
  graphMetaKind?: string | null
  overlayNodeId: unknown
  node: Pick<GraphNode, 'id'> | null | undefined
}): {
  overlayIdentityId: string
  actionNodeId: string
  renderNodeId: string
} {
  const overlayNodeId = String(args.overlayNodeId || '').trim()
  const concreteNodeId = String(args.node?.id || '').trim() || overlayNodeId
  const graphMetaKind = String(args.graphMetaKind || '').trim()
  if (graphMetaKind !== 'frontmatter-flow') {
    const id = overlayNodeId || concreteNodeId
    return {
      overlayIdentityId: id,
      actionNodeId: concreteNodeId || id,
      renderNodeId: concreteNodeId || id,
    }
  }
  const renderNodeId = concreteNodeId || overlayNodeId
  return {
    overlayIdentityId: renderNodeId,
    actionNodeId: concreteNodeId || overlayNodeId || renderNodeId,
    renderNodeId,
  }
}

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

  const currentGraphIsFrontmatterFlow = isFrontmatterFlowGraph(args.renderGraphDataOverride)
  const stableGraphIsFrontmatterFlow = isFrontmatterFlowGraph(args.lastStableRenderGraphDataOverride)
  const useStableFrontmatterGraphAuthority =
    !currentGraphIsFrontmatterFlow
    && stableGraphIsFrontmatterFlow
    && args.overlayEditorNodeIds.length > 0
  const graphMetaKind = args.renderGraphMetaKind
  const overlayGraphMetaKind = useStableFrontmatterGraphAuthority
    ? 'frontmatter-flow'
    : graphMetaKind || (currentGraphIsFrontmatterFlow ? 'frontmatter-flow' : null)
  const graphMetaKey = buildGraphMetaKeyIgnoringPending(
    useStableFrontmatterGraphAuthority
      ? args.lastStableRenderGraphDataOverride
      : args.renderGraphDataOverride,
  )
  const orderedOverlayEditorNodeIds = orderFlowEditorOverlayNodeIdsByRenderGraph({
    ids: args.overlayEditorNodeIds,
    nodes: (
      useStableFrontmatterGraphAuthority
        ? args.lastStableRenderGraphDataOverride?.nodes
        : args.renderGraphDataOverride?.nodes
    ) || [],
    graphMetaKind: overlayGraphMetaKind,
  })
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

  for (let stackIndex = 0; stackIndex < orderedOverlayEditorNodeIds.length; stackIndex += 1) {
    const id = orderedOverlayEditorNodeIds[stackIndex]
    const node = resolveNode(id)
    if (!node) continue
    if (String(node.type || '') === 'Section') continue

    const identity = resolveFlowEditorOverlayElementIdentity({ graphMetaKind: overlayGraphMetaKind, overlayNodeId: id, node })
    const actionNodeId = identity.actionNodeId || id
    const renderNode = identity.renderNodeId && identity.renderNodeId !== String(node.id || '').trim()
      ? { ...node, id: identity.renderNodeId }
      : node
    const autoRevealKey = id === String(args.lastDroppedWidgetNodeIdRef.current || '') ? args.lastDroppedWidgetToken : 0
    const connectedValuesBySchemaPath =
      args.connectedValuesByNodeId.get(id)
      || args.connectedValuesByNodeId.get(identity.renderNodeId)
      || args.connectedValuesByNodeId.get(identity.actionNodeId)
      || undefined
    const portHandleEdges =
      args.renderGraphIncidentEdgesByNodeId?.get(id)
      || args.renderGraphIncidentEdgesByNodeId?.get(identity.actionNodeId)
      || args.renderGraphIncidentEdgesByNodeId?.get(identity.renderNodeId)
      || EMPTY_GRAPH_EDGES
    const overlayGraphInstanceKey = overlayGraphMetaKind === 'frontmatter-flow'
      ? String(graphMetaKey || '').trim() || String(args.renderGraphSemanticKey || '').trim() || 'graph'
      : String(args.renderGraphSemanticKey || '').trim() || String(graphMetaKey || '').trim() || 'graph'
    const overlayInstanceKey = [
      'qe',
      String(args.flowEditorSurfaceId || '').trim() || 'surface',
      overlayGraphInstanceKey,
      identity.overlayIdentityId || id,
    ].join(':')

    elements.push(
      <FlowEditorWidgetOverlay
        key={overlayInstanceKey}
        visible={args.overlayVisibilityActive}
        active={args.canEdit}
        flowEditorSurfaceId={args.flowEditorSurfaceId}
        overlayCollectiveCount={orderedOverlayEditorNodeIds.length}
        node={renderNode}
        graphMetaKind={overlayGraphMetaKind}
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
        onSetLabel={(label) => args.setNodeLabelById(actionNodeId, label)}
        onSetType={(type) => args.setNodeTypeById(actionNodeId, type)}
        onPatchProperties={(patch) => args.patchNodePropertiesById(actionNodeId, patch)}
        onSetProperties={(props) => args.setNodePropertiesById(actionNodeId, props)}
        onValidate={() => args.validateNodeById(actionNodeId)}
        onRun={() => {
          void args.runWorkflowNode(actionNodeId)
        }}
        onDuplicate={() => {
          const pinnedMap = args.flowWidgetPinnedByNodeId || {}
          const pinned = pinnedMap[actionNodeId] === true || pinnedMap[identity.renderNodeId] === true
          if (pinned) {
            args.upsertUiToast({
              id: `flow-editor-node-duplicate-disabled-${identity.overlayIdentityId || actionNodeId}`,
              kind: 'warning',
              message: 'Pinned widget blocks duplicate copy.',
              ttlMs: 2200,
            })
            return
          }
          args.duplicateNodeById(actionNodeId)
        }}
        onRemove={() => args.removeNodeById(actionNodeId)}
        onClearOutput={() => args.clearNodeOutputById(actionNodeId)}
        onHelp={args.showNodeEditorHelp}
        onConvertToLoopNode={() => args.convertNodeToLoopById(actionNodeId)}
        onEnableHandlesForAllInputs={args.enableHandlesForAllInputs}
        onUpdateKvEntry={() => {
          if (typeof window === 'undefined') return
          const resolvedWidgetRegistryEntry = resolveWidgetRegistryEntry({
            node: renderNode,
            registry: args.widgetRegistry,
            graphMetaKind: overlayGraphMetaKind,
          })
          const widgetIdentity = resolveWidgetIdentity({ node: renderNode, registryEntry: resolvedWidgetRegistryEntry })
          const searchQuery = [
            String(resolvedWidgetRegistryEntry?.id || '').trim(),
            String(renderNode.type || '').trim(),
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
        onRenameSchemaFieldId={({ prevId, nextId }) => args.renameSchemaFieldIdByNodeId(actionNodeId, prevId, nextId)}
      />,
    )
  }

  return elements
}
