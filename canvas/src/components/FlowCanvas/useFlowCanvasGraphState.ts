import React from 'react'

import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { computeEffectiveFrontmatterMode, isFlowEditorFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'
import {
  buildCanonicalNodeIdSet,
  buildCanonicalNodeLookup,
  getCanonicalNodeLookupValue,
} from '@/lib/graph/canonicalNodeIds'
import { buildPanelOnlyNodeIdSetFromGraphNodes } from '@/lib/render/markdownPanelOverlayPool'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { applyConnectedValuesToNodeForRender } from '@/lib/render/effectiveMediaNode'
import {
  buildRichMediaConnectedValueTargetNodeIdSet,
  buildRichMediaPanelOverlayExcludeNodeIdSet,
  isRichMediaConnectedValueTargetNode,
  listDisplayRichMediaOverlayNodes,
} from '@/lib/render/richMediaSsot'
import { pickGraphDataForFlowRenderer } from '@/components/FlowCanvas/shared'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { hashScopedStringArraySignature, normalizeStringArrayForSignature } from '@/lib/hash/signature'

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

  const panelOnlyNodeIdSet = React.useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as GraphNode[]) : []
    if (nodes.length === 0) return null
    const set = buildPanelOnlyNodeIdSetFromGraphNodes(nodes)
    return set.size > 0 ? set : null
  }, [sceneGraphData])

  const mediaRenderConnectedValuesByNodeId = React.useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as GraphNode[]) : []
    if (nodes.length === 0) return new Map()
    const targetNodeIds = buildRichMediaConnectedValueTargetNodeIdSet({
      nodes,
      includeMediaSpecNodes: true,
    })
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
      graphRevision: graphDataRevision,
    })
  }, [baseWidgetRegistry, documentWidgetRegistry, graphDataRevision, sceneGraphData, widgetRegistry])

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
  const sceneGraphLookup = React.useMemo(() => {
    return getCachedGraphLookup({
      cacheScope: 'flow-canvas-scene-graph',
      graphData: sceneGraphData,
      graphRevision: graphDataRevision,
    })
  }, [graphDataRevision, sceneGraphData])
  const sceneGraphNodeById = sceneGraphLookup?.nodeById || null
  const sceneGraphCanonicalNodeById = React.useMemo(() => {
    if (!sceneGraphNodeById || sceneGraphNodeById.size === 0) return null
    return buildCanonicalNodeLookup(sceneGraphNodeById.entries())
  }, [sceneGraphNodeById])
  const selectedNodeIdsKey = React.useMemo(
    () => hashScopedStringArraySignature('flow-selected-node-ids', selectedNodeIds),
    [selectedNodeIds],
  )
  const selectedNodeIdsSnapshotRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (selectedNodeIdsSnapshotRef.current?.key !== selectedNodeIdsKey) {
    selectedNodeIdsSnapshotRef.current = {
      key: selectedNodeIdsKey,
      value: normalizeStringArrayForSignature(selectedNodeIds),
    }
  }
  const selectedNodeIdsSnapshot = selectedNodeIdsSnapshotRef.current?.value || []
  const openWidgetNodeIdsKey = React.useMemo(
    () => hashScopedStringArraySignature('flow-open-widget-node-ids', openWidgetNodeIds),
    [openWidgetNodeIds],
  )
  const openWidgetNodeIdsSnapshotRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (openWidgetNodeIdsSnapshotRef.current?.key !== openWidgetNodeIdsKey) {
    openWidgetNodeIdsSnapshotRef.current = {
      key: openWidgetNodeIdsKey,
      value: normalizeStringArrayForSignature(openWidgetNodeIds),
    }
  }
  const openWidgetNodeIdsSnapshot = openWidgetNodeIdsSnapshotRef.current?.value || []
  const excludeRichMediaOverlayNodeIdsKey = React.useMemo(
    () => hashScopedStringArraySignature('flow-exclude-rich-media-overlay-node-ids', excludeRichMediaOverlayNodeIds),
    [excludeRichMediaOverlayNodeIds],
  )
  const excludeRichMediaOverlayNodeIdsSnapshotRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (excludeRichMediaOverlayNodeIdsSnapshotRef.current?.key !== excludeRichMediaOverlayNodeIdsKey) {
    excludeRichMediaOverlayNodeIdsSnapshotRef.current = {
      key: excludeRichMediaOverlayNodeIdsKey,
      value: normalizeStringArrayForSignature(excludeRichMediaOverlayNodeIds),
    }
  }
  const excludeRichMediaOverlayNodeIdsSnapshot = excludeRichMediaOverlayNodeIdsSnapshotRef.current?.value || []
  const selectedOverlayNodeIds = React.useMemo(() => {
    const nodeIdSet = new Set<string>(selectedNodeIdsSnapshot)
    if (selectedNodeId) nodeIdSet.add(String(selectedNodeId))
    return Array.from(nodeIdSet)
      .map(rawId => {
        const resolved = getCanonicalNodeLookupValue(sceneGraphCanonicalNodeById, rawId)
        return String(resolved?.id || rawId || '').trim()
      })
      .filter(Boolean)
  }, [sceneGraphCanonicalNodeById, selectedNodeId, selectedNodeIdsSnapshot])

  const flowEditorRichMediaPanelOverlayExcludeNodeIdSet = React.useMemo(() => {
    if (canvas2dRenderer !== 'flowEditor') return undefined
    const excludeAllRichMediaPanelNodes = !flowEditorFrontmatterInteractionMode
    const candidateRawIds = [
      ...openWidgetNodeIdsSnapshot,
      ...excludeRichMediaOverlayNodeIdsSnapshot,
    ]
    const out = buildRichMediaPanelOverlayExcludeNodeIdSet({
      graphData: sceneGraphData,
      nodeById: sceneGraphNodeById || undefined,
      candidateRawIds,
      excludeAllRichMediaPanelNodes,
    })
    return out.size > 0 ? out : undefined
  }, [
    canvas2dRenderer,
    excludeRichMediaOverlayNodeIdsSnapshot,
    flowEditorFrontmatterInteractionMode,
    openWidgetNodeIdsSnapshot,
    sceneGraphData,
    sceneGraphNodeById,
  ])

  const stickyOverlayNodeByIdRef = React.useRef(new Map<string, ReturnType<typeof listDisplayRichMediaOverlayNodes>[number]>())
  const stickyOverlayOrderRef = React.useRef<string[]>([])
  const useStickyOverlayPool = !flowEditorOverlayInteractionMode && !flowEditorFrontmatterInteractionMode

  const mediaNodes = React.useMemo(() => {
    const nodes = mediaRenderNodes
    const poolMaxRaw = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    const suggested = listDisplayRichMediaOverlayNodes({
      renderMediaAsNodes,
      canvas2dRenderer,
      frontmatterModeEnabled,
      documentSemanticMode,
      nodes,
      poolMax,
      excludeNodeIdSet: flowEditorRichMediaPanelOverlayExcludeNodeIdSet,
      connectedValuesByNodeId: mediaRenderConnectedValuesByNodeId,
      nodeById: sceneGraphNodeById || undefined,
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
    const isValid = (id: string) => {
      const key = String(id || '').trim()
      if (!key) return false
      if (!needed.has(key)) return false
      const node = sceneGraphNodeById?.get(key)
      return isRichMediaConnectedValueTargetNode({ node, includeMediaSpecNodes: true })
    }

    const nextIds: string[] = []
    const nextIdSet = new Set<string>()
    const pushId = (id: string) => {
      if (!id || nextIds.length >= poolMax || nextIdSet.has(id) || !stickyMap.has(id) || !isValid(id)) return
      nextIds.push(id)
      nextIdSet.add(id)
    }
    for (let i = 0; i < prevOrder.length; i += 1) pushId(String(prevOrder[i] || '').trim())
    for (let i = 0; i < suggested.length; i += 1) {
      const id = String(suggested[i]!.id || '').trim()
      if (!id || nextIds.length >= poolMax || nextIdSet.has(id)) continue
      nextIds.push(id)
      nextIdSet.add(id)
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
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    threeIframeOverlayPoolMax,
    useStickyOverlayPool,
    sceneGraphNodeById,
  ])

  const selectedOverlayNodeIdSet = React.useMemo(() => {
    return buildCanonicalNodeIdSet(selectedOverlayNodeIds)
  }, [selectedOverlayNodeIds])

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
