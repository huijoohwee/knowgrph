import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { DEFAULT_NODE_MEDIA_KIND, getNodeMediaSpec, patchNodeMediaProperties, type NodeMediaKind } from '@/components/GraphCanvas/helpers'
import { emitChatInputAppend, emitFloatingPanelOpen } from '@/features/canvas/utils'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { createId } from '@/lib/id'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { getZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'

type FloatingPanelModel = {
  graphData: GraphData | null
  schema: GraphSchema | null
  nodeTypes: string[]
  catalogTypes: string[]
  edgeLabels: string[]
  newType: string
  setNewType: (next: string) => void
  newLabel: string
  setNewLabel: (next: string) => void
  newEdgeLabel: string
  setNewEdgeLabel: (next: string) => void
  mediaKind: NodeMediaKind
  setMediaKind: (next: NodeMediaKind) => void
  mediaUrl: string
  setMediaUrl: (next: string) => void
  mediaInteractive: boolean
  setMediaInteractive: (next: boolean) => void
  canUseNodeContext: boolean
  canUseEdgeContext: boolean
  doUpdateMedia: () => void
  doOpenNodeSide: () => void
  doOpenNodeNodesTab: () => void
  doOpenNodeCodeTab: () => void
  doShowNodeInMarkdown: () => void
  doAddToChat: () => void
  doStartEdgeFromNode: () => void
  doCreateNodeAndEdge: () => void
  doDeleteNode: () => void
  doOpenSourceSide: () => void
  doOpenTargetSide: () => void
  doUpdateSource: () => void
  doUpdateTarget: () => void
  doOpenEdgeEdgesTab: () => void
  doOpenEdgeCodeTab: () => void
  doShowEdgeInMarkdown: () => void
  doAddNode: () => void
  doAddNodePlusEdgeFromSelected: () => void
  doStartEdgeFromSelected: () => void
  doAddMediaNode: () => void
}

const getCanvasCenterGraphPoint = () => {
  const state = useGraphStore.getState()
  const dims = state.canvasDims || { w: 800, h: 600 }
  const w = Math.max(1, Math.floor(dims.w))
  const h = Math.max(1, Math.floor(dims.h))
  const zoomViewKey = buildActive2dZoomViewKey({
    canvasRenderMode: state.canvasRenderMode,
    canvas2dRenderer: state.canvas2dRenderer,
    schema: state.schema,
    graphData: state.graphData,
    documentSemanticMode: state.documentSemanticMode,
    frontmatterModeEnabled: state.frontmatterModeEnabled,
    documentStructureBaselineLock: state.documentStructureBaselineLock,
    renderMediaAsNodes: state.renderMediaAsNodes,
    mediaPanelDensity: state.mediaPanelDensity,
    collapsedGroupIds: state.collapsedGroupIds,
  })
  const z = zoomViewKey
    ? getZoomStateForKey({ zoomViewKey, zoomStateByKey: state.zoomStateByKey })
    : state.zoomState
  const k = z && typeof z.k === 'number' && Number.isFinite(z.k) && z.k !== 0 ? z.k : 1
  const tx = z && typeof z.x === 'number' && Number.isFinite(z.x) ? z.x : 0
  const ty = z && typeof z.y === 'number' && Number.isFinite(z.y) ? z.y : 0
  const cx = w / 2
  const cy = h / 2
  const x = (cx - tx) / k
  const y = (cy - ty) / k
  return { x, y }
}

export function useFloatingPropsPanelModel(): FloatingPanelModel {
  const graphData = useActiveGraphRenderData()
  const graphDataRevision = useGraphStore(s => s.graphDataRevision || 0)
  const schema = useGraphStore(s => s.schema as GraphSchema | null)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const setWorkspaceViewMode = useGraphStore(s => s.setWorkspaceViewMode)
  const addNode = useGraphStore(s => s.addNode)
  const addEdge = useGraphStore(s => s.addEdge)
  const removeNode = useGraphStore(s => s.removeNode)
  const updateNode = useGraphStore(s => s.updateNode)
  const requestEdgeCreation = useGraphStore(s => s.requestEdgeCreation)

  const nodeTypes = React.useMemo(
    () => (schema && schema.nodeStyles ? Object.keys(schema.nodeStyles) : []),
    [schema],
  )
  const catalogTypes = React.useMemo(
    () => schema?.catalog?.nodeTypes || [],
    [schema],
  )
  const preferred = schema?.behavior?.defaultNodeType
  const resolvedDefaultType = React.useMemo(
    () => {
      if (!schema) return 'entity'
      if (preferred && (catalogTypes.includes(preferred) || nodeTypes.includes(preferred))) {
        return preferred
      }
      return catalogTypes[0] || nodeTypes[0] || 'entity'
    },
    [schema, preferred, catalogTypes, nodeTypes],
  )

  const edgeLabels = React.useMemo(() => {
    const fromCatalog = schema?.catalog?.edgeLabels || []
    const fromStyles = schema?.edgeStyles ? Object.keys(schema.edgeStyles) : []
    const combined = new Set<string>([...fromCatalog, ...fromStyles].map(x => String(x)))
    return Array.from(combined).filter(Boolean)
  }, [schema])

  const defaultEdgeLabel = edgeLabels[0] || 'link'
  const [newType, setNewType] = React.useState<string>(resolvedDefaultType)
  const [newLabel, setNewLabel] = React.useState<string>(resolvedDefaultType || 'Node')
  const [newEdgeLabel, setNewEdgeLabel] = React.useState<string>(defaultEdgeLabel)
  const [mediaKind, setMediaKind] = React.useState<NodeMediaKind>(DEFAULT_NODE_MEDIA_KIND)
  const [mediaUrl, setMediaUrl] = React.useState<string>('')
  const [mediaInteractive, setMediaInteractive] = React.useState<boolean>(false)

  const graphSemanticKey = React.useMemo(
    () => buildScopedGraphSemanticKey('floating-props-panel-graph', { graphData, graphRevision: graphDataRevision }),
    [graphData, graphDataRevision],
  )
  const graphLookup = React.useMemo(() => {
    return getCachedGraphLookup({
      cacheScope: 'floating-props-panel-graph',
      graphData,
      graphRevision: graphDataRevision,
      graphSemanticKey,
      preferCurrentGraphDataRefs: true,
    })
  }, [graphData, graphDataRevision, graphSemanticKey])

  const nodeContextId = selectedNodeId
  const edgeContextId = selectedEdgeId
  const nodeContext = React.useMemo(() => {
    if (!graphLookup || !nodeContextId) return null
    return graphLookup.nodeById.get(nodeContextId) || null
  }, [graphLookup, nodeContextId])

  const canUseNodeContext = Boolean(graphLookup && nodeContextId && graphLookup.nodeById.has(nodeContextId))
  const canUseEdgeContext = Boolean(graphLookup && edgeContextId && graphLookup.edgeById.has(edgeContextId))

  React.useEffect(() => {
    setNewType(resolvedDefaultType)
    setNewLabel(resolvedDefaultType || 'Node')
  }, [resolvedDefaultType])

  React.useEffect(() => {
    setNewEdgeLabel(defaultEdgeLabel)
  }, [defaultEdgeLabel])

  React.useEffect(() => {
    if (!nodeContext) {
      setMediaKind(DEFAULT_NODE_MEDIA_KIND)
      setMediaUrl('')
      setMediaInteractive(false)
      return
    }
    const spec = getNodeMediaSpec(nodeContext)
    const props = nodeContext.properties || {}
    const rawInteractive = (props as Record<string, unknown>).media_interactive
    setMediaInteractive(rawInteractive === true)
    if (!spec) {
      setMediaKind(DEFAULT_NODE_MEDIA_KIND)
      setMediaUrl('')
      return
    }
    setMediaKind(spec.kind)
    setMediaUrl(spec.url)
  }, [nodeContext])

  const doUpdateMedia = React.useCallback(() => {
    if (!graphLookup || !nodeContextId) return
    const current = graphLookup.nodeById.get(nodeContextId) || null
    if (!current) return

    const nextProps = patchNodeMediaProperties({
      properties: (current.properties || {}) as Record<string, unknown>,
      kind: mediaKind,
      url: mediaUrl,
      interactive: mediaInteractive,
    }) as GraphNode['properties']
    updateNode(nodeContextId, { properties: nextProps })
  }, [graphLookup, mediaInteractive, mediaKind, mediaUrl, nodeContextId, updateNode])

  const doOpenNodeSide = React.useCallback(() => {
    if (!graphData || !nodeContextId) return
    setSelectionSource('toolbar')
    emitFloatingPanelOpen({ tab: 'node', open: true })
    selectNode(nodeContextId)
  }, [graphData, nodeContextId, selectNode, setSelectionSource])

  const resolveMarkdownProvenance = React.useCallback(
    (meta: unknown) => {
      const record = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {}
      const pathRaw = record.documentPath || record.sourcePath || record.sourceUri || record.codebasePath
      const documentPath = typeof pathRaw === 'string' ? pathRaw.trim() : ''
      const lineStartRaw = record.lineStart
      const lineEndRaw = record.lineEnd
      const parseLine = (v: unknown): number | null => {
        if (typeof v === 'number') return Number.isFinite(v) ? Math.floor(v) : null
        if (typeof v === 'string') {
          const parsed = Number.parseInt(v, 10)
          return Number.isFinite(parsed) ? parsed : null
        }
        return null
      }
      const start = parseLine(lineStartRaw)
      const endParsed = parseLine(lineEndRaw)
      if (!documentPath || start == null) return null
      const end = endParsed != null ? endParsed : start
      const safeStart = Math.max(1, Math.min(start, end))
      const safeEnd = Math.max(safeStart, Math.max(start, end))
      return { documentPath, startLine: safeStart, endLine: safeEnd }
    },
    [],
  )

  const openMarkdownProvenanceInEditor = React.useCallback((documentPath: string, startLine: number): boolean => {
    try {
      setWorkspaceViewMode('editor')
      const path = normalizeWorkspacePath(documentPath)
      useMarkdownExplorerStore.getState().setActivePath(path)
      useMarkdownExplorerStore.getState().requestRevealLine(startLine)
      return true
    } catch {
      return false
    }
  }, [setWorkspaceViewMode])

  const doOpenNodeNodesTab = React.useCallback(() => {
    if (!graphData || !nodeContextId) return
    setSelectionSource('toolbar')
    setWorkspaceViewMode('canvas')
    selectNode(nodeContextId)
  }, [graphData, nodeContextId, setSelectionSource, setWorkspaceViewMode, selectNode])

  const doOpenNodeCodeTab = React.useCallback(() => {
    if (!graphLookup || !nodeContextId) return
    const node = graphLookup.nodeById.get(nodeContextId) || null
    setSelectionSource('toolbar')
    selectNode(nodeContextId)
    const prov = node ? resolveMarkdownProvenance(node.metadata) : null
    if (!prov || !openMarkdownProvenanceInEditor(prov.documentPath, prov.startLine)) {
      setWorkspaceViewMode('canvas')
      return
    }
  }, [
    graphLookup,
    nodeContextId,
    openMarkdownProvenanceInEditor,
    resolveMarkdownProvenance,
    selectNode,
    setSelectionSource,
    setWorkspaceViewMode,
  ])

  const doShowNodeInMarkdown = React.useCallback(() => {
    if (!graphLookup || !nodeContextId) return
    const node = graphLookup.nodeById.get(nodeContextId) || null
    if (!node) return
    const prov = resolveMarkdownProvenance(node.metadata)
    if (!prov) return
    setSelectionSource('toolbar')
    openMarkdownProvenanceInEditor(prov.documentPath, prov.startLine)
  }, [graphLookup, nodeContextId, openMarkdownProvenanceInEditor, resolveMarkdownProvenance, setSelectionSource])

  const doAddToChat = React.useCallback(() => {
    if (!graphData || !graphLookup) return

    const serializeValue = (raw: unknown): string => {
      if (raw == null) return 'null'
      if (typeof raw === 'string') {
        const s = raw.trim()
        if (!s) return '""'
        const clipped = s.length > 140 ? `${s.slice(0, 137)}...` : s
        return JSON.stringify(clipped)
      }
      if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
      if (Array.isArray(raw)) return `[${raw.slice(0, 3).map(v => serializeValue(v)).join(', ')}${raw.length > 3 ? ', …' : ''}]`
      if (typeof raw === 'object') {
        const keys = Object.keys(raw as Record<string, unknown>).slice(0, 6)
        return `{ ${keys.join(', ')}${Object.keys(raw as Record<string, unknown>).length > keys.length ? ', …' : ''} }`
      }
      return JSON.stringify(String(raw))
    }

    const nodeId = nodeContextId && graphLookup.nodeById.has(nodeContextId) ? nodeContextId : null
    const edgeId = edgeContextId && graphLookup.edgeById.has(edgeContextId) ? edgeContextId : null

    let text = ''
    if (nodeId) {
      const n = graphLookup.nodeById.get(nodeId) || null
      if (!n) return
      const props = (n.properties || {}) as Record<string, unknown>
      const keys = Object.keys(props).slice(0, 8)
      const propLines = keys.map(k => `- ${k}: ${serializeValue(props[k])}`)
      const incident = (graphLookup.incidentEdgesByNodeId.get(nodeId) || [])
        .slice(0, 8)
        .map(e => {
          const src = graphLookup.nodeById.get(String(e.source))
          const tgt = graphLookup.nodeById.get(String(e.target))
          const srcLabel = String(src?.label || src?.id || e.source || '')
          const tgtLabel = String(tgt?.label || tgt?.id || e.target || '')
          return `[${srcLabel}] --[${String(e.label || 'rel')}]--> [${tgtLabel}]`
        })
      text = [
        `Selected node: ${String(n.label || n.id)} (id=${String(n.id)}; type=${String(n.type || '')})`,
        keys.length ? 'Properties:' : '',
        ...propLines,
        incident.length ? 'Incident relationships:' : '',
        ...incident.map(x => `- ${x}`),
      ]
        .filter(Boolean)
        .join('\n')
    } else if (edgeId) {
      const e = graphLookup.edgeById.get(edgeId) || null
      if (!e) return
      const src = graphLookup.nodeById.get(String(e.source))
      const tgt = graphLookup.nodeById.get(String(e.target))
      const srcLabel = String(src?.label || src?.id || e.source || '')
      const tgtLabel = String(tgt?.label || tgt?.id || e.target || '')
      const props = (e.properties || {}) as Record<string, unknown>
      const keys = Object.keys(props).slice(0, 8)
      const propLines = keys.map(k => `- ${k}: ${serializeValue(props[k])}`)
      text = [
        `Selected edge: ${String(e.id)} (${String(e.label || 'rel')})`,
        `Citation: [${srcLabel}] --[${String(e.label || 'rel')}]--> [${tgtLabel}]`,
        keys.length ? 'Properties:' : '',
        ...propLines,
      ]
        .filter(Boolean)
        .join('\n')
    } else {
      return
    }

    emitFloatingPanelOpen({ tab: 'chat', open: true })
    const wrapped = ['Selection context (from canvas):', '', '````text', text, '````'].join('\n')
    emitChatInputAppend({ text: wrapped, mode: 'append' })
  }, [edgeContextId, graphData, graphLookup, nodeContextId])

  const doStartEdgeFromNode = React.useCallback(() => {
    if (!graphData || !nodeContextId) return
    setSelectionSource('toolbar')
    selectNode(nodeContextId)
    requestEdgeCreation({ type: 'create', fromId: nodeContextId })
  }, [graphData, nodeContextId, setSelectionSource, selectNode, requestEdgeCreation])

  const doCreateNodeAndEdge = React.useCallback(() => {
    if (!graphLookup || !nodeContextId) return
    const start = graphLookup.nodeById.get(nodeContextId) || null
    if (!start) return
    const tpl = (schema?.templates?.node || {})[newType] || {}
    const newNodeId = createId('n')
    const center = getCanvasCenterGraphPoint()
    const node: GraphNode = {
      id: newNodeId,
      label: String((newLabel ?? (tpl as { label?: unknown }).label) || 'Node'),
      type: newType || 'entity',
      x: center.x,
      y: center.y,
      fx: center.x,
      fy: center.y,
      properties: { ...(tpl || {}) },
    }
    addNode(node)
    const edgeId = createId('e')
    const edge: GraphEdge = {
      id: edgeId,
      source: start.id,
      target: newNodeId,
      label: defaultEdgeLabel,
      properties: {},
    }
    addEdge(edge)
    setSelectionSource('toolbar')
    selectEdge(edge.id)
  }, [addEdge, addNode, defaultEdgeLabel, graphLookup, newLabel, newType, nodeContextId, schema, selectEdge, setSelectionSource])

  const doDeleteNode = React.useCallback(() => {
    if (!graphData || !nodeContextId) return
    removeNode(nodeContextId)
  }, [graphData, nodeContextId, removeNode])

  const doOpenSourceSide = React.useCallback(() => {
    if (!graphLookup || !edgeContextId) return
    const e = graphLookup.edgeById.get(edgeContextId) || null
    if (!e) return
    const srcId = e.source
    setSelectionSource('toolbar')
    emitFloatingPanelOpen({ tab: 'node', open: true })
    selectNode(srcId)
  }, [edgeContextId, graphLookup, selectNode, setSelectionSource])

  const doOpenTargetSide = React.useCallback(() => {
    if (!graphLookup || !edgeContextId) return
    const e = graphLookup.edgeById.get(edgeContextId) || null
    if (!e) return
    const tgtId = e.target
    setSelectionSource('toolbar')
    emitFloatingPanelOpen({ tab: 'node', open: true })
    selectNode(tgtId)
  }, [edgeContextId, graphLookup, selectNode, setSelectionSource])

  const doUpdateSource = React.useCallback(() => {
    if (!graphLookup || !edgeContextId) return
    const e = graphLookup.edgeById.get(edgeContextId) || null
    if (!e) return
    const src = graphLookup.nodeById.get(String(e.source)) || null
    if (!src) return
    setSelectionSource('toolbar')
    selectEdge(e.id)
    requestEdgeCreation({ type: 'update-source', fromId: src.id })
  }, [edgeContextId, graphLookup, requestEdgeCreation, selectEdge, setSelectionSource])

  const doUpdateTarget = React.useCallback(() => {
    if (!graphLookup || !edgeContextId) return
    const e = graphLookup.edgeById.get(edgeContextId) || null
    if (!e) return
    const tgt = graphLookup.nodeById.get(String(e.target)) || null
    if (!tgt) return
    setSelectionSource('toolbar')
    selectEdge(e.id)
    requestEdgeCreation({ type: 'update-target', fromId: tgt.id })
  }, [edgeContextId, graphLookup, requestEdgeCreation, selectEdge, setSelectionSource])

  const doOpenEdgeEdgesTab = React.useCallback(() => {
    if (!graphData || !edgeContextId) return
    setSelectionSource('toolbar')
    setWorkspaceViewMode('canvas')
    selectEdge(edgeContextId)
  }, [edgeContextId, graphData, selectEdge, setSelectionSource, setWorkspaceViewMode])

  const doOpenEdgeCodeTab = React.useCallback(() => {
    if (!graphLookup || !edgeContextId) return
    const edge = graphLookup.edgeById.get(edgeContextId) || null
    setSelectionSource('toolbar')
    selectEdge(edgeContextId)
    const prov = edge ? resolveMarkdownProvenance(edge.metadata) : null
    if (!prov || !openMarkdownProvenanceInEditor(prov.documentPath, prov.startLine)) {
      setWorkspaceViewMode('canvas')
      return
    }
  }, [
    edgeContextId,
    graphLookup,
    openMarkdownProvenanceInEditor,
    resolveMarkdownProvenance,
    selectEdge,
    setSelectionSource,
    setWorkspaceViewMode,
  ])

  const doShowEdgeInMarkdown = React.useCallback(() => {
    if (!graphLookup || !edgeContextId) return
    const edge = graphLookup.edgeById.get(edgeContextId) || null
    if (!edge) return
    const prov = resolveMarkdownProvenance(edge.metadata)
    if (!prov) return
    setSelectionSource('toolbar')
    openMarkdownProvenanceInEditor(prov.documentPath, prov.startLine)
  }, [edgeContextId, graphLookup, openMarkdownProvenanceInEditor, resolveMarkdownProvenance, setSelectionSource])

  const doAddNode = React.useCallback(() => {
    const tpl = (schema?.templates?.node || {})[newType] || {}
    const newNodeId = createId('n')
    const center = getCanvasCenterGraphPoint()
    const node: GraphNode = {
      id: newNodeId,
      label: String((newLabel ?? (tpl as { label?: unknown }).label) || 'Node'),
      type: newType || 'entity',
      x: center.x,
      y: center.y,
      fx: center.x,
      fy: center.y,
      properties: { ...(tpl || {}) },
    }
    addNode(node)
    setSelectionSource('toolbar')
    selectNode(newNodeId)
  }, [addNode, newLabel, newType, schema, selectNode, setSelectionSource])

  const doAddNodePlusEdgeFromSelected = React.useCallback(() => {
    if (!graphLookup || !nodeContextId) return
    const start = graphLookup.nodeById.get(nodeContextId) || null
    if (!start) return
    const tpl = (schema?.templates?.node || {})[newType] || {}
    const newNodeId = createId('n')
    const center = getCanvasCenterGraphPoint()
    const node: GraphNode = {
      id: newNodeId,
      label: String((newLabel ?? (tpl as { label?: unknown }).label) || 'Node'),
      type: newType || 'entity',
      x: center.x,
      y: center.y,
      fx: center.x,
      fy: center.y,
      properties: { ...(tpl || {}) },
    }
    addNode(node)
    const resolvedEdgeLabel = String(newEdgeLabel || defaultEdgeLabel || 'link').trim() || 'link'
    const newEdgeId = createId('e')
    const edge: GraphEdge = {
      id: newEdgeId,
      source: start.id,
      target: newNodeId,
      label: resolvedEdgeLabel,
      properties: {},
    }
    addEdge(edge)
    setSelectionSource('toolbar')
    selectEdge(newEdgeId)
  }, [addEdge, addNode, defaultEdgeLabel, graphLookup, newEdgeLabel, newLabel, newType, nodeContextId, schema, selectEdge, setSelectionSource])

  const doStartEdgeFromSelected = React.useCallback(() => {
    if (!graphLookup || !nodeContextId) return
    const src = graphLookup.nodeById.get(nodeContextId) || null
    if (!src) return
    setSelectionSource('toolbar')
    selectNode(nodeContextId)
    requestEdgeCreation({ type: 'create', fromId: src.id })
  }, [graphLookup, nodeContextId, requestEdgeCreation, selectNode, setSelectionSource])

  const doAddMediaNode = React.useCallback(() => {
    const tpl = (schema?.templates?.node || {})[newType] || {}
    const newNodeId = createId('n')
    const props = patchNodeMediaProperties({
      properties: (tpl || {}) as Record<string, unknown>,
      kind: mediaKind,
      url: mediaUrl,
      interactive: mediaInteractive,
    }) as GraphNode['properties']
    const center = getCanvasCenterGraphPoint()
    const node: GraphNode = {
      id: newNodeId,
      label: String((newLabel ?? (tpl as { label?: unknown }).label) || 'Node'),
      type: newType || 'entity',
      x: center.x,
      y: center.y,
      fx: center.x,
      fy: center.y,
      properties: props,
    }
    addNode(node)
    setSelectionSource('toolbar')
    selectNode(newNodeId)
  }, [addNode, mediaInteractive, mediaKind, mediaUrl, newLabel, newType, schema, selectNode, setSelectionSource])

  return {
    graphData,
    schema,
    nodeTypes,
    catalogTypes,
    edgeLabels,
    newType,
    setNewType,
    newLabel,
    setNewLabel,
    newEdgeLabel,
    setNewEdgeLabel,
    mediaKind,
    setMediaKind,
    mediaUrl,
    setMediaUrl,
    mediaInteractive,
    setMediaInteractive,
    canUseNodeContext,
    canUseEdgeContext,
    doUpdateMedia,
    doOpenNodeSide,
    doOpenNodeNodesTab,
    doOpenNodeCodeTab,
    doShowNodeInMarkdown,
    doAddToChat,
    doStartEdgeFromNode,
    doCreateNodeAndEdge,
    doDeleteNode,
    doOpenSourceSide,
    doOpenTargetSide,
    doUpdateSource,
    doUpdateTarget,
    doOpenEdgeEdgesTab,
    doOpenEdgeCodeTab,
    doShowEdgeInMarkdown,
    doAddNode,
    doAddNodePlusEdgeFromSelected,
    doStartEdgeFromSelected,
    doAddMediaNode,
  }
}
