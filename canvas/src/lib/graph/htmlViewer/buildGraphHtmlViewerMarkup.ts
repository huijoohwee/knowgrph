import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { ensureKgTokensInstalled, resolveCssVarWithKgFallback } from '@/lib/ui/tokens-ssot'
import { safeScaleExtent } from '@/lib/zoom/scaleExtent'
import { buildHtmlViewerRuntimeScript } from './runtimeScript'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'

type HtmlViewerMediaNode = {
  id: string
  title: string
  url: string
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
}): Promise<string | null> {
  try {
    ensureKgTokensInstalled()
  } catch {
    void 0
  }

  const title = String(args.title || '').trim() || 'Graph viewer'
  const svgMarkupRaw = String(args.svgMarkup || '').trim()

  const hasSvg = !!svgMarkupRaw
  if (!hasSvg) return null

  const canvasBg = resolveCssVarWithKgFallback('--kg-canvas-bg') || '#ffffff'
  const panelBg = resolveCssVarWithKgFallback('--kg-panel-bg') || 'rgba(255,255,255,0.92)'
  const border = resolveCssVarWithKgFallback('--kg-border') || 'rgba(0,0,0,0.12)'
  const text = resolveCssVarWithKgFallback('--kg-text-primary') || 'rgba(0,0,0,0.86)'
  const textTertiary = resolveCssVarWithKgFallback('--kg-text-tertiary') || 'rgba(0,0,0,0.55)'

  const canvasEdgeStroke = resolveCssVarWithKgFallback('--kg-canvas-edge-stroke') || '#9ca3af'
  const canvasNodeStroke = resolveCssVarWithKgFallback('--kg-canvas-node-stroke') || '#ffffff'
  const canvasAccent = resolveCssVarWithKgFallback('--kg-canvas-accent') || '#3b82f6'
  const canvasLabelFill = resolveCssVarWithKgFallback('--kg-canvas-label-fill') || text
  const canvasLabelHalo = resolveCssVarWithKgFallback('--kg-canvas-label-halo') || canvasBg

  const density = args.mediaPanelDensity === 'compact' ? 'compact' : 'default'
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
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    return listMediaOverlayNodes({ enabled: true, nodes, poolMax })
  })()

  const toBase64 = (bytes: Uint8Array): string => {
    const buf = (globalThis as unknown as { Buffer?: { from: (b: Uint8Array) => { toString: (enc: string) => string } } }).Buffer
    if (buf) return buf.from(bytes).toString('base64')
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      const sub = bytes.subarray(i, Math.min(bytes.length, i + chunk))
      binary += String.fromCharCode(...sub)
    }
    const btoaFn = (globalThis as unknown as { btoa?: (s: string) => string }).btoa
    if (!btoaFn) return ''
    return btoaFn(binary)
  }

  const decodeRepoFileUrlToRelPath = (url: string): string | null => {
    const raw = String(url || '').trim()
    if (!raw.startsWith('/__repo_file/')) return null
    const suffix = raw.slice('/__repo_file/'.length)
    if (!suffix) return null
    const decoded = suffix
      .split('/')
      .filter(Boolean)
      .map(seg => {
        try {
          return decodeURIComponent(seg)
        } catch {
          return seg
        }
      })
      .join('/')
    return decoded || null
  }

  const inferMimeFromKindAndPath = (kind: HtmlViewerMediaNode['kind'], relPath: string | null): string => {
    const ext = (() => {
      if (!relPath) return ''
      const i = relPath.lastIndexOf('.')
      return i >= 0 ? relPath.slice(i + 1).toLowerCase() : ''
    })()
    if (kind === 'svg') return 'image/svg+xml'
    if (kind === 'image') {
      if (ext === 'png') return 'image/png'
      if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
      if (ext === 'gif') return 'image/gif'
      if (ext === 'webp') return 'image/webp'
      return 'image/*'
    }
    if (kind === 'video') {
      if (ext === 'mp4') return 'video/mp4'
      if (ext === 'webm') return 'video/webm'
      return 'video/*'
    }
    return 'text/html'
  }

  const fetchBytes = async (url: string): Promise<Uint8Array | null> => {
    try {
      if (typeof fetch !== 'function') return null
      const res = await fetch(url)
      if (!res || !res.ok) return null
      const ab = await res.arrayBuffer()
      return new Uint8Array(ab)
    } catch {
      return null
    }
  }

  const inlineRepoFileMedia = async (nodes: HtmlViewerMediaNode[]): Promise<HtmlViewerMediaNode[]> => {
    if (!nodes || nodes.length === 0) return []
    const MAX_BYTES = 900_000
    const out: HtmlViewerMediaNode[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const url = String(n.url || '').trim()
      const relPath = decodeRepoFileUrlToRelPath(url)
      if (!relPath) {
        out.push(n)
        continue
      }
      const absUrl = (() => {
        try {
          if (/^https?:\/\//i.test(url)) return url
          if (typeof window !== 'undefined' && window.location && /^https?:$/.test(String(window.location.protocol || ''))) {
            return String(window.location.origin || '').replace(/\/+$/, '') + url
          }
        } catch {
          void 0
        }
        return url
      })()
      const bytes = await fetchBytes(absUrl)
      if (!bytes || bytes.length === 0 || bytes.length > MAX_BYTES) {
        out.push(n)
        continue
      }
      const mime = inferMimeFromKindAndPath(n.kind, relPath)
      const b64 = toBase64(bytes)
      if (!b64) {
        out.push(n)
        continue
      }
      const dataUrl = `data:${mime};base64,${b64}`
      out.push({ ...n, url: dataUrl })
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

  const edgeMetaByIdJson = (() => {
    const out: Record<string, { label: string; s: string; t: string }> = {}
    const graph = args.graphData
    const edges = Array.isArray(graph?.edges) ? (graph!.edges as GraphEdge[]) : []
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]
      const id = String(e?.id || '').trim()
      if (!id) continue
      const label = String((e as unknown as { label?: unknown }).label || '').trim()
      const s = String((e as unknown as { source?: unknown }).source || '').trim()
      const t = String((e as unknown as { target?: unknown }).target || '').trim()
      out[id] = { label: label || '', s, t }
    }
    return JSON.stringify(out)
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
    const groups = deriveGraphGroups(graph, { forceDocumentStructure: !isKeywordGraph })
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

  const nodePosByIdJson = (() => {
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
    return JSON.stringify(out)
  })()

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
    initialView: args.initialView || null,
    fixedViewport:
      isFiniteNum(args.viewportWidthPx) && isFiniteNum(args.viewportHeightPx)
        ? { widthPx: Math.max(1, Math.floor(args.viewportWidthPx)), heightPx: Math.max(1, Math.floor(args.viewportHeightPx)), scaleToFit: args.viewportScaleToFit === true }
        : null,
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

  const svgPlaceholder = svgMarkupRaw
  const runtimeScript = buildHtmlViewerRuntimeScript({
    interactionCfgJson,
    mediaNodesJson,
    nodeLabelByIdJson,
    edgeMetaByIdJson,
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
      --kg-border:${escapeHtml(border)};
      --kg-text:${escapeHtml(text)};
      --kg-text-tertiary:${escapeHtml(textTertiary)};
      --kg-canvas-edge-stroke:${escapeHtml(canvasEdgeStroke)};
      --kg-canvas-node-stroke:${escapeHtml(canvasNodeStroke)};
      --kg-canvas-accent:${escapeHtml(canvasAccent)};
      --kg-canvas-label-fill:${escapeHtml(canvasLabelFill)};
      --kg-canvas-label-halo:${escapeHtml(canvasLabelHalo)};
      --kg-media-panel-header-h:28px;
      --kg-media-panel-border-w:1px;
      --kg-media-panel-radius:10px;
      --kg-media-panel-padding:8px;
      --kg-media-panel-title-size:12px;
      --kg-media-pointer-events:none;
    }
    html,body{height:100%;width:100%;margin:0;background:var(--kg-canvas-bg);color:var(--kg-text);font-family:${escapeHtml(fontFamily)};-webkit-user-select:none;user-select:none;-webkit-text-size-adjust:100%;text-size-adjust:100%;overscroll-behavior:none}
    #kg-root{position:fixed;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;cursor:grab;overscroll-behavior:none}
    #kg-root.kg-dragging{cursor:grabbing}
    #kg-root.kg-fixedViewport{inset:auto;left:50%;top:50%;width:var(--kg-fixed-w,1920px);height:var(--kg-fixed-h,1080px);transform:translate(-50%,-50%) scale(var(--kg-fixed-scale,1));transform-origin:center}
    #kg-root *{-webkit-user-select:none;user-select:none}
    #kg-stage{position:fixed;inset:0}
    #kg-webgl{position:fixed;inset:0;width:100%;height:100%;display:none;touch-action:none;outline:none}
    #kg-root.kg-canvas3d #kg-webgl{display:block}
    #kg-root.kg-canvas3d #kg-svgWrap{display:none}
    #kg-svgWrap{position:fixed;inset:0}
    #kg-root.kg-fixedViewport #kg-stage{position:absolute;inset:0}
    #kg-root.kg-fixedViewport #kg-svgWrap{position:absolute;inset:0}
    #kg-svgWrap svg{display:block;width:100%;height:100%;overflow:visible;shape-rendering:geometricPrecision;text-rendering:geometricPrecision}
    #kg-svgWrap text{user-select:none;-webkit-user-select:none}
    #kg-overlay{position:fixed;inset:0;pointer-events:none}
    #kg-root.kg-fixedViewport #kg-overlay{position:absolute;inset:0}
    .kg-media{position:absolute;left:0;top:0;display:flex;flex-direction:column;pointer-events:auto;background:var(--kg-panel-bg);border:var(--kg-media-panel-border-w) solid var(--kg-border);border-radius:var(--kg-media-panel-radius);box-shadow:0 10px 30px rgba(0,0,0,.12);overflow:hidden;box-sizing:border-box}
    .kg-mediaHeader{height:var(--kg-media-panel-header-h);display:flex;align-items:center;gap:8px;padding:0 10px;background:rgba(0,0,0,0.04);border-bottom:var(--kg-media-panel-border-w) solid var(--kg-border);cursor:grab;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;pointer-events:auto}
    .kg-mediaTitle{font-size:var(--kg-media-panel-title-size);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--kg-text-tertiary);pointer-events:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
    .kg-mediaBody{position:relative;flex:1;padding:var(--kg-media-panel-padding);box-sizing:border-box}
    .kg-mediaBody iframe,.kg-mediaBody img,.kg-mediaBody video{display:block;width:100%;height:100%;border:0;border-radius:calc(var(--kg-media-panel-radius) * 0.8);background:rgba(0,0,0,0.02);pointer-events:var(--kg-media-pointer-events);box-sizing:border-box}
    #kg-hud{position:fixed;left:max(12px, env(safe-area-inset-left));top:max(12px, env(safe-area-inset-top));display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:1000;max-width:calc(100vw - 24px)}
    #kg-root.kg-fixedViewport #kg-hud{position:absolute;left:max(12px, env(safe-area-inset-left));top:max(12px, env(safe-area-inset-top))}
    .kg-btn{border:1px solid var(--kg-border);background:var(--kg-panel-bg);color:var(--kg-text);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;min-width:32px;min-height:32px;line-height:1.2}
    .kg-btn.kg-active{outline:2px solid rgba(59,130,246,0.6);outline-offset:0}
    .kg-tip{position:fixed;left:0;top:0;transform:translate3d(-99999px,-99999px,0);max-width:min(420px,calc(100vw - 24px));padding:8px 10px;border-radius:12px;background:rgba(17,24,39,.9);color:#fff;font-size:12px;line-height:1.25;pointer-events:none;z-index:9999;backdrop-filter: blur(10px);-webkit-backdrop-filter: blur(10px);border:1px solid rgba(255,255,255,0.08)}
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
    <div id="kg-overlay"></div>
    <div id="kg-hud" data-kg-canvas-wheel-ignore="true" data-kg-canvas-pointer-ignore="true">
      <button class="kg-btn" id="kg-fit" type="button">Fit</button>
      <button class="kg-btn" id="kg-reset" type="button">Reset</button>
      <button class="kg-btn" id="kg-3d-toggle" type="button" title="Toggle 3D (3)">3D</button>
      <button class="kg-btn" id="kg-rich-toggle" type="button" title="Toggle rich media overlays (R)">Rich</button>
      <button class="kg-btn" id="kg-media-toggle" type="button" title="Toggle media interaction (I)">Media</button>
      <button class="kg-btn" id="kg-frontmatter-toggle" type="button" title="Toggle frontmatter mode (F)">FM</button>
    </div>
  </div>
  <div id="kg-tooltip" class="kg-tip" aria-hidden="true"></div>
  <script type="module">
  (function(){
    try {
      if (window.__kgThreeReady) return;
      window.__kgThreeReady = (async function(){
        try {
          var THREE = await import('https://unpkg.com/three@0.170.0/build/three.module.js');
          var OrbitControlsMod = await import('https://unpkg.com/three@0.170.0/examples/jsm/controls/OrbitControls.js');
          var Lines2 = await import('https://unpkg.com/three@0.170.0/examples/jsm/lines/Line2.js');
          var LinesGeom = await import('https://unpkg.com/three@0.170.0/examples/jsm/lines/LineSegmentsGeometry.js');
          var LinesMat = await import('https://unpkg.com/three@0.170.0/examples/jsm/lines/LineMaterial.js');
          return {
            THREE: THREE,
            OrbitControls: OrbitControlsMod && OrbitControlsMod.OrbitControls ? OrbitControlsMod.OrbitControls : null,
            Line2: Lines2 && Lines2.Line2 ? Lines2.Line2 : null,
            LineSegmentsGeometry: LinesGeom && LinesGeom.LineSegmentsGeometry ? LinesGeom.LineSegmentsGeometry : null,
            LineMaterial: LinesMat && LinesMat.LineMaterial ? LinesMat.LineMaterial : null,
          };
        } catch (e) {
          return null;
        }
      })();
    } catch (e) {}
  })();
  </script>
  <script>
${runtimeScript}
  </script>
</body>
</html>`

  return html
}
