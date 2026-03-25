import { useCallback } from 'react'
import { exportHtmlCanvasSnapshot, exportHtmlSnapshot, exportSvgSnapshot, exportPngSnapshot } from '@/lib/graph/file'
import { writeTextFileToDirectoryDetailed } from '@/lib/fsAccess/writeTextFileToDirectory'
import { writeBlobToFileHandle } from '@/lib/graph/save'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import {
  captureVisibleCanvasPngBlobFromDom,
  injectLiveMarkdownDesignBlocksIntoSvgMarkupAnchored,
  readCanvasViewportSizeFromDom,
  wrapPngBlobAsSvgMarkup,
} from '@/lib/graph/svgSnapshot'
import { LS_KEYS } from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { exportGraphAsCenteredSvgMarkup } from '@/lib/graph/graphCenteredSvg'
import { exportGraphAsCentered3dSvgMarkup } from '@/lib/graph/graphCenteredSvg3d'
import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'
import { captureLiveOverlayHtmlForHtmlViewerExport } from '@/lib/graph/htmlViewer/liveOverlayExport'
import { readViewportControlsPresetFromLocalStorage } from '@/lib/graph/htmlViewer/exportViewportControls'
import { defaultSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { readPanSpeed, readWheelBehavior, readZoomSpeed } from '@/lib/canvas/camera-options-2d'
import { setupGraphScene } from '@/components/GraphCanvas/scene'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import { DEFAULT_OVERLAY_SIZING_CONFIG } from '@/lib/render/overlaySizing2d'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { getGraphDataForDisplay } from '@/components/GraphCanvas/displayFilter'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import type { WorkflowExportStatusDeps } from './useExportUtils'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { determineLayoutPositions, buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/components/GraphCanvas/layout/positioning'
import { rewriteSvgMarkupForStandaloneHtmlExport } from '@/lib/graph/htmlViewer/rewriteSvgMarkupForStandaloneHtmlExport'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { deriveMarkdownDesignLayout, deriveMarkdownDesignLayoutFromGraphBlocks } from '@/features/markdown-edgeless/markdownDesignLayout'
import { computeMarkdownAnchorNodeIdByBlockId } from '@/lib/render/markdownPanelOverlayPool'
import { extractNodePosByIdFromSvgMarkup } from '@/lib/graph/svgNodePos'
import { pickLayoutSeedPositions2dForExport } from '@/lib/graph/exportLayoutSeed2d'
import { ensureSvgHasEdgeGeometry } from '@/lib/graph/svgEdgeGeometry'
import { injectMarkdownDesignBlocksIntoSvgEl } from '@/lib/graph/htmlViewer/markdownDesignSvgOverlay'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'

type UseSnapshotExportHandlersParams = {
  captureCanvasSvgSnapshot: (mode?: '2d' | '3d') => Promise<string | null>
  captureCanvasPngSnapshot: () => Promise<Blob | null>
} & WorkflowExportStatusDeps

async function renderGraphCanvasSvgForHtmlExport(args: {
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
  container.appendChild(svgEl)

  const ref = <T,>(current: T | null) => ({ current })
  const svgRef = ref(svgEl)

  const graphDataForDisplay = getGraphDataForDisplay({ graphData, edges: null })
  const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(collapsedGroupIds)
  const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schema)
  const graphMetaKey = buildGraphMetaKeyIgnoringPending(graphDataForDisplay)
  const datasetKey = computeLayoutDatasetKey({
    graphData: graphDataForDisplay,
    graphDataRevision: typeof graphDataRevision === 'number' && Number.isFinite(graphDataRevision) ? Math.floor(graphDataRevision) : 0,
  })
  const effectiveGraphDataRevision = typeof graphDataRevision === 'number' && Number.isFinite(graphDataRevision) ? Math.floor(graphDataRevision) : 0
  const layoutMode = readLayoutMode(schema)
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

  const layoutPositions: Record<string, { x: number; y: number }> = (() => {
    const seeded = pickedLayoutSeed.layoutPositionsForMode
    if (seeded && Object.keys(seeded).length > 0) return seeded
    const nodes = Array.isArray(graphDataForDisplay.nodes) ? graphDataForDisplay.nodes : []
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

  const hasStablePositions = (() => {
    if (effectiveSkipInitialLayout && pickedLayoutSeed.layoutPositionsForMode) return true
    return Object.keys(layoutPositions).length >= 2
  })()

  const displayNodes = (graphDataForDisplay.nodes ?? []) as any
  const displayEdges = (graphDataForDisplay.edges ?? []) as any
  const edgesForSim = normalizeEdgesForSim(displayNodes, displayEdges)

  const markdownTableAnchorNodeIds = (() => {
    try {
      const layout = deriveMarkdownDesignLayoutFromGraphBlocks({
        graphData: graphDataForDisplay,
        graphDataRevision: effectiveGraphDataRevision,
        nodePosById: layoutPositions,
      })
      const blocks = Array.isArray((layout as any)?.blocks) ? ((layout as any).blocks as any[]) : []
      if (blocks.length === 0) return [] as string[]
      const nodes = Array.isArray((graphDataForDisplay as any)?.nodes) ? ((graphDataForDisplay as any).nodes as any[]) : []
      if (nodes.length === 0) return [] as string[]
      const anchorByBlockId = computeMarkdownAnchorNodeIdByBlockId({ layout, nodes }) as any
      const out: string[] = []
      for (let i = 0; i < blocks.length; i += 1) {
        const b = blocks[i] as any
        const kind = String(b?.preview?.kind || '').trim()
        if (kind !== 'table') continue
        const blockId = String(b?.id || '').trim()
        const anchorId = blockId ? String(anchorByBlockId?.[blockId] || '').trim() : ''
        if (anchorId) out.push(anchorId)
      }
      return Array.from(new Set(out))
    } catch {
      return [] as string[]
    }
  })()

  const panelOnlyNodeIdSet = (() => {
    const nodes = Array.isArray(graphDataForDisplay.nodes) ? (graphDataForDisplay.nodes as any[]) : []
    if (nodes.length === 0) return null
    const ids: string[] = []
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
        const props = n?.properties
        const propsObj = props && typeof props === 'object' && !Array.isArray(props) ? (props as Record<string, unknown>) : null
        const text = propsObj && typeof propsObj.text === 'string' ? String(propsObj.text || '').trim() : ''
        if (propsObj && propsObj.calloutType === true) ids.push(id)
        else if (text.startsWith('>')) ids.push(id)
      }
    }

    for (let i = 0; i < markdownTableAnchorNodeIds.length; i += 1) {
      const id = String(markdownTableAnchorNodeIds[i] || '').trim()
      if (id) ids.push(id)
    }
    const unique = Array.from(new Set(ids))
    return unique.length ? new Set(unique) : null
  })()

  const mediaOverlayNodeIdSet = (() => {
    const nodes = Array.isArray(graphDataForDisplay.nodes) ? (graphDataForDisplay.nodes as any[]) : []
    if (nodes.length === 0) return null
    const ids: string[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as any
      const id = String(n?.id || '').trim()
      if (!id) continue
      const spec = getNodeMediaSpec(n)
      if (!spec) continue
      ids.push(id)
    }
    const unique = Array.from(new Set(ids))
    return unique.length ? new Set(unique) : null
  })()
  const groupsDerivation = deriveSceneGroups({
    graphData: graphDataForDisplay,
    graphDataRevision: effectiveGraphDataRevision,
    schema,
    documentSemanticMode,
    frontmatterModeEnabled,
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
    active: () => true,
    svgEl,
    svgRef,
    graphData: graphDataForDisplay,
    graphDataRevision: effectiveGraphDataRevision,
    schema,
    documentSemanticMode,
    edgesForSim,
    width: widthPx,
    height: heightPx,
    hoverEnabled: true,
    zoomOnDoubleClick: false,
    renderMediaAsNodes,
    panelOnlyNodeIdSet: panelOnlyNodeIdSet || undefined,
    mediaOverlayNodeIdSet: mediaOverlayNodeIdSet || undefined,
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
    initialZoomTransform: { k: 1, x: 0, y: 0 },
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

  let markup = ''
  try {
    markup = svgEl.outerHTML
  } finally {
    cleanup()
    container.remove()
  }
  return String(markup || '').trim()
}

function normalizeCapturedSvgForHtmlEmbed(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  const noXml = s.replace(/^<\?xml[^>]*>\s*/i, '')
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(noXml, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (!svg) return noXml
    const g = svg.querySelector('g')
    if (g) g.removeAttribute('transform')
    return svg.outerHTML
  } catch {
    return noXml
  }
}

function extractCapturedViewportTransform(raw: string): { k: number; x: number; y: number } | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const noXml = s.replace(/^<\?xml[^>]*>\s*/i, '')
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(noXml, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (!svg) return null
    const g = svg.querySelector('g')
    const tr = String(g?.getAttribute('transform') || '').trim()
    if (!tr) return null

    const m = tr.match(/matrix\(\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*\)/i)
    if (m) {
      const a = Number(m[1])
      const b = Number(m[2])
      const e = Number(m[5])
      const f = Number(m[6])
      const k = Math.sqrt(a * a + b * b)
      if (Number.isFinite(k) && Number.isFinite(e) && Number.isFinite(f) && k > 0) return { k, x: e, y: f }
    }

    const mt = tr.match(/translate\(\s*([-0-9.]+)\s*[, ]\s*([-0-9.]+)\s*\)/i)
    const ms = tr.match(/scale\(\s*([-0-9.]+)\s*\)/i)
    if (mt && ms) {
      const x = Number(mt[1])
      const y = Number(mt[2])
      const k = Number(ms[1])
      if (Number.isFinite(k) && Number.isFinite(x) && Number.isFinite(y) && k > 0) return { k, x, y }
    }

    return null
  } catch {
    return null
  }
}

export function useSnapshotExportHandlers({
  captureCanvasSvgSnapshot,
  captureCanvasPngSnapshot,
  markExported,
  setTransientExportStatus,
}: UseSnapshotExportHandlersParams) {
  const activeRenderGraphData = useActiveGraphRenderData()
  const exportSvgSnapshotAction = useCallback(() => {
    void (async () => {
      try {
        const storage = verifyWorkflowPresetStorage()
        const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
        const geospatialEnabled = (() => {
          try {
            return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
          } catch {
            return false
          }
        })()
        const store = useGraphStore.getState()
        try {
          store.flushComposedPositionWritesNow()
        } catch {
          void 0
        }
        const workspaceEditorEnabled = store.workspaceViewMode === 'editor'
        const wants3dExport =
          store.canvasRenderMode === '3d' ||
          (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

        if (wants3dExport) {
          const graphData = store.graphData
          const schema = store.schema
          const vp = readCanvasViewportSizeFromDom()
          if (graphData && schema) {
            const centered3d = exportGraphAsCentered3dSvgMarkup({
              graphData,
              schema,
              widthPx: vp.w,
              heightPx: vp.h,
              paddingPx: 96,
              includeXmlDeclaration: true,
              animated: true,
                threeEdgeRenderer: store.threeEdgeRenderer,
            })
            if (centered3d && centered3d.trim()) {
              await exportSvgSnapshot(centered3d, suggested)
              markExported()
              setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExported)
              return
            }
          }
        }

        if (geospatialEnabled || workspaceEditorEnabled) {
          const graphData = store.graphData
          const schema = store.schema
          const vp = readCanvasViewportSizeFromDom()
          if (graphData && schema) {
            const centered = exportGraphAsCenteredSvgMarkup({
              graphData,
              schema,
              widthPx: vp.w,
              heightPx: vp.h,
              paddingPx: 96,
              includeXmlDeclaration: true,
              animated: workspaceEditorEnabled,
            })
            if (centered && centered.trim()) {
              await exportSvgSnapshot(centered, suggested)
              markExported()
              setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExported)
              return
            }
          }
        }

        if (!geospatialEnabled) {
          const svg = await captureCanvasSvgSnapshot()
          const trimmed = String(svg || '').trim()
          if (trimmed) {
            await exportSvgSnapshot(trimmed, suggested)
            markExported()
            setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExported)
            return
          }
        }

        const png = (geospatialEnabled ? null : await captureCanvasPngSnapshot()) || (await captureVisibleCanvasPngBlobFromDom())
        if (!png) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotNoSnapshotAvailable)
          return
        }
        const vpRaw = readCanvasViewportSizeFromDom()
        const vp = {
          w: vpRaw && vpRaw.w > 0 ? vpRaw.w : 1920,
          h: vpRaw && vpRaw.h > 0 ? vpRaw.h : 1080,
        }
        const wrapped = await wrapPngBlobAsSvgMarkup(png, { includeXmlDeclaration: true, width: vp.w, height: vp.h })
        const wrappedTrimmed = String(wrapped || '').trim()
        if (!wrappedTrimmed) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotNoSnapshotAvailable)
          return
        }
        await exportSvgSnapshot(wrappedTrimmed, suggested)
        markExported()
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExported)
      } catch {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExportFailed)
      }
    })()
  }, [captureCanvasPngSnapshot, captureCanvasSvgSnapshot, markExported, setTransientExportStatus])

  const exportPngSnapshotAction = useCallback(() => {
    void (async () => {
      try {
        const storage = verifyWorkflowPresetStorage()
        const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
        const pngBlob = await captureCanvasPngSnapshot()
        if (!pngBlob) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.pngSnapshotNoSnapshotAvailable)
          return
        }
        await exportPngSnapshot(pngBlob, suggested)
        markExported()
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.pngSnapshotExported)
      } catch {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.pngSnapshotExportFailed)
      }
    })()
  }, [captureCanvasPngSnapshot, markExported, setTransientExportStatus])

  const exportHtmlViewerAction = useCallback(() => {
    void (async () => {
      try {
        const storage = verifyWorkflowPresetStorage()
        const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
        const store = useGraphStore.getState()
        try {
          store.flushComposedPositionWritesNow()
        } catch {
          void 0
        }
        const graphData = (activeRenderGraphData || store.graphData) as GraphData | null
        const schema = store.schema
        if (!graphData || !schema) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlViewerNoSnapshotAvailable)
          return
        }
        const documentSemanticMode = store.documentSemanticMode === 'keyword' ? 'keyword' : 'document'
        const frontmatterModeEnabled = computeEffectiveFrontmatterMode({
          frontmatterModeEnabled: store.frontmatterModeEnabled,
          documentSemanticMode: store.documentSemanticMode,
          graphData,
        })
        const wants3dExport =
          store.canvasRenderMode === '3d' ||
          (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

        const vp = { w: 1920, h: 1080 }
        const title = (() => {
          const base = suggested ? suggested.replace(/\.[a-z0-9]+$/i, '') : ''
          return base ? `${base} (Graph viewer)` : 'Graph viewer'
        })()

        let initialView: { k: number; x: number; y: number } | null = null

        const svgMarkup = await (async () => {
          if (wants3dExport) {
            if (graphData && schema) {
              const pose = store.captureThreeCameraPose()
              const positionsById = store.captureThreeLayoutPositions() || undefined
              const cam = (() => {
                if (!pose) return { exportCameraZ: undefined, exportTiltXRad: undefined, exportYaw0Rad: undefined }
                const dx = Number(pose.position.x) - Number(pose.target.x)
                const dy = Number(pose.position.y) - Number(pose.target.y)
                const dz = Number(pose.position.z) - Number(pose.target.z)
                const horiz = Math.hypot(dx, dz)
                const dist = Math.hypot(dx, dy, dz)
                const pitch = Math.atan2(dy, Math.max(1e-6, horiz))
                const yaw = Math.atan2(dx, dz)
                return {
                  exportCameraZ: Number.isFinite(dist) ? Math.max(80, Math.min(1200, dist)) : undefined,
                  exportTiltXRad: Number.isFinite(pitch) ? Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, pitch)) : undefined,
                  exportYaw0Rad: Number.isFinite(yaw) ? -yaw : undefined,
                }
              })()
              const centered3d = exportGraphAsCentered3dSvgMarkup({
                graphData,
                schema,
                widthPx: vp.w,
                heightPx: vp.h,
                paddingPx: 96,
                includeXmlDeclaration: false,
                animated: true,
                includeInternalScript: false,
                exportIncludeLabels: false,
                threeEdgeRenderer: store.threeEdgeRenderer,
                exportShaderLineWidthPx: store.threeShaderLineWidthPx,
                positionsById,
                exportCameraPose: pose || undefined,
                exportCameraZ: cam.exportCameraZ,
                exportTiltXRad: cam.exportTiltXRad,
                exportYaw0Rad: cam.exportYaw0Rad,
                exportDepthOpacityMin: 1,
                exportDepthOpacityMax: 1,
              })
              return String(centered3d || '').trim()
            }
            return ''
          }
          const captured = await captureCanvasSvgSnapshot('2d')
          initialView = extractCapturedViewportTransform(String(captured || ''))
          const normalized = normalizeCapturedSvgForHtmlEmbed(String(captured || ''))
          if (normalized) return normalized
          return await renderGraphCanvasSvgForHtmlExport({
            graphData,
            graphDataRevision: store.graphDataRevision,
            schema,
            widthPx: vp.w,
            heightPx: vp.h,
            viewportControlsPreset:
              (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design'
                ? 'design'
                : 'map',
            renderMediaAsNodes: store.renderMediaAsNodes === true,
            mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
            documentSemanticMode,
            frontmatterModeEnabled,
            collapsedGroupIds: store.collapsedGroupIds,
            layoutPositionCacheByMode: store.layoutPositionCacheByMode,
            canvas2dRenderer: store.canvas2dRenderer,
            overlayBaseWidthRatioDefault: store.threeIframeOverlayBaseWidthRatioDefault,
            overlayBaseWidthRatioCompact: store.threeIframeOverlayBaseWidthRatioCompact,
            overlayBaseWidthMinPxDefault: store.threeIframeOverlayBaseWidthMinPxDefault,
            overlayBaseWidthMinPxCompact: store.threeIframeOverlayBaseWidthMinPxCompact,
            overlayBaseWidthMaxPxDefault: store.threeIframeOverlayBaseWidthMaxPxDefault,
            overlayBaseWidthMaxPxCompact: store.threeIframeOverlayBaseWidthMaxPxCompact,
            layoutSemanticModeKey: store.multiDimTableModeEnabled ? `${documentSemanticMode}:mdtbl` : documentSemanticMode,
          })
        })()

        const markdownLayout = (() => {
          try {
            const st = useGraphStore.getState() as unknown as { markdownDocumentText?: unknown; markdownDocumentName?: unknown }
            const markdownText = String(st.markdownDocumentText || '')
            if (!markdownText.trim()) return null
            const activeDocumentPath = String(st.markdownDocumentName || '').trim() || 'markdown'
            const markdownTokensKey = buildMarkdownTokensKey(markdownText)
            const lexed = lexMarkdown(markdownText)
            return deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
          } catch {
            return null
          }
        })()

        const svgDerivedNodePosById = extractNodePosByIdFromSvgMarkup(String(svgMarkup || ''))
        const layoutSemanticModeKey = store.multiDimTableModeEnabled ? `${documentSemanticMode}:mdtbl` : documentSemanticMode
        const layoutSeedPosById = pickLayoutSeedPositions2dForExport({
          graphData,
          graphDataRevision: store.graphDataRevision,
          schema,
          documentSemanticModeKey: layoutSemanticModeKey,
          frontmatterModeEnabled,
          renderMediaAsNodes: store.renderMediaAsNodes === true,
          mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
          collapsedGroupIds: store.collapsedGroupIds,
          layoutPositionCacheByMode: store.layoutPositionCacheByMode,
          canvas2dRenderer: store.canvas2dRenderer,
        })
        const nodePosById = (() => {
          const out: Record<string, { x: number; y: number }> = { ...(layoutSeedPosById || {}) }
          const nodes = Array.isArray((graphData as any)?.nodes) ? ((graphData as any).nodes as any[]) : []
          for (let i = 0; i < nodes.length; i += 1) {
            const n = nodes[i]
            const id = String(n?.id || '').trim()
            if (!id) continue
            const x = Number(n?.x)
            const y = Number(n?.y)
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue
            out[id] = { x, y }
          }
          for (const id of Object.keys(svgDerivedNodePosById)) out[id] = svgDerivedNodePosById[id]!
          return out
        })()

        const graphDataForViewer = (() => {
          const nodes = Array.isArray((graphData as any)?.nodes) ? ((graphData as any).nodes as any[]) : []
          if (nodes.length === 0) return graphData
          if (!nodePosById || Object.keys(nodePosById).length === 0) return graphData
          let changed = false
          const nextNodes = nodes.map(n => {
            const id = String(n?.id || '').trim()
            if (!id) return n
            const p = nodePosById[id]
            if (!p) return n
            const nx = Number(p.x)
            const ny = Number(p.y)
            if (!Number.isFinite(nx) || !Number.isFinite(ny)) return n
            const ox = Number((n as any).x)
            const oy = Number((n as any).y)
            if (ox === nx && oy === ny) return n
            changed = true
            return { ...(n as any), x: nx, y: ny }
          })
          return changed ? ({ ...(graphData as any), nodes: nextNodes } as GraphData) : graphData
        })()

        const markdownLayoutForSvgInjection = (() => {
          const blocks = Array.isArray((markdownLayout as any)?.blocks) ? ((markdownLayout as any).blocks as any[]) : []
          if (blocks.length > 0) return markdownLayout
          return deriveMarkdownDesignLayoutFromGraphBlocks({ graphData, graphDataRevision: store.graphDataRevision, nodePosById })
        })()

        const anchorNodeIdByBlockId = computeMarkdownAnchorNodeIdByBlockId({
          layout: markdownLayoutForSvgInjection,
          nodes: Array.isArray((graphData as any)?.nodes) ? ((graphData as any).nodes as any) : [],
        })

        const svgMarkupInjected = injectLiveMarkdownDesignBlocksIntoSvgMarkupAnchored({
          svgMarkup: String(svgMarkup || ''),
          anchorNodeIdByBlockId,
          nodePosById,
        })
        const svgWithEdgeGeometry = ensureSvgHasEdgeGeometry({ svgMarkup: svgMarkupInjected, graphData, nodePosById })
        const svgWithMarkdownFallback = (() => {
          const blocks = Array.isArray((markdownLayoutForSvgInjection as any)?.blocks)
            ? ((markdownLayoutForSvgInjection as any).blocks as any[])
            : []
          if (svgWithEdgeGeometry.includes('data-kg-layer="markdown-design-blocks"')) return svgWithEdgeGeometry
          if (blocks.length === 0) return svgWithEdgeGeometry
          if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return svgWithEdgeGeometry
          try {
            const doc = new DOMParser().parseFromString(svgWithEdgeGeometry.replace(/^<\?xml[^>]*>\s*/i, ''), 'image/svg+xml')
            const svg = doc.querySelector('svg') as unknown as SVGSVGElement | null
            if (!svg) return svgWithEdgeGeometry
            injectMarkdownDesignBlocksIntoSvgEl({ svgEl: svg, blocks })
            const out = new XMLSerializer().serializeToString(svg)
            const trimmed = String(out || '').trim()
            return trimmed || svgWithEdgeGeometry
          } catch {
            return svgWithEdgeGeometry
          }
        })()
        const svgMarkupStandalone = await rewriteSvgMarkupForStandaloneHtmlExport({ svgMarkup: svgWithMarkdownFallback })

        const html = await buildGraphHtmlViewerMarkup({
          title,
          svgMarkup: String(svgMarkupStandalone || '').trim() || null,
          overlayHtml: captureLiveOverlayHtmlForHtmlViewerExport(),
          graphData: graphDataForViewer,
          viewportControlsPreset: readViewportControlsPresetFromLocalStorage() || 'map',
          preferWebgl3d: wants3dExport,
          initialView: initialView || undefined,
          zoomLabelScaleMode2d: store.zoomLabelScaleMode2d,
          zoomLabelScaleExponent2d: store.zoomLabelScaleExponent2d,
          zoomLabelScaleClampMin2d: store.zoomLabelScaleClampMin2d,
          zoomLabelScaleClampMax2d: store.zoomLabelScaleClampMax2d,
          zoomStrokeScaleMode2d: store.zoomStrokeScaleMode2d,
          zoomStrokeScaleExponent2d: store.zoomStrokeScaleExponent2d,
          zoomStrokeScaleClampMin2d: store.zoomStrokeScaleClampMin2d,
          zoomStrokeScaleClampMax2d: store.zoomStrokeScaleClampMax2d,
          hideLabelsBelowScale: Number(store.schema?.performance?.lod?.hideLabelsBelowScale ?? 0),
          initialFrontmatterEnabled: frontmatterModeEnabled,
          includeRichMediaOverlays: true,
          mediaOverlayPoolMax: Math.max(
            240,
            Array.isArray((graphDataForViewer as any)?.nodes) ? ((graphDataForViewer as any).nodes as any[]).length : 0,
            typeof store.threeIframeOverlayPoolMax === 'number' && Number.isFinite(store.threeIframeOverlayPoolMax)
              ? Math.floor(store.threeIframeOverlayPoolMax || 0)
              : 0,
          ),
          mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
          threeIframeOverlayBaseWidthRatioDefault: store.threeIframeOverlayBaseWidthRatioDefault,
          threeIframeOverlayBaseWidthRatioCompact: store.threeIframeOverlayBaseWidthRatioCompact,
          threeIframeOverlayBaseWidthMinPxDefault: store.threeIframeOverlayBaseWidthMinPxDefault,
          threeIframeOverlayBaseWidthMinPxCompact: store.threeIframeOverlayBaseWidthMinPxCompact,
          threeIframeOverlayBaseWidthMaxPxDefault: store.threeIframeOverlayBaseWidthMaxPxDefault,
          threeIframeOverlayBaseWidthMaxPxCompact: store.threeIframeOverlayBaseWidthMaxPxCompact,
          zoomMinK: readZoomScaleExtent(store.schema || defaultSchema)[0],
          zoomMaxK: readZoomScaleExtent(store.schema || defaultSchema)[1],
          wheelBehavior: readWheelBehavior(store.schema || defaultSchema),
          panSpeed: readPanSpeed(store.schema || defaultSchema),
          zoomSpeed: readZoomSpeed(store.schema || defaultSchema),
          flowWheelZoomSpeedMultiplier: (store as unknown as { flowWheelZoomSpeedMultiplier?: number }).flowWheelZoomSpeedMultiplier,
          flowWheelZoomIncrementMultiplier: (store as unknown as { flowWheelZoomIncrementMultiplier?: number }).flowWheelZoomIncrementMultiplier,
          flowWheelZoomSmoothMinDurationMs: (store as unknown as { flowWheelZoomSmoothMinDurationMs?: number }).flowWheelZoomSmoothMinDurationMs,
          flowWheelZoomSmoothMaxDurationMs: (store as unknown as { flowWheelZoomSmoothMaxDurationMs?: number }).flowWheelZoomSmoothMaxDurationMs,
          wheelZoomCtrlMetaBoostMultiplier: (store as unknown as { wheelZoomCtrlMetaBoostMultiplier?: number }).wheelZoomCtrlMetaBoostMultiplier,
          canvasInteractionSpeedMultiplier: (store as unknown as { canvasInteractionSpeedMultiplier?: number }).canvasInteractionSpeedMultiplier,
          canvasPanSpeedMultiplier: (store as unknown as { canvasPanSpeedMultiplier?: number }).canvasPanSpeedMultiplier,
          snapGridEnabled: !!(store.schema && store.schema.behavior && (store.schema.behavior as any).snapGrid && (store.schema.behavior as any).snapGrid.enabled),
          snapGridSize: store.schema && store.schema.behavior && (store.schema.behavior as any).snapGrid ? (store.schema.behavior as any).snapGrid.size : undefined,
          dragConstraint: store.schema && store.schema.behavior ? ((store.schema.behavior as any).dragConstraint as any) : undefined,
          allowNodeDrag: true,
          allowEdgeDrag: true,
          allowGroupDrag: true,
        })
        const trimmed = String(html || '').trim()
        if (!trimmed) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlViewerNoSnapshotAvailable)
          return
        }
        await exportHtmlSnapshot(trimmed, suggested)
        markExported()
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlViewerExported)
      } catch {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlViewerExportFailed)
      }
    })()
  }, [activeRenderGraphData, captureCanvasPngSnapshot, captureCanvasSvgSnapshot, markExported, setTransientExportStatus])

  const exportHtmlCanvasAction = useCallback(() => {
    void (async () => {
      try {
        const storage = verifyWorkflowPresetStorage()
        const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
        const store = useGraphStore.getState()
        try {
          store.flushComposedPositionWritesNow()
        } catch {
          void 0
        }
        const graphData = (activeRenderGraphData || store.graphData) as GraphData | null
        const schema = store.schema
        if (!graphData || !schema) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasNoSnapshotAvailable)
          return
        }
        const documentSemanticMode = store.documentSemanticMode === 'keyword' ? 'keyword' : 'document'
        const frontmatterModeEnabled = computeEffectiveFrontmatterMode({
          frontmatterModeEnabled: store.frontmatterModeEnabled,
          documentSemanticMode: store.documentSemanticMode,
          graphData,
        })
        const wants3dExport =
          store.canvasRenderMode === '3d' ||
          (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

        const vp = readCanvasViewportSizeFromDom()
        const title = (() => {
          const base = suggested ? suggested.replace(/\.[a-z0-9]+$/i, '') : ''
          return base ? `${base} (Canvas)` : 'Canvas'
        })()

        let initialView: { k: number; x: number; y: number } | null = null

        const svgOnly = await (async () => {
          if (wants3dExport) {
            const pose = store.captureThreeCameraPose()
            const positionsById = store.captureThreeLayoutPositions() || undefined
            const cam = (() => {
              if (!pose) return { exportCameraZ: undefined, exportTiltXRad: undefined, exportYaw0Rad: undefined }
              const dx = Number(pose.position.x) - Number(pose.target.x)
              const dy = Number(pose.position.y) - Number(pose.target.y)
              const dz = Number(pose.position.z) - Number(pose.target.z)
              const horiz = Math.hypot(dx, dz)
              const dist = Math.hypot(dx, dy, dz)
              const pitch = Math.atan2(dy, Math.max(1e-6, horiz))
              const yaw = Math.atan2(dx, dz)
              return {
                exportCameraZ: Number.isFinite(dist) ? Math.max(80, Math.min(1200, dist)) : undefined,
                exportTiltXRad: Number.isFinite(pitch) ? Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, pitch)) : undefined,
                exportYaw0Rad: Number.isFinite(yaw) ? -yaw : undefined,
              }
            })()
            return exportGraphAsCentered3dSvgMarkup({
              graphData,
              schema,
              widthPx: vp.w,
              heightPx: vp.h,
              paddingPx: 96,
              includeXmlDeclaration: false,
              animated: true,
              includeInternalScript: false,
              exportIncludeLabels: false,
              threeEdgeRenderer: store.threeEdgeRenderer,
              exportShaderLineWidthPx: store.threeShaderLineWidthPx,
              positionsById,
              exportCameraPose: pose || undefined,
              exportCameraZ: cam.exportCameraZ,
              exportTiltXRad: cam.exportTiltXRad,
              exportYaw0Rad: cam.exportYaw0Rad,
              exportDepthOpacityMin: 1,
              exportDepthOpacityMax: 1,
            })
          }
          const captured = await captureCanvasSvgSnapshot('2d')
          initialView = extractCapturedViewportTransform(String(captured || ''))
          const normalized = normalizeCapturedSvgForHtmlEmbed(String(captured || ''))
          if (normalized) return normalized
          return await renderGraphCanvasSvgForHtmlExport({
            graphData,
            graphDataRevision: store.graphDataRevision,
            schema,
            widthPx: vp.w,
            heightPx: vp.h,
            viewportControlsPreset:
              (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design'
                ? 'design'
                : 'map',
            renderMediaAsNodes: store.renderMediaAsNodes === true,
            mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
            documentSemanticMode,
            frontmatterModeEnabled,
            collapsedGroupIds: store.collapsedGroupIds,
            layoutPositionCacheByMode: store.layoutPositionCacheByMode,
            canvas2dRenderer: store.canvas2dRenderer,
            overlayBaseWidthRatioDefault: store.threeIframeOverlayBaseWidthRatioDefault,
            overlayBaseWidthRatioCompact: store.threeIframeOverlayBaseWidthRatioCompact,
            overlayBaseWidthMinPxDefault: store.threeIframeOverlayBaseWidthMinPxDefault,
            overlayBaseWidthMinPxCompact: store.threeIframeOverlayBaseWidthMinPxCompact,
            overlayBaseWidthMaxPxDefault: store.threeIframeOverlayBaseWidthMaxPxDefault,
            overlayBaseWidthMaxPxCompact: store.threeIframeOverlayBaseWidthMaxPxCompact,
            layoutSemanticModeKey: store.multiDimTableModeEnabled ? `${documentSemanticMode}:mdtbl` : documentSemanticMode,
          })
        })()

        const markdownLayout = (() => {
          try {
            const st = useGraphStore.getState() as unknown as { markdownDocumentText?: unknown; markdownDocumentName?: unknown }
            const markdownText = String(st.markdownDocumentText || '')
            if (!markdownText.trim()) return null
            const activeDocumentPath = String(st.markdownDocumentName || '').trim() || 'markdown'
            const markdownTokensKey = buildMarkdownTokensKey(markdownText)
            const lexed = lexMarkdown(markdownText)
            return deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
          } catch {
            return null
          }
        })()

        const svgDerivedNodePosById = extractNodePosByIdFromSvgMarkup(String(svgOnly || ''))
        const layoutSemanticModeKey = store.multiDimTableModeEnabled ? `${documentSemanticMode}:mdtbl` : documentSemanticMode
        const layoutSeedPosById = pickLayoutSeedPositions2dForExport({
          graphData,
          graphDataRevision: store.graphDataRevision,
          schema,
          documentSemanticModeKey: layoutSemanticModeKey,
          frontmatterModeEnabled,
          renderMediaAsNodes: store.renderMediaAsNodes === true,
          mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
          collapsedGroupIds: store.collapsedGroupIds,
          layoutPositionCacheByMode: store.layoutPositionCacheByMode,
          canvas2dRenderer: store.canvas2dRenderer,
        })
        const nodePosById = (() => {
          const out: Record<string, { x: number; y: number }> = { ...(layoutSeedPosById || {}) }
          const nodes = Array.isArray((graphData as any)?.nodes) ? ((graphData as any).nodes as any[]) : []
          for (let i = 0; i < nodes.length; i += 1) {
            const n = nodes[i]
            const id = String(n?.id || '').trim()
            if (!id) continue
            const x = Number(n?.x)
            const y = Number(n?.y)
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue
            out[id] = { x, y }
          }
          for (const id of Object.keys(svgDerivedNodePosById)) out[id] = svgDerivedNodePosById[id]!
          return out
        })()

        const graphDataForViewer = (() => {
          const nodes = Array.isArray((graphData as any)?.nodes) ? ((graphData as any).nodes as any[]) : []
          if (nodes.length === 0) return graphData
          if (!nodePosById || Object.keys(nodePosById).length === 0) return graphData
          let changed = false
          const nextNodes = nodes.map(n => {
            const id = String(n?.id || '').trim()
            if (!id) return n
            const p = nodePosById[id]
            if (!p) return n
            const nx = Number(p.x)
            const ny = Number(p.y)
            if (!Number.isFinite(nx) || !Number.isFinite(ny)) return n
            const ox = Number((n as any).x)
            const oy = Number((n as any).y)
            if (ox === nx && oy === ny) return n
            changed = true
            return { ...(n as any), x: nx, y: ny }
          })
          return changed ? ({ ...(graphData as any), nodes: nextNodes } as GraphData) : graphData
        })()

        const markdownLayoutForSvgInjection = (() => {
          const blocks = Array.isArray((markdownLayout as any)?.blocks) ? ((markdownLayout as any).blocks as any[]) : []
          if (blocks.length > 0) return markdownLayout
          return deriveMarkdownDesignLayoutFromGraphBlocks({ graphData, graphDataRevision: store.graphDataRevision, nodePosById })
        })()

        const anchorNodeIdByBlockId = computeMarkdownAnchorNodeIdByBlockId({
          layout: markdownLayoutForSvgInjection,
          nodes: Array.isArray((graphData as any)?.nodes) ? ((graphData as any).nodes as any) : [],
        })

        const svgOnlyInjected = injectLiveMarkdownDesignBlocksIntoSvgMarkupAnchored({
          svgMarkup: String(svgOnly || ''),
          anchorNodeIdByBlockId,
          nodePosById,
        })
        const svgWithEdgeGeometry = ensureSvgHasEdgeGeometry({ svgMarkup: svgOnlyInjected, graphData, nodePosById })
        const svgWithMarkdownFallback = (() => {
          const blocks = Array.isArray((markdownLayoutForSvgInjection as any)?.blocks)
            ? ((markdownLayoutForSvgInjection as any).blocks as any[])
            : []
          if (svgWithEdgeGeometry.includes('data-kg-layer="markdown-design-blocks"')) return svgWithEdgeGeometry
          if (blocks.length === 0) return svgWithEdgeGeometry
          if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return svgWithEdgeGeometry
          try {
            const doc = new DOMParser().parseFromString(svgWithEdgeGeometry.replace(/^<\?xml[^>]*>\s*/i, ''), 'image/svg+xml')
            const svg = doc.querySelector('svg') as unknown as SVGSVGElement | null
            if (!svg) return svgWithEdgeGeometry
            injectMarkdownDesignBlocksIntoSvgEl({ svgEl: svg, blocks })
            const out = new XMLSerializer().serializeToString(svg)
            const trimmed = String(out || '').trim()
            return trimmed || svgWithEdgeGeometry
          } catch {
            return svgWithEdgeGeometry
          }
        })()
        const svgOnlyStandalone = await rewriteSvgMarkupForStandaloneHtmlExport({ svgMarkup: svgWithMarkdownFallback })

        const html = await buildGraphHtmlViewerMarkup({
          title,
          svgMarkup: String(svgOnlyStandalone || '').trim() || null,
          graphData: graphDataForViewer,
          preferWebgl3d: wants3dExport,
          initialView: initialView || undefined,
          zoomLabelScaleMode2d: store.zoomLabelScaleMode2d,
          zoomLabelScaleExponent2d: store.zoomLabelScaleExponent2d,
          zoomLabelScaleClampMin2d: store.zoomLabelScaleClampMin2d,
          zoomLabelScaleClampMax2d: store.zoomLabelScaleClampMax2d,
          zoomStrokeScaleMode2d: store.zoomStrokeScaleMode2d,
          zoomStrokeScaleExponent2d: store.zoomStrokeScaleExponent2d,
          zoomStrokeScaleClampMin2d: store.zoomStrokeScaleClampMin2d,
          zoomStrokeScaleClampMax2d: store.zoomStrokeScaleClampMax2d,
          hideLabelsBelowScale: Number(store.schema?.performance?.lod?.hideLabelsBelowScale ?? 0),
          initialFrontmatterEnabled: frontmatterModeEnabled,
          includeRichMediaOverlays: true,
          mediaOverlayPoolMax: Math.max(
            240,
            Array.isArray((graphDataForViewer as any)?.nodes) ? ((graphDataForViewer as any).nodes as any[]).length : 0,
            typeof store.threeIframeOverlayPoolMax === 'number' && Number.isFinite(store.threeIframeOverlayPoolMax)
              ? Math.floor(store.threeIframeOverlayPoolMax || 0)
              : 0,
          ),
          mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
          threeIframeOverlayBaseWidthRatioDefault: store.threeIframeOverlayBaseWidthRatioDefault,
          threeIframeOverlayBaseWidthRatioCompact: store.threeIframeOverlayBaseWidthRatioCompact,
          threeIframeOverlayBaseWidthMinPxDefault: store.threeIframeOverlayBaseWidthMinPxDefault,
          threeIframeOverlayBaseWidthMinPxCompact: store.threeIframeOverlayBaseWidthMinPxCompact,
          threeIframeOverlayBaseWidthMaxPxDefault: store.threeIframeOverlayBaseWidthMaxPxDefault,
          threeIframeOverlayBaseWidthMaxPxCompact: store.threeIframeOverlayBaseWidthMaxPxCompact,
          zoomMinK: readZoomScaleExtent(store.schema || defaultSchema)[0],
          zoomMaxK: readZoomScaleExtent(store.schema || defaultSchema)[1],
          wheelBehavior: readWheelBehavior(store.schema || defaultSchema),
          viewportControlsPreset: (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design' ? 'design' : 'map',
          panSpeed: readPanSpeed(store.schema || defaultSchema),
          zoomSpeed: readZoomSpeed(store.schema || defaultSchema),
          flowWheelZoomSpeedMultiplier: (store as unknown as { flowWheelZoomSpeedMultiplier?: number }).flowWheelZoomSpeedMultiplier,
          flowWheelZoomIncrementMultiplier: (store as unknown as { flowWheelZoomIncrementMultiplier?: number }).flowWheelZoomIncrementMultiplier,
          flowWheelZoomSmoothMinDurationMs: (store as unknown as { flowWheelZoomSmoothMinDurationMs?: number }).flowWheelZoomSmoothMinDurationMs,
          flowWheelZoomSmoothMaxDurationMs: (store as unknown as { flowWheelZoomSmoothMaxDurationMs?: number }).flowWheelZoomSmoothMaxDurationMs,
          wheelZoomCtrlMetaBoostMultiplier: (store as unknown as { wheelZoomCtrlMetaBoostMultiplier?: number }).wheelZoomCtrlMetaBoostMultiplier,
          canvasInteractionSpeedMultiplier: (store as unknown as { canvasInteractionSpeedMultiplier?: number }).canvasInteractionSpeedMultiplier,
          canvasPanSpeedMultiplier: (store as unknown as { canvasPanSpeedMultiplier?: number }).canvasPanSpeedMultiplier,
          snapGridEnabled: !!(store.schema && store.schema.behavior && (store.schema.behavior as any).snapGrid && (store.schema.behavior as any).snapGrid.enabled),
          snapGridSize: store.schema && store.schema.behavior && (store.schema.behavior as any).snapGrid ? (store.schema.behavior as any).snapGrid.size : undefined,
          dragConstraint: store.schema && store.schema.behavior ? ((store.schema.behavior as any).dragConstraint as any) : undefined,
          allowNodeDrag: true,
          allowEdgeDrag: true,
          allowGroupDrag: true,
        })
        const trimmed = String(html || '').trim()
        if (!trimmed) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasNoSnapshotAvailable)
          return
        }

        const mode = wants3dExport ? '3d' : '2d'
        const publishHandle = store.htmlCanvasPublishFolderHandle
        const publishFolderName = store.htmlCanvasPublishFolderName
        const publishFileHandle = store.htmlCanvasPublishFileHandle
        const publishFileName = store.htmlCanvasPublishFileName
        const publishPathTemplate = String(store.htmlCanvasPublishPath || 'index.html')
        const publishPath = publishPathTemplate.replace(/\{mode\}/g, mode)
        if (publishHandle) {
          const res = await writeTextFileToDirectoryDetailed({
            rootHandle: publishHandle,
            relativePath: publishPath,
            text: trimmed,
          })
          if (res.ok) {
            store.pushUiToast({
              id: 'export-html-canvas-published',
              kind: 'success',
              message: `Published HTML canvas to ${publishFolderName || 'Local folder'}/${publishPath}`,
            })
            markExported()
            setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasExported)
            return
          } else if ('reason' in res) {
            const reason = res.reason
            store.pushUiToast({
              id: 'export-html-canvas-publish-folder-failed',
              kind: 'warning',
              message:
                reason === 'invalid-path'
                  ? 'Publish failed: invalid publish path.'
                  : reason === 'permission-denied'
                    ? 'Publish failed: folder write permission was not granted.'
                    : 'Publish failed: unable to write into the selected folder.',
            })
          } else {
            store.pushUiToast({
              id: 'export-html-canvas-publish-folder-failed',
              kind: 'warning',
              message: 'Publish failed: unable to write into the selected folder.',
            })
          }
        }

        if (publishFileHandle) {
          const ok = await writeBlobToFileHandle(
            publishFileHandle,
            new Blob([trimmed], { type: 'text/html;charset=utf-8' }),
          )
          if (ok) {
            store.pushUiToast({
              id: 'export-html-canvas-published-file',
              kind: 'success',
              message: `Published HTML canvas to ${publishFileName || 'Selected file'}`,
            })
            markExported()
            setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasExported)
            return
          }
        }

        await exportHtmlCanvasSnapshot(trimmed, mode, suggested)
        markExported()
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasExported)
      } catch {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasExportFailed)
      }
    })()
  }, [activeRenderGraphData, markExported, setTransientExportStatus])

  return {
    exportSvgSnapshotAction,
    exportPngSnapshotAction,
    exportHtmlViewerAction,
    exportHtmlCanvasAction,
  }
}
