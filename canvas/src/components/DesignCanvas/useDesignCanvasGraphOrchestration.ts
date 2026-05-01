import React from 'react'
import { useDesignCanvasWebpageWireframe } from '@/components/DesignCanvas/webpageWireframe'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import type { DesignFramePos, DesignFrameSize } from '@/hooks/store/designRendererSlice'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import type { DesignCanvasFrameNodeRef, DesignCanvasFrameRect } from '@/components/DesignCanvas/types'
import type { DesignLayerState } from '@/features/design/designLayersState'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'

const FRAME_W = 320
const FRAME_H = 240
const EMPTY_GRAPH_NODE_BY_ID = new Map<string, GraphNode>()

type UseDesignCanvasGraphOrchestrationArgs = {
  active: boolean
  graphData: GraphData | null
  designLayerState: DesignLayerState
  designWireframeCacheEpoch: number
  designFramePosById: Record<string, DesignFramePos>
  designFrameSizeById: Record<string, DesignFrameSize>
  documentSemanticMode: string
  frontmatterModeEnabled: boolean
  markdownDocumentName: string | null
  markdownDocumentText: string
  viewportW: number
  viewportH: number
  setDesignRendererNodes: (nodes: DesignCanvasFrameNodeRef[]) => void
  setDesignRendererWebpageGraph: (next: { key: string | null; nodesById: Record<string, GraphNode> }) => void
}

function buildFrameNodeRefs(graphNodes: GraphNode[]): DesignCanvasFrameNodeRef[] {
  const out: DesignCanvasFrameNodeRef[] = []
  for (let i = 0; i < graphNodes.length; i += 1) {
    const node = graphNodes[i] as GraphNode
    const id = String(node.id || '').trim()
    if (!id) continue
    const props = (node.properties || {}) as Record<string, unknown>
    const visualLabel = typeof props['visual:label'] === 'string' ? String(props['visual:label'] || '').trim() : ''
    const label = visualLabel || String(node.label || id).trim() || id
    out.push({ id, label, ...(node.type ? { type: String(node.type) } : {}) })
  }
  return out
}

function buildWebpageFrameNodeRefs(graphNodes: GraphNode[]): DesignCanvasFrameNodeRef[] {
  const out: DesignCanvasFrameNodeRef[] = []
  for (let i = 0; i < graphNodes.length; i += 1) {
    const node = graphNodes[i] as GraphNode
    const props = (node.properties || {}) as Record<string, unknown>
    const tag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag'] || '').trim() : ''
    const domClass = typeof props['dom:attrs:class'] === 'string' ? String(props['dom:attrs:class'] || '').trim() : ''
    const isSynthSection = tag.toUpperCase() === 'SECTION' && domClass.includes('kg-synth-section')
    const id = String(node.id || '').trim()
    if (!id || isSynthSection) continue
    const visualLabel = typeof props['visual:label'] === 'string' ? String(props['visual:label'] || '').trim() : ''
    const label = visualLabel || String(node.label || node.id || '').trim() || id
    out.push({ id, label, ...(tag ? { type: tag } : {}) })
  }
  return out
}

function applyRectOverride(args: {
  id: string
  baseX: number
  baseY: number
  baseW: number
  baseH: number
  posOverrides: Record<string, DesignFramePos>
  sizeOverrides: Record<string, DesignFrameSize>
}): DesignCanvasFrameRect {
  const { id, baseX, baseY, baseW, baseH, posOverrides, sizeOverrides } = args
  const sizeOverride = sizeOverrides[id]
  const w = sizeOverride && Number.isFinite(sizeOverride.w) ? Math.max(24, sizeOverride.w) : baseW
  const h = sizeOverride && Number.isFinite(sizeOverride.h) ? Math.max(18, sizeOverride.h) : baseH
  const posOverride = posOverrides[id]
  if (posOverride && Number.isFinite(posOverride.x) && Number.isFinite(posOverride.y)) {
    return { x: posOverride.x, y: posOverride.y, w, h }
  }
  return { x: baseX, y: baseY, w, h }
}

export function useDesignCanvasGraphOrchestration(args: UseDesignCanvasGraphOrchestrationArgs) {
  const {
    active,
    graphData,
    designLayerState,
    designWireframeCacheEpoch,
    designFramePosById,
    designFrameSizeById,
    documentSemanticMode,
    frontmatterModeEnabled,
    markdownDocumentName,
    markdownDocumentText,
    viewportW,
    viewportH,
    setDesignRendererNodes,
    setDesignRendererWebpageGraph,
  } = args

  const activeRenderGraphData = useActiveGraphRenderData(active)

  const designGraphDataForDisplay = React.useMemo(() => {
    const graph = (activeRenderGraphData || graphData) as GraphData | null
    if (!graph) return null
    return deriveSceneDisplayGraph({ graphData: graph })?.displayGraphData || graph
  }, [activeRenderGraphData, graphData])

  const {
    documentUrl,
    webpageFrontmatter,
    webpageWorkspacePath,
    webpageLayout,
    webpageLayoutStatus,
    setWebpageLayoutStatus,
    setWebpageStatusUi,
    webpageStatusStore,
    activeWebpageLayoutGraphData,
    webpageLayoutKey,
    webpageGraphNodesById,
    decreaseWebpageFidelity,
    increaseWebpageFidelity,
    retryWebpageLayout,
  } = useDesignCanvasWebpageWireframe({
    active,
    graphData,
    activeRenderGraphData: activeRenderGraphData as GraphData | null,
    designWireframeCacheEpoch,
    documentSemanticMode,
    frontmatterModeEnabled,
    markdownDocumentName,
    markdownDocumentText,
    setDesignRendererWebpageGraph,
  })
  const designGraphLookup = React.useMemo(() => {
    return getCachedGraphLookup({
      cacheScope: 'design-canvas-orchestration-display-graph',
      graphData: designGraphDataForDisplay,
    })
  }, [designGraphDataForDisplay])
  const designGraphNodeById = designGraphLookup?.nodeById || EMPTY_GRAPH_NODE_BY_ID
  const activeWebpageLayoutLookup = React.useMemo(() => {
    return getCachedGraphLookup({
      cacheScope: 'design-canvas-orchestration-webpage-layout-graph',
      graphData: activeWebpageLayoutGraphData,
    })
  }, [activeWebpageLayoutGraphData])
  const activeWebpageLayoutNodeById = activeWebpageLayoutLookup?.nodeById || EMPTY_GRAPH_NODE_BY_ID

  const baseFrameNodes = React.useMemo(() => {
    if (activeWebpageLayoutGraphData?.nodes && activeWebpageLayoutGraphData.nodes.length > 0) {
      return buildWebpageFrameNodeRefs(activeWebpageLayoutGraphData.nodes as GraphNode[])
    }
    if (documentUrl) {
      if (webpageLayoutStatus === 'loading') return [{ id: 'kg:webpage:loading', label: 'Loading webpage wireframe…', type: 'Webpage' }]
      if (webpageLayoutStatus === 'error') return [{ id: 'kg:webpage:error', label: 'Webpage export failed — click Retry', type: 'Webpage' }]
      return [{ id: 'kg:webpage:idle', label: 'Preparing webpage wireframe…', type: 'Webpage' }]
    }
    if (designGraphDataForDisplay?.nodes && designGraphDataForDisplay.nodes.length > 0) {
      return buildFrameNodeRefs(designGraphDataForDisplay.nodes as GraphNode[])
    }
    return [] as DesignCanvasFrameNodeRef[]
  }, [activeWebpageLayoutGraphData, designGraphDataForDisplay?.nodes, documentUrl, webpageLayoutStatus])

  const sortedNodes = React.useMemo(() => {
    const order = Array.isArray(designLayerState?.order) ? designLayerState.order : []
    if (order.length === 0) return baseFrameNodes
    const byId = new Map(baseFrameNodes.map(node => [node.id, node] as const))
    const used = new Set<string>()
    const out: DesignCanvasFrameNodeRef[] = []
    for (let i = 0; i < order.length; i += 1) {
      const id = String(order[i] || '').trim()
      if (!id || used.has(id)) continue
      const node = byId.get(id)
      if (!node) continue
      used.add(id)
      out.push(node)
    }
    for (let i = 0; i < baseFrameNodes.length; i += 1) {
      const node = baseFrameNodes[i]
      if (!used.has(node.id)) out.push(node)
    }
    return out
  }, [baseFrameNodes, designLayerState])

  const visibleNodes = React.useMemo(() => {
    const hidden = designLayerState?.hiddenById || {}
    return sortedNodes.filter(node => hidden[node.id] !== true)
  }, [designLayerState?.hiddenById, sortedNodes])

  const layersPanelNodes = React.useMemo(() => {
    const out = baseFrameNodes.slice()
    out.sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id) || a.id.localeCompare(b.id))
    return out
  }, [baseFrameNodes])

  React.useEffect(() => {
    if (!active) {
      setDesignRendererNodes([])
      return
    }
    setDesignRendererNodes(layersPanelNodes)
  }, [active, layersPanelNodes, setDesignRendererNodes])

  const positions = React.useMemo(() => {
    const posOverrides = designFramePosById || {}
    const sizeOverrides = designFrameSizeById || {}
    const out: Record<string, DesignCanvasFrameRect> = {}

    if (activeWebpageLayoutGraphData?.nodes && activeWebpageLayoutGraphData.nodes.length > 0) {
      for (let i = 0; i < visibleNodes.length; i += 1) {
        const node = visibleNodes[i]
        const base = activeWebpageLayoutNodeById.get(node.id)
        if (!base) continue
        const props = (base.properties || {}) as Record<string, unknown>
        const baseW = typeof props['visual:width'] === 'number' ? (props['visual:width'] as number) : FRAME_W
        const baseH = typeof props['visual:height'] === 'number' ? (props['visual:height'] as number) : FRAME_H
        const cx = typeof base.x === 'number' && Number.isFinite(base.x) ? base.x : 0
        const cy = typeof base.y === 'number' && Number.isFinite(base.y) ? base.y : 0
        out[node.id] = applyRectOverride({
          id: node.id,
          baseX: cx - baseW / 2,
          baseY: cy - baseH / 2,
          baseW,
          baseH,
          posOverrides,
          sizeOverrides,
        })
      }
      return out
    }

    if (documentUrl && visibleNodes.length > 0) {
      const baseW = Math.max(360, Math.min(920, Math.floor(viewportW * 0.72)))
      const baseH = Math.max(220, Math.min(640, Math.floor(viewportH * 0.5)))
      for (let i = 0; i < visibleNodes.length; i += 1) {
        const node = visibleNodes[i]
        out[node.id] = applyRectOverride({
          id: node.id,
          baseX: -baseW / 2,
          baseY: -baseH / 2,
          baseW,
          baseH,
          posOverrides,
          sizeOverrides,
        })
      }
      return out
    }

    for (let i = 0; i < visibleNodes.length; i += 1) {
      const node = visibleNodes[i]
      const base = designGraphNodeById.get(node.id)
      if (!base) continue
      const props = (base.properties || {}) as Record<string, unknown>
      const baseW = typeof props['visual:width'] === 'number' ? (props['visual:width'] as number) : FRAME_W
      const baseH = typeof props['visual:height'] === 'number' ? (props['visual:height'] as number) : FRAME_H
      const cx = typeof base.x === 'number' && Number.isFinite(base.x) ? base.x : 0
      const cy = typeof base.y === 'number' && Number.isFinite(base.y) ? base.y : 0
      out[node.id] = applyRectOverride({
        id: node.id,
        baseX: cx - baseW / 2,
        baseY: cy - baseH / 2,
        baseW,
        baseH,
        posOverrides,
        sizeOverrides,
      })
    }
    return out
  }, [
    activeWebpageLayoutGraphData,
    activeWebpageLayoutNodeById,
    designFramePosById,
    designFrameSizeById,
    designGraphNodeById,
    documentUrl,
    viewportH,
    viewportW,
    visibleNodes,
  ])

  const localGraphData = React.useMemo(() => {
    if (activeWebpageLayoutGraphData?.nodes && activeWebpageLayoutGraphData.nodes.length > 0) {
      return {
        type: 'Graph',
        context: activeWebpageLayoutGraphData.context,
        nodes: visibleNodes.map(node => {
          const base = activeWebpageLayoutNodeById.get(node.id)
          const position = positions[node.id]
          if (!base || !position) return { id: node.id, label: node.label, type: 'Frame', properties: {}, x: 0, y: 0 }
          const props = (base.properties || {}) as Record<string, unknown>
          const width = typeof props['visual:width'] === 'number' ? (props['visual:width'] as number) : position.w
          const height = typeof props['visual:height'] === 'number' ? (props['visual:height'] as number) : position.h
          return {
            ...base,
            properties: {
              ...props,
              'visual:width': width,
              'visual:height': height,
              'visual:shape': 'rect',
            },
            x: position.x + position.w / 2,
            y: position.y + position.h / 2,
          }
        }),
        edges: [],
        metadata: activeWebpageLayoutGraphData.metadata,
      } as GraphData
    }

    const fallbackNodes = Array.isArray(designGraphDataForDisplay?.nodes) ? (designGraphDataForDisplay.nodes as GraphNode[]) : []
    const fallbackEdges = Array.isArray(designGraphDataForDisplay?.edges) ? (designGraphDataForDisplay.edges as GraphEdge[]) : []
    const visibleNodeIdSet = new Set(visibleNodes.map(node => String(node.id || '').trim()).filter(Boolean))
    const nodes = fallbackNodes
      .filter(node => visibleNodeIdSet.has(String(node?.id || '').trim()))
      .map(node => {
        const id = String(node?.id || '').trim()
        const position = positions[id]
        if (!position) return node
        const props = (node.properties || {}) as Record<string, unknown>
        return {
          ...node,
          properties: {
            ...props,
            'visual:width': typeof props['visual:width'] === 'number' ? props['visual:width'] : position.w,
            'visual:height': typeof props['visual:height'] === 'number' ? props['visual:height'] : position.h,
          },
          x: position.x + position.w / 2,
          y: position.y + position.h / 2,
        }
      })
    const nodeIdSet = new Set(nodes.map(node => String(node?.id || '').trim()).filter(Boolean))
    const edges = fallbackEdges.filter(edge => nodeIdSet.has(String(edge?.source || '').trim()) && nodeIdSet.has(String(edge?.target || '').trim()))
    return {
      type: 'Graph',
      context: designGraphDataForDisplay?.context,
      nodes,
      edges,
      metadata: designGraphDataForDisplay?.metadata || graphData?.metadata,
    } as GraphData
  }, [activeWebpageLayoutGraphData, activeWebpageLayoutNodeById, designGraphDataForDisplay, graphData?.metadata, positions, visibleNodes])

  return {
    documentUrl,
    webpageFrontmatter,
    webpageWorkspacePath,
    webpageLayout,
    webpageLayoutStatus,
    setWebpageLayoutStatus,
    setWebpageStatusUi,
    webpageStatusStore,
    activeWebpageLayoutGraphData,
    webpageLayoutKey,
    webpageGraphNodesById,
    decreaseWebpageFidelity,
    increaseWebpageFidelity,
    retryWebpageLayout,
    designGraphDataForDisplay,
    visibleNodes,
    designGraphNodeById,
    positions,
    localGraphData,
  }
}
