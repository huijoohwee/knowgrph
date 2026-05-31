import { useGraphStore } from '@/hooks/useGraphStore'
import type { UiToastInput } from '@/hooks/store/types'
import { exportHtmlSnapshot } from '@/lib/graph/file'
import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { readPanSpeed, readWheelBehavior, readZoomSpeed } from '@/lib/canvas/camera-options-2d'
import { deriveGraphDataForActiveView } from '@/hooks/useActiveGraphData'
import { readDocumentViewModeContext } from '@/lib/graph/documentViewMode'
import { readViewportControlsPresetFromLocalStorage } from '@/lib/graph/htmlViewer/exportViewportControls'
import { captureLiveOverlayHtmlForHtmlViewerExport } from '@/lib/graph/htmlViewer/liveOverlayExport'
import { rewriteSvgMarkupForStandaloneHtmlExport } from '@/lib/graph/htmlViewer/rewriteSvgMarkupForStandaloneHtmlExport'
import { ensureSvgHasEdgeGeometry } from '@/lib/graph/svgEdgeGeometry'
import { extractNodePosByIdFromSvgMarkup } from '@/lib/graph/svgNodePos'
import { pickLayoutSeedPositions2dForExport } from '@/lib/graph/exportLayoutSeed2d'
import { injectLiveMarkdownDesignBlocksIntoSvgMarkupAnchored } from '@/lib/graph/svgSnapshot'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { deriveMarkdownDesignLayout, deriveMarkdownDesignLayoutFromGraphBlocks } from '@/features/markdown-edgeless/markdownDesignLayout'
import { computeMarkdownAnchorNodeIdByBlockId } from '@/lib/render/markdownPanelOverlayPool'
import { injectMarkdownDesignBlocksIntoSvgEl } from '@/lib/graph/htmlViewer/markdownDesignSvgOverlay'
import { normalizeWorkspacePath, workspaceStem } from '@/features/workspace-fs/path'
import { readOverlaySizingInputFromStoreState } from '@/lib/render/overlaySizing2d'

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

    const m = tr.match(
      /matrix\(\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*[ ,]\s*([-0-9.]+)\s*\)/i,
    )
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

const deriveExportBaseName = async (): Promise<string> => {
  try {
    const store = useGraphStore.getState()
    const rawDocName = String((store as unknown as { markdownDocumentName?: unknown }).markdownDocumentName || '').trim()
    if (rawDocName) {
      const withoutFragment = rawDocName.split('#')[0] || rawDocName
      const stem = workspaceStem(normalizeWorkspacePath(withoutFragment))
      const safeStem = String(stem || '').trim()
        .replace(/\\/g, '/')
        .replace(/\s+/g, ' ')
        .replace(/\.+\//g, '')
        .replace(/\//g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/\.+$/g, '')
        .replace(/^\.+/g, '')
        .trim()
      if (safeStem) return safeStem
    }
  } catch {
    void 0
  }
  try {
    const { verifyWorkflowPresetStorage } = (await import('@/features/parsers/workflowPresets')) as typeof import(
      '@/features/parsers/workflowPresets'
    )
    const storage = verifyWorkflowPresetStorage()
    const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '').trim() : ''
    const stem = suggested ? suggested.replace(/\.[a-z0-9]+$/i, '') : ''
    return stem || 'graph'
  } catch {
    return 'graph'
  }
}

export async function exportHtmlCanvasFallback(args: { pushUiToast: (toast: UiToastInput) => void }): Promise<void> {
  const exportBaseName = await deriveExportBaseName()
  const { exportHtmlCanvasFromWorkspace } = (await import(
    '@/features/markdown-workspace/main/exports/exportHtmlCanvas'
  )) as typeof import('@/features/markdown-workspace/main/exports/exportHtmlCanvas')
  await exportHtmlCanvasFromWorkspace({ exportBaseName, pushUiToast: args.pushUiToast })
}

export async function exportHtmlViewerFallback(args: { pushUiToast: (toast: UiToastInput) => void }): Promise<void> {
  const toastId = 'launch:export:htmlViewer'
  args.pushUiToast({ id: toastId, kind: 'neutral', message: 'Exporting HTML viewer…', ttlMs: null, dismissible: false })
  try {
    const store = useGraphStore.getState()
    try {
      store.flushComposedPositionWritesNow()
    } catch {
      void 0
    }

    const exportBaseName = await deriveExportBaseName()
    const wants3dExport =
      store.canvasRenderMode === '3d' || (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

    const baseGraphData = store.graphData
    const schema = store.schema
    if (!baseGraphData || !schema) {
      args.pushUiToast({ id: toastId, kind: 'warning', message: 'No graph available to export.' })
      return
    }

    const documentSemanticMode = store.documentSemanticMode === 'keyword' ? 'keyword' : 'document'
    const multiDimTableModeEnabled = store.multiDimTableModeEnabled === true
    const frontmatterModeEnabled = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: store.frontmatterModeEnabled,
      documentSemanticMode: store.documentSemanticMode,
      graphData: baseGraphData,
    })
    const layoutSemanticModeKey = readDocumentViewModeContext({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      multiDimTableModeEnabled,
      documentSemanticMode,
      documentStructureBaselineLock: store.documentStructureBaselineLock === true,
    }).documentSemanticModeKey

    const graphData = deriveGraphDataForActiveView({
      graphData: baseGraphData,
      frontmatterModeEnabled: store.frontmatterModeEnabled === true,
      multiDimTableModeEnabled,
      documentSemanticMode,
      documentStructureBaselineLock: store.documentStructureBaselineLock === true,
      collapsedGroupIds: Array.isArray(store.collapsedGroupIds) ? store.collapsedGroupIds : [],
    }) as GraphData

    const svgCaptured = await store.captureCanvasSvgSnapshot(wants3dExport ? '3d' : '2d')
    const captured = String(svgCaptured || '').replace(/^[\s\S]*?<svg/i, '<svg').replace(/\s*<\?xml[^>]*>\s*/i, '').trim()
    if (!captured) {
      args.pushUiToast({ id: toastId, kind: 'warning', message: 'No canvas snapshot available.' })
      return
    }

    const initialView = !wants3dExport ? extractCapturedViewportTransform(captured) : null
    const normalizedSvg = normalizeCapturedSvgForHtmlEmbed(captured)

    const svgDerivedNodePosById = extractNodePosByIdFromSvgMarkup(normalizedSvg)
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

    const mergedNodePosById = {
      ...(layoutSeedPosById || {}),
      ...(svgDerivedNodePosById || {}),
    }

    const markdownDesignLayoutFromDoc = (() => {
      try {
        const markdownText = String((store as unknown as { markdownDocumentText?: unknown }).markdownDocumentText || '')
        if (!markdownText.trim()) return null
        const activeDocumentPath = String((store as unknown as { markdownDocumentName?: unknown }).markdownDocumentName || '').trim() || 'markdown'
        const markdownTokensKey = buildMarkdownTokensKey(markdownText)
        const lexed = lexMarkdown(markdownText)
        return deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
      } catch {
        return null
      }
    })()

    const markdownDesignLayout = (() => {
      const blocks = Array.isArray((markdownDesignLayoutFromDoc as any)?.blocks) ? ((markdownDesignLayoutFromDoc as any).blocks as any[]) : []
      if (blocks.length > 0) return markdownDesignLayoutFromDoc
      return deriveMarkdownDesignLayoutFromGraphBlocks({ graphData, graphDataRevision: store.graphDataRevision, nodePosById: mergedNodePosById })
    })()

    const anchorNodeIdByBlockId = computeMarkdownAnchorNodeIdByBlockId({
      layout: markdownDesignLayout,
      nodes: Array.isArray((graphData as any)?.nodes) ? ((graphData as any).nodes as any) : [],
    })

    const svgInjected = injectLiveMarkdownDesignBlocksIntoSvgMarkupAnchored({
      svgMarkup: normalizedSvg,
      anchorNodeIdByBlockId,
      nodePosById: mergedNodePosById,
    })
    const svgWithEdgeGeometry = ensureSvgHasEdgeGeometry({ svgMarkup: svgInjected, graphData, nodePosById: mergedNodePosById })
    const svgWithMarkdownFallback = (() => {
      const blocks = Array.isArray((markdownDesignLayout as any)?.blocks) ? ((markdownDesignLayout as any).blocks as any[]) : []
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
    const svgMarkupStandalone = await rewriteSvgMarkupForStandaloneHtmlExport({ svgMarkup: svgWithMarkdownFallback, inlineRemoteAssets: true })

    const graphDataForViewer = (() => {
      const nodes = Array.isArray((graphData as any)?.nodes) ? ((graphData as any).nodes as any[]) : []
      if (nodes.length === 0) return graphData
      if (!mergedNodePosById || Object.keys(mergedNodePosById).length === 0) return graphData
      let changed = false
      const nextNodes = nodes.map(n => {
        const id = String(n?.id || '').trim()
        if (!id) return n
        const p = (mergedNodePosById as Record<string, { x: number; y: number } | undefined>)[id]
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

    const html = await buildGraphHtmlViewerMarkup({
      title: `${exportBaseName} (Viewer)`,
      svgMarkup: svgMarkupStandalone,
      overlayHtml: captureLiveOverlayHtmlForHtmlViewerExport(),
      graphData: graphDataForViewer,
      viewportControlsPreset: readViewportControlsPresetFromLocalStorage() || 'map',
      includeRichMediaOverlays: true,
      inlineRemoteMediaAssets: true,
      mediaOverlayPoolMax: Math.max(
        240,
        Array.isArray((graphDataForViewer as any)?.nodes) ? ((graphDataForViewer as any).nodes as any[]).length : 0,
        typeof store.threeIframeOverlayPoolMax === 'number' && Number.isFinite(store.threeIframeOverlayPoolMax)
          ? Math.floor(store.threeIframeOverlayPoolMax || 0)
          : 0,
      ),
      mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
      enableDecorativeAnimation: true,
      initialFrontmatterEnabled: frontmatterModeEnabled,
      preferWebgl3d: wants3dExport,
      initialView: initialView || undefined,
      overlaySizing: readOverlaySizingInputFromStoreState(store),
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
      snapGridEnabled: !!store.schema?.behavior?.snapGrid?.enabled,
      snapGridSize: store.schema?.behavior?.snapGrid?.size,
      dragConstraint: (store.schema?.behavior?.dragConstraint as any) || 'free',
      allowNodeDrag: true,
      allowEdgeDrag: true,
      allowGroupDrag: true,
      zoomLabelScaleMode2d: store.zoomLabelScaleMode2d,
      zoomLabelScaleExponent2d: store.zoomLabelScaleExponent2d,
      zoomLabelScaleClampMin2d: store.zoomLabelScaleClampMin2d,
      zoomLabelScaleClampMax2d: store.zoomLabelScaleClampMax2d,
      zoomStrokeScaleMode2d: store.zoomStrokeScaleMode2d,
      zoomStrokeScaleExponent2d: store.zoomStrokeScaleExponent2d,
      zoomStrokeScaleClampMin2d: store.zoomStrokeScaleClampMin2d,
      zoomStrokeScaleClampMax2d: store.zoomStrokeScaleClampMax2d,
      hideLabelsBelowScale: Number(store.schema?.performance?.lod?.hideLabelsBelowScale ?? 0),
    })

    const trimmed = String(html || '').trim()
    if (!trimmed) {
      args.pushUiToast({ id: toastId, kind: 'warning', message: 'Failed to build HTML viewer export.' })
      return
    }
    await exportHtmlSnapshot(trimmed, `${exportBaseName}.viewer.html`)
    args.pushUiToast({ id: toastId, kind: 'success', message: 'Exported HTML viewer', ttlMs: 1800, dismissible: false })
  } catch (e) {
    args.pushUiToast({
      id: toastId,
      kind: 'error',
      message: `Export failed: ${String((e as { message?: unknown })?.message ?? e)}`,
      ttlMs: 6000,
      dismissible: true,
    })
  }
}
