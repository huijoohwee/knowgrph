import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { ensureKgTokensInstalled, resolveCssVarWithKgFallback } from '@/lib/ui/tokens-ssot'
import { safeScaleExtent } from '@/lib/zoom/scaleExtent'
import { buildHtmlViewerRuntimeScript } from './runtimeScript'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { filterGroupsByCollapsedAncestors } from '@/lib/graph/groupVisibility'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { extractNodePosByIdFromSvgMarkup } from '@/lib/graph/svgNodePos'
import { ensureSvgHasEdgeGeometry } from '@/lib/graph/svgEdgeGeometry'
import { deriveMarkdownDesignLayoutFromGraphBlocks } from '@/features/markdown-edgeless/markdownDesignLayout'
import {
  decodeRepoFileUrlToRelPath,
  inlineRepoFileUrlToDataUrl,
  unwrapStandaloneProxyUrl,
} from '@/lib/graph/htmlViewer/standaloneAssetRewrite'

type HtmlViewerMediaNode = {
  id: string
  title: string
  url: string
  openUrl?: string
  interactive: boolean
  kind: 'iframe' | 'image' | 'svg' | 'video'
}

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const escapeHtml = (s: string): string => {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const tryReadCssVar = (name: string, fallback: string): string => {
  try {
    if (typeof document === 'undefined') return fallback
    const raw = String(getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim()
    return raw || fallback
  } catch {
    return fallback
  }
}

export async function buildGraphHtmlViewerMarkup(args: {
  title?: string
  svgMarkup?: string | null
  graphData?: GraphData | null
  includeRichMediaOverlays?: boolean
  mediaOverlayPoolMax?: number
  mediaPanelDensity?: 'default' | 'compact'
  viewportWidthPx?: number
  viewportHeightPx?: number
  viewportScaleToFit?: boolean
  enableDecorativeAnimation?: boolean
  threeIframeOverlayBaseWidthRatioDefault?: number
  threeIframeOverlayBaseWidthRatioCompact?: number
  threeIframeOverlayBaseWidthMinPxDefault?: number
  threeIframeOverlayBaseWidthMinPxCompact?: number
  threeIframeOverlayBaseWidthMaxPxDefault?: number
  threeIframeOverlayBaseWidthMaxPxCompact?: number
  zoomMinK?: number
  zoomMaxK?: number
  wheelBehavior?: 'pan' | 'zoom' | 'preset'
  viewportControlsPreset?: 'map' | 'design'
  panSpeed?: number
  zoomSpeed?: number
  flowWheelZoomSpeedMultiplier?: number
  flowWheelZoomIncrementMultiplier?: number
  flowWheelZoomSmoothMinDurationMs?: number
  flowWheelZoomSmoothMaxDurationMs?: number
  wheelZoomCtrlMetaBoostMultiplier?: number
  canvasInteractionSpeedMultiplier?: number
  canvasPanSpeedMultiplier?: number
  snapGridEnabled?: boolean
  snapGridSize?: number
  dragConstraint?: 'free' | 'axis-x' | 'axis-y' | 'none'
  allowNodeDrag?: boolean
  allowEdgeDrag?: boolean
  allowGroupDrag?: boolean
  preferWebgl3d?: boolean
  initialView?: { k: number; x: number; y: number }
  zoomLabelScaleMode2d?: 'clampAt1' | 'smooth' | 'power'
  zoomLabelScaleExponent2d?: number
  zoomLabelScaleClampMin2d?: number
  zoomLabelScaleClampMax2d?: number
  zoomStrokeScaleMode2d?: 'zoomScaled' | 'screenConstant' | 'power'
  zoomStrokeScaleExponent2d?: number
  zoomStrokeScaleClampMin2d?: number
  zoomStrokeScaleClampMax2d?: number
  hideLabelsBelowScale?: number
  overlayHtml?: string
}): Promise<string | null> {
  try {
    ensureKgTokensInstalled()
  } catch {
    void 0
  }

  const title = String(args.title || '').trim() || 'Graph viewer'
  const svgMarkupRaw = String(args.svgMarkup || '').trim()

  const initialView =
    args.initialView && isFiniteNum(args.initialView.k) && isFiniteNum(args.initialView.x) && isFiniteNum(args.initialView.y)
      ? args.initialView
      : null
  const fixedViewport =
    isFiniteNum(args.viewportWidthPx) && isFiniteNum(args.viewportHeightPx)
      ? { w: Math.max(1, Math.floor(args.viewportWidthPx)), h: Math.max(1, Math.floor(args.viewportHeightPx)) }
      : null

  const preferredOverlayNodeIds = (() => {
    if (!initialView) return []
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    if (nodes.length === 0) return []

    const nodePosById: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      const x = (n as unknown as { x?: unknown }).x
      const y = (n as unknown as { y?: unknown }).y
      if (!isFiniteNum(x) || !isFiniteNum(y)) continue
      nodePosById[id] = { x, y }
    }
    const fromSvg = extractNodePosByIdFromSvgMarkup(svgMarkupRaw)
    for (const id of Object.keys(fromSvg)) nodePosById[id] = fromSvg[id]!

    const vpW = fixedViewport ? fixedViewport.w : 1920
    const vpH = fixedViewport ? fixedViewport.h : 1080
    const pad = 800
    const k = Math.max(0.00001, Number(initialView.k))
    const tx = Number(initialView.x)
    const ty = Number(initialView.y)

    const out: string[] = []
    for (const id of Object.keys(nodePosById)) {
      const p = nodePosById[id]
      if (!p) continue
      const sx = p.x * k + tx
      const sy = p.y * k + ty
      if (sx < -pad || sx > vpW + pad) continue
      if (sy < -pad || sy > vpH + pad) continue
      out.push(id)
      if (out.length >= 800) break
    }
    return out
  })()

  const hasSvg = !!svgMarkupRaw
  if (!hasSvg) return null

  const canvasBg = resolveCssVarWithKgFallback('--kg-canvas-bg') || '#ffffff'
  const panelBg = resolveCssVarWithKgFallback('--kg-panel-bg') || 'rgba(255,255,255,0.92)'
  const border = resolveCssVarWithKgFallback('--kg-border') || 'rgba(0,0,0,0.12)'
  const text = resolveCssVarWithKgFallback('--kg-text-primary') || 'rgba(0,0,0,0.86)'
  const textSecondary = resolveCssVarWithKgFallback('--kg-text-secondary') || 'rgba(0,0,0,0.7)'
  const textTertiary = resolveCssVarWithKgFallback('--kg-text-tertiary') || 'rgba(0,0,0,0.55)'
  const panelActionBg = resolveCssVarWithKgFallback('--kg-panel-action-bg') || 'rgba(0,0,0,0.04)'
  const panelActionBgHover = resolveCssVarWithKgFallback('--kg-panel-action-bg-hover') || 'rgba(0,0,0,0.06)'

  const canvasEdgeStroke = resolveCssVarWithKgFallback('--kg-canvas-edge-stroke') || '#9ca3af'
  const canvasNodeStroke = resolveCssVarWithKgFallback('--kg-canvas-node-stroke') || '#ffffff'
  const canvasAccent = resolveCssVarWithKgFallback('--kg-canvas-accent') || '#3b82f6'
  const canvasLabelFill = resolveCssVarWithKgFallback('--kg-canvas-label-fill') || text
  const canvasLabelHalo = resolveCssVarWithKgFallback('--kg-canvas-label-halo') || canvasBg
  const mediaHeaderBg = resolveCssVarWithKgFallback('--kg-media-panel-header-bg') || 'rgba(0,0,0,0.04)'

  const density = args.mediaPanelDensity === 'compact' ? 'compact' : 'default'

  const mediaPanelHeaderH = density === 'compact' ? 22 : 28
  const mediaPanelRadius = density === 'compact' ? 9 : 10
  const mediaPanelPadding = density === 'compact' ? 6 : 8
  const mediaPanelTitleSize = density === 'compact' ? 11 : 12
  const mediaPanelHeaderGap = 8
  const widthRatioDefault = isFiniteNum(args.threeIframeOverlayBaseWidthRatioDefault)
    ? Math.max(0.001, args.threeIframeOverlayBaseWidthRatioDefault)
    : 0.2
  const widthRatioCompact = isFiniteNum(args.threeIframeOverlayBaseWidthRatioCompact)
    ? Math.max(0.001, args.threeIframeOverlayBaseWidthRatioCompact)
    : 0.2
  const widthMinDefault = isFiniteNum(args.threeIframeOverlayBaseWidthMinPxDefault)
    ? Math.max(1, Math.floor(args.threeIframeOverlayBaseWidthMinPxDefault))
    : 210
  const widthMinCompact = isFiniteNum(args.threeIframeOverlayBaseWidthMinPxCompact)
    ? Math.max(1, Math.floor(args.threeIframeOverlayBaseWidthMinPxCompact))
    : 210
  const widthMaxDefault = isFiniteNum(args.threeIframeOverlayBaseWidthMaxPxDefault)
    ? Math.max(1, Math.floor(args.threeIframeOverlayBaseWidthMaxPxDefault))
    : 360
  const widthMaxCompact = isFiniteNum(args.threeIframeOverlayBaseWidthMaxPxCompact)
    ? Math.max(1, Math.floor(args.threeIframeOverlayBaseWidthMaxPxCompact))
    : 360

  const mediaNodesBase = (() => {
    if (args.includeRichMediaOverlays !== true) return []
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    const poolMaxRaw = isFiniteNum(args.mediaOverlayPoolMax) ? Math.max(0, Math.floor(args.mediaOverlayPoolMax)) : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : Math.min(2000, Math.max(24, nodes.length))
    return listMediaOverlayNodes({ enabled: true, nodes, poolMax, preferredNodeIds: preferredOverlayNodeIds })
  })()

  const inlineRepoFileMedia = async (nodes: HtmlViewerMediaNode[]): Promise<HtmlViewerMediaNode[]> => {
    if (!nodes || nodes.length === 0) return []
    const MAX_BYTES = 2_400_000
    const out: HtmlViewerMediaNode[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const url0 = String(n.url || '').trim()
      const url = unwrapStandaloneProxyUrl(url0)
      const relPath = decodeRepoFileUrlToRelPath(url)
      if (!relPath) {
        out.push({ ...n, url })
        continue
      }

      const inlined = await inlineRepoFileUrlToDataUrl(url, { maxBytes: MAX_BYTES })
      if (!inlined) {
        out.push({ ...n, url })
        continue
      }
      out.push({ ...n, url: inlined })
    }
    return out
  }

  const mediaNodes = await inlineRepoFileMedia(mediaNodesBase as unknown as HtmlViewerMediaNode[])

  const mediaNodesJson = JSON.stringify(mediaNodes)

  const nodeLabelByIdJson = (() => {
    const out: Record<string, { label: string }> = {}
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      const label = String((n as unknown as { label?: unknown }).label || '').trim()
      out[id] = { label: label || id }
    }
    return JSON.stringify(out)
  })()

  const nodeIdNormalizer = (() => {
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    const nodeIdSet = new Set<string>()
    const nodeIdBySuffix: Record<string, string> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const rawId = String(nodes[i]?.id || '').trim()
      if (!rawId) continue
      nodeIdSet.add(rawId)
      const suffix = rawId.split('::').pop() || ''
      if (suffix && !nodeIdBySuffix[suffix]) nodeIdBySuffix[suffix] = rawId
    }
    return (raw: string): string => {
      const id = String(raw || '').trim()
      if (!id) return ''
      if (nodeIdSet.has(id)) return id
      const suffix = id.split('::').pop() || ''
      if (!suffix) return id
      return nodeIdBySuffix[suffix] || id
    }
  })()

  const edgeMetaByIdJson = (() => {
    const out: Record<string, { label: string; s: string; t: string }> = {}
    const graph = args.graphData
    const edges = Array.isArray(graph?.edges) ? (graph!.edges as GraphEdge[]) : []
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]
      const id = String(e?.id || '').trim()
      if (!id) continue
      const label = String((e as unknown as { label?: unknown }).label || '').trim()
      const s0 = String((e as unknown as { source?: unknown }).source || '').trim()
      const t0 = String((e as unknown as { target?: unknown }).target || '').trim()
      const s = nodeIdNormalizer(s0)
      const t = nodeIdNormalizer(t0)
      out[id] = { label: label || '', s, t }
    }
    return JSON.stringify(out)
  })()

  const frontmatterVisibilityJson = (() => {
    const graph = args.graphData
    if (!graph) return JSON.stringify({ nodeIds: [], edgeIds: [] })
    const fm = filterGraphToFrontmatterMermaid(graph)
    const nodes = Array.isArray(fm.nodes) ? (fm.nodes as GraphNode[]) : []
    const edges = Array.isArray(fm.edges) ? (fm.edges as GraphEdge[]) : []
    const nodeIds = nodes.map(n => String(n?.id || '').trim()).filter(Boolean)
    const edgeIds = edges.map(e => String(e?.id || '').trim()).filter(Boolean)
    return JSON.stringify({ nodeIds, edgeIds })
  })()

  const groupMembersByIdJson = (() => {
    const graph = args.graphData
    if (!graph) return JSON.stringify({})
    const nodes = Array.isArray((graph as unknown as { nodes?: unknown }).nodes)
      ? ((graph as unknown as { nodes: GraphNode[] }).nodes as GraphNode[])
      : []
    const nodeIdSet = new Set<string>()
    const nodeIdBySuffix: Record<string, string> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const rawId = String(nodes[i]?.id || '').trim()
      if (!rawId) continue
      nodeIdSet.add(rawId)
      const suffix = rawId.split('::').pop() || ''
      if (suffix && !nodeIdBySuffix[suffix]) nodeIdBySuffix[suffix] = rawId
    }
    const normalizeMemberId = (raw: string): string => {
      const id = String(raw || '').trim()
      if (!id) return ''
      if (nodeIdSet.has(id)) return id
      const suffix = id.split('::').pop() || ''
      if (!suffix) return ''
      const full = nodeIdBySuffix[suffix]
      return full || id
    }
    const meta = (graph.metadata || {}) as Record<string, unknown>
    const isKeywordGraph = meta.kind === 'keyword'
    const view = meta['kg:view'] && typeof meta['kg:view'] === 'object' && !Array.isArray(meta['kg:view']) ? (meta['kg:view'] as Record<string, unknown>) : null
    const collapsedIds = view && Array.isArray(view.collapsedGroupIds) ? (view.collapsedGroupIds as unknown[]) : []
    const collapsedSet = new Set<string>(collapsedIds.map(x => String(x || '').trim()).filter(Boolean))
    const groups = filterGroupsByCollapsedAncestors({
      groups: deriveGraphGroups(graph, { forceDocumentStructure: !isKeywordGraph }),
      collapsedGroupIdSet: collapsedSet,
    })
    const out: Record<string, string[]> = {}
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      const id = String((g as unknown as { id?: unknown }).id || '').trim()
      if (!id) continue
      const membersRaw = (g as unknown as { memberNodeIds?: unknown }).memberNodeIds
      const members = Array.isArray(membersRaw) ? membersRaw.map(v => String(v)).filter(Boolean) : []
      if (members.length === 0) continue
      const normalized = members.map(normalizeMemberId).filter(m => m && nodeIdSet.has(m))
      if (normalized.length === 0) continue
      out[id] = normalized
    }
    return JSON.stringify(out)
  })()

  const nodePosByIdObj = (() => {
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    const out: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      const x = (n as unknown as { x?: unknown }).x
      const y = (n as unknown as { y?: unknown }).y
      if (!isFiniteNum(x) || !isFiniteNum(y)) continue
      out[id] = { x, y }
    }
    const fromSvg = extractNodePosByIdFromSvgMarkup(svgMarkupRaw)
    for (const id of Object.keys(fromSvg)) out[id] = fromSvg[id]!
    return out
  })()
  const nodePosByIdJson = JSON.stringify(nodePosByIdObj)

  const markdownBlocksJson = (() => {
    try {
      const graph = args.graphData
      if (!graph) return '[]'
      const layout = deriveMarkdownDesignLayoutFromGraphBlocks({ graphData: graph, nodePosById: nodePosByIdObj })
      const blocks = layout && Array.isArray(layout.blocks) ? layout.blocks : []
      return JSON.stringify(blocks)
    } catch {
      return '[]'
    }
  })()

  const svgMarkupWithEdgeGeometry = ensureSvgHasEdgeGeometry({
    svgMarkup: svgMarkupRaw,
    graphData: args.graphData || ({ nodes: [], edges: [] } as any),
    nodePosById: nodePosByIdObj,
  })

  const interactionCfgJson = JSON.stringify({
    scaleExtent: safeScaleExtent({ minK: args.zoomMinK, maxK: args.zoomMaxK }),
    wheelBehavior: args.wheelBehavior,
    viewportControlsPreset: args.viewportControlsPreset,
    panSpeed: args.panSpeed,
    zoomSpeed: args.zoomSpeed,
    flowWheelZoomSpeedMultiplier: args.flowWheelZoomSpeedMultiplier,
    flowWheelZoomIncrementMultiplier: args.flowWheelZoomIncrementMultiplier,
    flowWheelZoomSmoothMinDurationMs: args.flowWheelZoomSmoothMinDurationMs,
    flowWheelZoomSmoothMaxDurationMs: args.flowWheelZoomSmoothMaxDurationMs,
    wheelZoomCtrlMetaBoostMultiplier: args.wheelZoomCtrlMetaBoostMultiplier,
    canvasInteractionSpeedMultiplier: args.canvasInteractionSpeedMultiplier,
    canvasPanSpeedMultiplier: args.canvasPanSpeedMultiplier,
    snapGridEnabled: args.snapGridEnabled,
    snapGridSize: args.snapGridSize,
    dragConstraint: args.dragConstraint,
    allowNodeDrag: args.allowNodeDrag !== false,
    allowEdgeDrag: args.allowEdgeDrag !== false,
    allowGroupDrag: args.allowGroupDrag !== false,
    preferWebgl3d: args.preferWebgl3d === true,
    initialView: initialView || null,
    fixedViewport: fixedViewport ? { widthPx: fixedViewport.w, heightPx: fixedViewport.h, scaleToFit: args.viewportScaleToFit === true } : null,
    enableDecorativeAnimation: args.enableDecorativeAnimation === true,
    zoomLabelScaleMode2d: args.zoomLabelScaleMode2d,
    zoomLabelScaleExponent2d: args.zoomLabelScaleExponent2d,
    zoomLabelScaleClampMin2d: args.zoomLabelScaleClampMin2d,
    zoomLabelScaleClampMax2d: args.zoomLabelScaleClampMax2d,
    zoomStrokeScaleMode2d: args.zoomStrokeScaleMode2d,
    zoomStrokeScaleExponent2d: args.zoomStrokeScaleExponent2d,
    zoomStrokeScaleClampMin2d: args.zoomStrokeScaleClampMin2d,
    zoomStrokeScaleClampMax2d: args.zoomStrokeScaleClampMax2d,
    hideLabelsBelowScale: args.hideLabelsBelowScale,
  })

  const proxyOrigin = (() => {
    try {
      if (typeof window === 'undefined') return ''
      const origin = String(window.location?.origin || '').trim()
      if (!origin) return ''
      const host = new URL(origin).hostname.toLowerCase()
      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return origin
      return ''
    } catch {
      return ''
    }
  })()

  const svgPlaceholder = svgMarkupWithEdgeGeometry
  const runtimeScript = buildHtmlViewerRuntimeScript({
    interactionCfgJson,
    mediaNodesJson,
    markdownBlocksJson,
    nodeLabelByIdJson,
    edgeMetaByIdJson,
    frontmatterVisibilityJson,
    nodePosByIdJson,
    groupMembersByIdJson,
    density,
    widthRatioDefault,
    widthRatioCompact,
    widthMinDefault,
    widthMinCompact,
    widthMaxDefault,
    widthMaxCompact,
    proxyOrigin,
  })

  const fontFamily = tryReadCssVar('--kg-font-family', 'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial')

  const overlayHtml = String(args.overlayHtml || '')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root{
      --kg-canvas-bg:${escapeHtml(canvasBg)};
      --kg-panel-bg:${escapeHtml(panelBg)};
      --kg-media-panel-bg:${escapeHtml(panelBg)};
      --kg-border:${escapeHtml(border)};
      --kg-text:${escapeHtml(text)};
      --kg-text-primary:${escapeHtml(text)};
      --kg-text-secondary:${escapeHtml(textSecondary)};
      --kg-text-tertiary:${escapeHtml(textTertiary)};
      --kg-panel-action-bg:${escapeHtml(panelActionBg)};
      --kg-panel-action-bg-hover:${escapeHtml(panelActionBgHover)};
      --kg-canvas-edge-stroke:${escapeHtml(canvasEdgeStroke)};
      --kg-canvas-node-stroke:${escapeHtml(canvasNodeStroke)};
      --kg-canvas-accent:${escapeHtml(canvasAccent)};
      --kg-canvas-label-fill:${escapeHtml(canvasLabelFill)};
      --kg-canvas-label-halo:${escapeHtml(canvasLabelHalo)};
      --kg-media-panel-header-bg:${escapeHtml(mediaHeaderBg)};
      --kg-media-panel-header-h:${mediaPanelHeaderH}px;
      --kg-media-panel-border-w:1px;
      --kg-media-panel-radius:${mediaPanelRadius}px;
      --kg-media-panel-padding:${mediaPanelPadding}px;
      --kg-media-panel-title-size:${mediaPanelTitleSize}px;
      --kg-media-panel-header-gap:${mediaPanelHeaderGap}px;
      --kg-media-pointer-events:auto;
    }
    html,body{height:100%;width:100%;margin:0;background:var(--kg-canvas-bg);color:var(--kg-text);font-family:${escapeHtml(fontFamily)};-webkit-user-select:none;user-select:none;-webkit-text-size-adjust:100%;text-size-adjust:100%;overscroll-behavior:none}
    #kg-root{position:fixed;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;cursor:grab;overscroll-behavior:none}
    #kg-root.kg-dragging{cursor:grabbing}
    #kg-root.kg-fixedViewport{inset:auto;left:50%;top:50%;width:var(--kg-fixed-w,1920px);height:var(--kg-fixed-h,1080px);transform:translate(-50%,-50%) scale(var(--kg-fixed-scale,1));transform-origin:center}
    #kg-root *{-webkit-user-select:none;user-select:none}
    #kg-stage{position:absolute;inset:0}
    #kg-webgl{position:absolute;inset:0;width:100%;height:100%;display:none;touch-action:none;outline:none}
    #kg-root.kg-canvas3d #kg-webgl{display:block}
    #kg-root.kg-canvas3d #kg-svgWrap{display:none}
    #kg-svgWrap{position:absolute;inset:0}
    #kg-svgWrap svg{display:block;width:100%;height:100%;overflow:visible;shape-rendering:geometricPrecision;text-rendering:geometricPrecision}
    #kg-svgWrap text{user-select:none;-webkit-user-select:none}
    #kg-svgWrap [data-kg-layer="markdown-design-blocks"]{display:block}
    #kg-overlay{position:fixed;inset:0;pointer-events:none}
    .kg-media{position:absolute;left:0;top:0;box-sizing:border-box;overflow:hidden;contain:layout paint;isolation:isolate;border-radius:var(--kg-media-panel-radius, 10px);border:var(--kg-media-panel-border-w, 1px) solid var(--kg-border);background:var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.92)));box-shadow:0 10px 30px rgba(0,0,0,0.18);backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:left, top, transform, width, height;display:flex;flex-direction:column;pointer-events:auto}
    .kg-mediaHeader{height:var(--kg-media-panel-header-h, 28px);min-height:var(--kg-media-panel-header-h, 28px);box-sizing:border-box;display:flex;align-items:flex-start;justify-content:space-between;gap:var(--kg-media-panel-header-gap, 6px);padding-left:var(--kg-media-panel-padding, 6px);padding-right:var(--kg-media-panel-padding, 6px);padding-top:2px;padding-bottom:2px;background:var(--kg-media-panel-header-bg, var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.96))));color:var(--kg-text-primary, var(--kg-text));font-size:var(--kg-media-panel-title-size, 12px);font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;pointer-events:auto;cursor:grab;touch-action:none}
    .kg-mediaTitle{margin:0;min-width:0;font-size:var(--kg-media-panel-title-size, 12px);font-weight:600;line-height:1.25;color:var(--kg-text-primary, var(--kg-text));white-space:nowrap;text-overflow:ellipsis;overflow:hidden;pointer-events:none}
    .kg-mediaActions{margin:0;padding:0;list-style:none;display:flex;align-items:center;gap:4px;pointer-events:auto}
    .kg-mediaActionBtn{width:calc(var(--kg-media-panel-header-h, 28px) - 6px);height:calc(var(--kg-media-panel-header-h, 28px) - 6px);min-width:calc(var(--kg-media-panel-header-h, 28px) - 6px);min-height:calc(var(--kg-media-panel-header-h, 28px) - 6px);border-radius:6px;color:var(--kg-text-secondary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto}
    button[data-kg-panel-action="1"]{background:var(--kg-panel-action-bg);border:1px solid var(--kg-border);transition:transform 140ms ease, box-shadow 140ms ease, background 140ms ease;touch-action:manipulation}
    button[data-kg-panel-action="1"]:hover{background:var(--kg-panel-action-bg-hover)}
    button[data-kg-panel-action="1"]:active{transform:translateY(1px)}
    .kg-mediaBody{flex:1;padding:var(--kg-media-panel-padding, 6px);box-sizing:border-box;min-height:0;position:relative}
    .kg-mediaBody iframe,.kg-mediaBody img,.kg-mediaBody video{display:block;width:100%;height:100%;border:0;border-radius:calc(var(--kg-media-panel-radius) * 0.8);background:rgba(0,0,0,0.02);pointer-events:var(--kg-media-pointer-events);box-sizing:border-box}
    .kg-mediaSnap{position:absolute;inset:var(--kg-media-panel-padding, 6px);border-radius:calc(var(--kg-media-panel-radius) * 0.8);overflow:hidden;background:linear-gradient(135deg, rgba(15,23,42,0.06), rgba(148,163,184,0.10));border:1px solid rgba(0,0,0,0.06);display:flex;align-items:stretch;justify-content:stretch;pointer-events:none}
    .kg-mediaSnapImg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1.05) contrast(1.02);opacity:0;transition:opacity 220ms ease}
    .kg-mediaSnapMeta{position:absolute;left:0;right:0;bottom:0;padding:10px 10px 9px;background:linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,0.66));color:#fff;display:flex;flex-direction:column;gap:2px}
    .kg-mediaSnapTitle{font-size:12px;line-height:1.25;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .kg-mediaSnapHost{font-size:11px;line-height:1.25;opacity:0.84;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .kg-md{position:absolute;left:0;top:0;display:flex;flex-direction:column;pointer-events:none;background:var(--kg-panel-bg);border:var(--kg-media-panel-border-w) solid var(--kg-border);border-radius:var(--kg-media-panel-radius);box-shadow:0 10px 30px rgba(0,0,0,.12);overflow:hidden;box-sizing:border-box}
    .kg-mdHeader{height:var(--kg-media-panel-header-h);display:flex;align-items:center;gap:8px;padding:0 10px;background:rgba(0,0,0,0.04);border-bottom:var(--kg-media-panel-border-w) solid var(--kg-border)}
    .kg-mdTitle{font-size:var(--kg-media-panel-title-size);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--kg-text-tertiary)}
    .kg-mdBody{position:relative;flex:1;padding:var(--kg-media-panel-padding);box-sizing:border-box}
    .kg-mdTable{width:100%;border-collapse:collapse;font-size:11px;line-height:1.25;color:var(--kg-text)}
    .kg-mdTable th{ text-align:left; border:1px solid var(--kg-border); padding:2px 4px; background:rgba(0,0,0,0.04); font-weight:600 }
    .kg-mdTable td{ border:1px solid var(--kg-border); padding:2px 4px; vertical-align:top }
    .kg-mdCode{margin:0;padding:6px;border-radius:8px;background:rgba(0,0,0,0.06);font-size:11px;line-height:1.35;overflow:hidden;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;white-space:pre;color:var(--kg-text)}
    .kg-mdQuote{border-left:3px solid var(--kg-border);padding-left:8px;color:var(--kg-text);font-size:12px;line-height:1.35;white-space:pre-wrap}
    .kg-mdText{font-size:12px;line-height:1.35;color:var(--kg-text);white-space:pre-wrap}
    .kg-mdCallout{border-left:3px solid var(--kg-canvas-accent);padding-left:8px;color:var(--kg-text);font-size:12px;line-height:1.35}
    .kg-mdCalloutTitle{font-weight:700;margin-bottom:4px}
    #kg-hud{position:absolute;left:max(12px, env(safe-area-inset-left));top:max(12px, env(safe-area-inset-top));display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:1000;max-width:calc(100vw - 24px)}
    .kg-btn{border:1px solid var(--kg-border);background:var(--kg-panel-bg);color:var(--kg-text);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;min-width:32px;min-height:32px;line-height:1.2}
    .kg-btn.kg-active{outline:2px solid rgba(59,130,246,0.6);outline-offset:0}
    .kg-tip{position:absolute;left:0;top:0;transform:translate3d(-99999px,-99999px,0);max-width:min(420px,calc(100vw - 24px));padding:8px 10px;border-radius:12px;background:rgba(17,24,39,.9);color:#fff;font-size:12px;line-height:1.25;pointer-events:none;z-index:9999;backdrop-filter: blur(10px);-webkit-backdrop-filter: blur(10px);border:1px solid rgba(255,255,255,0.08)}
    .kg-tip strong{font-weight:600}
    @media (max-width:520px){.kg-btn{padding:10px 12px;font-size:14px;border-radius:12px;min-width:40px;min-height:40px}}
    @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
    @keyframes kgNodeBob{0%{transform:translateY(0)}50%{transform:translateY(calc(var(--kg-bob-amp,2px) * -1))}100%{transform:translateY(0)}}
  </style>
</head>
<body>
  <div id="kg-root">
    <div id="kg-stage">
      <canvas id="kg-webgl" aria-label="3D canvas" tabindex="-1"></canvas>
      <div id="kg-svgWrap">${svgPlaceholder}</div>
    </div>
    <div id="kg-overlay">${overlayHtml}</div>
    <div id="kg-hud" data-kg-canvas-wheel-ignore="true" data-kg-canvas-pointer-ignore="true">
      <button class="kg-btn" id="kg-fit" type="button">Fit</button>
      <button class="kg-btn" id="kg-reset" type="button">Reset</button>
    </div>
  </div>
  <div id="kg-tooltip" class="kg-tip" aria-hidden="true"></div>
  <script>
${runtimeScript}
  </script>
</body>
</html>`

  return html
}
