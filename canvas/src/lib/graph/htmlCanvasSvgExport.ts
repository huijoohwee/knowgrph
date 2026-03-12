import { setupGraphScene } from '@/components/GraphCanvas/scene'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'

export async function renderGraphCanvasSvgForHtmlExport(args: {
  graphData: GraphData
  schema: GraphSchema
  widthPx: number
  heightPx: number
  viewportControlsPreset: ViewportControlsPreset
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
}): Promise<string> {
  if (typeof document === 'undefined') return ''
  const { graphData, schema, widthPx, heightPx, viewportControlsPreset, renderMediaAsNodes, mediaPanelDensity } = args

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

  const layoutPositions: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    const n = graphData.nodes[i]
    const id = String((n as any).id || '').trim()
    const x = (n as any).x
    const y = (n as any).y
    if (!id) continue
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
      layoutPositions[id] = { x, y }
    }
  }
  const hasStablePositions = Object.keys(layoutPositions).length >= 2

  const edgesForSim = normalizeEdgesForSim((graphData.nodes ?? []) as any, (graphData.edges ?? []) as any)
  const groupsDerivation = deriveSceneGroups({
    graphData,
    graphDataRevision: 0,
    schema,
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
  })

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
    svgEl,
    svgRef,
    graphData,
    graphDataRevision: 0,
    schema,
    documentSemanticMode: 'document',
    edgesForSim,
    width: widthPx,
    height: heightPx,
    hoverEnabled: true,
    zoomOnDoubleClick: false,
    renderMediaAsNodes,
    mediaPanelDensity,
    enableTightInitialLayout: !hasStablePositions,
    fitToScreenMode: false,
    viewportControlsPreset,
    initialZoomTransform: { k: 1, x: 0, y: 0 },
    layoutPositionsForMode: hasStablePositions ? layoutPositions : null,
    baselineLayoutPositions: null,
    prevPositions: hasStablePositions ? layoutPositions : null,
    skipInitialLayout: hasStablePositions,
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
    getSchema: () => schema,
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
      const ticks = Math.min(520, Math.max(80, Math.floor(((graphData.nodes?.length || 0) + (graphData.edges?.length || 0)) * 6)))
      for (let i = 0; i < ticks; i += 1) sim.tick()
      const tickHandler = sim.on('tick')
      if (typeof tickHandler === 'function') tickHandler()
    }
  } catch {
    void 0
  }
  try {
    const before = beforeRenderFrameRef.current
    if (typeof before === 'function') before()
  } catch {
    void 0
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
