import { useCallback } from 'react'
import { exportHtmlCanvasSnapshot, exportHtmlSnapshot, exportSvgSnapshot, exportPngSnapshot } from '@/lib/graph/file'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import { captureVisibleCanvasPngBlobFromDom, readCanvasViewportSizeFromDom, wrapPngBlobAsSvgMarkup } from '@/lib/graph/svgSnapshot'
import { LS_KEYS } from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import { useGraphStore } from '@/hooks/useGraphStore'
import { exportGraphAsCenteredSvgMarkup } from '@/lib/graph/graphCenteredSvg'
import { exportGraphAsCentered3dSvgMarkup } from '@/lib/graph/graphCenteredSvg3d'
import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'
import { defaultSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { readPanSpeed, readWheelBehavior, readZoomSpeed } from '@/lib/canvas/camera-options-2d'
import { setupGraphScene } from '@/components/GraphCanvas/scene'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import type { WorkflowExportStatusDeps } from './useExportUtils'

type UseSnapshotExportHandlersParams = {
  captureCanvasSvgSnapshot: (mode?: '2d' | '3d') => Promise<string | null>
  captureCanvasPngSnapshot: () => Promise<Blob | null>
} & WorkflowExportStatusDeps

async function renderGraphCanvasSvgForHtmlExport(args: {
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

export function useSnapshotExportHandlers({
  captureCanvasSvgSnapshot,
  captureCanvasPngSnapshot,
  markExported,
  setTransientExportStatus,
}: UseSnapshotExportHandlersParams) {
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
        const vp = { w: 1920, h: 1080 }
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
        const wants3dExport =
          store.canvasRenderMode === '3d' ||
          (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

        const vp = { w: 1920, h: 1080 }
        const title = (() => {
          const base = suggested ? suggested.replace(/\.[a-z0-9]+$/i, '') : ''
          return base ? `${base} (Graph viewer)` : 'Graph viewer'
        })()

        const svgMarkup = await (async () => {
          if (wants3dExport) {
            const graphData = store.graphData
            const schema = store.schema
            if (graphData && schema) {
              const centered3d = exportGraphAsCentered3dSvgMarkup({
                graphData,
                schema,
                widthPx: vp.w,
                heightPx: vp.h,
                paddingPx: 96,
                includeXmlDeclaration: false,
                animated: true,
                threeEdgeRenderer: store.threeEdgeRenderer,
              })
              return String(centered3d || '').trim()
            }
            return ''
          }
          const graphData = store.graphData
          const schema = store.schema
          if (!graphData || !schema) return ''
          return await renderGraphCanvasSvgForHtmlExport({
            graphData,
            schema,
            widthPx: vp.w,
            heightPx: vp.h,
            viewportControlsPreset:
              (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design'
                ? 'design'
                : 'map',
            renderMediaAsNodes: store.renderMediaAsNodes === true,
            mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
          })
        })()

        const html = await buildGraphHtmlViewerMarkup({
          title,
          svgMarkup: svgMarkup || null,
          graphData: store.graphData,
          includeRichMediaOverlays: store.renderMediaAsNodes === true,
          mediaOverlayPoolMax: store.threeIframeOverlayPoolMax,
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
          allowNodeDrag: !(store.schema && store.schema.behavior && (store.schema.behavior as any).allowNodeDrag === false),
          allowEdgeDrag: !(store.schema && store.schema.behavior && (store.schema.behavior as any).allowNodeDrag === false),
          allowGroupDrag: !(store.schema && store.schema.behavior && (store.schema.behavior as any).allowGroupDrag === false),
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
  }, [captureCanvasPngSnapshot, captureCanvasSvgSnapshot, markExported, setTransientExportStatus])

  const exportHtmlCanvasAction = useCallback(() => {
    void (async () => {
      try {
        const storage = verifyWorkflowPresetStorage()
        const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
        const store = useGraphStore.getState()
        const wants3dExport =
          store.canvasRenderMode === '3d' ||
          (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

        const vp = readCanvasViewportSizeFromDom()
        const title = (() => {
          const base = suggested ? suggested.replace(/\.[a-z0-9]+$/i, '') : ''
          return base ? `${base} (Canvas)` : 'Canvas'
        })()

        const graphData = store.graphData
        const schema = store.schema
        if (!graphData || !schema) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasNoSnapshotAvailable)
          return
        }

        const svgOnly = await (async () => {
          return wants3dExport
            ? exportGraphAsCentered3dSvgMarkup({
                graphData,
                schema,
                widthPx: vp.w,
                heightPx: vp.h,
                paddingPx: 96,
                includeXmlDeclaration: false,
                animated: true,
                threeEdgeRenderer: store.threeEdgeRenderer,
              })
            : await renderGraphCanvasSvgForHtmlExport({
                graphData,
                schema,
                widthPx: vp.w,
                heightPx: vp.h,
                viewportControlsPreset:
                  (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design'
                    ? 'design'
                    : 'map',
                renderMediaAsNodes: store.renderMediaAsNodes === true,
                mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
              })
        })()

        const html = await buildGraphHtmlViewerMarkup({
          title,
          svgMarkup: String(svgOnly || '').trim() || null,
          graphData,
          includeRichMediaOverlays: store.renderMediaAsNodes === true,
          mediaOverlayPoolMax: store.threeIframeOverlayPoolMax,
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
          allowNodeDrag: !(store.schema && store.schema.behavior && (store.schema.behavior as any).allowNodeDrag === false),
          allowEdgeDrag: !(store.schema && store.schema.behavior && (store.schema.behavior as any).allowNodeDrag === false),
          allowGroupDrag: !(store.schema && store.schema.behavior && (store.schema.behavior as any).allowGroupDrag === false),
        })
        const trimmed = String(html || '').trim()
        if (!trimmed) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasNoSnapshotAvailable)
          return
        }

        await exportHtmlCanvasSnapshot(trimmed, wants3dExport ? '3d' : '2d', suggested)
        markExported()
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasExported)
      } catch {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasExportFailed)
      }
    })()
  }, [markExported, setTransientExportStatus])

  return {
    exportSvgSnapshotAction,
    exportPngSnapshotAction,
    exportHtmlViewerAction,
    exportHtmlCanvasAction,
  }
}
