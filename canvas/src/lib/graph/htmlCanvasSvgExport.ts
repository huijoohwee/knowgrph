import { setupGraphScene } from '@/components/GraphCanvas/scene'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { getGraphDataForDisplay } from '@/components/GraphCanvas/displayFilter'

import { applyGraphCanvasStyles2d } from '@/components/GraphCanvas/useGraphCanvasStyles'
import type { MarkdownDesignBlock } from '@/features/markdown-edgeless/markdownDesignLayout'
import { injectMarkdownDesignBlocksIntoSvgEl } from '@/lib/graph/htmlViewer/markdownDesignSvgOverlay'
import { looksLikeSingleTagBlock } from 'grph-shared/markdown/mediaHtml'
import { DEFAULT_OVERLAY_SIZING_CONFIG } from '@/lib/render/overlaySizing2d'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { withD3BipartiteSceneSchema } from '@/lib/canvas/d3BipartiteSchemaOverrides'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { determineLayoutPositions, buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/components/GraphCanvas/layout/positioning'
import { resolveActiveDocumentViewMode } from '@/lib/graph/documentViewMode'

export async function renderGraphCanvasSvgForHtmlExport(args: {
  graphData: GraphData
  graphDataRevision?: number
  schema: GraphSchema
  widthPx: number
  heightPx: number
  viewportControlsPreset: ViewportControlsPreset
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  documentSemanticMode: 'document' | 'keyword'
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled?: boolean
  documentStructureBaselineLock?: boolean
  markdownDesignBlocks?: MarkdownDesignBlock[]
  panelOnlyNodeIds?: string[]
  collapsedGroupIds?: unknown
  layoutPositionCacheByMode?: Record<string, Record<string, { x: number; y: number }>> | null
  canvas2dRenderer?: string
  overlayBaseWidthRatioDefault?: number
  overlayBaseWidthRatioCompact?: number
  overlayBaseWidthMinPxDefault?: number
  overlayBaseWidthMinPxCompact?: number
  overlayBaseWidthMaxPxDefault?: number
  overlayBaseWidthMaxPxCompact?: number
  layoutSemanticModeKey?: string
}): Promise<string> {
  if (typeof document === 'undefined') return ''
  const {
    graphData,
    graphDataRevision,
    schema,
    widthPx,
    heightPx,
    viewportControlsPreset,
    renderMediaAsNodes,
    mediaPanelDensity,
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    documentStructureBaselineLock,
    markdownDesignBlocks,
    panelOnlyNodeIds,
    collapsedGroupIds,
    layoutPositionCacheByMode,
    canvas2dRenderer,
    overlayBaseWidthRatioDefault,
    overlayBaseWidthRatioCompact,
    overlayBaseWidthMinPxDefault,
    overlayBaseWidthMinPxCompact,
    overlayBaseWidthMaxPxDefault,
    overlayBaseWidthMaxPxCompact,
    layoutSemanticModeKey,
  } = args

  const graphDataForDisplay = getGraphDataForDisplay({ graphData, edges: null })
  const schemaForScene = withD3BipartiteSceneSchema({
    schema,
    graphData: graphDataForDisplay,
    canvasRenderMode: '2d',
    canvas2dRenderer: String(canvas2dRenderer || ''),
    forceForAny2dRenderer: true,
  })
  const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(collapsedGroupIds)
  const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schemaForScene)
  const graphMetaKey = buildGraphMetaKeyIgnoringPending(graphDataForDisplay)
  const datasetKey = computeLayoutDatasetKey({
    graphData: graphDataForDisplay,
    graphDataRevision: typeof graphDataRevision === 'number' && Number.isFinite(graphDataRevision) ? Math.floor(graphDataRevision) : 0,
  })
  const effectiveGraphDataRevision = typeof graphDataRevision === 'number' && Number.isFinite(graphDataRevision) ? Math.floor(graphDataRevision) : 0
  const layoutMode = readLayoutMode(schemaForScene)
  const semanticModeKey = String(layoutSemanticModeKey || documentSemanticMode || 'document')
  const layoutViewKey = buildLayoutViewKey({
    schemaLayoutEngineJson,
    frontmatterModeEnabled,
    documentSemanticMode: semanticModeKey,
    graphMetaKey,
    renderMediaAsNodes,
    mediaPanelDensity: String(mediaPanelDensity),
    collapsedGroupIdsKey,
  })

  const layoutVariant = ''
  const renderVariant = String(canvas2dRenderer || 'd3')
  const pickedLayoutSeed = determineLayoutPositions({
    datasetKey,
    mode: layoutMode,
    frontmatterMode: frontmatterModeEnabled,
    semanticMode: semanticModeKey,
    renderMode: '2d',
    renderVariant,
    layoutVariant,
    viewKey: layoutViewKey,
    prevViewKey: null,
    prevDatasetKey: null,
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    prevRenderVariant: null,
    prevLayoutVariant: null,
    nodes: Array.isArray(graphDataForDisplay.nodes) ? graphDataForDisplay.nodes : [],
    layoutPositionCacheByMode: layoutPositionCacheByMode ?? null,
  })

  const baselineLayoutPositions = (() => {
    if (String(documentSemanticMode || 'document') !== 'keyword') return null
    const cache = layoutPositionCacheByMode
    if (!cache) return null

    const baselineGraphMetaKey = (() => {
      const meta = graphDataForDisplay.metadata && typeof graphDataForDisplay.metadata === 'object' && !Array.isArray(graphDataForDisplay.metadata)
        ? (graphDataForDisplay.metadata as Record<string, unknown>)
        : null
      const raw = meta && typeof meta.baselineGraphMetaKey === 'string' ? meta.baselineGraphMetaKey.trim() : ''
      return raw || graphMetaKey
    })()

    const baselineLayoutViewKey = buildLayoutViewKey({
      schemaLayoutEngineJson,
      frontmatterModeEnabled,
      documentSemanticMode: 'document',
      graphMetaKey: baselineGraphMetaKey,
      renderMediaAsNodes,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
    })
    const baselineKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode: layoutMode,
      frontmatterMode: frontmatterModeEnabled,
      semanticMode: 'document',
      renderMode: '2d',
      viewKey: baselineLayoutViewKey,
      renderVariant,
      layoutVariant,
    })
    const found = cache[baselineKey] ?? null
    if (!found) return null
    return Object.keys(found).length > 0 ? found : null
  })()

  const effectiveSkipInitialLayout =
    String(documentSemanticMode || 'document') === 'keyword' && !!baselineLayoutPositions ? true : pickedLayoutSeed.skipInitialLayout

  const hasStablePositions = (() => {
    if (effectiveSkipInitialLayout && pickedLayoutSeed.layoutPositionsForMode) return true
    const nodes = Array.isArray(graphDataForDisplay.nodes) ? graphDataForDisplay.nodes : []
    let ok = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as any
      const x = n?.x
      const y = n?.y
      if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) ok += 1
      if (ok >= 2) return true
    }
    return false
  })()

  const panelOnlyNodeIdSet = (() => {
    const nodes = Array.isArray(graphDataForDisplay.nodes) ? graphDataForDisplay.nodes : []
    if (nodes.length === 0) return undefined
    const ids: string[] = []

    const extra = Array.isArray(panelOnlyNodeIds) ? panelOnlyNodeIds : []
    for (let i = 0; i < extra.length; i += 1) {
      const id = String(extra[i] || '').trim()
      if (id) ids.push(id)
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as any
      const id = String(n?.id || '').trim()
      if (!id) continue
      const type = String(n?.type || '').trim()

      if (type === 'Table' || type === 'CodeBlock') {
        ids.push(id)
        continue
      }

      if (type === 'Paragraph') {
        const propsObj = n?.properties && typeof n.properties === 'object' && !Array.isArray(n.properties) ? (n.properties as Record<string, unknown>) : null
        const text = propsObj && typeof propsObj.text === 'string' ? String(propsObj.text || '').trim() : ''
        const isCallout = propsObj && propsObj.calloutType === true
        if (isCallout) {
          ids.push(id)
          continue
        }
        if (text.startsWith('>')) {
          ids.push(id)
          continue
        }
        if (text && /<\s*iframe\b/i.test(text) && text.toLowerCase().startsWith('<iframe') && looksLikeSingleTagBlock(text, 'iframe')) {
          ids.push(id)
          continue
        }
      }
    }
    const unique = Array.from(new Set(ids))
    return unique.length ? new Set(unique) : undefined
  })()

  const mediaOverlayNodeIdSet = (() => {
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    const ids: string[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as any
      const id = String(n?.id || '').trim()
      if (!id) continue
      const spec = getNodeMediaSpec(n)
      if (!spec) continue
      if (spec.kind === 'iframe' || spec.kind === 'image' || spec.kind === 'svg' || spec.kind === 'video') ids.push(id)
    }
    const unique = Array.from(new Set(ids))
    return unique.length ? new Set(unique) : undefined
  })()

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-100000px'
  container.style.top = '-100000px'
  container.style.width = `${widthPx}px`
  container.style.height = `${heightPx}px`
  container.style.overflow = 'hidden'
  container.style.pointerEvents = 'none'
  container.style.opacity = '0'
  document.body.appendChild(container)

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement
  svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svgEl.setAttribute('width', String(widthPx))
  svgEl.setAttribute('height', String(heightPx))
  svgEl.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`)
  svgEl.setAttribute('preserveAspectRatio', 'xMinYMin meet')
  try {
    const existing = (svgEl as unknown as { width?: unknown })?.width as any
    if (!existing || !existing.baseVal || typeof existing.baseVal.value !== 'number') {
      Object.defineProperty(svgEl, 'width', { value: { baseVal: { value: widthPx } }, configurable: true })
    }
  } catch {
    void 0
  }
  try {
    const existing = (svgEl as unknown as { height?: unknown })?.height as any
    if (!existing || !existing.baseVal || typeof existing.baseVal.value !== 'number') {
      Object.defineProperty(svgEl, 'height', { value: { baseVal: { value: heightPx } }, configurable: true })
    }
  } catch {
    void 0
  }
  try {
    const existing = (svgEl as unknown as { viewBox?: unknown })?.viewBox as any
    if (!existing || !existing.baseVal || typeof existing.baseVal.width !== 'number') {
      Object.defineProperty(svgEl, 'viewBox', {
        value: { baseVal: { x: 0, y: 0, width: widthPx, height: heightPx } },
        configurable: true,
      })
    }
  } catch {
    void 0
  }
  container.appendChild(svgEl)

  const ref = <T,>(current: T | null) => ({ current })
  const svgRef = ref(svgEl)

  const layoutPositions: Record<string, { x: number; y: number }> = (() => {
    const seeded = pickedLayoutSeed.layoutPositionsForMode
    if (seeded && Object.keys(seeded).length > 0) return seeded
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    const out: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as any
      const id = String(n?.id || '').trim()
      if (!id) continue
      const x = n?.x
      const y = n?.y
      if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) out[id] = { x, y }
    }
    return out
  })()

  const displayNodes = (graphDataForDisplay.nodes ?? []) as any
  const displayEdges = (graphDataForDisplay.edges ?? []) as any
  const edgesForSim = normalizeEdgesForSim(displayNodes, displayEdges)
  const activeDocumentViewMode = resolveActiveDocumentViewMode({
    frontmatterModeEnabled: frontmatterModeEnabled === true,
    multiDimTableModeEnabled: multiDimTableModeEnabled === true,
    documentSemanticMode: String(documentSemanticMode || 'document'),
    documentStructureBaselineLock: documentStructureBaselineLock === true,
  })

  const groupsDerivation = deriveSceneGroups({
    graphData: graphDataForDisplay,
    graphDataRevision: effectiveGraphDataRevision,
    schema: schemaForScene,
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled: multiDimTableModeEnabled === true,
    documentStructureBaselineLock: documentStructureBaselineLock === true,
  })

  const initialZoomTransform = (() => {
    try {
      const mode = readLayoutMode(schemaForScene)
      const baseOpts = readFitAllOptions({ schema: schemaForScene, mode, intent: 'fitToScreen' })
      const opts = {
        ...baseOpts,
        centerMode: 'centroid',
        schema: schemaForScene,
        graphData: graphDataForDisplay,
        deriveGroupsOptions: { forceDocumentStructure: activeDocumentViewMode === 'documentStructure' },
      }
      const t = fitAllTransform((graphDataForDisplay.nodes ?? []) as any, Math.max(1, widthPx), Math.max(1, Math.floor(heightPx)), opts as any)
      if (!t || !(typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0)) return { k: 1, x: 0, y: 0 }
      return { k: t.k, x: t.x, y: t.y }
    } catch {
      return { k: 1, x: 0, y: 0 }
    }
  })()

  const gRef = ref<unknown>(null)
  const nodesSelRef = ref<any>(null)
  const groupChevronSelRef = ref<any>(null)
  const mediaSelRef = ref<any>(null)
  const portHandlesSelRef = ref<any>(null)
  const linksHitSelRef = ref<any>(null)
  const linksSelRef = ref<any>(null)
  const labelsSelRef = ref<any>(null)
  const zoomRef = ref<any>(null)
  const tempLinkSelRef = ref<any>({})
  const linkDragRef = ref<any>(null)
  const simulationRef = ref<any>(null)
  const sceneGraphDataRef = ref<any>(null)
  const beforeRenderFrameRef = ref<(() => void) | null>(null)
  const selectedEdgeIdRef = ref<string | null>(null)
  const selectedNodeIdRef = ref<string | null>(null)
  const selectedNodeIdsRef = ref<string[] | undefined>(undefined)
  const selectedEdgeIdsRef = ref<string[] | undefined>(undefined)

  const cleanup = setupGraphScene({
    active: () => true,
    svgEl,
    svgRef,
    graphData: graphDataForDisplay,
    graphDataRevision: effectiveGraphDataRevision,
    schema: schemaForScene,
    documentSemanticMode,
    edgesForSim,
    width: widthPx,
    height: heightPx,
    hoverEnabled: true,
    zoomOnDoubleClick: false,
    renderMediaAsNodes,
    mediaOverlayNodeIdSet,
    panelOnlyNodeIdSet,
    mediaPanelDensity,
    overlayBaseWidthRatioDefault:
      typeof overlayBaseWidthRatioDefault === 'number' && Number.isFinite(overlayBaseWidthRatioDefault)
        ? Math.max(0.001, overlayBaseWidthRatioDefault)
        : DEFAULT_OVERLAY_SIZING_CONFIG.widthRatio,
    overlayBaseWidthRatioCompact:
      typeof overlayBaseWidthRatioCompact === 'number' && Number.isFinite(overlayBaseWidthRatioCompact)
        ? Math.max(0.001, overlayBaseWidthRatioCompact)
        : DEFAULT_OVERLAY_SIZING_CONFIG.widthRatio,
    overlayBaseWidthMinPxDefault:
      typeof overlayBaseWidthMinPxDefault === 'number' && Number.isFinite(overlayBaseWidthMinPxDefault)
        ? Math.max(1, Math.floor(overlayBaseWidthMinPxDefault))
        : DEFAULT_OVERLAY_SIZING_CONFIG.widthMinPx,
    overlayBaseWidthMinPxCompact:
      typeof overlayBaseWidthMinPxCompact === 'number' && Number.isFinite(overlayBaseWidthMinPxCompact)
        ? Math.max(1, Math.floor(overlayBaseWidthMinPxCompact))
        : DEFAULT_OVERLAY_SIZING_CONFIG.widthMinPx,
    overlayBaseWidthMaxPxDefault:
      typeof overlayBaseWidthMaxPxDefault === 'number' && Number.isFinite(overlayBaseWidthMaxPxDefault)
        ? Math.max(1, Math.floor(overlayBaseWidthMaxPxDefault))
        : DEFAULT_OVERLAY_SIZING_CONFIG.widthMaxPx,
    overlayBaseWidthMaxPxCompact:
      typeof overlayBaseWidthMaxPxCompact === 'number' && Number.isFinite(overlayBaseWidthMaxPxCompact)
        ? Math.max(1, Math.floor(overlayBaseWidthMaxPxCompact))
        : DEFAULT_OVERLAY_SIZING_CONFIG.widthMaxPx,
    enableTightInitialLayout: (() => {
      const nodesCount = Array.isArray(graphDataForDisplay?.nodes) ? graphDataForDisplay.nodes.length : 0
      const edgesCount = Array.isArray(graphDataForDisplay?.edges) ? graphDataForDisplay.edges.length : 0
      if (nodesCount > 2600) return false
      if (edgesCount > 8200) return false
      return true
    })(),
    fitToScreenMode: false,
    viewportControlsPreset,
    initialZoomTransform,
    layoutPositionsForMode: hasStablePositions ? layoutPositions : null,
    baselineLayoutPositions,
    prevPositions: hasStablePositions ? layoutPositions : null,
    skipInitialLayout: hasStablePositions ? effectiveSkipInitialLayout : false,
    freezeSimulation: true,
    groupsForBboxCollide: groupsDerivation?.allGroups || [],
    layoutGroupKeyByNodeId: groupsDerivation?.layoutGroupKeyByNodeId || null,
    gRef: gRef as any,
    nodesSelRef,
    groupChevronSelRef,
    mediaSelRef,
    portHandlesSelRef,
    linksHitSelRef,
    linksSelRef,
    labelsSelRef,
    zoomRef,
    tempLinkSelRef,
    linkDragRef,
    simulationRef,
    sceneGraphDataRef,
    beforeRenderFrameRef,
    selectedEdgeIdRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    selectNode: () => {},
    selectEdge: () => {},
    selectGroup: () => {},
    selectGroupExpanded: () => {},
    toggleGroupCollapsed: () => {},
    setSelectionSource: () => {},
    addEdge: () => {},
    updateEdge: () => {},
    addNode: () => {},
    updateNode: () => {},
    setHoverInfo: () => {},
    setLifecycleStageRendering: () => {},
    requestZoomSelection: () => {},
    onZoomTransform: () => {},
    edgeScrollEnabled: () => true,
    getSchema: () => schemaForScene,
    getRenderMediaAsNodes: () => renderMediaAsNodes,
    enableEditorGestures: false,
    layoutCacheKey: null,
    setLayoutPositionsForMode: null,
  })

  try {
    const sim = simulationRef.current
    if (sim && !hasStablePositions) {
      try {
        sim.alpha(1)
      } catch {
        void 0
      }
      const maxTicks = Math.min(
        520,
        Math.max(80, Math.floor(((graphDataForDisplay.nodes?.length || 0) + (graphDataForDisplay.edges?.length || 0)) * 6))
      )
      let i = 0
      const minAlpha = typeof sim.alphaMin === 'function' ? sim.alphaMin() : 0.001
      for (; i < maxTicks && sim.alpha() > minAlpha; i += 1) sim.tick()
    }
    const tickHandler = sim?.on('tick')
    if (typeof tickHandler === 'function') tickHandler()
  } catch {
    void 0
  }
  try {
    const before = beforeRenderFrameRef.current
    if (typeof before === 'function') before()
  } catch {
    void 0
  }

  try {
    applyGraphCanvasStyles2d({
      gRef: gRef as any,
      nodesSelRef,
      linksSelRef,
      labelsSelRef,
      schema,
      documentSemanticMode,
    })
  } catch (err) {
    console.warn('Failed to apply graph styles during SVG export', err)
  }

  try {
    if (Array.isArray(markdownDesignBlocks) && markdownDesignBlocks.length > 0) {
      injectMarkdownDesignBlocksIntoSvgEl({ svgEl, blocks: markdownDesignBlocks })
    }
  } catch (err) {
    console.warn('Failed to inject markdown design blocks during SVG export', err)
  }

  let markup = ''
  try {
    markup = svgEl.outerHTML
  } finally {
    cleanup()
    container.remove()
  }
  return String(markup || '').trim()
}
