import { setupGraphScene } from '@/components/GraphCanvas/scene'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { buildNodeMediaInventory } from '@/components/GraphCanvas/helpers'
import { getGraphDataForDisplay } from '@/components/GraphCanvas/displayFilter'

import { applyGraphCanvasStyles2d } from '@/components/GraphCanvas/useGraphCanvasStyles'
import type { MarkdownDesignBlock } from '@/features/markdown-edgeless/markdownDesignLayout'
import { injectMarkdownDesignBlocksIntoSvgEl } from '@/lib/graph/htmlViewer/markdownDesignSvgOverlay'
import { type OverlayDensitySizingConfigInput } from '@/lib/render/overlaySizing2d'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { withD3FlowchartSceneSchema } from '@/lib/canvas/d3FlowchartSchemaOverrides'
import { buildGraphMetaKeyIgnoringPending, readBaselineGraphMetaKey } from '@/lib/graph/graphMetaKey'
import {
  determineLayoutPositions,
  readBaselineDocumentLayoutRuntimeContext,
  readCurrentLayoutHistoryContext,
  readCurrentLayoutPrepContext,
  readCurrentLayoutResolutionContext,
  readCurrentLayoutSeedContext,
  buildLayoutPositionCacheKey,
} from '@/components/GraphCanvas/layout/positioning'
import { readDocumentViewModeContext } from '@/lib/graph/documentViewMode'
import { buildPanelOnlyNodeIdSetFromGraphNodes } from '@/lib/render/markdownPanelOverlayPool'

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
  overlaySizing?: OverlayDensitySizingConfigInput | null
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
    overlaySizing,
    layoutSemanticModeKey,
  } = args

  const graphDataForDisplay = getGraphDataForDisplay({ graphData, edges: null })
  const schemaForScene = withD3FlowchartSceneSchema({
    schema,
    graphData: graphDataForDisplay,
    canvasRenderMode: '2d',
    canvas2dRenderer: String(canvas2dRenderer || ''),
    forceForAny2dRenderer: true,
  })
  const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(collapsedGroupIds)
  const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schemaForScene)
  const graphMetaKey = buildGraphMetaKeyIgnoringPending(graphDataForDisplay)
  const effectiveGraphDataRevision = typeof graphDataRevision === 'number' && Number.isFinite(graphDataRevision) ? Math.floor(graphDataRevision) : 0
  const currentLayoutPrep = readCurrentLayoutPrepContext({
    graphData: graphDataForDisplay,
    graphDataRevision: effectiveGraphDataRevision,
    schemaLayoutEngineJson,
    frontmatterModeEnabled,
    documentSemanticMode: String(layoutSemanticModeKey || documentSemanticMode || 'document'),
    graphMetaKey,
    renderMediaAsNodes,
    mediaPanelDensity: String(mediaPanelDensity),
    collapsedGroupIdsKey,
  })
  const datasetKey = currentLayoutPrep.datasetKey
  const layoutResolutionContext = readCurrentLayoutResolutionContext({
    schema: schemaForScene,
    semanticMode: String(layoutSemanticModeKey || documentSemanticMode || 'document'),
    renderMode: '2d',
    canvas2dRenderer,
    default2dRenderVariant: 'd3',
  })
  const layoutMode = layoutResolutionContext.mode
  const semanticModeKey = layoutResolutionContext.semanticMode
  const layoutViewKey = currentLayoutPrep.layoutViewKey

  const layoutVariant = ''
  const renderVariant = layoutResolutionContext.renderVariant
  const currentLayoutSeed = readCurrentLayoutSeedContext({
    datasetKey,
    mode: layoutMode,
    frontmatterModeEnabled,
    semanticMode: semanticModeKey,
    renderMode: '2d',
    renderVariant,
    layoutViewKey,
    nodes: Array.isArray(graphDataForDisplay.nodes) ? graphDataForDisplay.nodes : [],
    layoutPositionCacheByMode,
  })
  const currentLayoutHistory = readCurrentLayoutHistoryContext({})
  const pickedLayoutSeed = determineLayoutPositions({
    ...currentLayoutSeed,
    layoutVariant,
    ...currentLayoutHistory,
  })

  const baselineLayoutRuntime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode,
    graphData: graphDataForDisplay,
    fallbackGraphMetaKey: graphMetaKey,
    schemaLayoutEngineJson,
    frontmatterModeEnabled,
    renderMediaAsNodes,
    mediaPanelDensity: String(mediaPanelDensity),
    collapsedGroupIdsKey,
    datasetKey,
    mode: layoutMode,
    renderMode: '2d',
    renderVariant,
    layoutVariant,
    layoutPositionCacheByMode,
  })
  const baselineLayoutPositions = baselineLayoutRuntime.baselineLayoutPositions
  const effectiveSkipInitialLayout = baselineLayoutRuntime.shouldSkipInitialLayoutFromBaselineDocumentPositions
    ? true
    : pickedLayoutSeed.skipInitialLayout

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
    const ids = buildPanelOnlyNodeIdSetFromGraphNodes(nodes as never)
    const extra = Array.isArray(panelOnlyNodeIds) ? panelOnlyNodeIds : []
    for (let i = 0; i < extra.length; i += 1) {
      const id = String(extra[i] || '').trim()
      if (id) ids.add(id)
    }
    return ids.size > 0 ? ids : undefined
  })()

  const mediaOverlayNodeIdSet = (() => {
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    const inventory = buildNodeMediaInventory(nodes as never)
    if (inventory.rows.length <= 0) return undefined
    const ids = new Set<string>()
    for (const row of inventory.rows) ids.add(row.id)
    return ids.size > 0 ? ids : undefined
  })()
  const container = document.createElement('section')
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
  const forceDocumentStructure = readDocumentViewModeContext({
    frontmatterModeEnabled: frontmatterModeEnabled === true,
    multiDimTableModeEnabled: multiDimTableModeEnabled === true,
    documentSemanticMode: String(documentSemanticMode || 'document'),
    documentStructureBaselineLock: documentStructureBaselineLock === true,
  }).forceDocumentStructureGroups

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
        deriveGroupsOptions: { forceDocumentStructure },
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
    overlaySizing,
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
