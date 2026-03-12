import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { ensureKgTokensInstalled, resolveCssVarWithKgFallback } from '@/lib/ui/tokens-ssot'
import { safeScaleExtent } from '@/lib/zoom/scaleExtent'

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
  const widthRatioDefault = isFiniteNum(args.threeIframeOverlayBaseWidthRatioDefault) ? Math.max(0.001, args.threeIframeOverlayBaseWidthRatioDefault) : 0.2
  const widthRatioCompact = isFiniteNum(args.threeIframeOverlayBaseWidthRatioCompact) ? Math.max(0.001, args.threeIframeOverlayBaseWidthRatioCompact) : 0.2
  const widthMinDefault = isFiniteNum(args.threeIframeOverlayBaseWidthMinPxDefault) ? Math.max(1, Math.floor(args.threeIframeOverlayBaseWidthMinPxDefault)) : 210
  const widthMinCompact = isFiniteNum(args.threeIframeOverlayBaseWidthMinPxCompact) ? Math.max(1, Math.floor(args.threeIframeOverlayBaseWidthMinPxCompact)) : 210
  const widthMaxDefault = isFiniteNum(args.threeIframeOverlayBaseWidthMaxPxDefault) ? Math.max(1, Math.floor(args.threeIframeOverlayBaseWidthMaxPxDefault)) : 360
  const widthMaxCompact = isFiniteNum(args.threeIframeOverlayBaseWidthMaxPxCompact) ? Math.max(1, Math.floor(args.threeIframeOverlayBaseWidthMaxPxCompact)) : 360

  const mediaNodes = (() => {
    if (args.includeRichMediaOverlays !== true) return []
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    const poolMaxRaw = isFiniteNum(args.mediaOverlayPoolMax) ? Math.max(0, Math.floor(args.mediaOverlayPoolMax)) : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    return listMediaOverlayNodes({ enabled: true, nodes, poolMax })
  })()

  const mediaNodesJson = JSON.stringify(mediaNodes)

  const scaleExtent = safeScaleExtent({
    minK: isFiniteNum(args.zoomMinK) ? args.zoomMinK : 0.05,
    maxK: isFiniteNum(args.zoomMaxK) ? args.zoomMaxK : 50,
  })
  const wheelBehavior = args.wheelBehavior === 'pan' || args.wheelBehavior === 'zoom' ? args.wheelBehavior : 'preset'
  const viewportControlsPreset = args.viewportControlsPreset === 'design' ? 'design' : 'map'
  const panSpeed = isFiniteNum(args.panSpeed) ? Math.max(0.1, Math.min(5, args.panSpeed)) : 1
  const zoomSpeed = isFiniteNum(args.zoomSpeed) ? Math.max(0.1, Math.min(5, args.zoomSpeed)) : 1
  const flowWheelZoomSpeedMultiplier = isFiniteNum(args.flowWheelZoomSpeedMultiplier)
    ? Math.max(0.01, Math.min(10, args.flowWheelZoomSpeedMultiplier))
    : 0.6
  const flowWheelZoomIncrementMultiplier = isFiniteNum(args.flowWheelZoomIncrementMultiplier)
    ? Math.max(0.01, Math.min(10, args.flowWheelZoomIncrementMultiplier))
    : 3
  const flowWheelZoomSmoothMinDurationMs = isFiniteNum(args.flowWheelZoomSmoothMinDurationMs)
    ? Math.max(0, Math.min(2000, Math.floor(args.flowWheelZoomSmoothMinDurationMs)))
    : 40
  const flowWheelZoomSmoothMaxDurationMs = isFiniteNum(args.flowWheelZoomSmoothMaxDurationMs)
    ? Math.max(flowWheelZoomSmoothMinDurationMs, Math.min(4000, Math.floor(args.flowWheelZoomSmoothMaxDurationMs)))
    : 110
  const wheelZoomCtrlMetaBoostMultiplier = isFiniteNum(args.wheelZoomCtrlMetaBoostMultiplier)
    ? Math.max(1, Math.min(400, args.wheelZoomCtrlMetaBoostMultiplier))
    : 120
  const canvasInteractionSpeedMultiplier = isFiniteNum(args.canvasInteractionSpeedMultiplier)
    ? Math.max(0.25, Math.min(3, args.canvasInteractionSpeedMultiplier))
    : 1
  const canvasPanSpeedMultiplier = isFiniteNum(args.canvasPanSpeedMultiplier)
    ? Math.max(0.25, Math.min(3, args.canvasPanSpeedMultiplier))
    : 1
  const snapGridEnabled = args.snapGridEnabled === true
  const snapGridSize = isFiniteNum(args.snapGridSize) ? Math.max(1, Math.floor(args.snapGridSize)) : 10
  const dragConstraint =
    args.dragConstraint === 'axis-x' || args.dragConstraint === 'axis-y' || args.dragConstraint === 'none'
      ? args.dragConstraint
      : 'free'
  const allowNodeDrag = args.allowNodeDrag !== false
  const allowEdgeDrag = args.allowEdgeDrag !== false
  const allowGroupDrag = args.allowGroupDrag !== false

  const interactionCfgJson = JSON.stringify({
    scaleExtent,
    wheelBehavior,
    viewportControlsPreset,
    panSpeed,
    zoomSpeed,
    flowWheelZoomSpeedMultiplier,
    flowWheelZoomIncrementMultiplier,
    flowWheelZoomSmoothMinDurationMs,
    flowWheelZoomSmoothMaxDurationMs,
    wheelZoomCtrlMetaBoostMultiplier,
    canvasInteractionSpeedMultiplier,
    canvasPanSpeedMultiplier,
    snapGridEnabled,
    snapGridSize,
    dragConstraint,
    allowNodeDrag,
    allowEdgeDrag,
    allowGroupDrag,
  })

  const groupMembersByIdJson = (() => {
    const graph = args.graphData
    const nodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    const out: Record<string, string[]> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      const props = (n as unknown as { properties?: unknown }).properties
      const p = props && typeof props === 'object' && !Array.isArray(props) ? (props as Record<string, unknown>) : null
      if (!p) continue
      const gid = typeof p['kg:groupId'] === 'string' ? String(p['kg:groupId'] || '').trim() : ''
      if (!gid) continue
      const arr = out[gid] || (out[gid] = [])
      arr.push(id)
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

  const svgPlaceholder = hasSvg ? svgMarkupRaw : ''
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
    html,body{height:100%;width:100%;margin:0;background:var(--kg-canvas-bg);color:var(--kg-text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;-webkit-user-select:none;user-select:none}
    #kg-root{position:fixed;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;cursor:grab}
    #kg-root.kg-dragging{cursor:grabbing}
    #kg-root *{-webkit-user-select:none;user-select:none}
    #kg-stage{position:fixed;inset:0}
    #kg-svgWrap{position:fixed;inset:0}
    #kg-svgWrap svg{display:block;width:100%;height:100%;overflow:visible;shape-rendering:geometricPrecision;text-rendering:geometricPrecision}
    #kg-svgWrap text{user-select:none;-webkit-user-select:none}
    #kg-overlay{position:fixed;inset:0;pointer-events:auto}
    .kg-media{position:absolute;left:0;top:0;display:flex;flex-direction:column;pointer-events:auto;background:var(--kg-panel-bg);border:var(--kg-media-panel-border-w) solid var(--kg-border);border-radius:var(--kg-media-panel-radius);box-shadow:0 10px 30px rgba(0,0,0,.12);overflow:hidden;box-sizing:border-box}
    .kg-mediaHeader{height:var(--kg-media-panel-header-h);display:flex;align-items:center;gap:8px;padding:0 10px;background:rgba(0,0,0,0.04);border-bottom:var(--kg-media-panel-border-w) solid var(--kg-border);cursor:grab;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;pointer-events:auto}
    .kg-mediaTitle{font-size:var(--kg-media-panel-title-size);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--kg-text-tertiary);pointer-events:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
    .kg-mediaBody{position:relative;flex:1;padding:var(--kg-media-panel-padding);box-sizing:border-box}
    .kg-mediaBody iframe,.kg-mediaBody img,.kg-mediaBody video{display:block;width:100%;height:100%;border:0;border-radius:calc(var(--kg-media-panel-radius) * 0.8);background:rgba(0,0,0,0.02);pointer-events:var(--kg-media-pointer-events);box-sizing:border-box}
    #kg-hud{position:fixed;left:12px;top:12px;display:flex;gap:8px;z-index:1000}
    .kg-btn{border:1px solid var(--kg-border);background:var(--kg-panel-bg);color:var(--kg-text);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer}
    .kg-btn.kg-active{outline:2px solid rgba(59,130,246,0.6);outline-offset:0}
  </style>
</head>
<body>
  <div id="kg-root">
    <div id="kg-stage">
      <div id="kg-svgWrap">${svgPlaceholder}</div>
    </div>
    <div id="kg-overlay"></div>
    <div id="kg-hud" data-kg-canvas-wheel-ignore="true" data-kg-canvas-pointer-ignore="true">
      <button class="kg-btn" id="kg-fit" type="button">Fit</button>
      <button class="kg-btn" id="kg-reset" type="button">Reset</button>
      <button class="kg-btn" id="kg-pan" type="button" title="Toggle pan mode (P)">Pan</button>
      <button class="kg-btn" id="kg-media-toggle" type="button" title="Toggle media interaction (I)">Media</button>
    </div>
  </div>
  <script>
  (function(){
    var root = document.getElementById('kg-root');
    var stage = document.getElementById('kg-stage');
    var svg = (document.querySelector('#kg-svgWrap svg') || null);
    var overlay = document.getElementById('kg-overlay');
    var hud = document.getElementById('kg-hud');
    var fitBtn = document.getElementById('kg-fit');
    var resetBtn = document.getElementById('kg-reset');
    var panBtn = document.getElementById('kg-pan');
    var mediaBtn = document.getElementById('kg-media-toggle');

    var state = { k: 1, x: 0, y: 0 };
    var cfg = ${interactionCfgJson};
    var minK = (cfg && cfg.scaleExtent && typeof cfg.scaleExtent.minK === 'number') ? cfg.scaleExtent.minK : 0.05;
    var maxK = (cfg && cfg.scaleExtent && typeof cfg.scaleExtent.maxK === 'number') ? cfg.scaleExtent.maxK : 50;
    var wheelBehavior = (cfg && (cfg.wheelBehavior === 'pan' || cfg.wheelBehavior === 'zoom')) ? cfg.wheelBehavior : 'preset';
    var viewportControlsPreset = (cfg && cfg.viewportControlsPreset === 'design') ? 'design' : 'map';
    var panSpeed = (cfg && typeof cfg.panSpeed === 'number' && isFinite(cfg.panSpeed)) ? cfg.panSpeed : 1;
    var zoomSpeed = (cfg && typeof cfg.zoomSpeed === 'number' && isFinite(cfg.zoomSpeed)) ? cfg.zoomSpeed : 1;
    var flowWheelZoomSpeedMultiplier = (cfg && typeof cfg.flowWheelZoomSpeedMultiplier === 'number' && isFinite(cfg.flowWheelZoomSpeedMultiplier)) ? cfg.flowWheelZoomSpeedMultiplier : 0.6;
    var flowWheelZoomIncrementMultiplier = (cfg && typeof cfg.flowWheelZoomIncrementMultiplier === 'number' && isFinite(cfg.flowWheelZoomIncrementMultiplier)) ? cfg.flowWheelZoomIncrementMultiplier : 3;
    var flowWheelZoomSmoothMinDurationMs = (cfg && typeof cfg.flowWheelZoomSmoothMinDurationMs === 'number' && isFinite(cfg.flowWheelZoomSmoothMinDurationMs)) ? cfg.flowWheelZoomSmoothMinDurationMs : 40;
    var flowWheelZoomSmoothMaxDurationMs = (cfg && typeof cfg.flowWheelZoomSmoothMaxDurationMs === 'number' && isFinite(cfg.flowWheelZoomSmoothMaxDurationMs)) ? cfg.flowWheelZoomSmoothMaxDurationMs : 110;
    var wheelZoomCtrlMetaBoostMultiplier = (cfg && typeof cfg.wheelZoomCtrlMetaBoostMultiplier === 'number' && isFinite(cfg.wheelZoomCtrlMetaBoostMultiplier)) ? cfg.wheelZoomCtrlMetaBoostMultiplier : 120;
    var canvasInteractionSpeedMultiplier = (cfg && typeof cfg.canvasInteractionSpeedMultiplier === 'number' && isFinite(cfg.canvasInteractionSpeedMultiplier)) ? cfg.canvasInteractionSpeedMultiplier : 1;
    var canvasPanSpeedMultiplier = (cfg && typeof cfg.canvasPanSpeedMultiplier === 'number' && isFinite(cfg.canvasPanSpeedMultiplier)) ? cfg.canvasPanSpeedMultiplier : 1;
    var snapGridEnabled = !!(cfg && cfg.snapGridEnabled === true);
    var snapGridSize = (cfg && typeof cfg.snapGridSize === 'number' && isFinite(cfg.snapGridSize)) ? Math.max(1, Math.floor(cfg.snapGridSize)) : 10;
    var dragConstraint = (cfg && (cfg.dragConstraint === 'axis-x' || cfg.dragConstraint === 'axis-y' || cfg.dragConstraint === 'none')) ? cfg.dragConstraint : 'free';
    var allowNodeDrag = !(cfg && cfg.allowNodeDrag === false);
    var allowEdgeDrag = !(cfg && cfg.allowEdgeDrag === false);
    var allowGroupDrag = !(cfg && cfg.allowGroupDrag === false);
    var lastOverlayKey = '';
    var mediaNodes = ${mediaNodesJson};
    var nodePosById = ${nodePosByIdJson};
    var groupMembersById = ${groupMembersByIdJson};
    var overlayFollowAnimation = (function(){
      try {
        if (!svg || !svg.getAttribute) return false;
        var raw = String(svg.getAttribute('data-kg-3d-payload') || '').trim();
        if (!raw) return false;
        var payload = JSON.parse(raw);
        return !!(payload && payload.animated === true);
      } catch (err) {
        return false;
      }
    })();
    var svgNodeById = Object.create(null);
    var svgNodeElsById = Object.create(null);
    var svgGroupElsById = Object.create(null);
    var edgeRefsByNodeId = Object.create(null);
    var edgeLabelElsByEdgeId = Object.create(null);
    var edgeLineByEdgeId = Object.create(null);
    var selectionState = { nodeId: null, edgeId: null };
    var lastSelectionKey = '';
    var mediaInteractive = false;
    var panHeld = false;
    var pointerMode = 'select';

    var UI_IGNORE_SELECTOR = '[data-kg-canvas-wheel-ignore="true"], [data-kg-canvas-pointer-ignore="true"]';

    function easeOutCubic01(t){
      if (!(t > 0)) return 0;
      if (!(t < 1)) return 1;
      var u = 1 - t;
      return 1 - u * u * u;
    }
    function lerpNumber(a,b,t){ return a + (b - a) * t; }
    function computeFlowWheelZoomDurationMs(args){
      var safe = (args && typeof args.deltaYpxAbs === 'number' && isFinite(args.deltaYpxAbs)) ? args.deltaYpxAbs : 0;
      var minMs = (args && typeof args.minMs === 'number' && isFinite(args.minMs)) ? Math.max(0, Math.floor(args.minMs)) : 0;
      var maxMs = (args && typeof args.maxMs === 'number' && isFinite(args.maxMs)) ? Math.max(minMs, Math.floor(args.maxMs)) : minMs;
      var scaled = minMs + Math.min(Math.max(0, maxMs - minMs), safe * 0.18);
      return Math.max(minMs, Math.min(maxMs, Math.round(scaled)));
    }

    function safeViewportTransform(t){
      var k = t && isFinite(t.k) ? Math.max(0.001, t.k) : 1;
      var x = t && isFinite(t.x) ? t.x : 0;
      var y = t && isFinite(t.y) ? t.y : 0;
      return { k: k, x: x, y: y };
    }
    function screenToWorld(args){
      var t = safeViewportTransform(args && args.transform ? args.transform : null);
      var sx = (args && isFinite(args.sx)) ? args.sx : 0;
      var sy = (args && isFinite(args.sy)) ? args.sy : 0;
      var baseSx = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;
      var baseSy = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;
      var ox = (svgBase && isFinite(svgBase.ox)) ? svgBase.ox : 0;
      var oy = (svgBase && isFinite(svgBase.oy)) ? svgBase.oy : 0;
      return { x: (sx - t.x - ox) / (t.k * baseSx), y: (sy - t.y - oy) / (t.k * baseSy) };
    }
    function computeAnchoredTransform(args){
      var t0 = safeViewportTransform(args && args.transform ? args.transform : null);
      var nextK = (args && isFinite(args.nextK)) ? args.nextK : t0.k;
      var sx = (args && args.anchor && isFinite(args.anchor.sx)) ? args.anchor.sx : 0;
      var sy = (args && args.anchor && isFinite(args.anchor.sy)) ? args.anchor.sy : 0;
      var world = screenToWorld({ transform: t0, sx: sx, sy: sy });
      var baseSx = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;
      var baseSy = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;
      var ox = (svgBase && isFinite(svgBase.ox)) ? svgBase.ox : 0;
      var oy = (svgBase && isFinite(svgBase.oy)) ? svgBase.oy : 0;
      var nextX = sx - ox - world.x * nextK * baseSx;
      var nextY = sy - oy - world.y * nextK * baseSy;
      return { k: nextK, x: nextX, y: nextY };
    }

    function normalizeWheelDeltaXpx(e){
      var raw = (e && typeof e.deltaX === 'number' && isFinite(e.deltaX)) ? e.deltaX : 0;
      var mode = (e && typeof e.deltaMode === 'number' && isFinite(e.deltaMode)) ? e.deltaMode : 0;
      if (mode === 1) return raw * 16;
      if (mode === 2) return raw * 800;
      return raw;
    }
    function normalizeWheelDeltaYpx(e){
      var raw = (e && typeof e.deltaY === 'number' && isFinite(e.deltaY)) ? e.deltaY : 0;
      var mode = (e && typeof e.deltaMode === 'number' && isFinite(e.deltaMode)) ? e.deltaMode : 0;
      if (mode === 1) return raw * 16;
      if (mode === 2) return raw * 800;
      return raw;
    }
    function normalizeWheelDeltasPx(e){ return { dx: normalizeWheelDeltaXpx(e), dy: normalizeWheelDeltaYpx(e) }; }
    function computeWheelZoomFactor(deltaYpx){
      var VIEWPORT_WHEEL_ZOOM_SENSITIVITY = 0.001;
      var safe = isFinite(deltaYpx) ? deltaYpx : 0;
      return Math.exp(-safe * VIEWPORT_WHEEL_ZOOM_SENSITIVITY);
    }
    function clampWheelZoomCtrlMetaBoostMultiplier(v){
      var def = 120, min = 1, max = 400;
      if (typeof v !== 'number' || !isFinite(v)) return def;
      if (v < min) return min;
      if (v > max) return max;
      return v;
    }
    function computeZoomWheelDeltaYpx(e, multiplier, ctrlMetaBoostMultiplier){
      var m = (typeof multiplier === 'number' && isFinite(multiplier)) ? multiplier : 1;
      var base = normalizeWheelDeltaYpx(e);
      var isCtrlMeta = !!(e && (e.ctrlKey === true || e.metaKey === true));
      var pinchBoost = 1;
      if (isCtrlMeta) {
        var absBase = Math.abs(base);
        var frac = Math.abs(base - Math.round(base));
        var looksLikeTrackpadPinch = absBase > 0 && absBase <= 240 && frac > 1e-3;
        if (looksLikeTrackpadPinch) pinchBoost = clampWheelZoomCtrlMetaBoostMultiplier(ctrlMetaBoostMultiplier);
        else {
          var looksLikeMouseWheel = absBase >= 60 && frac <= 1e-3;
          if (!looksLikeMouseWheel) {
            if (absBase <= 40) pinchBoost = clampWheelZoomCtrlMetaBoostMultiplier(ctrlMetaBoostMultiplier);
          }
        }
      }
      return base * m * pinchBoost;
    }
    function coerceWheelFallback(args){
      var fb = args ? args.fallback : null;
      if (!fb) return null;
      if (!isFinite(fb.sx) || !isFinite(fb.sy)) return null;
      var ts = (typeof fb.ts === 'number' && isFinite(fb.ts)) ? fb.ts : null;
      if (ts != null) {
        var ageMs = args.nowMs - ts;
        if (!isFinite(ageMs) || ageMs < 0 || ageMs > args.maxAgeMs) return null;
      }
      return { sx: fb.sx, sy: fb.sy };
    }
    function resolveWheelAnchor(args){
      var rect = args.rect;
      var sx = args.clientX - rect.left;
      var sy = args.clientY - rect.top;
      var inside = isFinite(sx) && isFinite(sy) && sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height;
      if (inside) return { sx: sx, sy: sy, source: 'event' };
      var clamp = function(v,lo,hi){ if (!isFinite(v)) return lo; return Math.max(lo, Math.min(hi, v)); };
      if (isFinite(sx) && isFinite(sy) && isFinite(rect.width) && isFinite(rect.height)) {
        var edgeSnapMarginPx = 24;
        var clampedSx = clamp(sx, 0, rect.width);
        var clampedSy = clamp(sy, 0, rect.height);
        var outsideDx = sx < 0 ? -sx : sx > rect.width ? sx - rect.width : 0;
        var outsideDy = sy < 0 ? -sy : sy > rect.height ? sy - rect.height : 0;
        if (Math.max(outsideDx, outsideDy) <= edgeSnapMarginPx) {
          return { sx: clampedSx, sy: clampedSy, source: 'event' };
        }
      }
      var fb = args.fallback;
      if (fb && isFinite(fb.sx) && isFinite(fb.sy)) return { sx: fb.sx, sy: fb.sy, source: 'fallback' };
      return { sx: rect.width * 0.5, sy: rect.height * 0.5, source: 'center' };
    }
    function createZoomWheelGuardState(){ return { lastClampedOutAtMinTs: null }; }
    function computeZoomWheelIntent(deltaYpx){ return deltaYpx < 0 ? 'in' : 'out'; }
    function computeZoomWheelGuardDecision(args){
      var currentK = isFinite(args.currentK) ? args.currentK : 1;
      var minK0 = isFinite(args.minK) ? args.minK : 0.05;
      var maxK0 = isFinite(args.maxK) ? args.maxK : 8;
      var nowMs = isFinite(args.nowMs) ? args.nowMs : 0;
      var deltaYpx = isFinite(args.deltaYpx) ? args.deltaYpx : 0;
      var eps = 1e-6;
      var atMin = currentK <= minK0 + eps;
      var atMax = currentK >= maxK0 - eps;
      var intent = computeZoomWheelIntent(deltaYpx);
      var nextState = { lastClampedOutAtMinTs: atMin ? args.state.lastClampedOutAtMinTs : null };
      if ((atMin && intent === 'out') || (atMax && intent === 'in')) {
        if (atMin) nextState.lastClampedOutAtMinTs = nowMs;
        return { block: true, nextState: nextState };
      }
      if (atMin && intent === 'in') {
        var lastClampTs = nextState.lastClampedOutAtMinTs;
        var ageMs = lastClampTs == null ? Infinity : nowMs - lastClampTs;
        var smallReverse = Math.abs(deltaYpx) < 40;
        if (isFinite(ageMs) && ageMs >= 0 && ageMs < 220 && smallReverse) {
          return { block: true, nextState: nextState };
        }
      }
      return { block: false, nextState: nextState };
    }
    function shouldIgnoreCanvasWheelEvent(args){
      var event = args.event;
      var ignoreSelector = args.ignoreSelector;
      if (!ignoreSelector) return false;
      if (typeof document === 'undefined') return false;
      try { if (event && event.__kgForwarded === true) return false; } catch (err) {}
      var clientX = event && typeof event.clientX === 'number' ? event.clientX : null;
      var clientY = event && typeof event.clientY === 'number' ? event.clientY : null;
      function isFiniteNumber(v){ return typeof v === 'number' && isFinite(v); }
      function isClientPointInsideRect(x,y,rect){ return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom; }
      if (isFiniteNumber(clientX) && isFiniteNumber(clientY)) {
        var top = (typeof document.elementFromPoint === 'function') ? document.elementFromPoint(clientX, clientY) : null;
        if (top && typeof top.closest === 'function') {
          if (top.closest(ignoreSelector)) return true;
        }
        var ignoreNodes = document.querySelectorAll(ignoreSelector);
        if (!ignoreNodes || ignoreNodes.length === 0) return false;
        for (var i = 0; i < ignoreNodes.length; i += 1) {
          var el = ignoreNodes[i];
          if (!(el instanceof HTMLElement)) continue;
          try {
            var styles = getComputedStyle(el);
            if (styles.display === 'none') continue;
            if (styles.visibility === 'hidden') continue;
            var opacity = parseFloat(styles.opacity);
            if (isFinite(opacity) && opacity <= 0.01) continue;
          } catch (err) {}
          var rect = el.getBoundingClientRect();
          if (!(rect.width > 0 && rect.height > 0)) continue;
          if (isClientPointInsideRect(clientX, clientY, rect)) return true;
        }
        return false;
      }
      var nativeTarget = event && event.target ? event.target : null;
      if (nativeTarget && nativeTarget instanceof Element) {
        if (nativeTarget.closest(ignoreSelector)) return true;
      }
      var composedPath = event && typeof event.composedPath === 'function' ? event.composedPath : null;
      if (typeof composedPath === 'function') {
        var path = composedPath();
        for (var j = 0; j < path.length; j += 1) {
          var p = path[j];
          if (p instanceof Element && typeof p.closest === 'function') {
            if (p.closest(ignoreSelector)) return true;
          }
        }
      }
      return false;
    }

    function coerceViewportControlsPreset(value){
      var v = (typeof value === 'string') ? value : '';
      if (v === 'design' || v === 'map') return v;
      return 'map';
    }
    function shouldWheelZoomForPreset(e,preset){
      if (preset === 'design') return e && (e.ctrlKey === true || e.metaKey === true);
      return true;
    }
    function computeWheelPanDeltaPx(e){
      var d = normalizeWheelDeltasPx(e);
      if (e && e.shiftKey === true && Math.abs(d.dx) < 1e-6) return { dx: d.dy, dy: 0 };
      return d;
    }
    function isPanDragButton(button,preset){
      var b = (typeof button === 'number' && isFinite(button)) ? button : 0;
      if (preset === 'design') return b === 1 || b === 2;
      return b === 0;
    }
    function shouldAllowPanDragForPreset(args){
      var type = (typeof args.eventType === 'string') ? args.eventType : '';
      if (type.indexOf('touch') === 0) return true;
      if (args.preset === 'design') {
        if (isPanDragButton(args.button, args.preset)) return true;
        return args.spacePanHeld === true && args.button === 0;
      }
      return isPanDragButton(args.button, args.preset);
    }
    function shouldAllowPanDragForPointerEvent(args){
      var type = (typeof args.eventType === 'string') ? args.eventType : '';
      var isDown = type === 'pointerdown' || type === 'mousedown';
      if (args.preset === 'map' && args.shiftKey === true && isDown && args.button === 0) return false;
      return shouldAllowPanDragForPreset({ preset: args.preset, eventType: type, button: args.button, spacePanHeld: args.spacePanHeld });
    }
    function shouldSuppressContextMenuForPreset(preset){ return preset === 'design'; }

    var lastPointerInCanvas = null;
    var guardState = createZoomWheelGuardState();
    var wheelZoomAnimRaf = null;
    var wheelZoomAnimStart = 0;
    var wheelZoomAnimDurationMs = 0;
    var wheelZoomFrom = { k: 1, x: 0, y: 0 };
    var wheelZoomToK = 1;
    var wheelZoomAnchor = { sx: 0, sy: 0 };

    function cancelWheelZoomAnimation(){
      if (wheelZoomAnimRaf == null) return;
      try { cancelAnimationFrame(wheelZoomAnimRaf); } catch (err) {}
      wheelZoomAnimRaf = null;
    }
    function tickWheelZoomAnimation(now){
      var elapsed = now - wheelZoomAnimStart;
      var raw01 = wheelZoomAnimDurationMs > 0 ? elapsed / wheelZoomAnimDurationMs : 1;
      var eased = easeOutCubic01(raw01);
      var k = lerpNumber(wheelZoomFrom.k, wheelZoomToK, eased);
      var next = computeAnchoredTransform({ transform: wheelZoomFrom, anchor: wheelZoomAnchor, nextK: k });
      state.k = next.k; state.x = next.x; state.y = next.y;
      applyTransform();
      if (!(raw01 < 1)) { wheelZoomAnimRaf = null; return; }
      wheelZoomAnimRaf = requestAnimationFrame(tickWheelZoomAnimation);
    }
    function startWheelZoomAnimation(args){
      cancelWheelZoomAnimation();
      wheelZoomFrom = safeViewportTransform(args.from);
      wheelZoomToK = (typeof args.toK === 'number' && isFinite(args.toK)) ? args.toK : wheelZoomFrom.k;
      wheelZoomAnchor = { sx: args.anchor.sx, sy: args.anchor.sy };
      wheelZoomAnimDurationMs = Math.max(0, Math.floor(args.durationMs));
      wheelZoomAnimStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      wheelZoomAnimRaf = requestAnimationFrame(tickWheelZoomAnimation);
    }

    function rebuildSvgNodeIndex(){
      svgNodeById = Object.create(null);
      svgNodeElsById = Object.create(null);
      svgGroupElsById = Object.create(null);
      edgeRefsByNodeId = Object.create(null);
      edgeLabelElsByEdgeId = Object.create(null);
      edgeLineByEdgeId = Object.create(null);
      if (!svg || !svg.querySelectorAll) return;
      var nodeEls = svg.querySelectorAll('[data-node-id]');
      for (var i = 0; i < nodeEls.length; i += 1) {
        var el = nodeEls[i];
        if (!el || !el.getAttribute) continue;
        var id = String(el.getAttribute('data-node-id') || '');
        if (!id) continue;
        if (!svgNodeById[id]) svgNodeById[id] = el;
        var arr = svgNodeElsById[id] || (svgNodeElsById[id] = []);
        arr.push(el);
      }
      var groupEls = svg.querySelectorAll('[data-kg-group-id]');
      for (var j = 0; j < groupEls.length; j += 1) {
        var ge = groupEls[j];
        if (!ge || !ge.getAttribute) continue;
        var gid = String(ge.getAttribute('data-kg-group-id') || '');
        if (!gid) continue;
        var garr = svgGroupElsById[gid] || (svgGroupElsById[gid] = []);
        garr.push(ge);
      }
      var edgeEls = svg.querySelectorAll('line[data-source-id][data-target-id], line[data-source][data-target]');
      for (var k = 0; k < edgeEls.length; k += 1) {
        var ee = edgeEls[k];
        if (!ee || !ee.getAttribute) continue;
        var src = String(ee.getAttribute('data-source-id') || ee.getAttribute('data-source') || '').trim();
        var tgt = String(ee.getAttribute('data-target-id') || ee.getAttribute('data-target') || '').trim();
        if (!src || !tgt) continue;
        try {
          var eid0 = String(ee.getAttribute('data-edge-id') || '').trim();
          if (eid0 && !edgeLineByEdgeId[eid0]) edgeLineByEdgeId[eid0] = ee;
        } catch (err) {}
        var a0 = edgeRefsByNodeId[src] || (edgeRefsByNodeId[src] = []);
        a0.push({ el: ee, end: 's' });
        var a1 = edgeRefsByNodeId[tgt] || (edgeRefsByNodeId[tgt] = []);
        a1.push({ el: ee, end: 't' });
      }
      var edgeLabelEls = svg.querySelectorAll('[data-kg-edge-label="1"][data-edge-id], text[data-kg-edge-label][data-edge-id]');
      for (var li = 0; li < edgeLabelEls.length; li += 1) {
        var le = edgeLabelEls[li];
        if (!le || !le.getAttribute) continue;
        var eid = String(le.getAttribute('data-edge-id') || '').trim();
        if (!eid) continue;
        var arr = edgeLabelElsByEdgeId[eid] || (edgeLabelElsByEdgeId[eid] = []);
        arr.push(le);
      }
      try { rebuildNodePosFromSvg(); } catch (err) {}
      try { updateAllEdgeLabelPositions(); } catch (err) {}
      try { applySelectionHighlight(); } catch (err) {}
    }

    function setSelection(next){
      var nextNodeId = next && typeof next.nodeId === 'string' ? String(next.nodeId || '').trim() : '';
      var nextEdgeId = next && typeof next.edgeId === 'string' ? String(next.edgeId || '').trim() : '';
      selectionState.nodeId = nextNodeId || null;
      selectionState.edgeId = nextEdgeId || null;
      try { applySelectionHighlight(); } catch (err) {}
    }

    function ensureBaseAttr(el, name, value){
      if (!el || !el.getAttribute || !el.setAttribute) return;
      if (el.getAttribute(name) != null) return;
      el.setAttribute(name, String(value == null ? '' : value));
    }

    function coerceBaseOpacity(el){
      if (!el) return 1;
      var existing = null;
      try { existing = el.getAttribute('data-kg-base-opacity'); } catch (err) {}
      if (existing != null && existing !== '') {
        var v = parseFloat(existing);
        return isFinite(v) ? v : 1;
      }
      var raw = '';
      try { raw = (el.style && typeof el.style.opacity === 'string') ? el.style.opacity : ''; } catch (err) {}
      if (!raw) {
        try { raw = String(el.getAttribute('opacity') || '').trim(); } catch (err) {}
      }
      var parsed = parseFloat(raw || 'NaN');
      var base = isFinite(parsed) ? parsed : 1;
      try { ensureBaseAttr(el, 'data-kg-base-opacity', String(base)); } catch (err) {}
      return base;
    }

    function setOpacity(el, value){
      if (!el || !el.style) return;
      el.style.opacity = String(value);
    }

    function computeNeighborNodeIds(selectedNodeId){
      var set = Object.create(null);
      if (!selectedNodeId) return set;
      var refs = edgeRefsByNodeId && edgeRefsByNodeId[selectedNodeId] ? edgeRefsByNodeId[selectedNodeId] : null;
      if (!refs || refs.length === 0) return set;
      for (var i = 0; i < refs.length; i += 1) {
        var r = refs[i];
        var el = r && r.el ? r.el : null;
        if (!el || !el.getAttribute) continue;
        var src = String(el.getAttribute('data-source-id') || el.getAttribute('data-source') || '').trim();
        var tgt = String(el.getAttribute('data-target-id') || el.getAttribute('data-target') || '').trim();
        if (src && src !== selectedNodeId) set[src] = 1;
        if (tgt && tgt !== selectedNodeId) set[tgt] = 1;
      }
      return set;
    }

    function computeEdgeEndpoints(edgeId){
      if (!edgeId) return null;
      var el = edgeLineByEdgeId && edgeLineByEdgeId[edgeId] ? edgeLineByEdgeId[edgeId] : null;
      if (!el || !el.getAttribute) return null;
      var src = String(el.getAttribute('data-source-id') || el.getAttribute('data-source') || '').trim();
      var tgt = String(el.getAttribute('data-target-id') || el.getAttribute('data-target') || '').trim();
      if (!src || !tgt) return null;
      return { src: src, tgt: tgt };
    }

    function applySelectionHighlight(){
      var nodeId = selectionState.nodeId;
      var edgeId = selectionState.edgeId;
      var key = (nodeId || '') + '|' + (edgeId || '');
      if (key === lastSelectionKey) return;
      lastSelectionKey = key;

      var hasSelection = !!(nodeId || edgeId);
      var neighborSet = nodeId ? computeNeighborNodeIds(nodeId) : Object.create(null);
      var edgeEndpoints = edgeId ? computeEdgeEndpoints(edgeId) : null;

      var allNodeEls = svg ? svg.querySelectorAll('[data-node-id]') : null;
      if (allNodeEls && allNodeEls.length) {
        for (var i = 0; i < allNodeEls.length; i += 1) {
          var el = allNodeEls[i];
          if (!el || !el.getAttribute) continue;
          var id = String(el.getAttribute('data-node-id') || '').trim();
          var base = coerceBaseOpacity(el);
          if (!hasSelection) {
            setOpacity(el, base);
            continue;
          }
          var isSelected = nodeId && id === nodeId;
          var isNeighbor = nodeId && neighborSet && neighborSet[id] === 1;
          var isEdgeEndpoint = !!(edgeEndpoints && (id === edgeEndpoints.src || id === edgeEndpoints.tgt));
          var keep = isSelected || isNeighbor || isEdgeEndpoint;
          setOpacity(el, keep ? Math.max(base, 1) : Math.min(base, 0.2));
        }
      }

      var allEdgeEls = svg ? svg.querySelectorAll('line[data-edge-id]') : null;
      if (allEdgeEls && allEdgeEls.length) {
        for (var j = 0; j < allEdgeEls.length; j += 1) {
          var ee = allEdgeEls[j];
          if (!ee || !ee.getAttribute) continue;
          var eid = String(ee.getAttribute('data-edge-id') || '').trim();
          var baseOpacity = coerceBaseOpacity(ee);
          ensureBaseAttr(ee, 'data-kg-base-stroke', String(ee.getAttribute('stroke') || ''));
          ensureBaseAttr(ee, 'data-kg-base-stroke-width', String(ee.getAttribute('stroke-width') || ''));
          if (!hasSelection) {
            setOpacity(ee, baseOpacity);
            continue;
          }
          var isPicked = edgeId && eid === edgeId;
          setOpacity(ee, isPicked ? 1 : Math.min(baseOpacity, 0.2));
          if (isPicked) {
            try {
              var baseW = parseFloat(ee.getAttribute('data-kg-base-stroke-width') || 'NaN');
              if (!isFinite(baseW)) baseW = parseFloat(ee.getAttribute('stroke-width') || 'NaN');
              if (!isFinite(baseW)) baseW = 2;
              ee.setAttribute('stroke', 'var(--kg-canvas-accent)');
              ee.setAttribute('stroke-width', String(baseW * 1.6));
            } catch (err) {}
          } else {
            try {
              var baseStroke = String(ee.getAttribute('data-kg-base-stroke') || '').trim();
              if (baseStroke) ee.setAttribute('stroke', baseStroke);
              var baseStrokeWidth = String(ee.getAttribute('data-kg-base-stroke-width') || '').trim();
              if (baseStrokeWidth) ee.setAttribute('stroke-width', baseStrokeWidth);
            } catch (err) {}
          }
        }
      }

      var edgeLabelEls = svg ? svg.querySelectorAll('[data-kg-edge-label="1"][data-edge-id], text[data-kg-edge-label][data-edge-id]') : null;
      if (edgeLabelEls && edgeLabelEls.length) {
        for (var k = 0; k < edgeLabelEls.length; k += 1) {
          var le = edgeLabelEls[k];
          if (!le || !le.getAttribute) continue;
          var baseOp = coerceBaseOpacity(le);
          if (!hasSelection) {
            setOpacity(le, baseOp);
            continue;
          }
          var lid = String(le.getAttribute('data-edge-id') || '').trim();
          setOpacity(le, edgeId && lid === edgeId ? 1 : Math.min(baseOp, 0.2));
        }
      }

      var overlayEls = overlay ? overlay.querySelectorAll('.kg-media[data-node-id]') : null;
      if (overlayEls && overlayEls.length) {
        for (var m = 0; m < overlayEls.length; m += 1) {
          var oe = overlayEls[m];
          if (!oe || !oe.getAttribute) continue;
          var nid = String(oe.getAttribute('data-node-id') || '').trim();
          if (!hasSelection) {
            setOpacity(oe, 1);
            continue;
          }
          var keep0 = (nodeId && nid === nodeId) || (edgeEndpoints && (nid === edgeEndpoints.src || nid === edgeEndpoints.tgt)) || (nodeId && neighborSet && neighborSet[nid] === 1);
          setOpacity(oe, keep0 ? 1 : 0.22);
        }
      }
    }

    function updateEdgeLabelPositionByEdgeId(edgeId){
      if (!edgeId) return;
      var labels = edgeLabelElsByEdgeId && edgeLabelElsByEdgeId[edgeId] ? edgeLabelElsByEdgeId[edgeId] : null;
      if (!labels || labels.length === 0) return;
      var line = edgeLineByEdgeId && edgeLineByEdgeId[edgeId] ? edgeLineByEdgeId[edgeId] : null;
      if (!line || !line.getAttribute) return;
      var x1 = parseFloat(line.getAttribute('x1') || 'NaN');
      var y1 = parseFloat(line.getAttribute('y1') || 'NaN');
      var x2 = parseFloat(line.getAttribute('x2') || 'NaN');
      var y2 = parseFloat(line.getAttribute('y2') || 'NaN');
      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;
      var mx = (x1 + x2) / 2;
      var my = (y1 + y2) / 2;
      for (var i = 0; i < labels.length; i += 1) {
        var el = labels[i];
        if (!el || !el.setAttribute) continue;
        el.setAttribute('x', String(mx));
        el.setAttribute('y', String(my));
      }
    }

    function updateAllEdgeLabelPositions(){
      if (!edgeLabelElsByEdgeId) return;
      for (var eid in edgeLabelElsByEdgeId) {
        updateEdgeLabelPositionByEdgeId(eid);
      }
    }

    var pendingEdgeLabelIds = null;
    var edgeLabelRaf = null;
    function scheduleEdgeLabelUpdate(edgeId){
      if (!edgeId) return;
      if (!pendingEdgeLabelIds) pendingEdgeLabelIds = {};
      pendingEdgeLabelIds[edgeId] = 1;
      if (edgeLabelRaf != null) return;
      edgeLabelRaf = requestAnimationFrame(function(){
        edgeLabelRaf = null;
        var ids = pendingEdgeLabelIds;
        pendingEdgeLabelIds = null;
        if (!ids) return;
        for (var k in ids) updateEdgeLabelPositionByEdgeId(k);
      });
    }

    function rebuildNodePosFromSvg(){
      if (!svg || !svg.querySelectorAll) return;

      function readTranslate(tr){
        var m = String(tr || '').match(/translate\\(\\s*([-0-9.]+)\\s*[ ,]\\s*([-0-9.]+)\\s*\\)/);
        if (!m) return null;
        var x = parseFloat(m[1]);
        var y = parseFloat(m[2]);
        if (!isFinite(x) || !isFinite(y)) return null;
        return { x: x, y: y };
      }

      function readCenterFromEl(el){
        if (!el || !el.getAttribute) return null;
        var tag = String(el.tagName || '').toLowerCase();
        if (tag === 'circle') {
          var cx = parseFloat(el.getAttribute('cx') || 'NaN');
          var cy = parseFloat(el.getAttribute('cy') || 'NaN');
          if (isFinite(cx) && isFinite(cy)) return { x: cx, y: cy };
        }
        if (tag === 'rect') {
          var x0 = parseFloat(el.getAttribute('x') || 'NaN');
          var y0 = parseFloat(el.getAttribute('y') || 'NaN');
          var w0 = parseFloat(el.getAttribute('width') || 'NaN');
          var h0 = parseFloat(el.getAttribute('height') || 'NaN');
          if (isFinite(x0) && isFinite(y0) && isFinite(w0) && isFinite(h0)) return { x: x0 + w0 / 2, y: y0 + h0 / 2 };
        }
        var tr = readTranslate(el.getAttribute('transform'));
        if (tag === 'g' && el.querySelector) {
          var base = null;
          var c = el.querySelector('circle[data-role="node-circle"], circle[cx][cy]');
          if (c && c.getAttribute) {
            var ccx = parseFloat(c.getAttribute('cx') || 'NaN');
            var ccy = parseFloat(c.getAttribute('cy') || 'NaN');
            if (isFinite(ccx) && isFinite(ccy)) base = { x: ccx, y: ccy };
          }
          if (!base) {
            var r = el.querySelector('rect[x][y][width][height]');
            if (r && r.getAttribute) {
              var rx = parseFloat(r.getAttribute('x') || 'NaN');
              var ry = parseFloat(r.getAttribute('y') || 'NaN');
              var rw = parseFloat(r.getAttribute('width') || 'NaN');
              var rh = parseFloat(r.getAttribute('height') || 'NaN');
              if (isFinite(rx) && isFinite(ry) && isFinite(rw) && isFinite(rh)) base = { x: rx + rw / 2, y: ry + rh / 2 };
            }
          }
          if (base && tr) return { x: base.x + tr.x, y: base.y + tr.y };
          if (base) return base;
          if (tr) return tr;
        }
        if (tr) return tr;
        return null;
      }

      var ids = Object.create(null);
      for (var id in svgNodeById) ids[id] = 1;
      for (var id2 in edgeRefsByNodeId) ids[id2] = 1;
      for (var mi = 0; mi < (mediaNodes ? mediaNodes.length : 0); mi += 1) {
        var m = mediaNodes[mi];
        var mid = m && m.id ? String(m.id || '').trim() : '';
        if (mid) ids[mid] = 1;
      }

      for (var id3 in ids) {
        if (!id3) continue;
        var el0 = svgNodeById[id3] || null;
        var p = el0 ? readCenterFromEl(el0) : null;
        if (!p) {
          var list = svgNodeElsById[id3] || null;
          if (list && list.length) p = readCenterFromEl(list[0]);
        }
        if (!p) {
          var refs = edgeRefsByNodeId[id3] || null;
          if (refs && refs.length) {
            var r0 = refs[0];
            if (r0 && r0.el && r0.el.getAttribute) {
              var ax = r0.end === 's' ? 'x1' : 'x2';
              var ay = r0.end === 's' ? 'y1' : 'y2';
              var ex = parseFloat(r0.el.getAttribute(ax) || 'NaN');
              var ey = parseFloat(r0.el.getAttribute(ay) || 'NaN');
              if (isFinite(ex) && isFinite(ey)) p = { x: ex, y: ey };
            }
          }
        }
        if (p && isFinite(p.x) && isFinite(p.y)) {
          if (!nodePosById) nodePosById = Object.create(null);
          nodePosById[id3] = { x: p.x, y: p.y };
        }
      }
    }

    function clearSelection(){
      try {
        var s = (window.getSelection && window.getSelection()) || null;
        if (s && s.removeAllRanges) s.removeAllRanges();
      } catch (err) {}
    }

    function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
    function ensureSvgViewportGroup(){
      if (!svg) return null;
      try {
        var nonDefs = [];
        var defsEl = null;
        if (svg.children && svg.children.length) {
          for (var i = 0; i < svg.children.length; i += 1) {
            var ch = svg.children[i];
            if (!ch || !ch.tagName) continue;
            var tag = String(ch.tagName || '').toLowerCase();
            if (tag === 'defs') {
              if (!defsEl) defsEl = ch;
              continue;
            }
            nonDefs.push(ch);
          }
        }

        if (nonDefs.length === 1) {
          var only = nonDefs[0];
          if (String(only.tagName || '').toLowerCase() === 'g') return only;
        }

        var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-kg-viewport', '1');
        if (defsEl) svg.insertBefore(g, defsEl);
        else svg.appendChild(g);
        for (var j = 0; j < nonDefs.length; j += 1) {
          g.appendChild(nonDefs[j]);
        }
        return g;
      } catch (err) {
        return null;
      }
    }

    var svgViewportG = ensureSvgViewportGroup();

    var lastSvgTransform = '';
    function applyTransform(){
      var k = isFinite(state.k) ? state.k : 1;
      if (!(k > 0)) k = 1;
      var xPx = isFinite(state.x) ? state.x : 0;
      var yPx = isFinite(state.y) ? state.y : 0;
      var sx = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;
      var sy = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;
      var tx = xPx / sx;
      var ty = yPx / sy;
      var next = 'matrix(' + k + ',0,0,' + k + ',' + tx + ',' + ty + ')';
      if (next === lastSvgTransform) return;
      lastSvgTransform = next;
      try {
        if (svgViewportG && svgViewportG.setAttribute) {
          svgViewportG.setAttribute('transform', next);
        }
      } catch (err) {}
      scheduleOverlayUpdate();
    }

    var lastMediaPointerEvents = '';
    var lastMediaBtnActive = null;
    function applyMediaPointerEvents(){
      var pe = (mediaInteractive && pointerMode !== 'pan' && !panHeld && !headerDrag) ? 'auto' : 'none';
      try {
        if (pe !== lastMediaPointerEvents) {
          lastMediaPointerEvents = pe;
          document.documentElement.style.setProperty('--kg-media-pointer-events', pe);
        }
      } catch (err) {}
      try {
        if (mediaBtn && mediaBtn.classList) {
          if (lastMediaBtnActive !== mediaInteractive) {
            lastMediaBtnActive = mediaInteractive;
            if (mediaInteractive) mediaBtn.classList.add('kg-active');
            else mediaBtn.classList.remove('kg-active');
          }
        }
      } catch (err) {}
    }

    var lastPanBtnActive = null;
    function applyPanModeUi(){
      try {
        if (!panBtn || !panBtn.classList) return;
        var active = pointerMode === 'pan';
        if (lastPanBtnActive === active) return;
        lastPanBtnActive = active;
        if (active) panBtn.classList.add('kg-active');
        else panBtn.classList.remove('kg-active');
      } catch (err) {}
    }

    function setPointerMode(next){
      pointerMode = String(next || 'select') === 'pan' ? 'pan' : 'select';
      applyPanModeUi();
      applyMediaPointerEvents();
      try {
        if (pointerMode === 'pan') {
          if (headerDrag && headerDrag.pointerId != null) endHeaderDrag(headerDrag.pointerId);
        }
      } catch (err) {}
    }
    function setMediaInteractive(next){
      mediaInteractive = !!next;
      applyMediaPointerEvents();
    }
    function setPanHeld(next){
      panHeld = !!next;
      applyMediaPointerEvents();
      try { if (!panHeld) endDrag(); } catch (err) {}
    }

    var svgBase = { sx: 1, sy: 1, ox: 0, oy: 0 };
    function refreshSvgBase(){
      if (!svg || !svg.getBoundingClientRect) return svgBase;
      try {
        var rect = svg.getBoundingClientRect();
        var rw = rect && isFinite(rect.width) ? rect.width : 0;
        var rh = rect && isFinite(rect.height) ? rect.height : 0;
        if (!(rw > 0) || !(rh > 0)) return svgBase;

        var vb = null;
        try {
          if (svg.viewBox && svg.viewBox.baseVal) {
            vb = {
              x: Number(svg.viewBox.baseVal.x),
              y: Number(svg.viewBox.baseVal.y),
              width: Number(svg.viewBox.baseVal.width),
              height: Number(svg.viewBox.baseVal.height),
            };
          }
        } catch (err) {}
        if (!vb || !(isFinite(vb.width) && vb.width > 0 && isFinite(vb.height) && vb.height > 0)) {
          vb = { x: 0, y: 0, width: rw, height: rh };
        }

        var par = '';
        try { par = String(svg.getAttribute('preserveAspectRatio') || '').trim(); } catch (err) {}
        if (!par) par = 'xMidYMid meet';
        var none = par.indexOf('none') >= 0;
        var meet = (!none && par.indexOf('slice') < 0);

        var sx0 = rw / vb.width;
        var sy0 = rh / vb.height;
        if (!(isFinite(sx0) && sx0 > 0)) sx0 = 1;
        if (!(isFinite(sy0) && sy0 > 0)) sy0 = 1;

        if (none) {
          svgBase.sx = sx0;
          svgBase.sy = sy0;
          svgBase.ox = -vb.x * sx0;
          svgBase.oy = -vb.y * sy0;
          return svgBase;
        }

        var s = meet ? Math.min(sx0, sy0) : Math.max(sx0, sy0);
        if (!(isFinite(s) && s > 0)) s = 1;
        var viewW = vb.width * s;
        var viewH = vb.height * s;
        var extraX = rw - viewW;
        var extraY = rh - viewH;
        var alignX = (par.indexOf('xMin') >= 0) ? 'min' : (par.indexOf('xMax') >= 0) ? 'max' : 'mid';
        var alignY = (par.indexOf('YMin') >= 0) ? 'min' : (par.indexOf('YMax') >= 0) ? 'max' : 'mid';
        var ax = (alignX === 'min') ? 0 : (alignX === 'max') ? extraX : extraX / 2;
        var ay = (alignY === 'min') ? 0 : (alignY === 'max') ? extraY : extraY / 2;
        svgBase.sx = s;
        svgBase.sy = s;
        svgBase.ox = ax - vb.x * s;
        svgBase.oy = ay - vb.y * s;
        return svgBase;
      } catch (err) {
        return svgBase;
      }
    }

    var viewport = { w: 0, h: 0 };
    function refreshViewport(){
      var r = root.getBoundingClientRect();
      viewport.w = Math.max(1, r.width);
      viewport.h = Math.max(1, r.height);
      try { refreshSvgBase(); } catch (err) {}
      return viewport;
    }
    function getViewport(){
      if (viewport.w > 0 && viewport.h > 0) return viewport;
      return refreshViewport();
    }

    function getContentBBox(){
      try {
        if (svgViewportG && svgViewportG.getBBox) {
          return svgViewportG.getBBox();
        }
        if (svg && svg.getBBox) return svg.getBBox();
        if (svg && svg.viewBox && svg.viewBox.baseVal) {
          var vb = svg.viewBox.baseVal;
          var vx = Number(vb.x);
          var vy = Number(vb.y);
          var vw = Number(vb.width);
          var vh = Number(vb.height);
          if (isFinite(vx) && isFinite(vy) && isFinite(vw) && isFinite(vh) && vw > 0 && vh > 0) {
            return { x: vx, y: vy, width: vw, height: vh };
          }
        }
      } catch (e) {}
      return null;
    }

    function fitToCenter(){
      var vp = getViewport();
      var pad = 96;
      var bb = getContentBBox();
      if (!bb || !(bb.width > 0) || !(bb.height > 0)) {
        state.k = 1; state.x = 0; state.y = 0; applyTransform(); return;
      }
      var baseSx = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;
      var baseSy = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;
      var ox = (svgBase && isFinite(svgBase.ox)) ? svgBase.ox : 0;
      var oy = (svgBase && isFinite(svgBase.oy)) ? svgBase.oy : 0;
      var k = Math.min(
        vp.w / (bb.width * baseSx + pad * 2),
        vp.h / (bb.height * baseSy + pad * 2)
      );
      k = clamp(k, minK, maxK);
      var cx = bb.x + bb.width / 2;
      var cy = bb.y + bb.height / 2;
      state.k = k;
      state.x = vp.w / 2 - ox - cx * k * baseSx;
      state.y = vp.h / 2 - oy - cy * k * baseSy;
      applyTransform();
    }

    function resetView(){
      state.k = 1; state.x = 0; state.y = 0; applyTransform();
    }

    function computeMediaPanelForZoom(k){
      var density = ${JSON.stringify(density)};
      var vp = getViewport();
      var widthRatio = density === 'compact' ? ${widthRatioCompact} : ${widthRatioDefault};
      var widthMin = density === 'compact' ? ${widthMinCompact} : ${widthMinDefault};
      var widthMax = density === 'compact' ? ${widthMaxCompact} : ${widthMaxDefault};
      var baseW = clamp(vp.w * widthRatio, widthMin, widthMax);
      var MAX_PANEL_PX = 2048;
      var STEP_PX = 16;
      var quantize = function(px){ return Math.round(px / STEP_PX) * STEP_PX; };
      var contentW = clamp(quantize(baseW * clamp(k, 0.001, 1000)), 2, MAX_PANEL_PX);
      var sizeScale = Math.max(0.001, contentW / Math.max(1, baseW));
      var headerBase = density === 'compact' ? 22 : 28;
      var paddingBase = density === 'compact' ? 6 : 8;
      var radiusBase = density === 'compact' ? 9 : 10;
      var borderBase = 1;
      var titleBase = density === 'compact' ? 11 : 12;
      var headerH = Math.max(14, Math.round(headerBase * sizeScale));
      var padding = Math.max(2, Math.round(paddingBase * sizeScale));
      var radius = Math.max(3, Math.round(radiusBase * sizeScale));
      var borderW = Math.max(1, Math.round(borderBase * sizeScale));
      var titleSize = Math.max(10, Math.round(titleBase * sizeScale));
      var contentH = Math.max(2, (contentW * 9) / 16);
      var panelW = Math.max(2, contentW + padding * 2);
      var panelH = Math.max(2, contentH + headerH + padding * 2);
      return {
        key: density + '|' + contentW,
        vars: {
          '--kg-media-panel-header-h': headerH + 'px',
          '--kg-media-panel-border-w': borderW + 'px',
          '--kg-media-panel-radius': radius + 'px',
          '--kg-media-panel-padding': padding + 'px',
          '--kg-media-panel-title-size': titleSize + 'px'
        },
        panelW: panelW,
        panelH: panelH
      };
    }

    function ensureMediaDom(){
      if (!overlay) return;
      if (!mediaNodes || mediaNodes.length === 0) return;
      if (overlay.__kgMediaBuilt) return;
      overlay.__kgMediaBuilt = true;
      overlay.__kgMediaById = {};
      for (var i = 0; i < mediaNodes.length; i += 1) {
        var n = mediaNodes[i];
        var el = document.createElement('div');
        el.className = 'kg-media';
        var id = String(n.id || '');
        el.setAttribute('data-node-id', id);
        var nodeEl0 = svgNodeById && svgNodeById[id] ? svgNodeById[id] : null;
        svgNodeById[id] = nodeEl0;
        var header = document.createElement('div');
        header.className = 'kg-mediaHeader';
        var title = document.createElement('div');
        title.className = 'kg-mediaTitle';
        title.textContent = String(n.title || n.id || 'Media');
        title.setAttribute('draggable', 'false');
        header.appendChild(title);
        var body = document.createElement('div');
        body.className = 'kg-mediaBody';
        var kind = String(n.kind || 'iframe');
        var url = String(n.url || '');
        el.setAttribute('data-kg-kind', kind);
        if (kind === 'image' || kind === 'svg') {
          var imgEl = document.createElement('img');
          imgEl.loading = 'eager';
          imgEl.src = url;
          body.appendChild(imgEl);
        } else if (kind === 'video') {
          var vid = document.createElement('video');
          vid.src = url;
          vid.controls = true;
          vid.preload = 'metadata';
          body.appendChild(vid);
        } else {
          var iframe = document.createElement('iframe');
          iframe.loading = 'eager';
          iframe.referrerPolicy = 'no-referrer';
          iframe.src = url;
          body.appendChild(iframe);
        }
        el.appendChild(header);
        el.appendChild(body);
        overlay.appendChild(el);
        overlay.__kgMediaById[id] = el;
      }
    }

    var overlayRaf = null;
    function scheduleOverlayUpdate(){
      if (overlayFollowAnimation) return;
      if (overlayRaf != null) return;
      overlayRaf = requestAnimationFrame(function(){
        overlayRaf = null;
        updateOverlays();
      });
    }

    function updateOverlays(){
      if (!overlay || !svg) return;
      ensureMediaDom();
      if (!mediaNodes || mediaNodes.length === 0) return;
      var panel = computeMediaPanelForZoom(state.k);
      if (panel.key !== lastOverlayKey) {
        lastOverlayKey = panel.key;
        var keys = Object.keys(panel.vars);
        for (var i = 0; i < keys.length; i += 1) {
          document.documentElement.style.setProperty(keys[i], panel.vars[keys[i]]);
        }
      }
      var byId = overlay.__kgMediaById || {};
      var nodeById = overlay.__kgSvgNodeById || svgNodeById || {};
      for (var i = 0; i < mediaNodes.length; i += 1) {
        var id = String(mediaNodes[i].id || '');
        var el = byId[id] || null;
        if (!el) continue;
        var nodeEl = nodeById[id] || null;
        var cx = null;
        var cy = null;
        var usedNodePos = false;
        if (!overlayFollowAnimation) {
          var p = nodePosById && nodePosById[id] ? nodePosById[id] : null;
          if (p && typeof p.x === 'number' && typeof p.y === 'number') {
            cx = p.x;
            cy = p.y;
            usedNodePos = true;
          }
        }
        if (nodeEl) {
          var c = (nodeEl.querySelector ? nodeEl.querySelector('[data-role="node-circle"]') : null);
          if (c && c.getAttribute) {
            var cx0 = parseFloat(c.getAttribute('cx') || 'NaN');
            var cy0 = parseFloat(c.getAttribute('cy') || 'NaN');
            if (isFinite(cx0) && isFinite(cy0) && (overlayFollowAnimation || cx == null || cy == null || !usedNodePos)) {
              cx = cx0;
              cy = cy0;
              usedNodePos = false;
            }
          }
          try {
            if (!overlayFollowAnimation && !usedNodePos && cx != null && cy != null && nodeEl.getAttribute) {
              var tr = String(nodeEl.getAttribute('transform') || '');
              var mt = tr.match(/translate\\(\\s*([-0-9.]+)\\s*[ ,]\\s*([-0-9.]+)\\s*\\)/);
              if (mt) {
                var tx0 = parseFloat(mt[1]);
                var ty0 = parseFloat(mt[2]);
                if (isFinite(tx0) && isFinite(ty0)) { cx += tx0; cy += ty0; }
              }
            }
          } catch (err) {}
          if ((cx == null || cy == null) && nodeEl.getBBox) {
            var bb;
            try { bb = nodeEl.getBBox(); } catch (e) { bb = null; }
            if (bb) {
              cx = bb.x + bb.width / 2;
              cy = bb.y + bb.height / 2;
            }
          }
        }
        if (cx == null || cy == null) {
          var last0 = el.__kgLastStyle || null;
          if (!last0 || last0.d !== 'none') {
            el.style.display = 'none';
            el.__kgLastStyle = { d: 'none' };
          }
          continue;
        }
        var last = el.__kgLastStyle || (el.__kgLastStyle = {});
        if (last.d !== 'block') { el.style.display = 'block'; last.d = 'block'; }
        if (last.w !== panel.panelW) { el.style.width = panel.panelW + 'px'; last.w = panel.panelW; }
        if (last.h !== panel.panelH) { el.style.height = panel.panelH + 'px'; last.h = panel.panelH; }
        var baseSx = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;
        var baseSy = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;
        var ox = (svgBase && isFinite(svgBase.ox)) ? svgBase.ox : 0;
        var oy = (svgBase && isFinite(svgBase.oy)) ? svgBase.oy : 0;
        var sx = cx * state.k * baseSx + state.x + ox;
        var sy = cy * state.k * baseSy + state.y + oy;
        var tx = sx - panel.panelW / 2;
        var ty = sy - panel.panelH / 2;
        if (last.x !== tx || last.y !== ty) {
          el.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
          last.x = tx;
          last.y = ty;
        }
      }
    }

    function onWheel(e){
      if (!e) return;
      if (shouldIgnoreCanvasWheelEvent({ event: e, ignoreSelector: UI_IGNORE_SELECTOR })) return;
      if (mediaInteractive && pointerMode !== 'pan' && !panHeld && isMediaTarget(e.target)) return;

      var preset = coerceViewportControlsPreset(viewportControlsPreset);
      var wheelZoom = (wheelBehavior === 'zoom') ? true : (wheelBehavior === 'pan') ? false : shouldWheelZoomForPreset(e, preset);
      if (!wheelZoom) {
        cancelWheelZoomAnimation();
        var d = computeWheelPanDeltaPx(e);
        var dx = d.dx * panSpeed * canvasPanSpeedMultiplier * canvasInteractionSpeedMultiplier;
        var dy = d.dy * panSpeed * canvasPanSpeedMultiplier * canvasInteractionSpeedMultiplier;
        if (dx === 0 && dy === 0) return;
        state.x -= dx;
        state.y -= dy;
        applyTransform();
        try { e.preventDefault(); } catch (err) {}
        return;
      }

      cancelWheelZoomAnimation();

      var nowMs = Date.now();
      var rect = root.getBoundingClientRect();
      var localSx = (isFinite(e.clientX) ? e.clientX : 0) - (isFinite(rect.left) ? rect.left : 0);
      var localSy = (isFinite(e.clientY) ? e.clientY : 0) - (isFinite(rect.top) ? rect.top : 0);
      var inBounds = localSx >= 0 && localSy >= 0 && localSx <= rect.width && localSy <= rect.height;
      var fallback = coerceWheelFallback({ fallback: lastPointerInCanvas, nowMs: nowMs, maxAgeMs: 800 });
      var anchor = inBounds
        ? { sx: localSx, sy: localSy, source: 'pointer' }
        : resolveWheelAnchor({ rect: rect, clientX: e.clientX, clientY: e.clientY, fallback: fallback });
      if (anchor.source !== 'center') {
        lastPointerInCanvas = { sx: anchor.sx, sy: anchor.sy, ts: nowMs };
      }

      var multiplier = zoomSpeed * flowWheelZoomSpeedMultiplier * canvasInteractionSpeedMultiplier;
      var deltaYpx = computeZoomWheelDeltaYpx(e, multiplier, wheelZoomCtrlMetaBoostMultiplier);
      var guard = computeZoomWheelGuardDecision({
        currentK: state.k,
        minK: minK,
        maxK: maxK,
        deltaYpx: deltaYpx,
        nowMs: nowMs,
        state: guardState
      });
      guardState = guard.nextState;
      if (guard.block) return;

      var factor = computeWheelZoomFactor(deltaYpx * flowWheelZoomIncrementMultiplier);
      var nextK = Math.max(minK, Math.min(maxK, state.k * factor));
      if (!isFinite(nextK) || Math.abs(nextK - state.k) < 1e-12) return;
      var durationMs = computeFlowWheelZoomDurationMs({ deltaYpxAbs: Math.abs(deltaYpx), minMs: flowWheelZoomSmoothMinDurationMs, maxMs: flowWheelZoomSmoothMaxDurationMs });
      startWheelZoomAnimation({ from: { k: state.k, x: state.x, y: state.y }, toK: nextK, anchor: { sx: anchor.sx, sy: anchor.sy }, durationMs: durationMs });
      try { e.preventDefault(); } catch (err) {}
    }

    var drag = null;
    function startDrag(id, x, y){
      clearSelection();
      drag = { id: id, x0: x, y0: y, x: state.x, y: state.y };
      try { if (root && root.classList) root.classList.add('kg-dragging'); } catch (err) {}
    }
    function moveDrag(x, y){
      if (!drag) return;
      state.x = drag.x + (x - drag.x0);
      state.y = drag.y + (y - drag.y0);
      applyTransform();
    }
    function endDrag(){
      if (!drag) return;
      drag = null;
      try { if (root && root.classList) root.classList.remove('kg-dragging'); } catch (err) {}
    }

    function isMediaTarget(t){
      try {
        if (!(t instanceof Element)) return false;
        return !!t.closest('.kg-media');
      } catch (err) {
        return false;
      }
    }

    function isMediaHeaderTarget(t){
      try {
        if (!(t instanceof Element)) return false;
        return !!t.closest('.kg-mediaHeader');
      } catch (err) {
        return false;
      }
    }

    function elementFromPointIgnoringOverlays(clientX, clientY){
      try {
        if (!document || typeof document.elementFromPoint !== 'function') return null;
        var prevOverlayPe = overlay && overlay.style ? overlay.style.pointerEvents : '';
        var prevHudPe = hud && hud.style ? hud.style.pointerEvents : '';
        if (overlay && overlay.style) overlay.style.pointerEvents = 'none';
        if (hud && hud.style) hud.style.pointerEvents = 'none';
        var el = document.elementFromPoint(clientX, clientY);
        if (overlay && overlay.style) overlay.style.pointerEvents = prevOverlayPe;
        if (hud && hud.style) hud.style.pointerEvents = prevHudPe;
        return el || null;
      } catch (err) {
        try {
          if (overlay && overlay.style) overlay.style.pointerEvents = '';
          if (hud && hud.style) hud.style.pointerEvents = '';
        } catch (err2) {}
        return null;
      }
    }

    var headerDrag = null;
    var nodeDrag = null;
    var groupDrag = null;
    var edgeDrag = null;

    function getWorldFromClient(clientX, clientY){
      var k = isFinite(state.k) ? state.k : 1;
      if (!isFinite(k) || k <= 0) k = 1;
      var baseSx = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;
      var baseSy = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;
      var ox = (svgBase && isFinite(svgBase.ox)) ? svgBase.ox : 0;
      var oy = (svgBase && isFinite(svgBase.oy)) ? svgBase.oy : 0;
      return { x: (clientX - state.x - ox) / (k * baseSx), y: (clientY - state.y - oy) / (k * baseSy) };
    }

    function addDeltaToElement(el, dx, dy){
      if (!el || !el.getAttribute || !el.setAttribute) return;
      var tag = String(el.tagName || '').toLowerCase();
      if (tag === 'line') return;
      if (el.hasAttribute('cx') && el.hasAttribute('cy')) {
        var cx = parseFloat(el.getAttribute('cx') || 'NaN');
        var cy = parseFloat(el.getAttribute('cy') || 'NaN');
        if (isFinite(cx) && isFinite(cy)) {
          el.setAttribute('cx', String(cx + dx));
          el.setAttribute('cy', String(cy + dy));
          return;
        }
      }
      if (el.hasAttribute('x') && el.hasAttribute('y')) {
        var x = parseFloat(el.getAttribute('x') || 'NaN');
        var y = parseFloat(el.getAttribute('y') || 'NaN');
        if (isFinite(x) && isFinite(y)) {
          el.setAttribute('x', String(x + dx));
          el.setAttribute('y', String(y + dy));
          return;
        }
      }
      var tr = String(el.getAttribute('transform') || '');
      var m = tr.match(/translate\\(\\s*([-0-9.]+)\\s*[ ,]\\s*([-0-9.]+)\\s*\\)/);
      if (m) {
        var tx = parseFloat(m[1]);
        var ty = parseFloat(m[2]);
        if (isFinite(tx) && isFinite(ty)) {
          el.setAttribute('transform', tr.replace(m[0], 'translate(' + (tx + dx) + ',' + (ty + dy) + ')'));
          return;
        }
      }

      try {
        var d = el.dataset || {};
        var base = (d.kgBaseTransform != null) ? String(d.kgBaseTransform || '') : String(tr || '');
        if (d.kgBaseTransform == null) d.kgBaseTransform = base;
        var ox = isFinite(Number(d.kgTx)) ? Number(d.kgTx) : 0;
        var oy = isFinite(Number(d.kgTy)) ? Number(d.kgTy) : 0;
        var nx = ox + dx;
        var ny = oy + dy;
        d.kgTx = String(nx);
        d.kgTy = String(ny);
        el.setAttribute('transform', ('translate(' + nx + ',' + ny + ') ' + base).trim());
      } catch (err) {}
    }

    function addDeltaToEdgeEnd(el, end, dx, dy){
      if (!el || !el.getAttribute || !el.setAttribute) return;
      var ax = end === 's' ? 'x1' : 'x2';
      var ay = end === 's' ? 'y1' : 'y2';
      var x = parseFloat(el.getAttribute(ax) || 'NaN');
      var y = parseFloat(el.getAttribute(ay) || 'NaN');
      if (!isFinite(x) || !isFinite(y)) return;
      el.setAttribute(ax, String(x + dx));
      el.setAttribute(ay, String(y + dy));
      try {
        var eid = String(el.getAttribute('data-edge-id') || '').trim();
        if (eid) scheduleEdgeLabelUpdate(eid);
      } catch (err) {}
    }

    function translateNodeByDelta(nodeId, dx, dy){
      if (!nodeId) return;
      try {
        if (overlayFollowAnimation && svg && (svg.__kgNodeOffsetById || (svg.__kgNodeOffsetById = {}))) {
          var map = svg.__kgNodeOffsetById;
          var prev = map[nodeId] || null;
          var ox = prev && isFinite(prev.x) ? prev.x : 0;
          var oy = prev && isFinite(prev.y) ? prev.y : 0;
          map[nodeId] = { x: ox + dx, y: oy + dy };
          return;
        }
      } catch (err) {}
      var els = svgNodeElsById[nodeId] || null;
      if (els) {
        for (var i = 0; i < els.length; i += 1) addDeltaToElement(els[i], dx, dy);
      }
      var p = nodePosById && nodePosById[nodeId] ? nodePosById[nodeId] : null;
      if (p && isFinite(p.x) && isFinite(p.y)) {
        p.x += dx;
        p.y += dy;
      }
      var refs = edgeRefsByNodeId[nodeId] || null;
      if (refs) {
        for (var j = 0; j < refs.length; j += 1) {
          var r = refs[j];
          if (!r || !r.el) continue;
          addDeltaToEdgeEnd(r.el, r.end, dx, dy);
        }
      }
    }

    function translateGroupByDelta(groupId, dx, dy){
      if (!groupId) return;
      try {
        if (overlayFollowAnimation && svg && (svg.__kgNodeOffsetById || (svg.__kgNodeOffsetById = {}))) {
          var map = svg.__kgNodeOffsetById;
          var members = groupMembersById && groupMembersById[groupId] ? groupMembersById[groupId] : null;
          if (members && members.length) {
            for (var j = 0; j < members.length; j += 1) {
              var id = String(members[j] || '');
              if (!id) continue;
              var prev = map[id] || null;
              var ox = prev && isFinite(prev.x) ? prev.x : 0;
              var oy = prev && isFinite(prev.y) ? prev.y : 0;
              map[id] = { x: ox + dx, y: oy + dy };
            }
          }
          return;
        }
      } catch (err) {}
      var gels = svgGroupElsById[groupId] || null;
      if (gels) {
        for (var i = 0; i < gels.length; i += 1) addDeltaToElement(gels[i], dx, dy);
      }
      var members = groupMembersById && groupMembersById[groupId] ? groupMembersById[groupId] : null;
      if (members && members.length) {
        for (var j = 0; j < members.length; j += 1) {
          var id = String(members[j] || '');
          if (!id) continue;
          translateNodeByDelta(id, dx, dy);
        }
      }
    }

    function startHeaderDrag(nodeId, pointerId, clientX, clientY, captureEl){
      var w = getWorldFromClient(clientX, clientY);
      if (!nodePosById) nodePosById = Object.create(null);
      var p = nodePosById && nodePosById[nodeId] ? nodePosById[nodeId] : null;
      if (!p || !isFinite(p.x) || !isFinite(p.y)) {
        try { rebuildNodePosFromSvg(); } catch (err) {}
        p = nodePosById && nodePosById[nodeId] ? nodePosById[nodeId] : null;
      }
      if (!p || !isFinite(p.x) || !isFinite(p.y)) {
        p = { x: w.x, y: w.y };
        nodePosById[nodeId] = p;
      }
      headerDrag = { id: nodeId, pointerId: pointerId, startWx: w.x, startWy: w.y, baseX: p.x, baseY: p.y };
      try { applyMediaPointerEvents(); } catch (err) {}
      try {
        var el = (captureEl && captureEl.setPointerCapture) ? captureEl : root;
        if (el && el.setPointerCapture) el.setPointerCapture(pointerId);
      } catch (err) {}
    }

    function moveHeaderDrag(pointerId, clientX, clientY){
      if (!headerDrag || headerDrag.pointerId !== pointerId) return;
      var w = getWorldFromClient(clientX, clientY);
      if (!nodePosById) nodePosById = Object.create(null);
      var p = nodePosById && nodePosById[headerDrag.id] ? nodePosById[headerDrag.id] : null;
      if (!p || !isFinite(p.x) || !isFinite(p.y)) {
        p = { x: headerDrag.baseX, y: headerDrag.baseY };
        nodePosById[headerDrag.id] = p;
      }
      var nx = headerDrag.baseX + (w.x - headerDrag.startWx);
      var ny = headerDrag.baseY + (w.y - headerDrag.startWy);
      var snapX = snapGridEnabled ? (Math.round(nx / snapGridSize) * snapGridSize) : nx;
      var snapY = snapGridEnabled ? (Math.round(ny / snapGridSize) * snapGridSize) : ny;
      var targetX = snapX;
      var targetY = snapY;
      if (dragConstraint === 'axis-x') {
        targetX = snapX;
        targetY = headerDrag.baseY;
      } else if (dragConstraint === 'axis-y') {
        targetX = headerDrag.baseX;
        targetY = snapY;
      } else if (dragConstraint === 'none') {
        targetX = headerDrag.baseX;
        targetY = headerDrag.baseY;
      }
      var dx = targetX - p.x;
      var dy = targetY - p.y;
      if (!isFinite(dx) || !isFinite(dy)) return;
      if (dx === 0 && dy === 0) return;
      p.x = targetX;
      p.y = targetY;
      try { translateNodeByDelta(headerDrag.id, dx, dy); } catch (err) {}
      try { scheduleOverlayUpdate(); } catch (err) {}
    }

    function endHeaderDrag(pointerId){
      if (!headerDrag || headerDrag.pointerId !== pointerId) return;
      headerDrag = null;
      try { applyMediaPointerEvents(); } catch (err) {}
    }

    function startNodeDrag(nodeId, pointerId, clientX, clientY){
      var w = getWorldFromClient(clientX, clientY);
      if (!nodePosById) nodePosById = Object.create(null);
      var p = nodePosById && nodePosById[nodeId] ? nodePosById[nodeId] : null;
      if (!p || !isFinite(p.x) || !isFinite(p.y)) {
        try { rebuildNodePosFromSvg(); } catch (err) {}
        p = nodePosById && nodePosById[nodeId] ? nodePosById[nodeId] : null;
      }
      if (!p || !isFinite(p.x) || !isFinite(p.y)) {
        p = { x: w.x, y: w.y };
        nodePosById[nodeId] = p;
      }
      nodeDrag = { id: nodeId, pointerId: pointerId, offX: p.x - w.x, offY: p.y - w.y };
      try { if (root && root.setPointerCapture) root.setPointerCapture(pointerId); } catch (err) {}
    }

    function moveNodeDrag(pointerId, clientX, clientY, altDown){
      if (!nodeDrag || nodeDrag.pointerId !== pointerId) return;
      var w = getWorldFromClient(clientX, clientY);
      if (!nodePosById) nodePosById = Object.create(null);
      var p = nodePosById && nodePosById[nodeDrag.id] ? nodePosById[nodeDrag.id] : null;
      if (!p || !isFinite(p.x) || !isFinite(p.y)) {
        p = { x: w.x + (nodeDrag.offX || 0), y: w.y + (nodeDrag.offY || 0) };
        nodePosById[nodeDrag.id] = p;
      }
      var nx = w.x + (nodeDrag.offX || 0);
      var ny = w.y + (nodeDrag.offY || 0);
      var doSnap = snapGridEnabled && !altDown;
      var snapX = doSnap ? (Math.round(nx / snapGridSize) * snapGridSize) : nx;
      var snapY = doSnap ? (Math.round(ny / snapGridSize) * snapGridSize) : ny;
      var targetX = snapX;
      var targetY = snapY;
      if (dragConstraint === 'axis-x') {
        targetX = snapX;
        targetY = p.y;
      } else if (dragConstraint === 'axis-y') {
        targetX = p.x;
        targetY = snapY;
      } else if (dragConstraint === 'none') {
        targetX = p.x;
        targetY = p.y;
      }
      var dx = targetX - p.x;
      var dy = targetY - p.y;
      if (!isFinite(dx) || !isFinite(dy)) return;
      if (dx === 0 && dy === 0) return;
      p.x = targetX;
      p.y = targetY;
      translateNodeByDelta(nodeDrag.id, dx, dy);
      try { scheduleOverlayUpdate(); } catch (err) {}
    }

    function endNodeDrag(pointerId){
      if (!nodeDrag || nodeDrag.pointerId !== pointerId) return;
      nodeDrag = null;
    }

    function startGroupDrag(groupId, pointerId, clientX, clientY){
      var w = getWorldFromClient(clientX, clientY);
      groupDrag = { id: groupId, pointerId: pointerId, wx: w.x, wy: w.y };
      try { if (root && root.setPointerCapture) root.setPointerCapture(pointerId); } catch (err) {}
    }

    function moveGroupDrag(pointerId, clientX, clientY){
      if (!groupDrag || groupDrag.pointerId !== pointerId) return;
      var w = getWorldFromClient(clientX, clientY);
      var dx = w.x - groupDrag.wx;
      var dy = w.y - groupDrag.wy;
      groupDrag.wx = w.x;
      groupDrag.wy = w.y;
      if (!isFinite(dx) || !isFinite(dy)) return;
      translateGroupByDelta(groupDrag.id, dx, dy);
      try { scheduleOverlayUpdate(); } catch (err) {}
    }

    function endGroupDrag(pointerId){
      if (!groupDrag || groupDrag.pointerId !== pointerId) return;
      groupDrag = null;
    }

    function startEdgeDrag(sourceId, targetId, pointerId, clientX, clientY){
      var w = getWorldFromClient(clientX, clientY);
      edgeDrag = { s: sourceId, t: targetId, pointerId: pointerId, wx: w.x, wy: w.y };
      try { if (root && root.setPointerCapture) root.setPointerCapture(pointerId); } catch (err) {}
    }

    function moveEdgeDrag(pointerId, clientX, clientY){
      if (!edgeDrag || edgeDrag.pointerId !== pointerId) return;
      var w = getWorldFromClient(clientX, clientY);
      var dx = w.x - edgeDrag.wx;
      var dy = w.y - edgeDrag.wy;
      edgeDrag.wx = w.x;
      edgeDrag.wy = w.y;
      if (!isFinite(dx) || !isFinite(dy)) return;
      translateNodeByDelta(edgeDrag.s, dx, dy);
      translateNodeByDelta(edgeDrag.t, dx, dy);
      try { scheduleOverlayUpdate(); } catch (err) {}
    }

    function endEdgeDrag(pointerId){
      if (!edgeDrag || edgeDrag.pointerId !== pointerId) return;
      edgeDrag = null;
    }

    function onPointerDown(e){
      try { clearSelection(); } catch (err) {}
      try {
        if (e && e.target && e.target instanceof Element) {
          if (e.target.closest(UI_IGNORE_SELECTOR)) return;
        }
      } catch (err) {}
      if (allowNodeDrag && !panHeld && pointerMode !== 'pan' && isMediaHeaderTarget(e.target)) {
        try {
          var headerEl = e.target instanceof Element ? e.target.closest('.kg-mediaHeader') : null;
          var panelEl = headerEl ? headerEl.closest('.kg-media') : null;
          if (panelEl) {
            var nid = String(panelEl.getAttribute('data-node-id') || '').trim();
            if (nid) {
              startHeaderDrag(nid, e.pointerId, e.clientX, e.clientY, headerEl || panelEl || root);
            }
            try { e.preventDefault(); } catch (err) {}
            try { e.stopPropagation(); } catch (err) {}
            return;
          }
        } catch (err) {}
      }
      try {
        if (pointerMode !== 'pan' && e && e.target && e.target instanceof Element) {
          var t = e.target;
          if (t && t.closest && t.closest('#kg-overlay') && !t.closest('.kg-media')) {
            var under = elementFromPointIgnoringOverlays(e.clientX, e.clientY);
            if (under && under instanceof Element) t = under;
          }
          var edgeEl = t.closest('line[data-edge-id]');
          if (allowEdgeDrag && edgeEl && edgeEl.getAttribute && !e.target.closest('.kg-media')) {
            var sid = String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim();
            var tid = String(edgeEl.getAttribute('data-target-id') || edgeEl.getAttribute('data-target') || '').trim();
            if (sid && tid) {
              startEdgeDrag(sid, tid, e.pointerId, e.clientX, e.clientY);
              try { e.preventDefault(); } catch (err) {}
              try { e.stopPropagation(); } catch (err) {}
              return;
            }
          }
          var groupEl = t.closest('[data-kg-group-id]');
          if (allowGroupDrag && groupEl && groupEl.getAttribute) {
            var gid = String(groupEl.getAttribute('data-kg-group-id') || '').trim();
            if (gid) {
              startGroupDrag(gid, e.pointerId, e.clientX, e.clientY);
              try { e.preventDefault(); } catch (err) {}
              try { e.stopPropagation(); } catch (err) {}
              return;
            }
          }
          var nodeEl = t.closest('[data-node-id]');
          if (allowNodeDrag && nodeEl && !e.target.closest('.kg-media') && nodeEl.getAttribute) {
            var nid = String(nodeEl.getAttribute('data-node-id') || '').trim();
            if (nid) {
              startNodeDrag(nid, e.pointerId, e.clientX, e.clientY);
              try { e.preventDefault(); } catch (err) {}
              try { e.stopPropagation(); } catch (err) {}
              return;
            }
          }
        }
      } catch (err) {}
      if (!panHeld && pointerMode !== 'pan' && mediaInteractive && isMediaTarget(e.target) && !isMediaHeaderTarget(e.target)) return;
      try {
        var pt = String(e.pointerType || '');
        var btn = (typeof e.button === 'number') ? e.button : 0;
        var preset = coerceViewportControlsPreset(viewportControlsPreset);
        var allowPanDrag = (pt === 'touch') || pointerMode === 'pan' || shouldAllowPanDragForPointerEvent({ preset: preset, eventType: 'pointerdown', button: btn, shiftKey: !!e.shiftKey, spacePanHeld: panHeld });
        if (!allowPanDrag) return;
      } catch (err) {}
      startDrag(e.pointerId, e.clientX, e.clientY);
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }

    function onClickCapture(e){
      try {
        if (!e) return;
        if (dragId != null) return;
        if (nodeDrag || edgeDrag || groupDrag || headerDrag) return;
        if (panHeld || pointerMode === 'pan') return;
        if (mediaInteractive && !panHeld && pointerMode !== 'pan' && isMediaTarget(e.target) && !isMediaHeaderTarget(e.target)) return;

        var t = (e.target && e.target instanceof Element) ? e.target : null;
        if (t && t.closest && t.closest(UI_IGNORE_SELECTOR)) return;

        var nodeEl = t && t.closest ? t.closest('[data-node-id]') : null;
        if (nodeEl && nodeEl.getAttribute) {
          var nid = String(nodeEl.getAttribute('data-node-id') || '').trim();
          if (nid) {
            setSelection({ nodeId: nid, edgeId: '' });
            return;
          }
        }

        var edgeEl = t && t.closest ? t.closest('[data-edge-id]') : null;
        if (edgeEl && edgeEl.getAttribute) {
          var eid = String(edgeEl.getAttribute('data-edge-id') || '').trim();
          if (eid) {
            setSelection({ nodeId: '', edgeId: eid });
            return;
          }
        }

        setSelection({ nodeId: '', edgeId: '' });
      } catch (err) {}
    }
    function onPointerMove(e){
      if (headerDrag && headerDrag.pointerId === e.pointerId) {
        moveHeaderDrag(e.pointerId, e.clientX, e.clientY);
        try { e.preventDefault(); } catch (err) {}
        try { e.stopPropagation(); } catch (err) {}
        return;
      }
      if (edgeDrag && edgeDrag.pointerId === e.pointerId) {
        moveEdgeDrag(e.pointerId, e.clientX, e.clientY);
        try { e.preventDefault(); } catch (err) {}
        try { e.stopPropagation(); } catch (err) {}
        return;
      }
      if (nodeDrag && nodeDrag.pointerId === e.pointerId) {
        moveNodeDrag(e.pointerId, e.clientX, e.clientY, !!e.altKey);
        try { e.preventDefault(); } catch (err) {}
        try { e.stopPropagation(); } catch (err) {}
        return;
      }
      if (groupDrag && groupDrag.pointerId === e.pointerId) {
        moveGroupDrag(e.pointerId, e.clientX, e.clientY);
        try { e.preventDefault(); } catch (err) {}
        try { e.stopPropagation(); } catch (err) {}
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      moveDrag(e.clientX, e.clientY);
      e.preventDefault();
    }
    function onPointerUp(e){
      if (headerDrag && headerDrag.pointerId === e.pointerId) {
        endHeaderDrag(e.pointerId);
        try { e.preventDefault(); } catch (err) {}
        try { e.stopPropagation(); } catch (err) {}
        return;
      }
      if (edgeDrag && edgeDrag.pointerId === e.pointerId) {
        endEdgeDrag(e.pointerId);
        try { e.preventDefault(); } catch (err) {}
        try { e.stopPropagation(); } catch (err) {}
        return;
      }
      if (nodeDrag && nodeDrag.pointerId === e.pointerId) {
        endNodeDrag(e.pointerId);
        try { e.preventDefault(); } catch (err) {}
        try { e.stopPropagation(); } catch (err) {}
        return;
      }
      if (groupDrag && groupDrag.pointerId === e.pointerId) {
        endGroupDrag(e.pointerId);
        try { e.preventDefault(); } catch (err) {}
        try { e.stopPropagation(); } catch (err) {}
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      endDrag();
      e.preventDefault();
    }

    function onMouseDown(e){
      if (typeof window !== 'undefined' && window.PointerEvent) return;
      try { clearSelection(); } catch (err) {}
      try {
        if (e && e.target && e.target instanceof Element) {
          if (e.target.closest(UI_IGNORE_SELECTOR)) return;
        }
      } catch (err) {}
      if (allowNodeDrag && !panHeld && pointerMode !== 'pan' && isMediaHeaderTarget(e.target)) {
        try {
          var headerEl = e.target instanceof Element ? e.target.closest('.kg-mediaHeader') : null;
          var panelEl = headerEl ? headerEl.closest('.kg-media') : null;
          if (panelEl) {
            var nid = String(panelEl.getAttribute('data-node-id') || '').trim();
            if (nid) startHeaderDrag(nid, 'mouse-header', e.clientX, e.clientY, headerEl || panelEl || root);
            try { e.preventDefault(); } catch (err) {}
            try { e.stopPropagation(); } catch (err) {}
            return;
          }
        } catch (err) {}
      }
      if (!panHeld && pointerMode !== 'pan' && mediaInteractive && isMediaTarget(e.target) && !isMediaHeaderTarget(e.target)) return;
      try {
        var btn = (typeof e.button === 'number') ? e.button : 0;
        var preset = coerceViewportControlsPreset(viewportControlsPreset);
        var allowPanDrag = pointerMode === 'pan' || shouldAllowPanDragForPointerEvent({ preset: preset, eventType: 'mousedown', button: btn, shiftKey: !!e.shiftKey, spacePanHeld: panHeld });
        if (!allowPanDrag) return;
      } catch (err) {}
      startDrag('mouse', e.clientX, e.clientY);
      e.preventDefault();
    }
    function onMouseMove(e){
      if (headerDrag && headerDrag.pointerId === 'mouse-header') {
        moveHeaderDrag('mouse-header', e.clientX, e.clientY);
        try { e.preventDefault(); } catch (err) {}
        return;
      }
      if (!drag || drag.id !== 'mouse') return;
      moveDrag(e.clientX, e.clientY);
      e.preventDefault();
    }
    function onMouseUp(e){
      if (headerDrag && headerDrag.pointerId === 'mouse-header') {
        endHeaderDrag('mouse-header');
        try { e.preventDefault(); } catch (err) {}
        return;
      }
      if (!drag || drag.id !== 'mouse') return;
      endDrag();
      e.preventDefault();
    }

    root.addEventListener('wheel', onWheel, { passive: false, capture: true });
    root.addEventListener('pointerdown', function(){ try { clearSelection(); } catch (err) {} }, { passive: true, capture: true });
    root.addEventListener('click', onClickCapture, true);
    root.addEventListener('pointerdown', onPointerDown, { passive: false });
    root.addEventListener('pointermove', onPointerMove, { passive: false });
    root.addEventListener('pointerup', onPointerUp, { passive: false });
    root.addEventListener('pointercancel', onPointerUp, { passive: false });
    root.addEventListener('mousedown', onMouseDown, { passive: false });
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp, { passive: false });
    root.addEventListener('selectstart', function(e){ e.preventDefault(); }, { passive: false });
    root.addEventListener('dragstart', function(e){ e.preventDefault(); }, { passive: false });
    root.addEventListener('dblclick', function(e){ e.preventDefault(); }, { passive: false });
    root.addEventListener('contextmenu', function(e){
      try {
        var preset = coerceViewportControlsPreset(viewportControlsPreset);
        if (!shouldSuppressContextMenuForPreset(preset)) return;
        e.preventDefault();
      } catch (err) {}
    }, { passive: false });

    window.addEventListener('keydown', function(e){
      try {
        if (!e) return;
        var k0 = String(e.key || '');
        if (k0 === ' ' || k0 === 'Spacebar') {
          var aeS = document.activeElement;
          if (!aeS || aeS === document.body || (root && root.contains(aeS))) {
            setPanHeld(true);
            e.preventDefault();
          }
        }
        if (!e.ctrlKey && !e.metaKey) {
          var kk = String(e.key || '').toLowerCase();
          if (kk === 'p') {
            var aeP = document.activeElement;
            if (!aeP || aeP === document.body || (root && root.contains(aeP))) {
              setPointerMode(pointerMode === 'pan' ? 'select' : 'pan');
              e.preventDefault();
            }
          }
          if (kk === 'i') {
            var ae0 = document.activeElement;
            if (!ae0 || ae0 === document.body || (root && root.contains(ae0))) {
              setMediaInteractive(!mediaInteractive);
              e.preventDefault();
            }
          }
        }
        if (!(e.ctrlKey || e.metaKey)) return;
        var k = String(e.key || '');
        if (k === '+' || k === '-' || k === '=' || k === '0') {
          var ae = document.activeElement;
          if (!ae || ae === document.body || (root && root.contains(ae))) e.preventDefault();
        }
      } catch (err) {}
    }, { passive: false });

    window.addEventListener('keyup', function(e){
      try {
        if (!e) return;
        var k0 = String(e.key || '');
        if (k0 === ' ' || k0 === 'Spacebar') {
          setPanHeld(false);
          e.preventDefault();
        }
      } catch (err) {}
    }, { passive: false });

    window.addEventListener('blur', function(){
      try { setPanHeld(false); } catch (err) {}
    }, { passive: true });

    document.addEventListener('visibilitychange', function(){
      try { if (document.hidden) setPanHeld(false); } catch (err) {}
    }, { passive: true });

    var gestureZoom = null;
    window.addEventListener('gesturestart', function(e){
      try {
        var rect = root.getBoundingClientRect();
        var scale = typeof e.scale === 'number' && isFinite(e.scale) ? e.scale : 1;
        var clientX = typeof e.clientX === 'number' && isFinite(e.clientX) ? e.clientX : rect.left + rect.width / 2;
        var clientY = typeof e.clientY === 'number' && isFinite(e.clientY) ? e.clientY : rect.top + rect.height / 2;
        gestureZoom = { startK: state.k, startScale: scale || 1, anchor: { sx: clientX - rect.left, sy: clientY - rect.top } };
        e.preventDefault();
      } catch (err) {}
    }, { passive: false });
    window.addEventListener('gesturechange', function(e){
      try {
        if (!gestureZoom) return;
        var g = gestureZoom;
        var scale = typeof e.scale === 'number' && isFinite(e.scale) ? e.scale : 1;
        var ratio = g.startScale > 0 ? scale / g.startScale : scale;
        var nextK = Math.max(minK, Math.min(maxK, g.startK * ratio));
        var next = computeAnchoredTransform({ transform: state, anchor: g.anchor, nextK: nextK });
        state.k = next.k; state.x = next.x; state.y = next.y;
        applyTransform();
        e.preventDefault();
      } catch (err) {}
    }, { passive: false });
    window.addEventListener('gestureend', function(e){
      try { gestureZoom = null; e.preventDefault(); } catch (err) {}
    }, { passive: false });

    if (fitBtn) fitBtn.addEventListener('click', function(){ fitToCenter(); });
    if (resetBtn) resetBtn.addEventListener('click', function(){ resetView(); });
    if (panBtn) panBtn.addEventListener('click', function(){ setPointerMode(pointerMode === 'pan' ? 'select' : 'pan'); });
    if (mediaBtn) mediaBtn.addEventListener('click', function(){ setMediaInteractive(!mediaInteractive); });
    window.addEventListener('resize', function(){ refreshViewport(); fitToCenter(); });

    requestAnimationFrame(function(){
      setMediaInteractive(false);
      setPanHeld(false);
      setPointerMode('select');
      refreshViewport();
      rebuildSvgNodeIndex();
      fitToCenter();
      updateOverlays();
      if (overlayFollowAnimation && mediaNodes && mediaNodes.length > 0) {
        var overlayTick = function(){
          updateOverlays();
          requestAnimationFrame(overlayTick);
        };
        requestAnimationFrame(overlayTick);
      }
    });
  })();
  </script>
</body>
</html>`

  return html
}
