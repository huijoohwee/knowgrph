import { getKgHtmlViewerRuntimeTemplateB64 } from './runtimeTemplateB64'

const decodeBase64Utf8 = (b64: string): string => {
  const trimmed = String(b64 || '').trim()
  if (!trimmed) return ''
  const buf = (globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: (enc2: string) => string } } })
    .Buffer
  if (buf) return buf.from(trimmed, 'base64').toString('utf8')
  const atobFn = (globalThis as unknown as { atob?: (s: string) => string }).atob
  if (!atobFn) return ''
  const binary = atobFn(trimmed)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    let out = ''
    for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i])
    return out
  }
}

const replaceAllExact = (s: string, token: string, replacement: string): string => {
  if (!token) return s
  if (!s.includes(token)) return s
  return s.split(token).join(replacement)
}

const replaceOnceExact = (s: string, token: string, replacement: string): string => {
  if (!token) return s
  const i = s.indexOf(token)
  if (i < 0) return s
  return s.slice(0, i) + replacement + s.slice(i + token.length)
}

const cookTemplateLiteral = (raw: string): string => {
  const src = String(raw || '')
  if (!src) return ''
  const escaped = src.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  try {
    return Function('return `' + escaped + '`')() as string
  } catch {
    return src
  }
}

export function buildHtmlViewerRuntimeScript(args: {
  interactionCfgJson: string
  mediaNodesJson: string
  nodeLabelByIdJson: string
  edgeMetaByIdJson: string
  frontmatterVisibilityJson: string
  nodePosByIdJson: string
  groupMembersByIdJson: string
  density: 'default' | 'compact'
  widthRatioDefault: number
  widthRatioCompact: number
  widthMinDefault: number
  widthMinCompact: number
  widthMaxDefault: number
  widthMaxCompact: number
  proxyOrigin?: string
}): string {
  const templateRaw = decodeBase64Utf8(getKgHtmlViewerRuntimeTemplateB64())
  const template = cookTemplateLiteral(templateRaw)
  if (!template) return ''

  let out = template
  out = replaceAllExact(out, '__KG_CFG__', args.interactionCfgJson)
  out = replaceAllExact(out, '__KG_MEDIA_NODES__', args.mediaNodesJson)
  out = replaceAllExact(out, '__KG_NODE_META__', args.nodeLabelByIdJson)
  out = replaceAllExact(out, '__KG_EDGE_META__', args.edgeMetaByIdJson)
  out = replaceAllExact(out, '__KG_NODE_POS__', args.nodePosByIdJson)
  out = replaceAllExact(out, '__KG_GROUP_MEMBERS__', args.groupMembersByIdJson)
  out = replaceAllExact(out, '__KG_DENSITY__', JSON.stringify(args.density))
  out = replaceAllExact(out, '__KG_WIDTH_RATIO_DEFAULT__', String(args.widthRatioDefault))
  out = replaceAllExact(out, '__KG_WIDTH_RATIO_COMPACT__', String(args.widthRatioCompact))
  out = replaceAllExact(out, '__KG_WIDTH_MIN_DEFAULT__', String(args.widthMinDefault))
  out = replaceAllExact(out, '__KG_WIDTH_MIN_COMPACT__', String(args.widthMinCompact))
  out = replaceAllExact(out, '__KG_WIDTH_MAX_DEFAULT__', String(args.widthMaxDefault))
  out = replaceAllExact(out, '__KG_WIDTH_MAX_COMPACT__', String(args.widthMaxCompact))

  out = replaceOnceExact(
    out,
    "var panBtn = null;\n    var mediaBtn = document.getElementById('kg-media-toggle');",
    "var panBtn = null;\n    var mode3dBtn = document.getElementById('kg-3d-toggle');\n    var richBtn = document.getElementById('kg-rich-toggle');\n    var frontmatterBtn = document.getElementById('kg-frontmatter-toggle');\n    var mediaBtn = document.getElementById('kg-media-toggle');",
  )

  out = replaceOnceExact(
    out,
    "if (/(^|\\/\\/)twitframe\\.com\\//i.test(u)) return true;\n        return false;",
    "if (/(^|\\/\\/)twitframe\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)player\\.bilibili\\.com\\//i.test(u)) return true;\n        return false;",
  )

  out = replaceOnceExact(
    out,
    "var mediaBtn = document.getElementById('kg-media-toggle');",
    "var mediaBtn = document.getElementById('kg-media-toggle');\n\n    var KG_PROXY_ORIGIN = __KG_PROXY_ORIGIN__;\n    var KG_PROXY_ORIGIN_RUNTIME = (typeof KG_PROXY_ORIGIN === 'string' ? String(KG_PROXY_ORIGIN || '').trim() : '');\n    var KG_PROXY_PROBE_STARTED = false;\n\n    var kgGetProxyOrigin = function(){\n      try { return String(KG_PROXY_ORIGIN_RUNTIME || '').trim(); } catch (e) { return ''; }\n    };\n\n    var kgShouldUseProxy = function(){\n      try {\n        if (kgGetProxyOrigin()) return true;\n      } catch (e) {\n        void 0;\n      }\n      try {\n        var host = String((window && window.location && window.location.hostname) ? window.location.hostname : '').toLowerCase();\n        if (!host) return false;\n        return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';\n      } catch (e) {\n        return false;\n      }\n    };\n\n    var kgInferMediaKindFromUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        if (/^data:image\\//i.test(u)) {\n          if (/^data:image\\/svg\\+xml/i.test(u)) return 'svg';\n          return 'image';\n        }\n        var noHash = u.split('#')[0] || u;\n        var noQuery = noHash.split('?')[0] || noHash;\n        var lower = String(noQuery).toLowerCase();\n        if (lower.endsWith('.svg')) return 'svg';\n        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp')) return 'image';\n        if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.m4v')) return 'video';\n        return '';\n      } catch (e) {\n        return '';\n      }\n    };\n\n    var kgIsDirectIframeEmbedUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return false;\n        if (!/^https?:\\/\\//i.test(u)) return true;\n        if (/(^|\\/\\/)(www\\.)?youtube\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)(www\\.)?youtu\\.be\\//i.test(u)) return true;\n        if (/(^|\\/\\/)www\\.youtube-nocookie\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)player\\.vimeo\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)platform\\.twitter\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)twitframe\\.com\\//i.test(u)) return true;\n        return false;\n      } catch (e) {\n        return false;\n      }\n    };\n\n    var kgBuildRemoteFetchProxyUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        if (u.startsWith('/__fetch_remote?url=')) return u;\n        var origin = kgGetProxyOrigin();\n        if (/^https?:\\/\\//i.test(origin || '')) return String(origin).replace(/\\/+$/, '') + '/__fetch_remote?url=' + encodeURIComponent(u);\n        if (!kgShouldUseProxy()) return u;\n        return '/__fetch_remote?url=' + encodeURIComponent(u);\n      } catch (e) {\n        return String(rawUrl || '').trim();\n      }\n    };\n\n    var kgBuildWebpageProxyUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        if (u.startsWith('/__webpage_proxy?url=')) return u;\n        var origin = kgGetProxyOrigin();\n        if (/^https?:\\/\\//i.test(origin || '')) return String(origin).replace(/\\/+$/, '') + '/__webpage_proxy?url=' + encodeURIComponent(u);\n        if (!kgShouldUseProxy()) return u;\n        return '/__webpage_proxy?url=' + encodeURIComponent(u);\n      } catch (e) {\n        return String(rawUrl || '').trim();\n      }\n    };\n\n    var kgResolveMediaSrc = function(url, kind){\n      var u = String(url || '').trim();\n      if (!u) return '';\n      if (/^\\s*(data:|blob:|mailto:|tel:)/i.test(u)) return u;\n      if (u.startsWith('/__') || u.startsWith('/@')) return u;\n      var k = String(kind || '');\n      if (k === 'iframe') {\n        if (kgIsDirectIframeEmbedUrl(u)) return u;\n        return kgBuildWebpageProxyUrl(u);\n      }\n      if (k === 'video' || k === 'image' || k === 'svg') return kgBuildRemoteFetchProxyUrl(u);\n      return u;\n    };\n\n    var kgResolveIframeSandbox = function(url){\n      try {\n        return kgIsDirectIframeEmbedUrl(url)\n          ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation'\n          : 'allow-scripts allow-presentation';\n      } catch (e) {\n        return 'allow-scripts allow-presentation';\n      }\n    };\n\n    var kgApplyMediaSrcForEl = function(el){\n      try {\n        if (!el || !el.getAttribute) return;\n        var kind0 = String(el.getAttribute('data-kg-kind') || 'iframe');\n        var url0 = String(el.getAttribute('data-kg-url') || '');\n        var inferred = kgInferMediaKindFromUrl(url0);\n        var kind = (inferred && (kind0 === 'iframe' || kind0 === '')) ? inferred : kind0;\n        if (kind === 'image' || kind === 'svg') {\n          var img = el.querySelector ? el.querySelector('img') : null;\n          if (img) img.src = kgResolveMediaSrc(url0, kind);\n          return;\n        }\n        if (kind === 'video') {\n          var vid = el.querySelector ? el.querySelector('video') : null;\n          if (vid) vid.src = kgResolveMediaSrc(url0, kind);\n          return;\n        }\n        var iframe = el.querySelector ? el.querySelector('iframe') : null;\n        if (!iframe) return;\n        try { iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'); } catch (e0) { void 0; }\n        try { iframe.setAttribute('sandbox', kgResolveIframeSandbox(url0)); } catch (e1) { void 0; }\n        iframe.src = kgResolveMediaSrc(url0, 'iframe');\n      } catch (e) {\n        void 0;\n      }\n    };\n\n    var kgApplyMediaSrcToAll = function(){\n      try {\n        if (!overlay || !overlay.__kgMediaById) return;\n        var m = overlay.__kgMediaById;\n        for (var k in m) {\n          if (!k) continue;\n          kgApplyMediaSrcForEl(m[k]);\n        }\n      } catch (e) {\n        void 0;\n      }\n    };\n\n    var kgMaybeProbeProxyOrigin = function(){\n      try {\n        if (KG_PROXY_PROBE_STARTED) return;\n        if (kgGetProxyOrigin()) return;\n        if (!window || !window.location) return;\n        if (String(window.location.protocol || '') !== 'file:') return;\n        KG_PROXY_PROBE_STARTED = true;\n        var ports = [5173,5174,5175,5176,5177,5178,5179,5180];\n        var i = 0;\n        var probeNext = function(){\n          if (i >= ports.length) return;\n          var origin = 'http://localhost:' + ports[i++];\n          try {\n            var probeUrl = origin + '/__fetch_remote?url=' + encodeURIComponent('https://example.com/');\n            fetch(probeUrl, { method: 'HEAD', mode: 'cors' }).then(function(res){\n              if (!res) return probeNext();\n              if (res.status === 404) return probeNext();\n              KG_PROXY_ORIGIN_RUNTIME = origin;\n              kgApplyMediaSrcToAll();\n            }).catch(function(){ probeNext(); });\n          } catch (e) {\n            probeNext();\n          }\n        };\n        probeNext();\n      } catch (e) {\n        void 0;\n      }\n    };\n\n    kgMaybeProbeProxyOrigin();\n",
  )

  out = replaceOnceExact(
    out,
    'var kgResolveMediaSrc = function(url, kind){',
    "var kgIsWeChatHotlinkProtectedAssetUrl = function(absUrl){\n      try {\n        var raw = String(absUrl || '').trim();\n        if (!/^https?:\\/\\//i.test(raw)) return false;\n        var p = new URL(raw);\n        var host = String(p.hostname || '').toLowerCase();\n        if (host === 'mmbiz.qpic.cn' || host.endsWith('.qpic.cn')) return true;\n        if (host === 'mmbiz.qlogo.cn' || host.endsWith('.qlogo.cn')) return true;\n        if (host === 'wx.qlogo.cn' || host.endsWith('.wx.qlogo.cn')) return true;\n        return false;\n      } catch (e) {\n        return false;\n      }\n    };\n\n    var kgBuildWebpageAssetPathProxyUrl = function(absUrl){\n      try {\n        var raw = String(absUrl || '').trim();\n        if (!raw) return '';\n        if (raw.startsWith('/__webpage_asset_path/')) return raw;\n        if (raw.startsWith('/__webpage_asset_proxy?url=')) return raw;\n        if (!/^https?:\\/\\//i.test(raw)) return raw;\n        var p = new URL(raw);\n        var originEnc = encodeURIComponent(p.origin);\n        var pp = String(p.pathname || '/');\n        var qq = String(p.search || '');\n        var out = '/__webpage_asset_path/' + originEnc + pp + qq;\n        try {\n          var origin = kgGetProxyOrigin();\n          if (/^https?:\\/\\//i.test(origin || '') && window && window.location && String(window.location.protocol || '') === 'file:') {\n            return String(origin).replace(/\\/+$/, '') + out;\n          }\n        } catch (e0) {\n          void 0;\n        }\n        return out;\n      } catch (e) {\n        return String(absUrl || '').trim();\n      }\n    };\n\n    var kgResolveMediaSrc = function(url, kind){",
  )

  out = replaceOnceExact(
    out,
    "if (k === 'video' || k === 'image' || k === 'svg') return kgBuildRemoteFetchProxyUrl(u);",
    "if (k === 'image' || k === 'svg') {\n        if (kgShouldUseProxy()) return kgBuildRemoteFetchProxyUrl(u);\n        return u;\n      }\n      if (k === 'video') return kgShouldUseProxy() ? kgBuildRemoteFetchProxyUrl(u) : u;",
  )

  out = replaceOnceExact(
    out,
    "if (u.startsWith('/__') || u.startsWith('/@')) return u;",
    "if (u.startsWith('/__') || u.startsWith('/@')) {\n        try {\n          var origin = kgGetProxyOrigin();\n          if (/^https?:\\/\\//i.test(origin || '') && window && window.location && String(window.location.protocol || '') === 'file:') {\n            return String(origin).replace(/\\/+$/, '') + u;\n          }\n        } catch (e0) {\n          void 0;\n        }\n        return u;\n      }",
  )

  out = replaceOnceExact(
    out,
    'function fitToCenter(){',
    "function getContentCentroid(){\n      try {\n        if (nodePosById) {\n          var sx = 0;\n          var sy = 0;\n          var c = 0;\n          for (var id in nodePosById) {\n            var p = nodePosById[id];\n            if (!p) continue;\n            var x = Number(p.x);\n            var y = Number(p.y);\n            if (!isFinite(x) || !isFinite(y)) continue;\n            sx += x;\n            sy += y;\n            c += 1;\n          }\n          if (c > 0) return { x: sx / c, y: sy / c };\n        }\n      } catch (e) {}\n      return null;\n    }\n\n    function fitToCenter(){",
  )

  out = replaceOnceExact(
    out,
    'var cx = bb.x + bb.width / 2;\n      var cy = bb.y + bb.height / 2;',
    'var c = getContentCentroid();\n      var cx = (c && isFinite(c.x)) ? c.x : (bb.x + bb.width / 2);\n      var cy = (c && isFinite(c.y)) ? c.y : (bb.y + bb.height / 2);',
  )

  out = replaceOnceExact(
    out,
    "if (t && t.closest && (t.closest('[data-node-id]') || t.closest('[data-edge-id]') || t.closest('[data-kg-group-id]') || t.closest('.kg-media'))) return;",
    "if (t && t.closest && t.closest('[data-edge-id]')) return;",
  )

  out = replaceOnceExact(
    out,
    'if (!touches || touches.length === 0) return;\n\n        var t0 = safeViewportTransform(state);',
    "if (!touches || touches.length === 0) return;\n\n        if (touches.length === 1) {\n          try {\n            if (t && t.closest && !panHeld && pointerMode !== 'pan') {\n              var touchClientX = (touches[0] && isFinite(touches[0].clientX)) ? touches[0].clientX : 0;\n              var touchClientY = (touches[0] && isFinite(touches[0].clientY)) ? touches[0].clientY : 0;\n\n              var headerEl = t.closest('.kg-mediaHeader');\n              if (headerEl) {\n                var panelEl = headerEl.closest('.kg-media');\n                var nid0 = (panelEl && panelEl.getAttribute) ? String(panelEl.getAttribute('data-node-id') || '').trim() : '';\n                if (nid0) {\n                  startHeaderDrag(nid0, -1, touchClientX, touchClientY, headerEl);\n                  touchDrag = { type: 'header', pointerId: -1 };\n                  try { e.preventDefault(); } catch (err0) {}\n                  return;\n                }\n              }\n\n              var groupEl = t.closest('[data-kg-group-id]');\n              if (allowGroupDrag && groupEl && groupEl.getAttribute) {\n                var gid = String(groupEl.getAttribute('data-kg-group-id') || '').trim();\n                if (gid) {\n                  startGroupDrag(gid, -1, touchClientX, touchClientY);\n                  touchDrag = { type: 'group', pointerId: -1 };\n                  try { e.preventDefault(); } catch (err1) {}\n                  return;\n                }\n              }\n\n              var nodeEl = t.closest('[data-node-id]');\n              if (allowNodeDrag && nodeEl && nodeEl.getAttribute && !(t.closest && t.closest('.kg-media'))) {\n                var nid = String(nodeEl.getAttribute('data-node-id') || '').trim();\n                if (nid) {\n                  startNodeDrag(nid, -1, touchClientX, touchClientY);\n                  touchDrag = { type: 'node', pointerId: -1 };\n                  try { e.preventDefault(); } catch (err2) {}\n                  return;\n                }\n              }\n            }\n          } catch (err3) {}\n        }\n\n        var t0 = safeViewportTransform(state);",
  )

  out = replaceOnceExact(
    out,
    "if (touchDrag.type === 'rotate') {",
    "if (touchDrag.type === 'node') {\n          if (touches.length !== 1) { try { endDrag(); } catch (e0) {} touchDrag = null; return; }\n          try { moveNodeDrag(-1, touches[0].clientX, touches[0].clientY); } catch (e1) {}\n          try { e.preventDefault(); } catch (err0) {}\n          return;\n        }\n\n        if (touchDrag.type === 'group') {\n          if (touches.length !== 1) { try { endDrag(); } catch (e2) {} touchDrag = null; return; }\n          try { moveGroupDrag(-1, touches[0].clientX, touches[0].clientY); } catch (e3) {}\n          try { e.preventDefault(); } catch (err1) {}\n          return;\n        }\n\n        if (touchDrag.type === 'header') {\n          if (touches.length !== 1) { try { endDrag(); } catch (e4) {} touchDrag = null; return; }\n          try { moveHeaderDrag(-1, touches[0].clientX, touches[0].clientY); } catch (e5) {}\n          try { e.preventDefault(); } catch (err2) {}\n          return;\n        }\n\n        if (touchDrag.type === 'rotate') {",
  )

  out = replaceOnceExact(
    out,
    'if (!touches || touches.length === 0) touchDrag = null;',
    "if (!touches || touches.length === 0) {\n          try { endDrag(); } catch (e0) {}\n          touchDrag = null;\n        }",
  )

  out = replaceOnceExact(
    out,
    'if (mediaBtn) mediaBtn.addEventListener(\'click\', function(){ setMediaInteractive(!mediaInteractive); });',
    `var __kgFrontmatterVis = ${args.frontmatterVisibilityJson};
    var __kgFrontmatterNodeSet = null;
    var __kgFrontmatterEdgeSet = null;
    var __kgAllNodeEls = null;
    var __kgAllEdgeEls = null;
    var __kgAllGroupEls = null;

    function __kgEnsureFrontmatterSets(){
      if (__kgFrontmatterNodeSet && __kgFrontmatterEdgeSet) return;
      __kgFrontmatterNodeSet = Object.create(null);
      __kgFrontmatterEdgeSet = Object.create(null);
      try {
        var nids = (__kgFrontmatterVis && __kgFrontmatterVis.nodeIds) ? __kgFrontmatterVis.nodeIds : [];
        for (var i = 0; i < nids.length; i += 1) {
          var id = String(nids[i] || '').trim();
          if (id) __kgFrontmatterNodeSet[id] = 1;
        }
      } catch (e0) {
        void 0;
      }
      try {
        var eids = (__kgFrontmatterVis && __kgFrontmatterVis.edgeIds) ? __kgFrontmatterVis.edgeIds : [];
        for (var j = 0; j < eids.length; j += 1) {
          var eid = String(eids[j] || '').trim();
          if (eid) __kgFrontmatterEdgeSet[eid] = 1;
        }
      } catch (e1) {
        void 0;
      }
    }

    function __kgEnsureAllNodeEls(){
      if (__kgAllNodeEls) return __kgAllNodeEls;
      try {
        __kgAllNodeEls = root ? Array.prototype.slice.call(root.querySelectorAll('[data-node-id]')) : (svg ? Array.prototype.slice.call(svg.querySelectorAll('[data-node-id]')) : []);
      } catch (e) {
        __kgAllNodeEls = [];
      }
      return __kgAllNodeEls;
    }

    function __kgEnsureAllEdgeEls(){
      if (__kgAllEdgeEls) return __kgAllEdgeEls;
      try { __kgAllEdgeEls = svg ? Array.prototype.slice.call(svg.querySelectorAll('line[data-edge-id],path[data-edge-id],polyline[data-edge-id]')) : []; } catch (e) { __kgAllEdgeEls = []; }
      return __kgAllEdgeEls;
    }

    function __kgEnsureAllGroupEls(){
      if (__kgAllGroupEls) return __kgAllGroupEls;
      try { __kgAllGroupEls = svg ? Array.prototype.slice.call(svg.querySelectorAll('[data-kg-group-id]')) : []; } catch (e) { __kgAllGroupEls = []; }
      return __kgAllGroupEls;
    }

    function __kgApplyFrontmatterVisibility(){
      try {
        if (!svg) return;
        __kgEnsureFrontmatterSets();
        var showAll = !frontmatterEnabled;

        __kgAllNodeEls = null;
        var nodes = __kgEnsureAllNodeEls();
        for (var i = 0; i < nodes.length; i += 1) {
          var el = nodes[i];
          if (!el || !el.getAttribute || !el.style) continue;
          var nid = String(el.getAttribute('data-node-id') || '').trim();
          if (showAll) { el.style.display = ''; continue; }
          el.style.display = (__kgFrontmatterNodeSet && __kgFrontmatterNodeSet[nid] === 1) ? '' : 'none';
        }

        var edges = __kgEnsureAllEdgeEls();
        for (var j = 0; j < edges.length; j += 1) {
          var ee = edges[j];
          if (!ee || !ee.getAttribute || !ee.style) continue;
          var eid = String(ee.getAttribute('data-edge-id') || '').trim();
          if (showAll) { ee.style.display = ''; continue; }
          ee.style.display = (__kgFrontmatterEdgeSet && __kgFrontmatterEdgeSet[eid] === 1) ? '' : 'none';
        }

        var groups = __kgEnsureAllGroupEls();
        for (var k = 0; k < groups.length; k += 1) {
          var ge = groups[k];
          if (!ge || !ge.getAttribute || !ge.style) continue;
          if (showAll) { ge.style.display = ''; continue; }
          var gid = String(ge.getAttribute('data-kg-group-id') || '').trim();
          var members = (groupMembersById && gid && groupMembersById[gid]) ? groupMembersById[gid] : null;
          var any = false;
          if (members && members.length) {
            for (var mi = 0; mi < members.length; mi += 1) {
              var mid = String(members[mi] || '').trim();
              if (mid && __kgFrontmatterNodeSet && __kgFrontmatterNodeSet[mid] === 1) { any = true; break; }
            }
          }
          ge.style.display = any ? '' : 'none';
        }

        try { if (typeof scheduleOverlayUpdate === 'function') scheduleOverlayUpdate(); } catch (e2) { void 0; }
      } catch (e) {
        void 0;
      }
    }

    var richVisible = true;
    var frontmatterEnabled = false;
    var mode3dVisible = false;

    function setRichVisible(next){
      richVisible = !!next;
      try { if (overlay && overlay.style) overlay.style.display = richVisible ? '' : 'none'; } catch (e0) {}
      try { if (richBtn && richBtn.classList) richBtn.classList.toggle('kg-active', richVisible); } catch (e1) {}
    }

    function setFrontmatterEnabled(next){
      frontmatterEnabled = !!next;
      try { if (root && root.classList) root.classList.toggle('kg-frontmatter', frontmatterEnabled); } catch (e0) {}
      try { if (frontmatterBtn && frontmatterBtn.classList) frontmatterBtn.classList.toggle('kg-active', frontmatterEnabled); } catch (e1) {}
      try { __kgApplyFrontmatterVisibility(); } catch (e2) { void 0; }
    }

    function set3dVisible(next){
      mode3dVisible = !!next;
      try { if (cfg && mode3dVisible) cfg.preferWebgl3d = true; } catch (e0) {}
      if (mode3dVisible) {
        try { install3dCanvasRendererOnce(); } catch (e1) {}
        try { if (root && root.classList) root.classList.add('kg-canvas3d'); } catch (e2) {}
        try { if (schedule3dFrame) schedule3dFrame(); } catch (e3) {}
        try { if (scheduleWebgl3dFrame) scheduleWebgl3dFrame(); } catch (e4) {}
      } else {
        try { if (root && root.classList) root.classList.remove('kg-canvas3d'); } catch (e5) {}
      }
      try { if (mode3dBtn && mode3dBtn.classList) mode3dBtn.classList.toggle('kg-active', mode3dVisible); } catch (e6) {}
    }

    if (mediaBtn) mediaBtn.addEventListener('click', function(){ setMediaInteractive(!mediaInteractive); });
    if (richBtn) richBtn.addEventListener('click', function(){ setRichVisible(!richVisible); });
    if (frontmatterBtn) frontmatterBtn.addEventListener('click', function(){ setFrontmatterEnabled(!frontmatterEnabled); });
    if (mode3dBtn) mode3dBtn.addEventListener('click', function(){ set3dVisible(!mode3dVisible); });

    setRichVisible(true);
    setFrontmatterEnabled(false);
    try {
      var kgPanelMode = '';
      try { kgPanelMode = String((window && window.localStorage) ? (window.localStorage.getItem('kg:render:richMedia:panelMode') || '') : ''); } catch (e0) { kgPanelMode = ''; }
      setMediaInteractive(String(kgPanelMode || '').trim() === 'embed');
    } catch (e8) {}
    try { set3dVisible(!!(root && root.classList && root.classList.contains('kg-canvas3d'))); } catch (e7) {}`,
  )

  out = replaceOnceExact(
    out,
    'var kgIsDirectIframeEmbedUrl = function(rawUrl){',
    "var kgInferMediaKindFromUrl2 = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        try {\n          var k0 = typeof kgInferMediaKindFromUrl === 'function' ? kgInferMediaKindFromUrl(u) : '';\n          if (k0) return k0;\n        } catch (e0) {\n          void 0;\n        }\n        try {\n          var p = new URL(u);\n          var host = String(p.hostname || '').toLowerCase();\n          var path = String(p.pathname || '').toLowerCase();\n          var query = String(p.search || '').toLowerCase();\n          var isWeChatAssetHost =\n            host === 'mmbiz.qpic.cn' || host.endsWith('.qpic.cn') ||\n            host === 'mmbiz.qlogo.cn' || host.endsWith('.qlogo.cn') ||\n            host === 'wx.qlogo.cn' || host.endsWith('.wx.qlogo.cn');\n          if (isWeChatAssetHost) {\n            if (path.indexOf('/mmbiz_png/') >= 0 || path.indexOf('/mmbiz_jpg/') >= 0 || path.indexOf('/mmbiz_gif/') >= 0 || path.indexOf('/mmbiz_webp/') >= 0) return 'image';\n            if (query.indexOf('wx_fmt=') >= 0 || query.indexOf('tp=') >= 0) return 'image';\n          }\n          if ((host === 'substackcdn.com' || host.endsWith('.substackcdn.com')) && path.indexOf('/image/fetch') >= 0) return 'image';\n        } catch (e1) {\n          void 0;\n        }\n        return '';\n      } catch (e) {\n        return '';\n      }\n    };\n\n    var kgIsDirectIframeEmbedUrl = function(rawUrl){",
  )

  out = replaceOnceExact(
    out,
    "el.className = 'kg-media';",
    "el.className = 'kg-media';\n        el.setAttribute('data-kg-canvas-wheel-ignore', 'true');\n        try {\n          el.addEventListener('click', function(ev){\n            try {\n              if (typeof mediaInteractive !== 'undefined' && mediaInteractive) return;\n              var trg = (ev && ev.target && (ev.target instanceof Element)) ? ev.target : null;\n              try {\n                if (trg && trg.closest && trg.closest('.kg-mediaHeader')) return;\n                if (trg && trg.closest && !trg.closest('.kg-mediaBody')) return;\n              } catch (eX) {\n                void 0;\n              }\n              var open = String(el.getAttribute('data-kg-open-url') || el.getAttribute('data-kg-url') || '').trim();\n              if (!open) return;\n              try { ev.preventDefault(); } catch (e0) {}\n              try { ev.stopPropagation(); } catch (e1) {}\n              window.open(open, '_blank', 'noopener,noreferrer');\n            } catch (e2) {\n              void 0;\n            }\n          }, { passive: false });\n        } catch (e) { void 0; }",
  )

  out = replaceOnceExact(
    out,
    'imgEl.src = url;',
    "imgEl.src = kgResolveMediaSrc(url, kind);\n          imgEl.onerror = function(){\n            try {\n              var raw = String(url || '').trim();\n              var cur = String(imgEl.getAttribute('src') || '').trim();\n              if (raw && cur !== raw) imgEl.src = raw;\n            } catch (e0) {\n              void 0;\n            }\n          };",
  )
  out = replaceOnceExact(
    out,
    'vid.src = url;',
    "vid.src = kgResolveMediaSrc(url, kind);\n          vid.onerror = function(){\n            try {\n              var raw = String(url || '').trim();\n              var cur = String(vid.getAttribute('src') || '').trim();\n              if (raw && cur !== raw) vid.src = raw;\n            } catch (e0) {\n              void 0;\n            }\n          };",
  )
  out = replaceOnceExact(
    out,
    'iframe.src = url;',
    "iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');\n          iframe.setAttribute('sandbox', kgResolveIframeSandbox(url));\n          iframe.src = kgResolveMediaSrc(url, kind);",
  )

  out = replaceOnceExact(
    out,
    "var url = String(n.url || '');",
    "var url = String(n.url || '');\n        var openUrl = String((n && (n.openUrl || n.open_url)) || '');\n        if (!openUrl) openUrl = url;\n        try { el.setAttribute('data-kg-url', url); } catch (e) { void 0; }\n        try { el.setAttribute('data-kg-open-url', openUrl); } catch (e2) { void 0; }",
  )

  out = replaceOnceExact(
    out,
    "var kind = String(n.kind || 'iframe');",
    "var kind = String(n.kind || 'iframe');\n        var inferredKind = kgInferMediaKindFromUrl2(url) || kgInferMediaKindFromUrl(url);\n        if (inferredKind && (kind === 'iframe' || kind === '')) kind = inferredKind;",
  )

  out = replaceOnceExact(
    out,
    'var inferred = kgInferMediaKindFromUrl(url0);',
    'var inferred = (typeof kgInferMediaKindFromUrl2 === "function" ? kgInferMediaKindFromUrl2(url0) : "") || kgInferMediaKindFromUrl(url0);',
  )

  out = replaceOnceExact(
    out,
    "var allEdgeEls = svg ? svg.querySelectorAll('line[data-edge-id],path[data-edge-id],polyline[data-edge-id]') : null;",
    "try {\n" +
      "        if (svg && edgeMetaById && nodePosById) {\n" +
      "          var existingEdges = svg.querySelectorAll('line[data-edge-id],path[data-edge-id],polyline[data-edge-id]');\n" +
      "          if (!existingEdges || existingEdges.length === 0) {\n" +
      "            var linksRoot = svg.querySelector('[data-kg-layer=\"links\"]');\n" +
      "            if (linksRoot) {\n" +
      "              for (var eid2 in edgeMetaById) {\n" +
      "                if (!Object.prototype.hasOwnProperty.call(edgeMetaById, eid2)) continue;\n" +
      "                var meta2 = edgeMetaById[eid2];\n" +
      "                if (!meta2) continue;\n" +
      "                var s2 = String(meta2.s || '').trim();\n" +
      "                var t2 = String(meta2.t || '').trim();\n" +
      "                if (!s2 || !t2) continue;\n" +
      "                var ps2 = nodePosById && nodePosById[s2] ? nodePosById[s2] : null;\n" +
      "                var pt2 = nodePosById && nodePosById[t2] ? nodePosById[t2] : null;\n" +
      "                if (!ps2 || !pt2) continue;\n" +
      "                var sx2 = Number(ps2.x);\n" +
      "                var sy2 = Number(ps2.y);\n" +
      "                var tx2 = Number(pt2.x);\n" +
      "                var ty2 = Number(pt2.y);\n" +
      "                if (!isFinite(sx2) || !isFinite(sy2) || !isFinite(tx2) || !isFinite(ty2)) continue;\n" +
      "                var line2 = svg.ownerDocument && svg.ownerDocument.createElementNS\n" +
      "                  ? svg.ownerDocument.createElementNS(svg.namespaceURI || 'http://www.w3.org/2000/svg', 'line')\n" +
      "                  : null;\n" +
      "                if (!line2) continue;\n" +
      "                line2.setAttribute('data-edge-id', eid2);\n" +
      "                line2.setAttribute('data-source-id', s2);\n" +
      "                line2.setAttribute('data-target-id', t2);\n" +
      "                line2.setAttribute('x1', String(sx2));\n" +
      "                line2.setAttribute('y1', String(sy2));\n" +
      "                line2.setAttribute('x2', String(tx2));\n" +
      "                line2.setAttribute('y2', String(ty2));\n" +
      "                line2.setAttribute('stroke', 'var(--kg-canvas-edge-stroke)');\n" +
      "                line2.setAttribute('stroke-opacity', '1');\n" +
      "                line2.setAttribute('stroke-width', '2');\n" +
      "                line2.setAttribute('stroke-linecap', 'round');\n" +
      "                line2.setAttribute('fill', 'none');\n" +
      "                try { line2.style.pointerEvents = 'none'; } catch (e0) {}\n" +
      "                linksRoot.appendChild(line2);\n" +
      "                try {\n" +
      "                  if (typeof edgeLineByEdgeId === 'object' && edgeLineByEdgeId) {\n" +
      "                    if (!edgeLineByEdgeId[eid2]) edgeLineByEdgeId[eid2] = line2;\n" +
      "                  }\n" +
      "                } catch (e1) {}\n" +
      "                try {\n" +
      "                  if (typeof edgeRefsByNodeId === 'object' && edgeRefsByNodeId) {\n" +
      "                    var r0 = edgeRefsByNodeId[s2] || (edgeRefsByNodeId[s2] = []);\n" +
      "                    r0.push({ el: line2, end: 's' });\n" +
      "                    var r1 = edgeRefsByNodeId[t2] || (edgeRefsByNodeId[t2] = []);\n" +
      "                    r1.push({ el: line2, end: 't' });\n" +
      "                  }\n" +
      "                } catch (e2) {}\n" +
      "              }\n" +
      "            }\n" +
      "          }\n" +
      "        }\n" +
      "      } catch (e) {}\n" +
      "      var allEdgeEls = svg ? svg.querySelectorAll('line[data-edge-id],path[data-edge-id],polyline[data-edge-id]') : null;",
  )

  out = replaceOnceExact(
    out,
    "if (overlayFollowAnimation && svg && (svg.__kgNodeOffsetById || (svg.__kgNodeOffsetById = {}))) {\n          var map = svg.__kgNodeOffsetById;\n          var prev = map[nodeId] || null;\n          var ox = prev && isFinite(prev.x) ? prev.x : 0;\n          var oy = prev && isFinite(prev.y) ? prev.y : 0;\n          map[nodeId] = { x: ox + dx, y: oy + dy };\n          return;\n        }",
    "if (overlayFollowAnimation && svg && (svg.__kgNodeOffsetById || (svg.__kgNodeOffsetById = {}))) {\n          try {\n            if (nodeDrag && nodeDrag.id && String(nodeDrag.id) === String(nodeId)) {\n              void 0;\n            } else if (headerDrag && headerDrag.id && String(headerDrag.id) === String(nodeId)) {\n              void 0;\n            } else {\n              var map = svg.__kgNodeOffsetById;\n              var prev = map[nodeId] || null;\n              var ox = prev && isFinite(prev.x) ? prev.x : 0;\n              var oy = prev && isFinite(prev.y) ? prev.y : 0;\n              map[nodeId] = { x: ox + dx, y: oy + dy };\n              return;\n            }\n          } catch (e0) {\n            var map = svg.__kgNodeOffsetById;\n            var prev = map[nodeId] || null;\n            var ox = prev && isFinite(prev.x) ? prev.x : 0;\n            var oy = prev && isFinite(prev.y) ? prev.y : 0;\n            map[nodeId] = { x: ox + dx, y: oy + dy };\n            return;\n          }\n        }",
  )

  out = replaceOnceExact(
    out,
    "try { scheduleEdgeGeometryUpdateForNode(nodeId); } catch (e0) {}\n    }\n\n    function translateGroupByDelta(groupId, dx, dy){",
    "try { scheduleEdgeGeometryUpdateForNode(nodeId); } catch (e0) {}\n    }\n\n    var __kgGroupRectCacheById = Object.create(null);\n    var __kgGroupIdsByNodeId = null;\n\n    function __kgClampNum(v, a, b){\n      var x = Number(v);\n      if (!isFinite(x)) return a;\n      if (x < a) return a;\n      if (x > b) return b;\n      return x;\n    }\n\n    function __kgGetNodeHalfExtents(nodeId){\n      try {\n        if (!nodeId) return { hw: 12, hh: 12 };\n        var el = (svgNodeById && svgNodeById[nodeId]) ? svgNodeById[nodeId] : null;\n        if (!el && svgNodeElsById && svgNodeElsById[nodeId] && svgNodeElsById[nodeId].length) el = svgNodeElsById[nodeId][0];\n        if (!el) return { hw: 12, hh: 12 };\n\n        var tag = String(el.tagName || '').toLowerCase();\n        if (tag !== 'circle' && tag !== 'rect') {\n          try {\n            var c = el.querySelector ? el.querySelector('circle[r]') : null;\n            if (c) { el = c; tag = 'circle'; }\n          } catch (e0) {}\n          if (tag !== 'circle') {\n            try {\n              var r = el.querySelector ? el.querySelector('rect[width][height]') : null;\n              if (r) { el = r; tag = 'rect'; }\n            } catch (e1) {}\n          }\n        }\n\n        if (tag === 'circle' && el.getAttribute) {\n          var rr = parseFloat(el.getAttribute('r') || 'NaN');\n          if (isFinite(rr) && rr > 0) return { hw: Math.max(1, rr), hh: Math.max(1, rr) };\n          return { hw: 12, hh: 12 };\n        }\n        if (tag === 'rect' && el.getAttribute) {\n          var w = parseFloat(el.getAttribute('width') || 'NaN');\n          var h = parseFloat(el.getAttribute('height') || 'NaN');\n          if (isFinite(w) && isFinite(h) && w > 0 && h > 0) return { hw: Math.max(1, w / 2), hh: Math.max(1, h / 2) };\n          return { hw: 12, hh: 12 };\n        }\n      } catch (e) {}\n      return { hw: 12, hh: 12 };\n    }\n\n    function __kgEnsureGroupIdsByNodeId(){\n      if (__kgGroupIdsByNodeId) return __kgGroupIdsByNodeId;\n      var out = Object.create(null);\n      try {\n        if (!groupMembersById) { __kgGroupIdsByNodeId = out; return out; }\n        for (var gid in groupMembersById) {\n          if (!Object.prototype.hasOwnProperty.call(groupMembersById, gid)) continue;\n          var members = groupMembersById[gid];\n          if (!members || !members.length) continue;\n          for (var i = 0; i < members.length; i += 1) {\n            var nid = String(members[i] || '').trim();\n            if (!nid) continue;\n            var arr = out[nid] || (out[nid] = []);\n            arr.push(gid);\n          }\n        }\n      } catch (e) {}\n      __kgGroupIdsByNodeId = out;\n      return out;\n    }\n\n    function __kgComputeGroupMemberBounds(gid){\n      try {\n        var members = groupMembersById && groupMembersById[gid] ? groupMembersById[gid] : null;\n        if (!members || !members.length) return null;\n        var minX = Infinity;\n        var minY = Infinity;\n        var maxX = -Infinity;\n        var maxY = -Infinity;\n        var saw = false;\n        for (var i = 0; i < members.length; i += 1) {\n          var nid = String(members[i] || '').trim();\n          if (!nid) continue;\n          var p = nodePosById && nodePosById[nid] ? nodePosById[nid] : null;\n          if (!p) continue;\n          var x = Number(p.x);\n          var y = Number(p.y);\n          if (!isFinite(x) || !isFinite(y)) continue;\n          var ext = __kgGetNodeHalfExtents(nid);\n          var hw = (ext && isFinite(ext.hw)) ? Math.max(1, Number(ext.hw)) : 12;\n          var hh = (ext && isFinite(ext.hh)) ? Math.max(1, Number(ext.hh)) : 12;\n          if (x - hw < minX) minX = x - hw;\n          if (y - hh < minY) minY = y - hh;\n          if (x + hw > maxX) maxX = x + hw;\n          if (y + hh > maxY) maxY = y + hh;\n          saw = true;\n        }\n        if (!saw || !(maxX > minX) || !(maxY > minY)) return null;\n        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };\n      } catch (e) {\n        return null;\n      }\n    }\n\n    function __kgInitGroupRectCache(gid, rectEl){\n      try {\n        var rX = parseFloat(rectEl.getAttribute('x') || 'NaN');\n        var rY = parseFloat(rectEl.getAttribute('y') || 'NaN');\n        var rW = parseFloat(rectEl.getAttribute('width') || 'NaN');\n        var rH = parseFloat(rectEl.getAttribute('height') || 'NaN');\n        if (!isFinite(rX) || !isFinite(rY) || !isFinite(rW) || !isFinite(rH) || !(rW > 0) || !(rH > 0)) return null;\n        var b = __kgComputeGroupMemberBounds(gid);\n        var padL = 24;\n        var padR = 24;\n        var padT = 24;\n        var padB = 24;\n        if (b) {\n          padL = __kgClampNum(b.minX - rX, 0, 800);\n          padR = __kgClampNum((rX + rW) - b.maxX, 0, 800);\n          padT = __kgClampNum(b.minY - rY, 0, 800);\n          padB = __kgClampNum((rY + rH) - b.maxY, 0, 800);\n          if (!(padL > 0)) padL = 24;\n          if (!(padR > 0)) padR = 24;\n          if (!(padT > 0)) padT = 24;\n          if (!(padB > 0)) padB = 24;\n        }\n\n        var labelDx = null;\n        var labelDy = null;\n        var labelEl = null;\n        var chevronEl = null;\n        try {\n          var gels = svgGroupElsById && svgGroupElsById[gid] ? svgGroupElsById[gid] : null;\n          if (gels && gels.length) {\n            for (var i = 0; i < gels.length; i += 1) {\n              var el = gels[i];\n              if (!el || !el.getAttribute) continue;\n              var tag = String(el.tagName || '').toLowerCase();\n              if (!labelEl && tag === 'text' && String(el.getAttribute('data-kg-group-label') || '') === '1') labelEl = el;\n              if (!chevronEl && tag === 'path' && String(el.getAttribute('data-kg-group-chevron') || '') === '1') chevronEl = el;\n              if (labelEl && chevronEl) break;\n            }\n          }\n        } catch (e0) {}\n\n        if (labelEl && labelEl.getAttribute) {\n          var lx = parseFloat(labelEl.getAttribute('x') || 'NaN');\n          var ly = parseFloat(labelEl.getAttribute('y') || 'NaN');\n          if (isFinite(lx) && isFinite(ly)) {\n            labelDx = lx - rX;\n            labelDy = ly - rY;\n          }\n        }\n\n        var handleEl = null;\n        try {\n          var pg = rectEl.parentNode && rectEl.parentNode.querySelector ? rectEl.parentNode : null;\n          if (pg) handleEl = pg.querySelector('circle[data-kg-group-resize]');\n        } catch (e1) {\n          handleEl = null;\n        }\n\n        return {\n          padL: padL,\n          padR: padR,\n          padT: padT,\n          padB: padB,\n          labelDx: labelDx,\n          labelDy: labelDy,\n          labelEl: labelEl,\n          chevronEl: chevronEl,\n          handleEl: handleEl,\n          lastX: rX,\n          lastY: rY,\n        };\n      } catch (e) {\n        return null;\n      }\n    }\n\n    function __kgUpdateGroupRectForGroupId(gid){\n      try {\n        if (!gid) return;\n        var gels = svgGroupElsById && svgGroupElsById[gid] ? svgGroupElsById[gid] : null;\n        if (!gels || !gels.length) return;\n\n        var groupRoot = null;\n        for (var i = 0; i < gels.length; i += 1) {\n          var el = gels[i];\n          if (!el || !el.querySelector) continue;\n          var rect0 = null;\n          try { rect0 = el.querySelector('rect[data-kg-shape=\"group-rect\"]'); } catch (e0) { rect0 = null; }\n          if (rect0) { groupRoot = el; break; }\n        }\n        if (!groupRoot) return;\n\n        var rectEl = null;\n        try { rectEl = groupRoot.querySelector('rect[data-kg-shape=\"group-rect\"]'); } catch (e1) { rectEl = null; }\n        if (!rectEl || !rectEl.getAttribute || !rectEl.setAttribute) return;\n\n        var cache = __kgGroupRectCacheById[gid] || null;\n        if (!cache) {\n          cache = __kgInitGroupRectCache(gid, rectEl);\n          if (!cache) return;\n          __kgGroupRectCacheById[gid] = cache;\n        }\n\n        var b = __kgComputeGroupMemberBounds(gid);\n        if (!b) return;\n\n        var nx = b.minX - cache.padL;\n        var ny = b.minY - cache.padT;\n        var nw = (b.maxX - b.minX) + cache.padL + cache.padR;\n        var nh = (b.maxY - b.minY) + cache.padT + cache.padB;\n\n        if (!isFinite(nx) || !isFinite(ny) || !isFinite(nw) || !isFinite(nh) || !(nw > 0) || !(nh > 0)) return;\n\n        var prevX = cache.lastX;\n        var prevY = cache.lastY;\n        var dx = isFinite(prevX) ? (nx - prevX) : 0;\n        var dy = isFinite(prevY) ? (ny - prevY) : 0;\n\n        rectEl.setAttribute('x', String(nx));\n        rectEl.setAttribute('y', String(ny));\n        rectEl.setAttribute('width', String(nw));\n        rectEl.setAttribute('height', String(nh));\n\n        if (cache.handleEl && cache.handleEl.setAttribute) {\n          try { cache.handleEl.setAttribute('cx', String(nx + nw)); } catch (e2) {}\n          try { cache.handleEl.setAttribute('cy', String(ny + nh)); } catch (e3) {}\n        }\n\n        if (cache.labelEl && cache.labelEl.setAttribute && cache.labelDx != null && cache.labelDy != null) {\n          try { cache.labelEl.setAttribute('x', String(nx + cache.labelDx)); } catch (e4) {}\n          try { cache.labelEl.setAttribute('y', String(ny + cache.labelDy)); } catch (e5) {}\n        }\n\n        if (cache.chevronEl && (dx !== 0 || dy !== 0)) {\n          try { addDeltaToElement(cache.chevronEl, dx, dy); } catch (e6) {}\n        }\n\n        cache.lastX = nx;\n        cache.lastY = ny;\n      } catch (e) {\n        void 0;\n      }\n    }\n\n    function __kgUpdateGroupRectsForNodeId(nodeId){\n      try {\n        var idx = __kgEnsureGroupIdsByNodeId();\n        var gids = idx && nodeId && idx[nodeId] ? idx[nodeId] : null;\n        if (!gids || !gids.length) return;\n        for (var i = 0; i < gids.length; i += 1) {\n          var gid = String(gids[i] || '').trim();\n          if (!gid) continue;\n          __kgUpdateGroupRectForGroupId(gid);\n        }\n      } catch (e) {\n        void 0;\n      }\n    }\n\n    function translateGroupByDelta(groupId, dx, dy){",
  )

  out = replaceOnceExact(
    out,
    "p.x = targetX;\n      p.y = targetY;\n      translateNodeByDelta(nodeDrag.id, dx, dy);",
    "translateNodeByDelta(nodeDrag.id, dx, dy);\n      try { __kgUpdateGroupRectsForNodeId(nodeDrag.id); } catch (err0) {}",
  )

  out = replaceOnceExact(
    out,
    "var edgeLs = svg.querySelectorAll('[data-edge-id]');",
    "if (svg && edgeMetaById && nodePosById) {\n" +
      "      try {\n" +
      "        var linksRoot = svg.querySelector('[data-kg-layer=\"links\"]');\n" +
      "        if (linksRoot && !linksRoot.querySelector('[data-edge-id]')) {\n" +
      "          for (var eid in edgeMetaById) {\n" +
      "            if (!Object.prototype.hasOwnProperty.call(edgeMetaById, eid)) continue;\n" +
      "            var meta = edgeMetaById[eid];\n" +
      "            if (!meta) continue;\n" +
      "            var s = String(meta.s || '').trim();\n" +
      "            var t = String(meta.t || '').trim();\n" +
      "            if (!s || !t) continue;\n" +
      "            var ps = nodePosById && nodePosById[s] ? nodePosById[s] : null;\n" +
      "            var pt = nodePosById && nodePosById[t] ? nodePosById[t] : null;\n" +
      "            if (!ps || !pt) continue;\n" +
      "            var sx = Number(ps.x);\n" +
      "            var sy = Number(ps.y);\n" +
      "            var tx = Number(pt.x);\n" +
      "            var ty = Number(pt.y);\n" +
      "            if (!isFinite(sx) || !isFinite(sy) || !isFinite(tx) || !isFinite(ty)) continue;\n" +
      "            var line = svg.ownerDocument && svg.ownerDocument.createElementNS\n" +
      "              ? svg.ownerDocument.createElementNS(svg.namespaceURI || 'http://www.w3.org/2000/svg', 'line')\n" +
      "              : null;\n" +
      "            if (!line) continue;\n" +
      "            line.setAttribute('data-edge-id', eid);\n" +
      "            line.setAttribute('data-source-id', s);\n" +
      "            line.setAttribute('data-target-id', t);\n" +
      "            line.setAttribute('x1', String(sx));\n" +
      "            line.setAttribute('y1', String(sy));\n" +
      "            line.setAttribute('x2', String(tx));\n" +
      "            line.setAttribute('y2', String(ty));\n" +
      "            line.setAttribute('stroke', 'var(--kg-canvas-edge-stroke)');\n" +
      "            line.setAttribute('stroke-width', '2');\n" +
      "            line.setAttribute('fill', 'none');\n" +
      "            linksRoot.appendChild(line);\n" +
      "          }\n" +
      "        }\n" +
      "      } catch (e) {}\n" +
      "    }\n" +
      "    var edgeLs = svg.querySelectorAll('[data-edge-id]');",
  )
  out = replaceAllExact(out, '__KG_PROXY_ORIGIN__', JSON.stringify(String(args.proxyOrigin || '')))
  return out
}
