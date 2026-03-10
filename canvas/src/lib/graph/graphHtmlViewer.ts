import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import type { GraphData, GraphNode } from '@/lib/graph/types'

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
}): Promise<string | null> {
  const title = String(args.title || '').trim() || 'Graph viewer'
  const svgMarkupRaw = String(args.svgMarkup || '').trim()

  const hasSvg = !!svgMarkupRaw
  if (!hasSvg) return null

  const canvasBg = tryReadCssVar('--kg-canvas-bg', '#ffffff')
  const panelBg = tryReadCssVar('--kg-panel-bg', 'rgba(255,255,255,0.92)')
  const border = tryReadCssVar('--kg-border', 'rgba(0,0,0,0.12)')
  const text = tryReadCssVar('--kg-text-primary', 'rgba(0,0,0,0.86)')
  const textTertiary = tryReadCssVar('--kg-text-tertiary', 'rgba(0,0,0,0.55)')

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
    #kg-stage{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
    #kg-svgWrap{position:absolute;left:0;top:0}
    #kg-svgWrap svg{display:block}
    #kg-svgWrap text{pointer-events:none}
    #kg-overlay{position:absolute;left:0;top:0;pointer-events:none}
    .kg-media{position:absolute;left:0;top:0;pointer-events:auto;background:var(--kg-panel-bg);border:var(--kg-media-panel-border-w) solid var(--kg-border);border-radius:var(--kg-media-panel-radius);box-shadow:0 10px 30px rgba(0,0,0,.12);overflow:hidden}
    .kg-mediaHeader{height:var(--kg-media-panel-header-h);display:flex;align-items:center;gap:8px;padding:0 10px;background:rgba(0,0,0,0.04);border-bottom:var(--kg-media-panel-border-w) solid var(--kg-border);cursor:grab;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;pointer-events:none}
    .kg-mediaTitle{font-size:var(--kg-media-panel-title-size);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--kg-text-tertiary);pointer-events:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
    .kg-mediaBody{position:relative;padding:var(--kg-media-panel-padding)}
    .kg-mediaBody iframe,.kg-mediaBody img,.kg-mediaBody video{display:block;width:100%;height:100%;border:0;border-radius:calc(var(--kg-media-panel-radius) * 0.8);background:rgba(0,0,0,0.02);pointer-events:var(--kg-media-pointer-events)}
    #kg-hud{position:fixed;left:12px;top:12px;display:flex;gap:8px;z-index:1000}
    .kg-btn{border:1px solid var(--kg-border);background:var(--kg-panel-bg);color:var(--kg-text);border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer}
    .kg-btn.kg-active{outline:2px solid rgba(59,130,246,0.6);outline-offset:0}
  </style>
</head>
<body>
  <div id="kg-root">
    <div id="kg-stage">
      <div id="kg-svgWrap">${svgPlaceholder}</div>
      <div id="kg-overlay"></div>
    </div>
    <div id="kg-hud">
      <button class="kg-btn" id="kg-fit" type="button">Fit</button>
      <button class="kg-btn" id="kg-reset" type="button">Reset</button>
      <button class="kg-btn" id="kg-media-toggle" type="button" title="Toggle media interaction (I)">Media</button>
    </div>
  </div>
  <script>
  (function(){
    var root = document.getElementById('kg-root');
    var stage = document.getElementById('kg-stage');
    var svg = (document.querySelector('#kg-svgWrap svg') || null);
    var overlay = document.getElementById('kg-overlay');
    var fitBtn = document.getElementById('kg-fit');
    var resetBtn = document.getElementById('kg-reset');
    var mediaBtn = document.getElementById('kg-media-toggle');

    var state = { k: 1, x: 0, y: 0 };
    var minK = 0.05;
    var maxK = 50;
    var lastOverlayKey = '';
    var mediaNodes = ${mediaNodesJson};
    var nodePosById = ${nodePosByIdJson};
    var overlayFollowAnimation = !!(svg && svg.getAttribute && svg.getAttribute('data-kg-3d-payload'));
    var svgNodeById = {};
    var mediaInteractive = false;
    var panHeld = false;

    function clearSelection(){
      try {
        var s = (window.getSelection && window.getSelection()) || null;
        if (s && s.removeAllRanges) s.removeAllRanges();
      } catch (err) {}
    }

    function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
    function applyTransform(){
      stage.style.transform = 'translate(' + state.x + 'px,' + state.y + 'px) scale(' + state.k + ')';
      scheduleOverlayUpdate();
    }

    function applyMediaPointerEvents(){
      try {
        document.documentElement.style.setProperty('--kg-media-pointer-events', (mediaInteractive && !panHeld) ? 'auto' : 'none');
      } catch (err) {}
      try {
        if (mediaBtn && mediaBtn.classList) {
          if (mediaInteractive) mediaBtn.classList.add('kg-active');
          else mediaBtn.classList.remove('kg-active');
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

    function getViewport(){
      var r = root.getBoundingClientRect();
      return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    }

    function getContentBBox(){
      try {
        if (svg && svg.getBBox) {
          var g = svg.querySelector('g') || svg;
          if (g && g.getBBox) return g.getBBox();
          return svg.getBBox();
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
      var k = Math.min(vp.w / (bb.width + pad * 2), vp.h / (bb.height + pad * 2));
      k = clamp(k, minK, maxK);
      var cx = bb.x + bb.width / 2;
      var cy = bb.y + bb.height / 2;
      state.k = k;
      state.x = vp.w / 2 - cx * k;
      state.y = vp.h / 2 - cy * k;
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
      overlay.__kgSvgNodeById = {};
      for (var i = 0; i < mediaNodes.length; i += 1) {
        var n = mediaNodes[i];
        var el = document.createElement('div');
        el.className = 'kg-media';
        var id = String(n.id || '');
        el.setAttribute('data-node-id', id);
        try {
          var esc = (typeof CSS !== 'undefined' && CSS && CSS.escape) ? CSS.escape(id) : id;
          var nodeEl0 = svg ? svg.querySelector('[data-node-id=\"' + esc + '\"]') : null;
          overlay.__kgSvgNodeById[id] = nodeEl0;
          svgNodeById[id] = nodeEl0;
        } catch (err) {
          overlay.__kgSvgNodeById[id] = null;
          svgNodeById[id] = null;
        }
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
        if (nodeEl) {
          var c = (nodeEl.querySelector ? nodeEl.querySelector('[data-role="node-circle"]') : null);
          if (c && c.getAttribute) {
            var cx0 = parseFloat(c.getAttribute('cx') || 'NaN');
            var cy0 = parseFloat(c.getAttribute('cy') || 'NaN');
            if (isFinite(cx0) && isFinite(cy0)) { cx = cx0; cy = cy0; }
          }
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
          var p = nodePosById && nodePosById[id] ? nodePosById[id] : null;
          if (p && typeof p.x === 'number' && typeof p.y === 'number') {
            cx = p.x;
            cy = p.y;
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
        var tx = cx - panel.panelW / 2;
        var ty = cy - panel.panelH / 2;
        if (last.x !== tx || last.y !== ty) {
          el.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
          last.x = tx;
          last.y = ty;
        }
      }
    }

    function onWheel(e){
      e.preventDefault();
      var cx = e.clientX;
      var cy = e.clientY;
      if (e.ctrlKey || e.metaKey) {
        var zoomSpeed = 0.0022;
        var nextK = state.k * Math.exp(-e.deltaY * zoomSpeed);
        nextK = clamp(nextK, minK, maxK);
        var wx = (cx - state.x) / state.k;
        var wy = (cy - state.y) / state.k;
        state.k = nextK;
        state.x = cx - wx * nextK;
        state.y = cy - wy * nextK;
        applyTransform();
        return;
      }
      state.x -= e.deltaX;
      state.y -= e.deltaY;
      applyTransform();
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

    function onPointerDown(e){
      if (!panHeld && mediaInteractive && isMediaTarget(e.target)) return;
      startDrag(e.pointerId, e.clientX, e.clientY);
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }
    function onPointerMove(e){
      if (!drag || drag.id !== e.pointerId) return;
      moveDrag(e.clientX, e.clientY);
      e.preventDefault();
    }
    function onPointerUp(e){
      if (!drag || drag.id !== e.pointerId) return;
      endDrag();
      e.preventDefault();
    }

    function onMouseDown(e){
      if (typeof window !== 'undefined' && window.PointerEvent) return;
      if (!panHeld && mediaInteractive && isMediaTarget(e.target)) return;
      startDrag('mouse', e.clientX, e.clientY);
      e.preventDefault();
    }
    function onMouseMove(e){
      if (!drag || drag.id !== 'mouse') return;
      moveDrag(e.clientX, e.clientY);
      e.preventDefault();
    }
    function onMouseUp(e){
      if (!drag || drag.id !== 'mouse') return;
      endDrag();
      e.preventDefault();
    }

    root.addEventListener('wheel', onWheel, { passive: false, capture: true });
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
    root.addEventListener('contextmenu', function(e){ e.preventDefault(); }, { passive: false });

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

    window.addEventListener('gesturestart', function(e){ try { e.preventDefault(); } catch (err) {} }, { passive: false });
    window.addEventListener('gesturechange', function(e){ try { e.preventDefault(); } catch (err) {} }, { passive: false });
    window.addEventListener('gestureend', function(e){ try { e.preventDefault(); } catch (err) {} }, { passive: false });

    if (fitBtn) fitBtn.addEventListener('click', function(){ fitToCenter(); });
    if (resetBtn) resetBtn.addEventListener('click', function(){ resetView(); });
    if (mediaBtn) mediaBtn.addEventListener('click', function(){ setMediaInteractive(!mediaInteractive); });
    window.addEventListener('resize', function(){ fitToCenter(); });

    requestAnimationFrame(function(){
      setMediaInteractive(false);
      setPanHeld(false);
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
