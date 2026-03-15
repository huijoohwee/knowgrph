import { downloadBlob, saveBlobWithPicker } from '@/lib/graph/save'
import { useGraphStore } from '@/hooks/useGraphStore'
import { lsBool } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import { exportGraphAsCentered3dSvgMarkup } from '@/lib/graph/graphCenteredSvg3d'
import { exportGraphAsCenteredSvgMarkup } from '@/lib/graph/graphCenteredSvg'
import { renderGraphCanvasSvgForHtmlExport } from '@/lib/graph/htmlCanvasSvgExport'
import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'
import { defaultSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { readPanSpeed, readWheelBehavior, readZoomSpeed } from '@/lib/canvas/camera-options-2d'
import type { UiToastInput } from '@/hooks/store/types'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { readCanvasViewportSizeFromDom } from '@/lib/graph/svgSnapshot'
import { normalizeInteractiveSvgForHtmlViewer } from './normalizeInteractiveSvg'

export async function exportHtmlCanvasFromWorkspace(args: {
  exportBaseName: string
  pushUiToast: (toast: UiToastInput) => void
}): Promise<void> {
  try {
    const exportBaseName = String(args.exportBaseName || '').trim() || 'document'
    const store = useGraphStore.getState()

    const geospatialEnabled = (() => {
      try {
        return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
      } catch {
        return false
      }
    })()

    const wants3dExport =
      store.canvasRenderMode === '3d' || (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

    const graphData = store.graphData
    const schema = store.schema
    if (!graphData || !schema) {
      args.pushUiToast({ id: 'export-html-missing-canvas', kind: 'warning', message: 'No canvas snapshot available.' })
      return
    }

    const documentSemanticMode = store.documentSemanticMode === 'keyword' ? 'keyword' : 'document'
    const frontmatterModeEnabled = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: store.frontmatterModeEnabled,
      documentSemanticMode: store.documentSemanticMode,
      graphData,
    })

    const vp = readCanvasViewportSizeFromDom()
    const fixedViewport = {
      widthPx: Math.max(1, Math.floor(Number(vp.w) || 1920)),
      heightPx: Math.max(1, Math.floor(Number(vp.h) || 1080)),
    }
    const fitInitialView2d = (() => {
      try {
        const mode = readLayoutMode(schema)
        const baseOpts = readFitAllOptions({ schema, mode, intent: 'fitToScreen' })
        const opts = {
          ...baseOpts,
          centerMode: 'centroid',
          schema,
          graphData,
          deriveGroupsOptions: { forceDocumentStructure: documentSemanticMode === 'document' },
        }
        const t = fitAllTransform((graphData.nodes ?? []) as any, fixedViewport.widthPx, fixedViewport.heightPx, opts as any)
        if (!t || !(typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0)) return null
        return { k: t.k, x: t.x, y: t.y }
      } catch {
        return null
      }
    })()

    const exportView = await (async (): Promise<{ svgMarkup: string; initialView: { k: number; x: number; y: number } | null }> => {
      if (!geospatialEnabled) {
        if (wants3dExport) {
          const positionsById = store.captureThreeLayoutPositions() || undefined
          const exportCameraPose = store.captureThreeCameraPose() || undefined
          const schemaThree = store.schema?.three
          const exportAutoRotate = schemaThree?.cameraAutoRotate === true
          const exportAutoRotateSpeed =
            typeof schemaThree?.cameraAutoRotateSpeed === 'number' && Number.isFinite(schemaThree.cameraAutoRotateSpeed)
              ? schemaThree.cameraAutoRotateSpeed
              : undefined
          const exportMotionIntensityMultiplier =
            typeof schemaThree?.nodeMotionIntensity === 'number' && Number.isFinite(schemaThree.nodeMotionIntensity)
              ? Math.max(0, schemaThree.nodeMotionIntensity)
              : undefined
          const exportShaderLineWidthPx =
            typeof (store as unknown as { threeShaderLineWidthPx?: unknown }).threeShaderLineWidthPx === 'number' &&
            Number.isFinite((store as unknown as { threeShaderLineWidthPx?: number }).threeShaderLineWidthPx)
              ? Math.max(0.5, Math.min(20, Number((store as unknown as { threeShaderLineWidthPx?: number }).threeShaderLineWidthPx)))
              : undefined
          const centered3d = exportGraphAsCentered3dSvgMarkup({
            graphData,
            schema,
            widthPx: fixedViewport.widthPx,
            heightPx: fixedViewport.heightPx,
            paddingPx: 96,
            includeXmlDeclaration: false,
            animated: true,
            exportAutoRotate,
            exportAutoRotateSpeed,
            exportMotionIntensityMultiplier,
            exportTiltXRad: 0.45,
            exportCameraZ: 200,
            threeEdgeRenderer: store.threeEdgeRenderer,
            exportShaderLineWidthPx,
            positionsById,
            exportCameraPose,
          })
          const trimmed = String(centered3d || '').trim()
          if (trimmed) return { svgMarkup: trimmed, initialView: null }
        } else {
          const snap = await store.captureCanvasSvgSnapshot('2d')
          const snapped = String(snap || '').replace(/^[\s\S]*?<svg/i, '<svg').replace(/\s*<\?xml[^>]*>\s*/i, '').trim()
          if (snapped) return normalizeInteractiveSvgForHtmlViewer(snapped)

          const viewportControlsPreset =
            (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design' ? 'design' : 'map'
          const mediaPanelDensity = store.mediaPanelDensity === 'compact' ? 'compact' : 'default'
          const rendered = await renderGraphCanvasSvgForHtmlExport({
            graphData,
            schema,
            widthPx: fixedViewport.widthPx,
            heightPx: fixedViewport.heightPx,
            viewportControlsPreset,
            renderMediaAsNodes: store.renderMediaAsNodes === true,
            mediaPanelDensity,
            documentSemanticMode,
            frontmatterModeEnabled,
          })
          if (rendered) return normalizeInteractiveSvgForHtmlViewer(rendered)
          const centered = exportGraphAsCenteredSvgMarkup({
            graphData,
            schema,
            widthPx: fixedViewport.widthPx,
            heightPx: fixedViewport.heightPx,
            paddingPx: 96,
            includeXmlDeclaration: false,
            animated: true,
          })
          const trimmed = String(centered || '').trim()
          if (trimmed) return normalizeInteractiveSvgForHtmlViewer(trimmed)
        }
      }
      const svgMarkup = await store.captureCanvasSvgSnapshot()
      const trimmed = String(svgMarkup || '').replace(/^\s*<\?xml[^>]*>\s*/i, '').trim()
      return { svgMarkup: trimmed, initialView: null }
    })()

    if (!exportView.svgMarkup) {
      args.pushUiToast({ id: 'export-html-missing-canvas', kind: 'warning', message: 'No inline SVG canvas snapshot available.' })
      return
    }

    const htmlViewer = await buildGraphHtmlViewerMarkup({
      title: `${exportBaseName} (Canvas)`,
      svgMarkup: exportView.svgMarkup,
      graphData: store.graphData,
      includeRichMediaOverlays: store.renderMediaAsNodes === true,
      mediaOverlayPoolMax: (store as unknown as { threeIframeOverlayPoolMax?: number }).threeIframeOverlayPoolMax,
      mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
      enableDecorativeAnimation: true,
      preferWebgl3d: wants3dExport,
      threeIframeOverlayBaseWidthRatioDefault: (store as unknown as { threeIframeOverlayBaseWidthRatioDefault?: number }).threeIframeOverlayBaseWidthRatioDefault,
      threeIframeOverlayBaseWidthRatioCompact: (store as unknown as { threeIframeOverlayBaseWidthRatioCompact?: number }).threeIframeOverlayBaseWidthRatioCompact,
      threeIframeOverlayBaseWidthMinPxDefault: (store as unknown as { threeIframeOverlayBaseWidthMinPxDefault?: number }).threeIframeOverlayBaseWidthMinPxDefault,
      threeIframeOverlayBaseWidthMinPxCompact: (store as unknown as { threeIframeOverlayBaseWidthMinPxCompact?: number }).threeIframeOverlayBaseWidthMinPxCompact,
      threeIframeOverlayBaseWidthMaxPxDefault: (store as unknown as { threeIframeOverlayBaseWidthMaxPxDefault?: number }).threeIframeOverlayBaseWidthMaxPxDefault,
      threeIframeOverlayBaseWidthMaxPxCompact: (store as unknown as { threeIframeOverlayBaseWidthMaxPxCompact?: number }).threeIframeOverlayBaseWidthMaxPxCompact,
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
      snapGridEnabled: !!store.schema?.behavior?.snapGrid?.enabled,
      snapGridSize: store.schema?.behavior?.snapGrid?.size,
      dragConstraint: (store.schema?.behavior?.dragConstraint as any) || 'free',
      allowNodeDrag: true,
      allowEdgeDrag: true,
      allowGroupDrag: true,
      zoomLabelScaleMode2d: (store as unknown as { zoomLabelScaleMode2d?: 'clampAt1' | 'smooth' | 'power' }).zoomLabelScaleMode2d,
      zoomLabelScaleExponent2d: (store as unknown as { zoomLabelScaleExponent2d?: number }).zoomLabelScaleExponent2d,
      zoomLabelScaleClampMin2d: (store as unknown as { zoomLabelScaleClampMin2d?: number }).zoomLabelScaleClampMin2d,
      zoomLabelScaleClampMax2d: (store as unknown as { zoomLabelScaleClampMax2d?: number }).zoomLabelScaleClampMax2d,
      zoomStrokeScaleMode2d: (store as unknown as { zoomStrokeScaleMode2d?: 'zoomScaled' | 'screenConstant' | 'power' }).zoomStrokeScaleMode2d,
      zoomStrokeScaleExponent2d: (store as unknown as { zoomStrokeScaleExponent2d?: number }).zoomStrokeScaleExponent2d,
      zoomStrokeScaleClampMin2d: (store as unknown as { zoomStrokeScaleClampMin2d?: number }).zoomStrokeScaleClampMin2d,
      zoomStrokeScaleClampMax2d: (store as unknown as { zoomStrokeScaleClampMax2d?: number }).zoomStrokeScaleClampMax2d,
      hideLabelsBelowScale: store.schema?.performance?.lod?.hideLabelsBelowScale,
    })

    if (!htmlViewer || !htmlViewer.trim()) {
      args.pushUiToast({ id: 'export-html-missing-canvas', kind: 'warning', message: 'Failed to build HTML canvas export.' })
      return
    }

    const blob = new Blob([htmlViewer], { type: 'text/html;charset=utf-8' })
    const name = `${exportBaseName}.canvas-${wants3dExport ? '3d' : '2d'}.html`
    const saved = await saveBlobWithPicker(blob, name, { description: 'HTML Files', accept: { 'text/html': ['.html'] } })
    if (saved === '') return
    if (!saved) downloadBlob(blob, name)
  } catch {
    void 0
  }
}
