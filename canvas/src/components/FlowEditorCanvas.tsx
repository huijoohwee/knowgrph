import React from 'react'
import { Check, Link2, Plus, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'

import FlowCanvas from '@/components/FlowCanvas'
import FlowEditorInspector, { type InspectorTab } from '@/components/FlowEditor/FlowEditorInspector'
import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { coerceJsonObject, safeJsonStringify, tryParseJson } from '@/components/FlowEditor/flowEditorJson'
import { useContainerDims } from '@/hooks/useContainerDims'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import { createUniqueId } from '@/lib/ids'
import { normalizeGraphData } from '@/lib/graph/normalize'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID,
  FLOW_EDITOR_SMART_NODE_REQUIRED_FIELDS,
  LS_KEYS,
  UI_COPY,
} from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { viewportCenterToWorld } from '@/lib/zoom/viewport'
import {
  convertNodeToLoopInGraphData,
  enableHandlesForAllInputsInSchema,
  isHandlesForAllInputsEnabled,
} from '@/lib/flowEditor/flowEditorActions'
import { togglePortHandlesEnabledInSchema } from '@/lib/graph/portHandlesBehavior'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  FLOW_EDGE_DISPLAY_LABEL_KEY,
  buildFlowEdgeDisplayLabelFromPorts,
  pickDefaultSchemaFieldPortKey,
} from '@/lib/graph/flowPorts'
import { canAddEdge } from '@/features/schema/validation'

type ToolMode = 'select' | 'addEdge'

const FlowEditorNodeQuickEditorOverlay = React.memo(function FlowEditorNodeQuickEditorOverlay(args: {
  active: boolean
  node: GraphNode
  edges: ReadonlyArray<GraphEdge>
  viewportW: number
  viewportH: number
  toolMode: ToolMode
  pendingEdgeSourceId: string | null
  onBeginAddEdgeFromNode: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode: (nodeId: string, portKey?: string | null) => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onDuplicate: () => void
  onRemove: () => void
  onClearOutput: () => void
  onHelp: () => void
  onConvertToLoopNode: () => void
  onTogglePortHandles: () => void
  onEnableHandlesForAllInputs: () => void
  onPinnedToNodeChange: (pinnedToNode: boolean) => void
}) {
  return (
    <NodeOverlayEditor
      active={args.active}
      node={args.node}
      edges={args.edges}
      toolMode={args.toolMode}
      pendingEdgeSourceId={args.pendingEdgeSourceId}
      onBeginAddEdgeFromNode={args.onBeginAddEdgeFromNode}
      onFinalizeAddEdgeToNode={args.onFinalizeAddEdgeToNode}
      viewportW={args.viewportW}
      viewportH={args.viewportH}
      onSetLabel={args.onSetLabel}
      onSetType={args.onSetType}
      onPatchProperties={args.onPatchProperties}
      onSetProperties={args.onSetProperties}
      onValidate={args.onValidate}
      onDuplicate={args.onDuplicate}
      onRemove={args.onRemove}
      onClearOutput={args.onClearOutput}
      onHelp={args.onHelp}
      onConvertToLoopNode={args.onConvertToLoopNode}
      onTogglePortHandles={args.onTogglePortHandles}
      onEnableHandlesForAllInputs={args.onEnableHandlesForAllInputs}
      onPinnedToNodeChange={args.onPinnedToNodeChange}
    />
  )
})

const cloneGraphDataForDraft = (graphData: GraphData): GraphData => {
  const normalized = normalizeGraphData(graphData)
  const nodes = (normalized.nodes || []).map(n => ({
    ...n,
    properties: { ...(n.properties || {}) },
    ...(n.metadata ? { metadata: { ...n.metadata } } : {}),
  }))
  const edges = (normalized.edges || []).map(e => ({
    ...e,
    properties: { ...(e.properties || {}) },
    ...(e.metadata ? { metadata: { ...e.metadata } } : {}),
  }))
  return { ...normalized, nodes, edges }
}

export default function FlowEditorCanvas({ active = true }: { active?: boolean }) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const { width, height } = useContainerDims(rootRef)
  const viewportW = Math.max(1, Math.floor(width))
  const viewportH = Math.max(1, Math.floor(height))

  const baseGraphData = useGraphStore(s => s.graphData)
  const baseGraphDataRevision = useGraphStore(s => s.graphDataRevision || 0)
  const selectedNodeId = useGraphStore(s => (typeof s.selectedNodeId === 'string' ? s.selectedNodeId : null))
  const selectedEdgeId = useGraphStore(s => (typeof s.selectedEdgeId === 'string' ? s.selectedEdgeId : null))
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const setGraphDataPreservingLayout = useGraphStore(s => s.setGraphDataPreservingLayout)
  const upsertUiToast = useGraphStore(s => s.upsertUiToast)
  const documentStructureBaselineLock = useGraphStore(s => s.documentStructureBaselineLock === true)
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)

  const selectedNodeIdsRef = useGraphStoreKeyRef('selectedNodeIds')
  const selectedEdgeIdsRef = useGraphStoreKeyRef('selectedEdgeIds')

  const [nodeEditorPinnedToNode, setNodeEditorPinnedToNode] = React.useState<boolean>(
    () => !lsBool(LS_KEYS.flowNodeQuickEditorPinned, false),
  )

  const [toolMode, setToolMode] = React.useState<ToolMode>('select')
  const [pendingEdgeSourceId, setPendingEdgeSourceId] = React.useState<string | null>(null)
  const [pendingEdgeSourcePortKey, setPendingEdgeSourcePortKey] = React.useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = React.useState<InspectorTab>('node')

  const [draftGraphData, setDraftGraphData] = React.useState<GraphData | null>(null)
  const [draftGraphDataRevision, setDraftGraphDataRevision] = React.useState<number>(0)
  const [draftDirty, setDraftDirty] = React.useState(false)
  const [draftConflict, setDraftConflict] = React.useState(false)
  const baseRevisionAtStartRef = React.useRef<number>(0)

  const [nodePropsJson, setNodePropsJson] = React.useState('')
  const [nodeMetaJson, setNodeMetaJson] = React.useState('')
  const [edgePropsJson, setEdgePropsJson] = React.useState('')
  const [edgeMetaJson, setEdgeMetaJson] = React.useState('')
  const [workflowMetaJson, setWorkflowMetaJson] = React.useState('')
  const [workflowContextJson, setWorkflowContextJson] = React.useState('')
  const [jsonError, setJsonError] = React.useState<string | null>(null)


  const [inspectorPortalHost, setInspectorPortalHost] = React.useState<HTMLElement | null>(null)

  const resolveInspectorPortalHost = React.useCallback(() => {
    if (!active) return null
    if (typeof document === 'undefined') return null
    try {
      const el = document.getElementById(FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID)
      if (!el) return null
      if (!(el instanceof HTMLElement)) return null
      if (!el.isConnected) return null
      return el
    } catch {
      return null
    }
  }, [active])

  React.useEffect(() => {
    if (!active) {
      setInspectorPortalHost(null)
      return
    }
    const resolved = resolveInspectorPortalHost()
    setInspectorPortalHost(prev => (prev === resolved ? prev : resolved))
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => {
      const nextResolved = resolveInspectorPortalHost()
      setInspectorPortalHost(prev => (prev === nextResolved ? prev : nextResolved))
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [active, resolveInspectorPortalHost])

  const ensureDraft = React.useCallback(() => {
    const base = baseGraphData as GraphData | null
    if (!base) return
    setDraftGraphData(prev => (prev ? prev : cloneGraphDataForDraft(base)))
    setDraftGraphDataRevision(prev => (prev > 0 ? prev : 1))
    baseRevisionAtStartRef.current = baseGraphDataRevision
    setDraftDirty(false)
    setDraftConflict(false)
  }, [baseGraphData, baseGraphDataRevision])

  React.useEffect(() => {
    if (!active) return
    if (!draftGraphData && baseGraphData) ensureDraft()
  }, [active, baseGraphData, draftGraphData, ensureDraft])

  React.useEffect(() => {
    if (!draftDirty) return
    if (baseGraphDataRevision === baseRevisionAtStartRef.current) return
    setDraftConflict(true)
    upsertUiToast({
      id: 'flow-editor-conflict',
      kind: 'warning',
      message: 'Flow Editor draft is out of date. Discard draft to sync with latest graph.',
      ttlMs: 7000,
    })
  }, [baseGraphDataRevision, draftDirty, upsertUiToast])

  React.useEffect(() => {
    if (active) return
    if (!draftDirty) return
    if (!selectedNodeId && !selectedEdgeId) return
    setSelectionSource('canvas')
    selectNode(null)
    selectEdge(null)
  }, [active, draftDirty, selectedEdgeId, selectedNodeId, selectEdge, selectNode, setSelectionSource])

  const beginAddEdgeFromNode = React.useCallback(
    (nodeId: string, portKey?: string | null) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!active) return
      if (!draftGraphData) return
      const nodeIds = new Set((draftGraphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
      if (!nodeIds.has(id)) return
      const nodeById = new Map((draftGraphData.nodes || []).map(n => [String(n.id || ''), n] as const))
      const node = nodeById.get(id) || null
      const explicit = typeof portKey === 'string' && portKey.trim() ? portKey.trim() : null
      const defaultPortKey = explicit || pickDefaultSchemaFieldPortKey(node) || null
      setSelectionSource('canvas')
      selectEdge(null)
      selectNode(id)
      setToolMode('addEdge')
      setPendingEdgeSourceId(id)
      setPendingEdgeSourcePortKey(defaultPortKey)
    },
    [active, draftGraphData, selectEdge, selectNode, setSelectionSource],
  )

  const finalizePendingEdge = React.useCallback(
    (nodeId: string, portKey?: string | null) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!active) return
      if (toolMode !== 'addEdge') return
      if (!draftGraphData) return
      const nodeIds = new Set((draftGraphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
      if (!nodeIds.has(id)) return
      if (!pendingEdgeSourceId) {
        setPendingEdgeSourceId(id)
        setPendingEdgeSourcePortKey(null)
        return
      }
      if (pendingEdgeSourceId === id) return

      const nodeById = new Map((draftGraphData.nodes || []).map(n => [String(n.id || ''), n] as const))
      const sourceNode = nodeById.get(pendingEdgeSourceId) || null
      const targetNode = nodeById.get(id) || null
      const explicitSource =
        typeof pendingEdgeSourcePortKey === 'string' && pendingEdgeSourcePortKey.trim() ? pendingEdgeSourcePortKey.trim() : null
      const sourcePort = explicitSource || pickDefaultSchemaFieldPortKey(sourceNode) || null
      const explicitTarget = typeof portKey === 'string' && portKey.trim() ? portKey.trim() : null
      const targetPort = explicitTarget || pickDefaultSchemaFieldPortKey(targetNode) || null

      const usedEdgeIds = new Set((draftGraphData.edges || []).map(e => String(e.id || '')).filter(Boolean))
      const edgeId = createUniqueId('e', usedEdgeIds)
      const nextEdge: GraphEdge = {
        id: edgeId,
        source: pendingEdgeSourceId,
        target: id,
        label: 'linksTo',
        properties: {
          ...(sourcePort ? { [FLOW_EDGE_SOURCE_PORT_KEY]: sourcePort } : {}),
          ...(targetPort ? { [FLOW_EDGE_TARGET_PORT_KEY]: targetPort } : {}),
        },
      }

      const displayLabel = buildFlowEdgeDisplayLabelFromPorts({
        sourceNode,
        targetNode,
        sourcePortKey: sourcePort,
        targetPortKey: targetPort,
      })
      if (displayLabel) {
        ;(nextEdge.properties as Record<string, unknown>)[FLOW_EDGE_DISPLAY_LABEL_KEY] = displayLabel
      }

      const duplicate = (draftGraphData.edges || []).find(e => {
        if (String(e.source) !== String(nextEdge.source)) return false
        if (String(e.target) !== String(nextEdge.target)) return false
        if (String(e.label || '') !== String(nextEdge.label || '')) return false
        const sp = (e.properties as Record<string, unknown> | null | undefined)?.[FLOW_EDGE_SOURCE_PORT_KEY]
        const tp = (e.properties as Record<string, unknown> | null | undefined)?.[FLOW_EDGE_TARGET_PORT_KEY]
        const nsp = (nextEdge.properties as Record<string, unknown> | null | undefined)?.[FLOW_EDGE_SOURCE_PORT_KEY]
        const ntp = (nextEdge.properties as Record<string, unknown> | null | undefined)?.[FLOW_EDGE_TARGET_PORT_KEY]
        return String(sp || '') === String(nsp || '') && String(tp || '') === String(ntp || '')
      })
      if (duplicate) {
        setSelectionSource('canvas')
        selectEdge(String(duplicate.id || ''))
        selectNode(null)
        setPendingEdgeSourceId(null)
        setPendingEdgeSourcePortKey(null)
        setToolMode('select')
        return
      }

      if (!canAddEdge(schema, draftGraphData, nextEdge)) {
        upsertUiToast({
          id: 'flow-editor-edge-denied',
          kind: 'warning',
          message: 'Edge blocked by schema rules.',
          ttlMs: 2200,
        })
        return
      }
      const next: GraphData = {
        ...draftGraphData,
        edges: [...(draftGraphData.edges || []), nextEdge],
      }
      setDraftGraphData(normalizeGraphData(next))
      setDraftGraphDataRevision(r => r + 1)
      setDraftDirty(true)
      setPendingEdgeSourceId(null)
      setPendingEdgeSourcePortKey(null)
      setToolMode('select')
    },
    [active, draftGraphData, pendingEdgeSourceId, pendingEdgeSourcePortKey, schema, selectEdge, selectNode, setSelectionSource, toolMode, upsertUiToast],
  )

  React.useEffect(() => {
    if (!active) return
    if (toolMode !== 'addEdge') return
    if (!selectedNodeId) return
    finalizePendingEdge(selectedNodeId)
  }, [active, finalizePendingEdge, selectedNodeId, toolMode])

  const addNode = React.useCallback(() => {
    if (!draftGraphData) return
    const nodeIds = new Set((draftGraphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
    const id = createUniqueId('n', nodeIds)
    const st = useGraphStore.getState()
    const pos = viewportCenterToWorld({ transform: (st.zoomState as unknown as { k: number; x: number; y: number } | null) || null, viewportW, viewportH })
    const nextNode: GraphNode = {
      id,
      label: id,
      type: 'Node',
      x: pos.x,
      y: pos.y,
      properties: {},
    }
    const next: GraphData = {
      ...draftGraphData,
      nodes: [...(draftGraphData.nodes || []), nextNode],
    }
    setDraftGraphData(normalizeGraphData(next))
    setDraftGraphDataRevision(r => r + 1)
    setDraftDirty(true)
    setSelectionSource('canvas')
    selectEdge(null)
    selectNode(id)
  }, [draftGraphData, selectEdge, selectNode, setSelectionSource, viewportH, viewportW])

  const deleteSelection = React.useCallback(() => {
    if (!draftGraphData) return
    const selectedNodeIds = Array.isArray(selectedNodeIdsRef.current) ? selectedNodeIdsRef.current.map(String) : []
    const selectedEdgeIds = Array.isArray(selectedEdgeIdsRef.current) ? selectedEdgeIdsRef.current.map(String) : []
    const nodeIdSet = new Set(selectedNodeIds)
    const edgeIdSet = new Set(selectedEdgeIds)
    if (selectedNodeId) nodeIdSet.add(selectedNodeId)
    if (selectedEdgeId) edgeIdSet.add(selectedEdgeId)
    if (nodeIdSet.size === 0 && edgeIdSet.size === 0) return

    const nextNodes = (draftGraphData.nodes || []).filter(n => !nodeIdSet.has(String(n.id || '')))
    const nextEdges = (draftGraphData.edges || []).filter(e => {
      const id = String(e.id || '')
      if (edgeIdSet.has(id)) return false
      const src = String(e.source || '')
      const tgt = String(e.target || '')
      if (!src || !tgt) return false
      if (nodeIdSet.has(src) || nodeIdSet.has(tgt)) return false
      return true
    })
    const next: GraphData = normalizeGraphData({
      ...draftGraphData,
      nodes: nextNodes,
      edges: nextEdges,
    })
    setDraftGraphData(next)
    setDraftGraphDataRevision(r => r + 1)
    setDraftDirty(true)
    setSelectionSource('canvas')
    selectNode(null)
    selectEdge(null)
  }, [draftGraphData, selectEdge, selectNode, selectedEdgeId, selectedEdgeIdsRef, selectedNodeId, selectedNodeIdsRef, setSelectionSource])

  const commitDraft = React.useCallback(() => {
    if (!draftGraphData || !draftDirty || draftConflict) return
    setGraphDataPreservingLayout(draftGraphData)
    baseRevisionAtStartRef.current = baseGraphDataRevision
    setDraftDirty(false)
    setDraftConflict(false)
    upsertUiToast({
      id: 'flow-editor-commit',
      kind: 'success',
      message: 'Flow Editor changes committed.',
      ttlMs: 3500,
    })
  }, [baseGraphDataRevision, draftConflict, draftDirty, draftGraphData, setGraphDataPreservingLayout, upsertUiToast])

  const discardDraft = React.useCallback(() => {
    const base = baseGraphData as GraphData | null
    if (!base) {
      setDraftGraphData(null)
      setDraftGraphDataRevision(0)
      setDraftDirty(false)
      setDraftConflict(false)
      setPendingEdgeSourceId(null)
      setToolMode('select')
      return
    }
    setDraftGraphData(cloneGraphDataForDraft(base))
    setDraftGraphDataRevision(r => (r > 0 ? r + 1 : 1))
    baseRevisionAtStartRef.current = baseGraphDataRevision
    setDraftDirty(false)
    setDraftConflict(false)
    setPendingEdgeSourceId(null)
    setToolMode('select')
    upsertUiToast({
      id: 'flow-editor-discard',
      kind: 'neutral',
      message: 'Flow Editor draft discarded.',
      ttlMs: 3500,
    })
  }, [baseGraphData, baseGraphDataRevision, upsertUiToast])

  const selectedDraftNode = React.useMemo(() => {
    if (!draftGraphData || !selectedNodeId) return null
    const nodes = Array.isArray(draftGraphData.nodes) ? draftGraphData.nodes : []
    return nodes.find(n => String(n.id || '') === selectedNodeId) || null
  }, [draftGraphData, selectedNodeId])

  const selectedDraftEdge = React.useMemo(() => {
    if (!draftGraphData || !selectedEdgeId) return null
    const edges = Array.isArray(draftGraphData.edges) ? draftGraphData.edges : []
    return edges.find(e => String(e.id || '') === selectedEdgeId) || null
  }, [draftGraphData, selectedEdgeId])

  React.useEffect(() => {
    if (!active) return
    setJsonError(null)
    setNodePropsJson(safeJsonStringify(selectedDraftNode?.properties || {}))
    setNodeMetaJson(safeJsonStringify(selectedDraftNode?.metadata || {}))
    setEdgePropsJson(safeJsonStringify(selectedDraftEdge?.properties || {}))
    setEdgeMetaJson(safeJsonStringify(selectedDraftEdge?.metadata || {}))
    setWorkflowMetaJson(safeJsonStringify(draftGraphData?.metadata || {}))
    setWorkflowContextJson(safeJsonStringify(draftGraphData?.context ?? null))
  }, [active, draftGraphData, selectedDraftEdge, selectedDraftNode])

  const setSelectedNodeLabel = React.useCallback(
    (label: string) => {
      if (!draftGraphData || !selectedNodeId) return
      const trimmed = String(label || '')
      const nodes = (draftGraphData.nodes || []).map(n => {
        if (String(n.id || '') !== selectedNodeId) return n
        if (String(n.label || '') === trimmed) return n
        return { ...n, label: trimmed }
      })
      const next = normalizeGraphData({ ...draftGraphData, nodes })
      setDraftGraphData(next)
      setDraftGraphDataRevision(r => r + 1)
      setDraftDirty(true)
    },
    [draftGraphData, selectedNodeId],
  )

  const setSelectedNodeType = React.useCallback(
    (type: string) => {
      if (!draftGraphData || !selectedNodeId) return
      const trimmed = String(type || '').trim() || 'Node'
      const nodes = (draftGraphData.nodes || []).map(n => {
        if (String(n.id || '') !== selectedNodeId) return n
        if (String(n.type || '') === trimmed) return n
        return { ...n, type: trimmed }
      })
      const next = normalizeGraphData({ ...draftGraphData, nodes })
      setDraftGraphData(next)
      setDraftGraphDataRevision(r => r + 1)
      setDraftDirty(true)
    },
    [draftGraphData, selectedNodeId],
  )

  const patchSelectedNodeProperties = React.useCallback(
    (patch: Record<string, unknown>) => {
      if (!draftGraphData || !selectedNodeId) return
      const nodes = (draftGraphData.nodes || []).map(n => {
        if (String(n.id || '') !== selectedNodeId) return n
        const prevProps = (n.properties || {}) as Record<string, unknown>
        const nextProps: Record<string, unknown> = { ...prevProps }
        for (const [key, value] of Object.entries(patch)) {
          if (typeof value === 'undefined') {
            delete nextProps[key]
            continue
          }
          nextProps[key] = value as unknown
        }
        return { ...n, properties: nextProps as never }
      })
      const next = normalizeGraphData({ ...draftGraphData, nodes })
      setDraftGraphData(next)
      setDraftGraphDataRevision(r => r + 1)
      setDraftDirty(true)
    },
    [draftGraphData, selectedNodeId],
  )

  const setSelectedNodeProperties = React.useCallback(
    (properties: Record<string, unknown>) => {
      if (!draftGraphData || !selectedNodeId) return
      const nodes = (draftGraphData.nodes || []).map(n => {
        if (String(n.id || '') !== selectedNodeId) return n
        return { ...n, properties: (properties || {}) as never }
      })
      const next = normalizeGraphData({ ...draftGraphData, nodes })
      setDraftGraphData(next)
      setDraftGraphDataRevision(r => r + 1)
      setDraftDirty(true)
    },
    [draftGraphData, selectedNodeId],
  )

  const validateSelectedNode = React.useCallback(() => {
    if (!selectedDraftNode) return
    const props = (selectedDraftNode.properties || {}) as Record<string, unknown>
    const missing: string[] = []
    for (const key of FLOW_EDITOR_SMART_NODE_REQUIRED_FIELDS) {
      const v = props[key]
      if (key === 'duration') {
        if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) missing.push(String(key))
        continue
      }
      if (typeof v === 'string') {
        if (v.trim().length === 0) missing.push(String(key))
        continue
      }
      if (typeof v === 'undefined' || v === null) {
        missing.push(String(key))
        continue
      }
    }
    if (missing.length > 0) {
      upsertUiToast({
        id: `flow-editor-node-validate-${String(selectedDraftNode.id || '')}`,
        kind: 'warning',
        message: `Missing required fields: ${missing.join(', ')}`,
        ttlMs: 4500,
      })
      return
    }
    upsertUiToast({
      id: `flow-editor-node-validate-${String(selectedDraftNode.id || '')}`,
      kind: 'success',
      message: 'Node validated.',
      ttlMs: 2500,
    })
  }, [selectedDraftNode, upsertUiToast])

  const duplicateSelectedNode = React.useCallback(() => {
    if (!draftGraphData || !selectedDraftNode) return
    const nodeIds = new Set((draftGraphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
    const nextId = createUniqueId('n', nodeIds)
    const baseLabel = String(selectedDraftNode.label || selectedDraftNode.id || nextId)
    const nextNode: GraphNode = {
      ...selectedDraftNode,
      id: nextId,
      label: `${baseLabel} copy`,
      x: (Number.isFinite(selectedDraftNode.x) ? selectedDraftNode.x : 0) + 40,
      y: (Number.isFinite(selectedDraftNode.y) ? selectedDraftNode.y : 0) + 40,
    }
    const next: GraphData = {
      ...draftGraphData,
      nodes: [...(draftGraphData.nodes || []), nextNode],
    }
    setDraftGraphData(normalizeGraphData(next))
    setDraftGraphDataRevision(r => r + 1)
    setDraftDirty(true)
    setSelectionSource('canvas')
    selectEdge(null)
    selectNode(nextId)
  }, [draftGraphData, selectEdge, selectNode, selectedDraftNode, setSelectionSource])

  const clearSelectedNodeOutput = React.useCallback(() => {
    if (!selectedDraftNode) return
    upsertUiToast({
      id: `flow-editor-clear-output-${String(selectedDraftNode.id || '')}`,
      kind: 'neutral',
      message: 'Clear output is not implemented in MVP.',
      ttlMs: 2200,
    })
  }, [selectedDraftNode, upsertUiToast])

  const showNodeEditorHelp = React.useCallback(() => {
    upsertUiToast({
      id: 'flow-editor-node-editor-help',
      kind: 'neutral',
      message: UI_COPY.flowNodeQuickEditorHelpToast,
      ttlMs: 2800,
    })
  }, [upsertUiToast])

  const enableHandlesForAllInputs = React.useCallback(() => {
    if (documentStructureBaselineLock === true) {
      upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }

    if (isHandlesForAllInputsEnabled(schema)) {
      upsertUiToast({
        id: 'flow-editor-enable-handles',
        kind: 'neutral',
        message: UI_COPY.flowNodeQuickEditorEnableHandlesAlreadyOnToast,
        ttlMs: 2200,
      })
      return
    }

    const next = enableHandlesForAllInputsInSchema(schema)
    if (next.changed) setSchema(next.schema)
    upsertUiToast({
      id: 'flow-editor-enable-handles',
      kind: 'success',
      message: UI_COPY.flowNodeQuickEditorEnableHandlesToast,
      ttlMs: 2600,
    })
  }, [documentStructureBaselineLock, schema, setSchema, upsertUiToast])

  const togglePortHandles = React.useCallback(() => {
    if (documentStructureBaselineLock === true) {
      upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }
    const next = togglePortHandlesEnabledInSchema(schema)
    if (next.changed) setSchema(next.schema)
  }, [documentStructureBaselineLock, schema, setSchema, upsertUiToast])

  const convertSelectedNodeToLoop = React.useCallback(() => {
    if (!draftGraphData || !selectedNodeId) return
    const converted = convertNodeToLoopInGraphData(draftGraphData, selectedNodeId)
    if (!converted.changed) {
      upsertUiToast({
        id: 'flow-editor-convert-loop',
        kind: 'neutral',
        message: UI_COPY.flowNodeQuickEditorConvertToLoopAlreadyLoopToast,
        ttlMs: 2200,
      })
      return
    }
    setDraftGraphData(converted.graphData)
    setDraftGraphDataRevision(r => r + 1)
    setDraftDirty(true)
    upsertUiToast({
      id: 'flow-editor-convert-loop',
      kind: 'success',
      message: UI_COPY.flowNodeQuickEditorConvertToLoopToast,
      ttlMs: 2600,
    })
  }, [draftGraphData, selectedNodeId, upsertUiToast])

  const setSelectedEdgeLabel = React.useCallback(
    (label: string) => {
      if (!draftGraphData || !selectedEdgeId) return
      const trimmed = String(label || '').trim() || 'linksTo'
      const edges = (draftGraphData.edges || []).map(e => {
        if (String(e.id || '') !== selectedEdgeId) return e
        if (String(e.label || '') === trimmed) return e
        return { ...e, label: trimmed }
      })
      const next = normalizeGraphData({ ...draftGraphData, edges })
      setDraftGraphData(next)
      setDraftGraphDataRevision(r => r + 1)
      setDraftDirty(true)
    },
    [draftGraphData, selectedEdgeId],
  )

  const applyJsonToDraft = React.useCallback(
    (args: { target: 'nodeProps' | 'nodeMeta' | 'edgeProps' | 'edgeMeta' | 'workflowMeta' | 'workflowContext' }) => {
      if (!draftGraphData) return
      setJsonError(null)
      const apply = (next: GraphData) => {
        setDraftGraphData(normalizeGraphData(next))
        setDraftGraphDataRevision(r => r + 1)
        setDraftDirty(true)
      }

      if (args.target === 'workflowContext') {
        const parsed = tryParseJson(workflowContextJson)
        if (parsed.ok === false) {
          setJsonError(parsed.error)
          return
        }
        apply({ ...draftGraphData, context: parsed.value as never })
        return
      }

      if (args.target === 'workflowMeta') {
        const parsed = tryParseJson(workflowMetaJson)
        if (parsed.ok === false) {
          setJsonError(parsed.error)
          return
        }
        const record = coerceJsonObject(parsed.value)
        if (!record) {
          setJsonError('Workflow metadata must be a JSON object.')
          return
        }
        apply({ ...draftGraphData, metadata: record as never })
        return
      }

      if (args.target === 'nodeProps' || args.target === 'nodeMeta') {
        if (!selectedNodeId) return
        const text = args.target === 'nodeProps' ? nodePropsJson : nodeMetaJson
        const parsed = tryParseJson(text)
        if (parsed.ok === false) {
          setJsonError(parsed.error)
          return
        }
        const record = coerceJsonObject(parsed.value)
        if (!record) {
          setJsonError('Node value must be a JSON object.')
          return
        }
        const nodes = (draftGraphData.nodes || []).map(n => {
          if (String(n.id || '') !== selectedNodeId) return n
          return args.target === 'nodeProps' ? { ...n, properties: record as never } : { ...n, metadata: record as never }
        })
        apply({ ...draftGraphData, nodes })
        return
      }

      if (args.target === 'edgeProps' || args.target === 'edgeMeta') {
        if (!selectedEdgeId) return
        const text = args.target === 'edgeProps' ? edgePropsJson : edgeMetaJson
        const parsed = tryParseJson(text)
        if (parsed.ok === false) {
          setJsonError(parsed.error)
          return
        }
        const record = coerceJsonObject(parsed.value)
        if (!record) {
          setJsonError('Edge value must be a JSON object.')
          return
        }
        const edges = (draftGraphData.edges || []).map(e => {
          if (String(e.id || '') !== selectedEdgeId) return e
          return args.target === 'edgeProps' ? { ...e, properties: record as never } : { ...e, metadata: record as never }
        })
        apply({ ...draftGraphData, edges })
      }
    },
    [draftGraphData, edgeMetaJson, edgePropsJson, nodeMetaJson, nodePropsJson, selectedEdgeId, selectedNodeId, workflowContextJson, workflowMetaJson],
  )

  if (!draftGraphData) {
    return (
      <section ref={rootRef} className="absolute inset-0" aria-label="Flow Editor">
        <aside className="absolute top-3 left-3 z-[220]" aria-label="Flow Editor Status">
          <section className={`rounded-lg border px-3 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <p className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>No graph loaded.</p>
          </section>
        </aside>
      </section>
    )
  }

  const inspectorElement = (
    <FlowEditorInspector
      active={active}
      tab={inspectorTab}
      setTab={setInspectorTab}
      selectedNode={selectedDraftNode}
      selectedEdge={selectedDraftEdge}
      workflowNodes={draftGraphData.nodes || []}
      workflowSelectedNodeId={selectedNodeId}
      onWorkflowSelectNode={id => {
        setInspectorTab('node')
        setSelectionSource('canvas')
        selectEdge(null)
        selectNode(id)
      }}
      onWorkflowRunNode={id =>
        upsertUiToast({
          id: `flow-editor-run-${id}`,
          kind: 'neutral',
          message: 'Run is not implemented in MVP.',
          ttlMs: 2200,
        })}
      jsonError={jsonError}
      nodePropsJson={nodePropsJson}
      setNodePropsJson={setNodePropsJson}
      nodeMetaJson={nodeMetaJson}
      setNodeMetaJson={setNodeMetaJson}
      edgePropsJson={edgePropsJson}
      setEdgePropsJson={setEdgePropsJson}
      edgeMetaJson={edgeMetaJson}
      setEdgeMetaJson={setEdgeMetaJson}
      workflowMetaJson={workflowMetaJson}
      setWorkflowMetaJson={setWorkflowMetaJson}
      workflowContextJson={workflowContextJson}
      setWorkflowContextJson={setWorkflowContextJson}
      onSetNodeLabel={setSelectedNodeLabel}
      onSetNodeType={setSelectedNodeType}
      onSetEdgeLabel={setSelectedEdgeLabel}
      onApplyJson={target => applyJsonToDraft({ target })}
    />
  )

  const overlayEditorElement =
    active && selectedDraftNode ? (
      <FlowEditorNodeQuickEditorOverlay
        active={active}
        node={selectedDraftNode}
        edges={(draftGraphData?.edges || []) as GraphEdge[]}
        toolMode={toolMode}
        pendingEdgeSourceId={pendingEdgeSourceId}
        onBeginAddEdgeFromNode={beginAddEdgeFromNode}
        onFinalizeAddEdgeToNode={finalizePendingEdge}
        viewportW={viewportW}
        viewportH={viewportH}
        onSetLabel={setSelectedNodeLabel}
        onSetType={setSelectedNodeType}
        onPatchProperties={patchSelectedNodeProperties}
        onSetProperties={setSelectedNodeProperties}
        onValidate={validateSelectedNode}
        onDuplicate={duplicateSelectedNode}
        onRemove={deleteSelection}
        onClearOutput={clearSelectedNodeOutput}
        onHelp={showNodeEditorHelp}
        onConvertToLoopNode={convertSelectedNodeToLoop}
        onTogglePortHandles={togglePortHandles}
        onEnableHandlesForAllInputs={enableHandlesForAllInputs}
        onPinnedToNodeChange={setNodeEditorPinnedToNode}
      />
    ) : null

  return (
    <section ref={rootRef} className="absolute inset-0" aria-label="Flow Editor">
      <FlowCanvas
        active={active}
        graphDataOverride={draftGraphData}
        graphDataRevisionOverride={draftGraphDataRevision}
        collisionDuringDrag
        allowNodeDragOverride={nodeEditorPinnedToNode ? false : undefined}
        hideSelectedNodeGlyph={Boolean(overlayEditorElement)}
        hideSelectedNodePortHandles={Boolean(overlayEditorElement)}
        forbidCircleNodes
      />

      {overlayEditorElement}

      <nav className="absolute top-3 left-3 z-[220]" aria-label="Flow Editor Tools">
        <section className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
          <button
            type="button"
            className={`App-toolbar__btn ${toolMode === 'select' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
            onClick={() => {
              setToolMode('select')
              setPendingEdgeSourceId(null)
            }}
            aria-label="Tool: Select"
            disabled={!active}
          >
            Select
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={addNode}
            aria-label="Add node"
            disabled={!active}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${toolMode === 'addEdge' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
            onClick={() => {
              if (toolMode === 'addEdge') {
                setToolMode('select')
                setPendingEdgeSourceId(null)
                return
              }
              setToolMode('addEdge')
              setPendingEdgeSourceId(null)
            }}
            aria-label="Add edge"
            disabled={!active}
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={deleteSelection}
            aria-label="Delete selection"
            disabled={!active}
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <span className={`px-2 text-xs ${UI_THEME_TOKENS.text.secondary}`} aria-label="Draft status">
            {draftConflict ? 'Conflict' : draftDirty ? 'Staged' : 'Clean'}
          </span>

          <button
            type="button"
            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`}
            onClick={commitDraft}
            aria-label="Commit draft"
            disabled={!active || !draftDirty || draftConflict}
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={discardDraft}
            aria-label="Discard draft"
            disabled={!active || (!draftDirty && !draftConflict)}
          >
            <X className="h-4 w-4" />
          </button>
        </section>
      </nav>

      {toolMode === 'addEdge' && active && (
        <aside className="absolute top-16 left-3 z-[220]" aria-label="Add edge hint">
          <section className={`rounded-lg border px-3 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <p className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>
              {pendingEdgeSourceId ? `Select target node (from ${pendingEdgeSourceId}).` : 'Select source node.'}
            </p>
          </section>
        </aside>
      )}

      {inspectorPortalHost ? createPortal(inspectorElement, inspectorPortalHost) : null}
    </section>
  )
}
