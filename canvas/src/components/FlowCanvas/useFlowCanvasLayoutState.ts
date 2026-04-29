import React from 'react'

import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/components/GraphCanvas/layout/positioning'
import { coerceNodesForFit, fitAllTransform } from '@/components/GraphCanvas/fit'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import { readFrontmatterFlowRenderSettings } from '@/lib/graph/frontmatterFlowSettings'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { normalizeRichMediaPanelDensity } from '@/lib/render/richMediaSsot'
import { computeMediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'
import { resolveActiveDocumentViewMode } from '@/lib/graph/documentViewMode'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveRankdir, buildGraphMetaKeyIgnoringPending } from '@/components/FlowCanvas/layout'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import { readFlowPresentation } from '@/components/FlowCanvas/presentation'
import { useFlowComputedPositions } from '@/components/FlowCanvas/useFlowComputedPositions'
import { fitFlowEditorPinnedWidgets } from '@/components/FlowCanvas/fitPinnedWidgets'
import { placeFlowFallbackSeedPositions } from '@/components/FlowCanvas/seedFallbackPositions'
import { isFlowTransformShowingGraph } from '@/components/FlowCanvas/transformGuards'
import { computeWidgetScale, WIDGET_BASE_SIZE } from '@/components/FlowEditor/widgetZoom'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'

type UseFlowCanvasLayoutStateArgs = {
  active: boolean
  graphDataRevision: number
  sceneGraphData: GraphData | null
  filteredGraphDataForRenderer: GraphData | null
  effectiveFrontmatter: boolean
  canvasRenderMode: '2d' | '3d'
  canvas2dRenderer: string
  documentSemanticMode: 'document' | 'keyword'
  documentStructureBaselineLock: boolean
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  collapsedGroupIds: string[]
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  mediaNodes: Array<{ id: string }>
  schema: GraphSchema | null
  widgetRegistry: unknown[]
  setLayoutPositionsForMode?: (cacheKey: string, positions: Record<string, { x: number; y: number }>) => void
  threeIframeOverlayBaseWidthRatioDefault?: number
  threeIframeOverlayBaseWidthRatioCompact?: number
  threeIframeOverlayBaseWidthMinPxDefault?: number
  threeIframeOverlayBaseWidthMinPxCompact?: number
  threeIframeOverlayBaseWidthMaxPxDefault?: number
  threeIframeOverlayBaseWidthMaxPxCompact?: number
  openWidgetNodeIds: string[]
  flowWidgetPinnedByNodeId: Record<string, boolean>
  flowWidgetWorldPosByNodeId: Record<string, { x: number; y: number }>
  viewportW: number
  viewportH: number
}

export function useFlowCanvasLayoutState(args: UseFlowCanvasLayoutStateArgs) {
  const {
    active,
    graphDataRevision,
    sceneGraphData,
    filteredGraphDataForRenderer,
    effectiveFrontmatter,
    canvasRenderMode,
    canvas2dRenderer,
    documentSemanticMode,
    documentStructureBaselineLock,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    collapsedGroupIds,
    renderMediaAsNodes,
    mediaPanelDensity,
    mediaNodes,
    schema,
    widgetRegistry,
    setLayoutPositionsForMode,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    openWidgetNodeIds,
    flowWidgetPinnedByNodeId,
    flowWidgetWorldPosByNodeId,
    viewportW,
    viewportH,
  } = args

  const schemaLayoutEngineJson = React.useMemo(() => buildSchemaLayoutEngineJson2d(schema), [schema])
  const collapsedGroupIdsKey = React.useMemo(() => buildCollapsedGroupIdsKey(collapsedGroupIds), [collapsedGroupIds])
  const frontmatterFlowRenderSettings = React.useMemo(() => readFrontmatterFlowRenderSettings(sceneGraphData), [sceneGraphData])

  const layoutMode = schema ? readLayoutMode(schema) : 'radial'
  const rankdir =
    layoutMode === 'block'
      ? 'LR'
      : frontmatterFlowRenderSettings?.rankdir || deriveRankdir({ flowRankdir: schema?.layout?.flow?.rankdir })
  const flowConfig = React.useMemo(() => readFlowConfig({ schema, rankdir }), [rankdir, schema])
  const flowConfigEffective = React.useMemo(() => {
    if (documentSemanticMode !== 'keyword') return flowConfig
    const explicitElkLayout = schema?.layout?.flow?.elkLayout
    if (typeof explicitElkLayout === 'string' && explicitElkLayout.trim()) return flowConfig
    if (flowConfig.engine !== 'auto' && flowConfig.engine !== 'elk') return flowConfig
    if (flowConfig.elk.algorithm !== 'layered') return flowConfig
    return { ...flowConfig, elk: { ...flowConfig.elk, algorithm: 'stress' as const } }
  }, [documentSemanticMode, flowConfig, schema?.layout?.flow?.elkLayout])

  const flowPresentation = React.useMemo(() => {
    const basePresentation = readFlowPresentation({ schema, documentSemanticMode })
    const graph = sceneGraphData as { context?: unknown; metadata?: unknown } | null
    const metaKind = (() => {
      const meta = graph?.metadata
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return ''
      return String((meta as Record<string, unknown>).kind || '').trim()
    })()
    const isFrontmatterFlow = metaKind === 'frontmatter-flow'
    const isMermaidLayout = (() => {
      if (!graph) return false
      if (String(graph.context || '') === 'frontmatter-mermaid') return true
      const meta = graph.metadata
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false
      return String((meta as Record<string, unknown>).layoutEngine || '') === 'mermaid'
    })()
    const nextPresentation =
      !isMermaidLayout
        ? basePresentation
        : {
            ...basePresentation,
            edges: {
              ...basePresentation.edges,
              underlay: { ...basePresentation.edges.underlay, enabled: false },
            },
          }
    if (!isFrontmatterFlow) return nextPresentation
    return {
      ...nextPresentation,
      portHandles: {
        ...nextPresentation.portHandles,
        enabled: true,
        sizePx: Math.max(10, nextPresentation.portHandles.sizePx),
        offsetPx: Math.max(4, nextPresentation.portHandles.offsetPx),
        strokeWidthPx: Math.max(1.5, nextPresentation.portHandles.strokeWidthPx),
      },
    }
  }, [documentSemanticMode, schema, sceneGraphData])

  const layoutVariant = React.useMemo(() => {
    return [
      `e=${flowConfigEffective.engine}`,
      `rd=${rankdir}`,
      `dir=${flowConfigEffective.elk.direction}`,
      `alg=${flowConfigEffective.elk.algorithm}`,
      `n=${flowConfigEffective.node.widthPx}x${flowConfigEffective.node.heightPx}`,
      `s=${flowConfigEffective.elk.nodeNodeSpacingPx},${flowConfigEffective.elk.layerSpacingPx},${flowConfigEffective.elk.edgeNodeSpacingPx}`,
      `h=${flowConfigEffective.handle.sizePx},${flowConfigEffective.handle.lineHeightPx}`,
      'cs=topLeftV2',
    ].join('|')
  }, [flowConfigEffective, rankdir])

  const sceneGroupsDerivation = React.useMemo(() => {
    return deriveSceneGroups({
      graphData: filteredGraphDataForRenderer,
      graphDataRevision,
      schema,
      documentSemanticMode: String(documentSemanticMode || ''),
      frontmatterModeEnabled: !!effectiveFrontmatter,
      multiDimTableModeEnabled: multiDimTableModeEnabled === true,
      documentStructureBaselineLock: documentStructureBaselineLock === true,
    })
  }, [
    documentSemanticMode,
    documentStructureBaselineLock,
    effectiveFrontmatter,
    filteredGraphDataForRenderer,
    graphDataRevision,
    multiDimTableModeEnabled,
    schema,
  ])
  const sceneGroups = React.useMemo(() => {
    if (!flowPresentation.groups.enabled) return []
    return sceneGroupsDerivation?.allGroups || []
  }, [flowPresentation.groups.enabled, sceneGroupsDerivation])

  const layoutViewKey = React.useMemo(() => {
    return buildLayoutViewKey({
      schemaLayoutEngineJson,
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: String(documentSemanticMode),
      graphMetaKey: buildGraphMetaKeyIgnoringPending(sceneGraphData),
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
    })
  }, [collapsedGroupIdsKey, documentSemanticMode, effectiveFrontmatter, mediaPanelDensity, renderMediaAsNodes, sceneGraphData, schemaLayoutEngineJson])

  const zoomViewKey = React.useMemo(() => {
    return buildZoomViewKey({
      canvasRenderMode,
      canvas2dRenderer,
      schemaLayoutEngineJson,
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: String(documentSemanticMode),
      graphMetaKey: buildGraphMetaKeyIgnoringPending(sceneGraphData),
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
    })
  }, [canvas2dRenderer, canvasRenderMode, collapsedGroupIdsKey, documentSemanticMode, effectiveFrontmatter, mediaPanelDensity, renderMediaAsNodes, sceneGraphData, schemaLayoutEngineJson])

  const datasetKey = React.useMemo(() => {
    return computeLayoutDatasetKey({
      graphData: sceneGraphData as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null,
      graphDataRevision,
    })
  }, [graphDataRevision, sceneGraphData])

  const cacheKey = React.useMemo(() => {
    return buildLayoutPositionCacheKey({
      datasetKey,
      mode: layoutMode,
      frontmatterMode: effectiveFrontmatter,
      semanticMode: documentSemanticMode,
      renderMode: '2d',
      viewKey: layoutViewKey,
      renderVariant: canvas2dRenderer,
      layoutVariant,
    })
  }, [canvas2dRenderer, datasetKey, documentSemanticMode, effectiveFrontmatter, layoutMode, layoutVariant, layoutViewKey])

  const layoutPositionsForMode = useGraphStore(s => (cacheKey ? (s.layoutPositionCacheByMode?.[cacheKey] ?? null) : null))
  const computedPositions = useFlowComputedPositions({
    active,
    cacheKey,
    datasetKey,
    graphDataRevision,
    layoutMode,
    layoutVariant,
    flowEditorMode: canvas2dRenderer === 'flowEditor',
    documentSemanticMode: String(documentSemanticMode || 'document'),
    effectiveFrontmatter,
    layoutViewKey,
    rankdir,
    sceneGraphData,
    sceneGroups,
    schema,
    flowConfig: flowConfigEffective,
    flowPresentation,
    layoutPositionsForMode,
    setLayoutPositionsForMode,
  })

  const seededFallbackPositions = React.useMemo(() => {
    if (computedPositions) return null
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as GraphNode[]) : []
    if (nodes.length < 2) return null
    const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
    let finiteCount = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    const seen = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      const x = (nodes[i] as { x?: unknown }).x
      const y = (nodes[i] as { y?: unknown }).y
      if (!isFiniteNum(x) || !isFiniteNum(y)) continue
      finiteCount += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const shouldSeedAll = finiteCount < 2 || (maxX - minX < 1 && maxY - minY < 1)
    const ids = nodes.map(node => String(node?.id || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
    if (ids.length < 2) return null
    const gap = 48
    const seeded = placeFlowFallbackSeedPositions({
      ids,
      cellW: Math.max(120, Math.floor(flowConfigEffective.node.widthPx + gap)),
      cellH: Math.max(120, Math.floor(flowConfigEffective.node.heightPx + gap)),
    })
    const next: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!
      if (!shouldSeedAll) {
        const node = nodes.find(entry => String(entry?.id || '').trim() === id) || null
        if (node && isFiniteNum((node as { x?: unknown }).x) && isFiniteNum((node as { y?: unknown }).y)) continue
      }
      if (seeded[id]) next[id] = seeded[id]!
    }
    return Object.keys(next).length > 0 ? next : null
  }, [computedPositions, flowConfigEffective.node.heightPx, flowConfigEffective.node.widthPx, sceneGraphData])

  const graphDataForZoom = React.useMemo(() => {
    if (!sceneGraphData) return null
    const positions = computedPositions || seededFallbackPositions
    if (!positions) return sceneGraphData
    return {
      ...sceneGraphData,
      nodes: (sceneGraphData.nodes || []).map(node => {
        const point = positions[String(node.id || '')]
        return point ? { ...node, x: point.x, y: point.y } : node
      }),
    }
  }, [computedPositions, sceneGraphData, seededFallbackPositions])

  const nodesForFlowTransformGuard = React.useMemo(() => {
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const base = (Array.isArray(graphDataForZoom?.nodes) ? graphDataForZoom.nodes : []) as GraphNode[]
    if (!isFlowEditor) return base
    const positions = computedPositions || seededFallbackPositions
    if (!positions) return base
    return base
      .map(node => {
        const id = String(node?.id || '').trim()
        const point = positions[id]
        return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { ...node, x: point.x, y: point.y } : null
      })
      .filter(Boolean) as GraphNode[]
  }, [canvas2dRenderer, computedPositions, graphDataForZoom, seededFallbackPositions])

  const nodesForFlowZoom = React.useMemo(() => {
    const base = canvas2dRenderer === 'flowEditor'
      ? nodesForFlowTransformGuard
      : ((Array.isArray(graphDataForZoom?.nodes) ? graphDataForZoom.nodes : []) as GraphNode[])
    return coerceNodesForFit({
      nodes: base,
      coords: 'topLeft',
      defaultW: flowConfigEffective.node.widthPx,
      defaultH: flowConfigEffective.node.heightPx,
      setVisualRect: true,
    })
  }, [canvas2dRenderer, flowConfigEffective.node.heightPx, flowConfigEffective.node.widthPx, graphDataForZoom, nodesForFlowTransformGuard])

  const mediaPanelWorldSizeForFit = React.useMemo(() => {
    const density = normalizeRichMediaPanelDensity(mediaPanelDensity)
    const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
    const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
    const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault
    const sizing = computeMediaOverlaySizing({
      density,
      viewportW,
      viewportH,
      zoomK: 1,
      itemCount: 1,
      config: {
        widthRatio: Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2,
        widthMinPx: Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 210,
        widthMaxPx: Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360,
      },
    })
    return { panelW: sizing.panelW, panelH: sizing.panelH }
  }, [
    mediaPanelDensity,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthRatioDefault,
    viewportW,
  ])

  const nodesForFlowZoomCollective = React.useMemo(() => {
    const flowEditorFrontmatterDocumentMode =
      canvas2dRenderer === 'flowEditor'
      && frontmatterModeEnabled === true
      && documentSemanticMode === 'document'
    if (flowEditorFrontmatterDocumentMode) return nodesForFlowZoom
    if (!Array.isArray(nodesForFlowZoom) || nodesForFlowZoom.length === 0 || mediaNodes.length === 0) return nodesForFlowZoom
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodesForFlowZoom.length; i += 1) {
      const id = String(nodesForFlowZoom[i]?.id || '').trim()
      if (id) nodeById.set(id, nodesForFlowZoom[i]!)
    }
    const extras: GraphNode[] = []
    const panelW = Math.max(2, Number(mediaPanelWorldSizeForFit.panelW) || 2)
    const panelH = Math.max(2, Number(mediaPanelWorldSizeForFit.panelH) || 2)
    for (let i = 0; i < mediaNodes.length; i += 1) {
      const id = String(mediaNodes[i]?.id || '').trim()
      const base = nodeById.get(id)
      if (!id || !base || !Number.isFinite(base.x) || !Number.isFinite(base.y)) continue
      extras.push({
        id: `__fit_media_panel__:${id}`,
        type: 'MediaPanel',
        label: '',
        x: base.x,
        y: base.y,
        properties: { 'visual:shape': 'rect', 'visual:width': panelW, 'visual:height': panelH },
      })
    }
    return extras.length > 0 ? [...nodesForFlowZoom, ...extras] : nodesForFlowZoom
  }, [
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    mediaNodes,
    mediaPanelWorldSizeForFit.panelH,
    mediaPanelWorldSizeForFit.panelW,
    nodesForFlowZoom,
  ])

  const flowEditorReservedW = React.useMemo(() => {
    if (canvas2dRenderer !== 'flowEditor') return 0
    let unpinnedCount = 0
    for (let i = 0; i < openWidgetNodeIds.length; i += 1) {
      const id = String(openWidgetNodeIds[i] || '').trim()
      const pinned = typeof flowWidgetPinnedByNodeId[id] === 'boolean' ? flowWidgetPinnedByNodeId[id] : true
      if (id && !pinned) unpinnedCount += 1
    }
    if (unpinnedCount <= 0) return 0
    const port = schema?.behavior?.portHandles || null
    const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
    const portSizePx = typeof (port as { size?: unknown } | null)?.size === 'number' ? Math.max(0, (port as { size: number }).size) : 4
    const portOffsetPx = typeof (port as { offset?: unknown } | null)?.offset === 'number' ? Math.max(0, (port as { offset: number }).offset) : 2
    const portExtraPadPx = portEnabled ? Math.floor((portSizePx + portOffsetPx + 8) * 0.7) : 0
    const overlay = schema?.layout?.flow && typeof schema.layout.flow === 'object' ? (schema.layout.flow as { overlay?: { collisionGapPx?: unknown } }).overlay : null
    const gapPx = Math.max(0, Math.min(40, Math.floor(typeof overlay?.collisionGapPx === 'number' ? overlay.collisionGapPx : 12)))
    const cellW = WIDGET_BASE_SIZE.width + gapPx + portExtraPadPx
    const cellH = Math.round(WIDGET_BASE_SIZE.height * 0.76) + gapPx
    const rowsMax = Math.max(1, Math.floor((viewportH - 96 - 24) / Math.max(1, cellH)))
    const colsNeeded = Math.max(1, Math.ceil(unpinnedCount / rowsMax))
    const colsMax = Math.max(1, Math.min(3, Math.floor((viewportW - 20 - 20) / Math.max(1, cellW))))
    const dockWidth = Math.max(1, Math.min(colsNeeded, colsMax)) * cellW - gapPx
    return Math.max(0, Math.min(Math.floor(viewportW * 0.72), Math.floor(dockWidth + 20 + 12)))
  }, [canvas2dRenderer, flowWidgetPinnedByNodeId, openWidgetNodeIds, schema?.behavior?.portHandles, schema?.layout?.flow, viewportH, viewportW])

  const graphDataForZoomRequests = React.useMemo(() => {
    if (!graphDataForZoom) return null
    return { ...graphDataForZoom, nodes: nodesForFlowZoomCollective }
  }, [graphDataForZoom, nodesForFlowZoomCollective])

  const buildInitialTransform = React.useCallback((runtimeTransform: { k: number; x: number; y: number }, graphData: GraphData | null) => {
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const nodesForFit = nodesForFlowZoomCollective
    const nodesForGuard = nodesForFlowTransformGuard
    if (isFlowEditor && nodesForGuard.length === 0) return null
    const schemaNow = useGraphStore.getState().schema
    const mode = readLayoutMode(schemaNow)
    const opts = readFitAllOptions({ schema: schemaNow, mode, intent: 'initialFit' })
    const activeDocumentViewMode = resolveActiveDocumentViewMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      multiDimTableModeEnabled: multiDimTableModeEnabled === true,
      documentSemanticMode: String(documentSemanticMode || 'document'),
      documentStructureBaselineLock: documentStructureBaselineLock === true,
    })
    if (activeDocumentViewMode === 'documentStructure') {
      opts.detectClusters = false
      opts.includeGroupsBounds = true
      opts.deriveGroupsOptions = { forceDocumentStructure: true }
      opts.schema = { ...schemaNow, layout: { ...(schemaNow?.layout || {}), groups: { ...(schemaNow?.layout?.groups || {}), enabled: true } } } as GraphSchema
    }
    const fitW = Math.max(1, viewportW - (isFlowEditor ? flowEditorReservedW : 0))
    const fit = isFlowEditor
      ? (() => {
          const port = schemaNow?.behavior?.portHandles || null
          const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
          const portSizePx = typeof (port as { size?: unknown } | null)?.size === 'number' ? Math.max(0, (port as { size: number }).size) : 4
          const portOffsetPx = typeof (port as { offset?: unknown } | null)?.offset === 'number' ? Math.max(0, (port as { offset: number }).offset) : 2
          return fitFlowEditorPinnedWidgets({
            nodes: nodesForFit,
            fitW,
            viewportH,
            viewportW,
            openWidgetNodeIds,
            pinnedById: flowWidgetPinnedByNodeId || {},
            worldPosById: flowWidgetWorldPosByNodeId || {},
            portExtraPadScreenPx: portEnabled ? portSizePx + portOffsetPx + 8 : 0,
            graphData,
            fitOpts: opts,
          })
        })()
      : fitAllTransform(nodesForFit, fitW, viewportH, { ...opts, graphData: graphData || undefined })
    const candidate = fit
    if (isFlowEditor) return candidate
    const ok = isFlowTransformShowingGraph(
      { k: candidate.k, x: candidate.x, y: candidate.y },
      {
        nodes: nodesForGuard as Array<{ x?: unknown; y?: unknown }>,
        viewportW,
        viewportH,
        nodeW: flowConfigEffective.node.widthPx,
        nodeH: flowConfigEffective.node.heightPx,
      },
    )
    return ok ? candidate : fit
  }, [
    canvas2dRenderer,
    documentSemanticMode,
    documentStructureBaselineLock,
    flowConfigEffective.node.heightPx,
    flowConfigEffective.node.widthPx,
    flowEditorReservedW,
    flowWidgetPinnedByNodeId,
    flowWidgetWorldPosByNodeId,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    nodesForFlowTransformGuard,
    nodesForFlowZoomCollective,
    openWidgetNodeIds,
    viewportH,
    viewportW,
  ])

  return {
    collapsedGroupIdsKey,
    zoomViewKey,
    rankdir,
    flowConfigEffective,
    flowPresentation,
    layoutVariant,
    sceneGroups,
    cacheKey,
    computedPositions,
    seededFallbackPositions,
    graphDataForZoom,
    nodesForFlowZoom,
    graphDataForZoomRequests,
    flowEditorReservedW,
    buildInitialTransform,
  }
}
