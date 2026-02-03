import React from 'react'
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type Viewport,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useContainerDims } from '@/hooks/useContainerDims'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'
import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { FlowZoomEffects } from '@/components/FlowCanvas/FlowZoomEffects'
import { ElkNode } from '@/components/FlowCanvas/ElkNode'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import { buildElkLayout } from '@/components/FlowCanvas/elkLayout'
import { computeFlowHandlesByNode, buildFlowHandleId } from '@/components/FlowCanvas/handles'
import { buildDagreLayout, buildGraphMetaKey, deriveRankdir } from '@/components/FlowCanvas/layout'

function hasCacheCoverage(args: {
  nodes: ReadonlyArray<{ id: unknown }>
  positions: Record<string, { x: number; y: number }> | null
  minCoverage: number
}): boolean {
  const nodes = args.nodes
  const cached = args.positions
  if (!cached) return false
  if (!Array.isArray(nodes) || nodes.length === 0) return false
  let ok = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id ?? '')
    if (!id) continue
    const p = cached[id]
    if (!p) continue
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    ok += 1
  }
  return ok / Math.max(1, nodes.length) >= args.minCoverage
}

export default function FlowCanvas({ active = true }: { active?: boolean }) {
  const containerRef = React.useRef<HTMLElement>(null)
  const { width, height } = useContainerDims(containerRef)
  const viewportW = Math.max(1, Math.floor(width))
  const viewportH = Math.max(1, Math.floor(height))

  const {
    schema,
    frontmatterModeEnabled,
    documentSemanticMode,
    collapsedGroupIds,
    renderMediaAsNodes,
    mediaPanelDensity,
    canvasRenderMode,
    canvas2dRenderer,
    layoutPositionCacheByMode,
    setLayoutPositionsForMode,
    graphDataRevision,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
  } = useGraphStore(
    useShallow(s => ({
      schema: s.schema,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
      documentSemanticMode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
      collapsedGroupIds: s.collapsedGroupIds || [],
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      layoutPositionCacheByMode: s.layoutPositionCacheByMode,
      setLayoutPositionsForMode: s.setLayoutPositionsForMode,
      graphDataRevision: s.graphDataRevision || 0,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeIds: s.selectedEdgeIds,
    })),
  )

  const schemaLayoutEngineJson = React.useMemo(() => {
    const mode = schema ? readLayoutMode(schema) : 'force'
    const forces = schema?.layout?.forces || null
    const fitPadding = schema?.layout?.fitPadding ?? null
    return JSON.stringify({ mode, forces, fitPadding })
  }, [schema])

  const schemaNodesPresentationJson = React.useMemo(() => {
    return JSON.stringify({
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
      nodeShapes: schema?.nodeShapes || null,
      allowNodeDrag: schema?.behavior?.allowNodeDrag !== false,
      hoverEnabled: schema?.behavior?.hover?.enabled !== false,
      expansion: schema?.behavior?.expansion || null,
      renderMediaAsNodes,
      mediaPanelDensity,
    })
  }, [
    mediaPanelDensity,
    renderMediaAsNodes,
    schema?.behavior?.allowNodeDrag,
    schema?.behavior?.expansion,
    schema?.behavior?.hover?.enabled,
    schema?.behavior?.nodeShapeMode,
    schema?.behavior?.portHandles,
    schema?.nodeShapes,
  ])

  const schemaGroupsPresentationJson = React.useMemo(() => {
    return JSON.stringify({
      groups: schema?.layout?.groups || null,
      labelStyles: schema?.labelStyles || null,
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
    })
  }, [
    schema?.behavior?.nodeShapeMode,
    schema?.behavior?.portHandles,
    schema?.labelStyles,
    schema?.layout?.groups,
  ])

  const renderGraphData = useActiveGraphRenderData()
  const effectiveFrontmatter = !!frontmatterModeEnabled && documentSemanticMode !== 'keyword'

  const collapsedGroupIdsKey = React.useMemo(() => {
    const ids = Array.isArray(collapsedGroupIds) ? collapsedGroupIds : []
    const normalized = ids.map(x => String(x || '').trim()).filter(Boolean)
    if (normalized.length === 0) return ''
    normalized.sort((a, b) => a.localeCompare(b))
    return normalized.join('|')
  }, [collapsedGroupIds])

  const sceneGraphData = React.useMemo(() => {
    if (!renderGraphData) return null
    return cloneGraphDataForRender(renderGraphData)
  }, [renderGraphData])

  const zoomViewKey = React.useMemo(() => {
    return buildZoomViewKey({
      canvasRenderMode,
      canvas2dRenderer,
      schemaLayoutEngineJson,
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: String(documentSemanticMode),
      graphMetaKey: buildGraphMetaKey(sceneGraphData),
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
      schemaNodesPresentationJson,
      schemaGroupsPresentationJson,
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIdsKey,
    documentSemanticMode,
    effectiveFrontmatter,
    mediaPanelDensity,
    renderMediaAsNodes,
    schemaGroupsPresentationJson,
    schemaLayoutEngineJson,
    schemaNodesPresentationJson,
    sceneGraphData,
  ])

  const allowNodeDrag = schema?.behavior?.allowNodeDrag !== false
  const selectMode = schema?.behavior?.selectMode || 'single'
  const dragConstraint = schema?.behavior?.dragConstraint || 'free'
  const nodesConnectable = selectMode === 'single' || selectMode === 'multi' || selectMode === 'lasso'
  const panOnDrag = dragConstraint !== 'none'
  const rankdir = deriveRankdir({ schemaOrientation: schema?.layout?.stratify?.orientation })
  const flowConfig = React.useMemo(() => readFlowConfig({ schema, rankdir }), [rankdir, schema])
  const layoutMode = schema ? readLayoutMode(schema) : 'force'

  const { cacheKey, layoutPositionsForMode } = React.useMemo(() => {
    const layoutVariant = [
      `rd=${rankdir}`,
      `dir=${flowConfig.elk.direction}`,
      `n=${flowConfig.node.widthPx}x${flowConfig.node.heightPx}`,
      `s=${flowConfig.elk.nodeNodeSpacingPx},${flowConfig.elk.layerSpacingPx},${flowConfig.elk.edgeNodeSpacingPx}`,
      `h=${flowConfig.handle.sizePx},${flowConfig.handle.lineHeightPx}`,
    ].join('|')
    const out = determineLayoutPositions({
      mode: layoutMode,
      frontmatterMode: effectiveFrontmatter,
      semanticMode: documentSemanticMode,
      renderMode: '2d',
      renderVariant: canvas2dRenderer,
      layoutVariant,
      prevMode: null,
      prevFrontmatterMode: null,
      prevSemanticMode: null,
      prevRenderMode: null,
      nodes: Array.isArray(sceneGraphData?.nodes) ? sceneGraphData?.nodes : [],
      layoutPositionCacheByMode,
    })
    return { cacheKey: out.cacheKey, layoutPositionsForMode: out.layoutPositionsForMode }
  }, [
    canvas2dRenderer,
    documentSemanticMode,
    effectiveFrontmatter,
    flowConfig,
    layoutMode,
    layoutPositionCacheByMode,
    rankdir,
    sceneGraphData,
  ])

  const { zoomStateByKey, zoomState, setZoomStateForKey } = useGraphStore(
    useShallow(s => ({
      zoomStateByKey: s.zoomStateByKey,
      zoomState: s.zoomState,
      setZoomStateForKey: s.setZoomStateForKey,
    })),
  )

  const defaultViewport = React.useMemo(() => {
    const z = zoomStateByKey[zoomViewKey] || zoomState
    if (!z) return { x: 0, y: 0, zoom: 1 }
    const zoom = Number.isFinite(z.k) ? z.k : 1
    const x = Number.isFinite(z.x) ? z.x : 0
    const y = Number.isFinite(z.y) ? z.y : 0
    return { x, y, zoom }
  }, [zoomState, zoomStateByKey, zoomViewKey])

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])

  const lastGraphKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    let cancelled = false
    const g = sceneGraphData
    const nodeList = Array.isArray(g?.nodes) ? g?.nodes : []
    const edgeList = Array.isArray(g?.edges) ? g?.edges : []
    const graphKey = `${nodeList.length}:${edgeList.length}:${buildGraphMetaKey(g)}:${rankdir}:${flowConfig.elk.direction}:${flowConfig.node.widthPx}x${flowConfig.node.heightPx}`
    if (graphKey === lastGraphKeyRef.current && nodes.length > 0) return
    lastGraphKeyRef.current = graphKey

    const run = async () => {
      const cached = layoutPositionsForMode || null
      const computed = hasCacheCoverage({ nodes: nodeList, positions: cached, minCoverage: 0.9 })
        ? cached
        : await (async () => {
            try {
              return await buildElkLayout({
                graphData: { nodes: nodeList, edges: edgeList },
                config: flowConfig,
              })
            } catch {
              return buildDagreLayout({
                nodes: nodeList.map(n => ({ id: String(n.id) })),
                edges: edgeList.map(e => ({ source: String(e.source), target: String(e.target) })),
                rankdir,
                nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
              })
            }
          })()

      if (cancelled) return

      if (cacheKey && typeof setLayoutPositionsForMode === 'function' && computed && Object.keys(computed).length > 0) {
        setLayoutPositionsForMode(cacheKey, computed)
      }

      const handlesByNode = computeFlowHandlesByNode({
        nodes: nodeList as ReadonlyArray<{ id: unknown }>,
        edges: edgeList as ReadonlyArray<{ id: unknown; source: unknown; target: unknown }>,
      })

      const nextNodes: Node[] = nodeList
        .map(n => {
          const id = String(n.id)
          if (!id) return null
          const label = String(n.label || id)
          const p = computed ? computed[id] : null
          const x = p && Number.isFinite(p.x) ? p.x : 0
          const y = p && Number.isFinite(p.y) ? p.y : 0
          const selected =
            (selectedNodeId && String(selectedNodeId) === id) ||
            (Array.isArray(selectedNodeIds) && selectedNodeIds.some(v => String(v) === id))
          const handles = handlesByNode[id] || { in: [], out: [] }
          return {
            id,
            type: 'elk',
            position: { x, y },
            data: { label, handles, config: { node: flowConfig.node, handle: flowConfig.handle } },
            draggable: allowNodeDrag,
            selected,
          } as Node
        })
        .filter(Boolean) as Node[]

      const nextEdges: Edge[] = edgeList
        .map(e => {
          const id = String(e.id)
          const source = String(e.source)
          const target = String(e.target)
          if (!id || !source || !target) return null
          const label = e.label != null ? String(e.label) : undefined
          const selected =
            (selectedEdgeId && String(selectedEdgeId) === id) ||
            (Array.isArray(selectedEdgeIds) && selectedEdgeIds.some(v => String(v) === id))
          return {
            id,
            source,
            target,
            sourceHandle: buildFlowHandleId({ dir: 'out', edgeId: id }),
            targetHandle: buildFlowHandleId({ dir: 'in', edgeId: id }),
            label,
            type: 'smoothstep',
            animated: false,
            selected,
          } as Edge
        })
        .filter(Boolean) as Edge[]

      setNodes(nextNodes)
      setEdges(nextEdges)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    allowNodeDrag,
    cacheKey,
    flowConfig,
    layoutPositionsForMode,
    nodes.length,
    rankdir,
    sceneGraphData,
    selectedEdgeId,
    selectedEdgeIds,
    selectedNodeId,
    selectedNodeIds,
    setEdges,
    setLayoutPositionsForMode,
    setNodes,
  ])

  React.useEffect(() => {
    setNodes(prev => {
      if (!prev || prev.length === 0) return prev
      return prev.map(n => {
        const id = String(n.id)
        const selected =
          (selectedNodeId && String(selectedNodeId) === id) ||
          (Array.isArray(selectedNodeIds) && selectedNodeIds.some(v => String(v) === id))
        if (n.selected === selected) return n
        return { ...n, selected }
      })
    })
  }, [selectedNodeId, selectedNodeIds, setNodes])

  React.useEffect(() => {
    setEdges(prev => {
      if (!prev || prev.length === 0) return prev
      return prev.map(e => {
        const id = String(e.id)
        const selected =
          (selectedEdgeId && String(selectedEdgeId) === id) ||
          (Array.isArray(selectedEdgeIds) && selectedEdgeIds.some(v => String(v) === id))
        if (e.selected === selected) return e
        return { ...e, selected }
      })
    })
  }, [selectedEdgeId, selectedEdgeIds, setEdges])

  const handleNodesChange = React.useCallback(
    (changes: Parameters<typeof applyNodeChanges>[0]) => {
      if (!active) return
      onNodesChange(changes)
    },
    [active, onNodesChange],
  )

  const handleEdgesChange = React.useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) => {
      if (!active) return
      onEdgesChange(changes)
    },
    [active, onEdgesChange],
  )

  const handleNodeClick = React.useCallback((_: unknown, node: Node) => {
    const state = useGraphStore.getState()
    state.setSelectionSource('canvas')
    state.selectEdge(null)
    state.selectNode(String(node.id))
  }, [])

  const handleEdgeClick = React.useCallback((_: unknown, edge: Edge) => {
    const state = useGraphStore.getState()
    state.setSelectionSource('canvas')
    state.selectEdge(String(edge.id))
  }, [])

  const handlePaneClick = React.useCallback(() => {
    const state = useGraphStore.getState()
    state.setSelectionSource('canvas')
    state.selectNode(null)
    state.selectEdge(null)
  }, [])

  const handleNodeDragStop = React.useCallback(() => {
    if (!active) return
    if (!cacheKey || typeof setLayoutPositionsForMode !== 'function') return
    const positions: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n.id)
      if (!id) continue
      const x = n.position?.x
      const y = n.position?.y
      if (typeof x !== 'number' || typeof y !== 'number') continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      positions[id] = { x, y }
    }
    if (Object.keys(positions).length > 0) setLayoutPositionsForMode(cacheKey, positions)
  }, [active, cacheKey, nodes, setLayoutPositionsForMode])

  const handleMoveEnd = React.useCallback(
    (_: unknown, viewport: Viewport) => {
      if (!active) return
      setZoomStateForKey(zoomViewKey, {
        k: viewport.zoom,
        x: viewport.x,
        y: viewport.y,
        graphDataRevision,
        viewportW,
        viewportH,
      })
    },
    [active, graphDataRevision, setZoomStateForKey, viewportH, viewportW, zoomViewKey],
  )

  return (
    <section ref={containerRef} className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={{ elk: ElkNode }}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        nodesDraggable={allowNodeDrag}
        nodesConnectable={nodesConnectable}
        elementsSelectable
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={handleMoveEnd}
        panOnDrag={panOnDrag}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        preventScrolling
        defaultViewport={defaultViewport}
        className="bg-transparent"
      >
        <Background gap={18} size={1} />
        <Controls showInteractive={false} />
        <FlowZoomEffects active={active} zoomViewKey={zoomViewKey} />
      </ReactFlow>
    </section>
  )
}
