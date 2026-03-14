import { useCallback } from 'react'
import { exportHtmlCanvasSnapshot, exportHtmlSnapshot, exportSvgSnapshot, exportPngSnapshot } from '@/lib/graph/file'
import { writeTextFileToDirectoryDetailed } from '@/lib/fsAccess/writeTextFileToDirectory'
import { writeBlobToFileHandle } from '@/lib/graph/save'
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
            const graphData = store.graphData
            const schema = store.schema
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
          hideLabelsBelowScale: store.schema?.performance?.lod?.hideLabelsBelowScale,
          includeRichMediaOverlays: true,
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

        let initialView: { k: number; x: number; y: number } | null = null

        const graphData = store.graphData
        const schema = store.schema
        if (!graphData || !schema) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.htmlCanvasNoSnapshotAvailable)
          return
        }

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
          hideLabelsBelowScale: store.schema?.performance?.lod?.hideLabelsBelowScale,
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
  }, [markExported, setTransientExportStatus])

  return {
    exportSvgSnapshotAction,
    exportPngSnapshotAction,
    exportHtmlViewerAction,
    exportHtmlCanvasAction,
  }
}
