import React from 'react'

import {
  deriveFrontmatterFlowOverlayNodeIds,
  FlowEditorWidgetOverlay,
  isCanonicalFrontmatterBuiltInWidgetNode,
  resolveDefaultFlowWidgetPinnedInCanvas,
  resolveGraphNodeIdByCanonicalId,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { computeFlowConnectedValuesBySchemaPath, type FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'

export function useFlowEditorOverlaySurface(args: {
  flowEditorSurfaceId: string
  canEdit: boolean
  flowEditorViewActive: boolean
  flowEditorFrontmatterGraphAvailable: boolean
  geospatialWidgetPanelMode?: boolean
  renderGraphDataOverride: GraphData | null
  baseGraphDataRevision: number
  openWidgetNodeIds: string[]
  overlayDraftNode: GraphNode | null
  pendingOverlayNode: GraphNode | null
  pendingOverlayNodeIdRef: React.MutableRefObject<string | null>
  lastDroppedWidgetNodeIdRef: React.MutableRefObject<string | null>
  lastDroppedWidgetToken: number
  toolMode: 'select' | 'addEdge'
  pendingEdgeSourceId: string | null
  viewportW: number
  viewportH: number
  canvasWindowOffset: { left: number; top: number }
  zoomViewKey: string | null
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
  scheduleOverlayCollisionResolve: () => void
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
  widgetRegistry: ReadonlyArray<WidgetRegistryEntry>
  flowWidgetPinnedByNodeId?: Record<string, boolean>
}) {
  const overlayEditorNodeIdsRef = React.useRef<string[]>([])
  const lastStableOverlayEditorNodeIdsRef = React.useRef<string[]>([])

  React.useEffect(() => {
    if (!args.flowEditorViewActive) lastStableOverlayEditorNodeIdsRef.current = []
  }, [args.flowEditorViewActive])

  const overlayEditorNodeIds = React.useMemo(() => {
    if (!args.flowEditorViewActive) return []
    const isFrontmatterFlow = args.renderGraphDataOverride ? isFrontmatterFlowGraph(args.renderGraphDataOverride) : false
    const nodes = Array.isArray(args.renderGraphDataOverride?.nodes) ? (args.renderGraphDataOverride?.nodes as GraphNode[]) : []
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id || nodeById.has(id)) continue
      nodeById.set(id, n)
    }
    if (isFrontmatterFlow && nodes.length > 0) {
      const sorted = deriveFrontmatterFlowOverlayNodeIds(args.renderGraphDataOverride)
      if (sorted.length > 0) {
        lastStableOverlayEditorNodeIdsRef.current = sorted
        return sorted
      }
      return nodes.length > 0 ? lastStableOverlayEditorNodeIdsRef.current : []
    }
    const eligibleIds = buildFlowWidgetEligibleNodeIdSet(nodes)
    if (args.flowEditorFrontmatterGraphAvailable) return []
    const next: string[] = []
    const seen = new Set<string>()
    for (const rawId of args.openWidgetNodeIds) {
      const resolvedId = resolveGraphNodeIdByCanonicalId(args.renderGraphDataOverride, rawId)
      const s = resolvedId || String(rawId || '').trim()
      if (!s || seen.has(s)) continue
      if (eligibleIds.size > 0 && !eligibleIds.has(s)) continue
      if (String(nodeById.get(s)?.type || '') === 'Section') continue
      seen.add(s)
      next.push(s)
    }
    const sel = String(args.overlayDraftNode?.id || '').trim()
    if (
      sel
      && !seen.has(sel)
      && (eligibleIds.size === 0 || eligibleIds.has(sel))
      && String(nodeById.get(sel)?.type || '') !== 'Section'
    ) {
      next.push(sel)
    }
    if (next.length > 0) lastStableOverlayEditorNodeIdsRef.current = next
    return next
  }, [
    args.flowEditorFrontmatterGraphAvailable,
    args.flowEditorViewActive,
    args.openWidgetNodeIds,
    args.overlayDraftNode?.id,
    args.renderGraphDataOverride,
    args.renderGraphDataOverride?.metadata,
    args.renderGraphDataOverride?.nodes,
  ])

  React.useEffect(() => {
    overlayEditorNodeIdsRef.current = overlayEditorNodeIds
  }, [overlayEditorNodeIds])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as Window & { localStorage?: Storage; __KG_FLOW_EDITOR_QE_TRACE__?: Array<Record<string, unknown>> }
    let enabled = false
    try {
      enabled = Boolean(w.localStorage && w.localStorage.getItem('kg:debug:flowEditorWidgetTrace') === '1')
    } catch {
      enabled = false
    }
    if (!enabled) return

    const graphNodes = Array.isArray(args.renderGraphDataOverride?.nodes) ? args.renderGraphDataOverride.nodes.length : 0
    const graphEdges = Array.isArray(args.renderGraphDataOverride?.edges) ? args.renderGraphDataOverride.edges.length : 0
    const entry: Record<string, unknown> = {
      ts: Date.now(),
      active: args.canEdit ? 1 : 0,
      view: args.flowEditorViewActive ? 1 : 0,
      frontmatterGraph: args.flowEditorFrontmatterGraphAvailable ? 1 : 0,
      graphNodes,
      graphEdges,
      openWidgetCount: Array.isArray(args.openWidgetNodeIds) ? args.openWidgetNodeIds.length : 0,
      overlayCount: overlayEditorNodeIds.length,
      overlayIdsHead: overlayEditorNodeIds.slice(0, 8).join(','),
    }
    const buf = Array.isArray(w.__KG_FLOW_EDITOR_QE_TRACE__) ? w.__KG_FLOW_EDITOR_QE_TRACE__ : []
    buf.push(entry)
    if (buf.length > 150) buf.splice(0, buf.length - 150)
    w.__KG_FLOW_EDITOR_QE_TRACE__ = buf
  }, [
    args.canEdit,
    args.flowEditorFrontmatterGraphAvailable,
    args.flowEditorViewActive,
    args.openWidgetNodeIds,
    overlayEditorNodeIds,
    args.renderGraphDataOverride?.edges,
    args.renderGraphDataOverride?.nodes,
  ])

  const seededFrontmatterAutoWidgetsKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    if (!args.renderGraphDataOverride) return
    if (!isFrontmatterFlowGraph(args.renderGraphDataOverride)) return
    if (overlayEditorNodeIds.length === 0) return

    const st = useGraphStore.getState()
    const pinnedById = st.flowWidgetPinnedByNodeId || {}
    const graphMetaKind = String(((args.renderGraphDataOverride.metadata || {}) as Record<string, unknown>).kind || '').trim()
    const defaultPinned = resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind })
    const missingIds = overlayEditorNodeIds.filter(id => id && !Object.prototype.hasOwnProperty.call(pinnedById, id))
    const seedKey = `${args.baseGraphDataRevision}|${overlayEditorNodeIds.join(',')}|${missingIds.join(',')}|${defaultPinned ? 1 : 0}`
    if (seededFrontmatterAutoWidgetsKeyRef.current === seedKey) return
    seededFrontmatterAutoWidgetsKeyRef.current = seedKey
    if (missingIds.length === 0) return

    const nextPinned = { ...pinnedById }
    let changed = false
    for (let i = 0; i < missingIds.length; i += 1) {
      const id = missingIds[i]
      if (!id) continue
      nextPinned[id] = defaultPinned
      changed = true
    }
    if (!changed) return
    st.setFlowWidgetPinnedByNodeId(nextPinned)
    if (!defaultPinned) args.scheduleOverlayCollisionResolve()
  }, [args.baseGraphDataRevision, args.renderGraphDataOverride, args.scheduleOverlayCollisionResolve, overlayEditorNodeIds])

  const seededGeospatialOverlayWidgetPinsKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    if (!args.geospatialWidgetPanelMode) return
    if (overlayEditorNodeIds.length === 0) return
    const st = useGraphStore.getState()
    const pinnedById = st.flowWidgetPinnedByNodeId || {}
    const missingIds = overlayEditorNodeIds.filter(id => id && !Object.prototype.hasOwnProperty.call(pinnedById, id))
    const defaultPinned = resolveDefaultFlowWidgetPinnedInCanvas({ geospatialWidgetPanelMode: true })
    const seedKey = `${overlayEditorNodeIds.join(',')}|${missingIds.join(',')}|${defaultPinned ? 1 : 0}`
    if (seededGeospatialOverlayWidgetPinsKeyRef.current === seedKey) return
    seededGeospatialOverlayWidgetPinsKeyRef.current = seedKey
    if (missingIds.length === 0) return
    const nextPinned = { ...pinnedById }
    for (let i = 0; i < missingIds.length; i += 1) nextPinned[missingIds[i]!] = defaultPinned
    st.setFlowWidgetPinnedByNodeId(nextPinned)
    if (!defaultPinned) args.scheduleOverlayCollisionResolve()
  }, [args.geospatialWidgetPanelMode, args.scheduleOverlayCollisionResolve, overlayEditorNodeIds])

  const overlayEditorNodeIdsKey = React.useMemo(() => overlayEditorNodeIds.join('\n'), [overlayEditorNodeIds])
  const connectedValueTargetNodeIds = React.useMemo(() => new Set(overlayEditorNodeIdsKey ? overlayEditorNodeIdsKey.split('\n') : []), [overlayEditorNodeIdsKey])
  const connectedValuesByNodeId = React.useMemo(() => {
    return computeFlowConnectedValuesBySchemaPath({
      graphData: args.renderGraphDataOverride,
      registry: Array.isArray(args.widgetRegistry) ? args.widgetRegistry : [],
      targetNodeIds: connectedValueTargetNodeIds,
    })
  }, [args.widgetRegistry, connectedValueTargetNodeIds, args.renderGraphDataOverride])

  const handlePinnedInCanvasChange = React.useCallback(() => {
    args.scheduleOverlayCollisionResolve()
  }, [args.scheduleOverlayCollisionResolve])

  const overlayEditorElements = React.useMemo(() => {
    if (!args.flowEditorViewActive) return []
    const edges = (args.renderGraphDataOverride?.edges || []) as GraphEdge[]
    const nodes = Array.isArray(args.renderGraphDataOverride?.nodes) ? (args.renderGraphDataOverride?.nodes as GraphNode[]) : []
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id || nodeById.has(id)) continue
      nodeById.set(id, n)
    }
    const graphMetaKind = String(((args.renderGraphDataOverride?.metadata || {}) as Record<string, unknown>).kind || '').trim() || null
    const resolveNode = (id: string) => {
      const found = nodeById.get(id) || null
      if (found) return found
      const pending = args.pendingOverlayNodeIdRef.current
      if (pending && pending === id) return args.pendingOverlayNode
      return null
    }
    return overlayEditorNodeIds
      .map((id, stackIndex) => {
        const node = resolveNode(id)
        if (!node) return null
        if (String(node.type || '') === 'Section') return null
        const autoRevealKey = id === String(args.lastDroppedWidgetNodeIdRef.current || '') ? args.lastDroppedWidgetToken : 0
        const connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath | undefined = connectedValuesByNodeId.get(id) || undefined
        return (
          <FlowEditorWidgetOverlay
            key={`qe-${id}`}
            visible={args.flowEditorViewActive}
            active={args.canEdit}
            flowEditorSurfaceId={args.flowEditorSurfaceId}
            node={node}
            graphMetaKind={graphMetaKind}
            edges={edges}
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
              const widgetTypeId = typeof node.properties?.[FLOW_WIDGET_TYPE_ID_KEY] === 'string'
                ? String(node.properties[FLOW_WIDGET_TYPE_ID_KEY] || '').trim()
                : ''
              const formId = typeof node.properties?.[FLOW_WIDGET_FORM_ID_KEY] === 'string'
                ? String(node.properties[FLOW_WIDGET_FORM_ID_KEY] || '').trim()
                : ''
              const searchQuery = [
                String(resolvedWidgetRegistryEntry?.id || '').trim(),
                String(node.type || '').trim(),
                widgetTypeId,
                formId,
              ].filter(Boolean).join(' ')
              const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
              window.dispatchEvent(new CustomEventCtor(MAIN_PANEL_OPEN_EVENT, {
                detail: {
                  tab: 'workflowManager' as const,
                  workflowManagerTab: 'mapping' as const,
                  searchQuery,
                },
              }))
            }}
            onPinnedInCanvasChange={handlePinnedInCanvasChange}
            onRenameSchemaFieldId={({ prevId, nextId }) => args.renameSchemaFieldIdByNodeId(id, prevId, nextId)}
          />
        )
      })
      .filter(Boolean)
  }, [
    args.beginAddEdgeFromNode,
    args.canEdit,
    args.canvasWindowOffset,
    args.clearNodeOutputById,
    args.convertNodeToLoopById,
    args.duplicateNodeById,
    args.enableHandlesForAllInputs,
    args.finalizePendingEdge,
    args.flowEditorViewActive,
    args.flowWidgetPinnedByNodeId,
    args.geospatialWidgetPanelMode,
    args.getLiveContainmentGroupAabbForNode,
    args.getLiveNodeWorldPos,
    args.getLiveZoomTransform,
    args.lastDroppedWidgetNodeIdRef,
    args.lastDroppedWidgetToken,
    args.patchNodePropertiesById,
    args.pendingEdgeSourceId,
    args.pendingOverlayNode,
    args.pendingOverlayNodeIdRef,
    args.removeNodeById,
    args.renameSchemaFieldIdByNodeId,
    args.renderGraphDataOverride?.edges,
    args.renderGraphDataOverride?.nodes,
    args.runWorkflowNode,
    args.setNodeLabelById,
    args.setNodePropertiesById,
    args.setNodeTypeById,
    args.showNodeEditorHelp,
    args.toolMode,
    args.upsertUiToast,
    args.validateNodeById,
    args.viewportH,
    args.viewportW,
    args.widgetRegistry,
    args.zoomViewKey,
    connectedValuesByNodeId,
    handlePinnedInCanvasChange,
    overlayEditorNodeIds,
  ])

  const hasOverlayEditors = overlayEditorElements.length > 0
  const frontmatterOverlayHideSafety = React.useMemo(() => {
    const kind = String(((args.renderGraphDataOverride?.metadata || {}) as Record<string, unknown>).kind || '').trim()
    if (kind !== 'frontmatter-flow') {
      return { kind, visibleNodeIds: [] as string[], hasFullOverlayCoverageForVisibleNodes: true }
    }
    const display = deriveSceneDisplayGraph({ graphData: args.renderGraphDataOverride })
    const visibleNodeIds = Array.isArray(display?.displayNodes)
      ? display.displayNodes.map(n => String(n?.id || '').trim()).filter(Boolean)
      : []
    const eligibleIds = buildFlowWidgetEligibleNodeIdSet(
      Array.isArray(args.renderGraphDataOverride?.nodes) ? (args.renderGraphDataOverride.nodes as GraphNode[]) : [],
    )
    const overlayIdSet = new Set(overlayEditorNodeIds)
    const visibleFlowNodeIds = visibleNodeIds.filter(id => eligibleIds.size === 0 || eligibleIds.has(id))
    const hasFullOverlayCoverageForVisibleNodes = visibleFlowNodeIds.every(id => overlayIdSet.has(id))
    return { kind, visibleNodeIds: visibleFlowNodeIds, hasFullOverlayCoverageForVisibleNodes }
  }, [args.renderGraphDataOverride, overlayEditorNodeIds])

  const overlayOnlyActive =
    args.flowEditorViewActive
    && (frontmatterOverlayHideSafety.kind !== 'frontmatter-flow' || frontmatterOverlayHideSafety.hasFullOverlayCoverageForVisibleNodes)
    && (hasOverlayEditors || Boolean(args.geospatialWidgetPanelMode))

  const overlayOnlyHidePortHandleNodeIds = React.useMemo(() => {
    if (!overlayOnlyActive) return undefined
    const nodes = Array.isArray(args.renderGraphDataOverride?.nodes) ? args.renderGraphDataOverride.nodes : []
    return nodes.map(n => String((n as { id?: unknown })?.id || '')).filter(Boolean)
  }, [overlayOnlyActive, args.renderGraphDataOverride?.nodes])

  return {
    hasOverlayEditors,
    noGraphLoaded: !args.renderGraphDataOverride,
    overlayEditorElements,
    overlayEditorNodeIds,
    overlayOnlyActive,
    overlayOnlyHidePortHandleNodeIds,
  }
}
