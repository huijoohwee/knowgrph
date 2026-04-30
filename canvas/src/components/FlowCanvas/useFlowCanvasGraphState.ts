import React from 'react'

import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { computeEffectiveFrontmatterMode, isFlowEditorFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'
import { resolveGraphNodeByCanonicalId, isCanonicalNodeIdEqual } from '@/lib/graph/canonicalNodeIds'
import { buildPanelOnlyNodeIdSetFromGraphNodes } from '@/lib/render/markdownPanelOverlayPool'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { applyConnectedValuesToNodeForRender } from '@/lib/render/effectiveMediaNode'
import {
  isRichMediaPanelNode,
  listDisplayRichMediaOverlayNodes,
} from '@/lib/render/richMediaSsot'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { pickGraphDataForFlowRenderer } from '@/components/FlowCanvas/shared'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

type UseFlowCanvasGraphStateArgs = {
  graphDataOverride: GraphData | null | undefined
  graphDataRevisionOverride?: number
  storeGraphData: GraphData | null
  baseGraphDataRevision: number
  selectedNodeId: string | null
  selectedNodeIds: string[]
  frontmatterModeEnabled: boolean
  documentSemanticMode: 'document' | 'keyword'
  documentStructureBaselineLock: boolean
  allowNodeDragOverride?: boolean
  canvas2dRenderer: string
  renderMediaAsNodes: boolean
  infiniteCanvasInteractionMode: 'static' | 'interactive'
  excludeRichMediaOverlayNodeIds?: string[]
  openWidgetNodeIds: string[]
  widgetRegistry: WidgetRegistryEntry[]
  baseWidgetRegistry: WidgetRegistryEntry[]
  documentWidgetRegistry: WidgetRegistryEntry[]
  threeIframeOverlayPoolMax?: number
}

export function useFlowCanvasGraphState(args: UseFlowCanvasGraphStateArgs) {
  const {
    graphDataOverride,
    graphDataRevisionOverride,
    storeGraphData,
    baseGraphDataRevision,
    selectedNodeId,
    selectedNodeIds,
    frontmatterModeEnabled,
    documentSemanticMode,
    documentStructureBaselineLock,
    allowNodeDragOverride,
    canvas2dRenderer,
    renderMediaAsNodes,
    excludeRichMediaOverlayNodeIds,
    openWidgetNodeIds,
    widgetRegistry,
    baseWidgetRegistry,
    documentWidgetRegistry,
    threeIframeOverlayPoolMax,
  } = args

  const graphDataRevision = typeof graphDataRevisionOverride === 'number' ? graphDataRevisionOverride : baseGraphDataRevision
  const renderGraphData = graphDataOverride !== undefined ? graphDataOverride : storeGraphData
  const allowMutations = allowNodeDragOverride !== false && documentStructureBaselineLock !== true
  const effectiveFrontmatter = React.useMemo(() => {
    return computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      documentSemanticMode,
      graphData: renderGraphData,
    })
  }, [documentSemanticMode, frontmatterModeEnabled, renderGraphData])
  const flowEditorFrontmatterInteractionMode = isFlowEditorFrontmatterDocumentModeRequested({
    canvas2dRenderer: String(canvas2dRenderer || ''),
    frontmatterModeEnabled: frontmatterModeEnabled === true,
    documentSemanticMode: String(documentSemanticMode || ''),
  })
  const flowEditorOverlayInteractionMode = canvas2dRenderer === 'flowEditor'

  const clonedGraphData = React.useMemo(() => {
    if (!renderGraphData) return null
    return cloneGraphDataForRender(renderGraphData) as GraphData
  }, [renderGraphData])

  const filteredGraphDataForRenderer = React.useMemo(() => {
    return pickGraphDataForFlowRenderer({ graphData: clonedGraphData, effectiveFrontmatter })
  }, [clonedGraphData, effectiveFrontmatter])

  const sceneDisplayGraphDerivation = React.useMemo(() => {
    if (!filteredGraphDataForRenderer) return null
    return deriveSceneDisplayGraph({ graphData: filteredGraphDataForRenderer })
  }, [filteredGraphDataForRenderer])

  const sceneGraphData = React.useMemo(() => {
    if (!filteredGraphDataForRenderer) return null
    return sceneDisplayGraphDerivation?.displayGraphData || filteredGraphDataForRenderer
  }, [filteredGraphDataForRenderer, sceneDisplayGraphDerivation])

  const selectedOverlayNodeIds = React.useMemo(() => {
    const nodeIdSet = new Set<string>((selectedNodeIds || []).map(v => String(v)))
    if (selectedNodeId) nodeIdSet.add(String(selectedNodeId))
    return Array.from(nodeIdSet)
      .map(rawId => {
        const resolved = resolveGraphNodeByCanonicalId(sceneGraphData, rawId)
        return String(resolved?.id || rawId || '').trim()
      })
      .filter(Boolean)
  }, [sceneGraphData, selectedNodeId, selectedNodeIds])

  const panelOnlyNodeIdSet = React.useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as GraphNode[]) : []
    if (nodes.length === 0) return null
    const set = buildPanelOnlyNodeIdSetFromGraphNodes(nodes)
    return set.size > 0 ? set : null
  }, [sceneGraphData])

  const mediaRenderConnectedValuesByNodeId = React.useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as GraphNode[]) : []
    if (nodes.length === 0) return new Map()
    const targetNodeIds = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const id = String(node?.id || '').trim()
      if (!id) continue
      if (isRichMediaPanelNode(node)) targetNodeIds.add(id)
      else if (getNodeMediaSpec(node)) targetNodeIds.add(id)
    }
    if (targetNodeIds.size === 0) return new Map()
    const dataflowRegistry = buildDataflowWidgetRegistry({
      documentWidgetRegistry,
      effectiveWidgetRegistry: widgetRegistry,
      widgetRegistry: baseWidgetRegistry,
    })
    return computeFlowConnectedValuesBySchemaPath({
      graphData: sceneGraphData,
      registry: dataflowRegistry,
      targetNodeIds,
    })
  }, [baseWidgetRegistry, documentWidgetRegistry, sceneGraphData, widgetRegistry])

  const mediaRenderNodes = React.useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as GraphNode[]) : []
    if (nodes.length === 0) return nodes
    return nodes.map(node => {
      const nodeId = String(node?.id || '').trim()
      return applyConnectedValuesToNodeForRender({
        node,
        connectedValuesBySchemaPath: nodeId ? mediaRenderConnectedValuesByNodeId.get(nodeId) || undefined : undefined,
      })
    })
  }, [mediaRenderConnectedValuesByNodeId, sceneGraphData])

  const flowEditorRichMediaPanelOverlayExcludeNodeIdSet = React.useMemo(() => {
    if (canvas2dRenderer !== 'flowEditor') return undefined
    const candidateRawIds = [
      ...(Array.isArray(openWidgetNodeIds) ? openWidgetNodeIds : []),
      ...(Array.isArray(excludeRichMediaOverlayNodeIds) ? excludeRichMediaOverlayNodeIds : []),
    ]
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as GraphNode[]) : []
    if (nodes.length === 0) return undefined
    const nodeById = new Map<string, GraphNode>()
    const out = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]!
      const id = String(node?.id || '').trim()
      if (!id) continue
      nodeById.set(id, node)
      if (isRichMediaPanelNode(node)) out.add(id)
    }
    for (let i = 0; i < candidateRawIds.length; i += 1) {
      const rawId = candidateRawIds[i]
      const id = String(resolveGraphNodeByCanonicalId(sceneGraphData, rawId)?.id || rawId || '').trim()
      if (!id || !isRichMediaPanelNode(nodeById.get(id))) continue
      out.add(id)
    }
    return out.size > 0 ? out : undefined
  }, [canvas2dRenderer, excludeRichMediaOverlayNodeIds, openWidgetNodeIds, sceneGraphData])

  const stickyOverlayNodeByIdRef = React.useRef(new Map<string, ReturnType<typeof listDisplayRichMediaOverlayNodes>[number]>())
  const stickyOverlayOrderRef = React.useRef<string[]>([])
  const useStickyOverlayPool = !flowEditorOverlayInteractionMode && !flowEditorFrontmatterInteractionMode

  const mediaNodes = React.useMemo(() => {
    const nodes = mediaRenderNodes
    const poolMaxRaw = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    const suggested = listDisplayRichMediaOverlayNodes({
      renderMediaAsNodes,
      nodes,
      poolMax,
      excludeNodeIdSet: flowEditorRichMediaPanelOverlayExcludeNodeIdSet,
      connectedValuesByNodeId: mediaRenderConnectedValuesByNodeId,
    })
    if (!useStickyOverlayPool) {
      const stickyMap = stickyOverlayNodeByIdRef.current
      stickyMap.clear()
      for (let i = 0; i < suggested.length; i += 1) stickyMap.set(suggested[i]!.id, suggested[i]!)
      stickyOverlayOrderRef.current = suggested.map(node => String(node.id || '').trim()).filter(Boolean)
      return suggested
    }

    const prevOrder = stickyOverlayOrderRef.current
    const stickyMap = stickyOverlayNodeByIdRef.current
    for (let i = 0; i < suggested.length; i += 1) stickyMap.set(suggested[i]!.id, suggested[i]!)

    const needed = new Set<string>(prevOrder)
    for (let i = 0; i < suggested.length; i += 1) needed.add(String(suggested[i]!.id || '').trim())
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]!
      const id = String(node?.id || '').trim()
      if (id && needed.has(id)) nodeById.set(id, node)
    }
    const isValid = (id: string) => {
      const key = String(id || '').trim()
      if (!key) return false
      const node = nodeById.get(key)
      return !!node && !!getNodeMediaSpec(node)
    }

    const nextIds: string[] = []
    const pushId = (id: string) => {
      if (!id || nextIds.length >= poolMax || nextIds.includes(id) || !stickyMap.has(id) || !isValid(id)) return
      nextIds.push(id)
    }
    for (let i = 0; i < prevOrder.length; i += 1) pushId(String(prevOrder[i] || '').trim())
    for (let i = 0; i < suggested.length; i += 1) {
      const id = String(suggested[i]!.id || '').trim()
      if (!id || nextIds.length >= poolMax || nextIds.includes(id)) continue
      nextIds.push(id)
    }

    stickyOverlayOrderRef.current = nextIds
    const out = nextIds.map(id => stickyMap.get(id)).filter(Boolean) as typeof suggested
    if (stickyMap.size > Math.max(96, poolMax * 6)) {
      const keep = new Set<string>(nextIds)
      for (let i = 0; i < suggested.length; i += 1) keep.add(String(suggested[i]!.id || ''))
      for (const [id] of stickyMap) {
        if (!keep.has(id)) stickyMap.delete(id)
      }
    }
    return out
  }, [
    flowEditorRichMediaPanelOverlayExcludeNodeIdSet,
    mediaRenderConnectedValuesByNodeId,
    mediaRenderNodes,
    renderMediaAsNodes,
    threeIframeOverlayPoolMax,
    useStickyOverlayPool,
  ])

  const selectedOverlayNodeIdSet = React.useMemo(() => {
    const out = new Set<string>()
    for (let i = 0; i < mediaNodes.length; i += 1) {
      const id = String(mediaNodes[i]?.id || '').trim()
      if (!id) continue
      if (selectedOverlayNodeIds.some(selectedId => isCanonicalNodeIdEqual(selectedId, id))) out.add(id)
    }
    return out
  }, [mediaNodes, selectedOverlayNodeIds])

  return {
    graphDataRevision,
    renderGraphData,
    allowMutations,
    effectiveFrontmatter,
    flowEditorFrontmatterInteractionMode,
    flowEditorOverlayInteractionMode,
    filteredGraphDataForRenderer,
    sceneGraphData,
    panelOnlyNodeIdSet,
    mediaNodes,
    selectedOverlayNodeIds,
    selectedOverlayNodeIdSet,
  }
}
