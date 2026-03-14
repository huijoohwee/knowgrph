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
    "var mediaBtn = document.getElementById('kg-media-toggle');",
    "var mediaBtn = document.getElementById('kg-media-toggle');\n\n    var KG_PROXY_ORIGIN = __KG_PROXY_ORIGIN__;\n    var KG_PROXY_ORIGIN_RUNTIME = (typeof KG_PROXY_ORIGIN === 'string' ? String(KG_PROXY_ORIGIN || '').trim() : '');\n    var KG_PROXY_PROBE_STARTED = false;\n\n    var kgGetProxyOrigin = function(){\n      try { return String(KG_PROXY_ORIGIN_RUNTIME || '').trim(); } catch (e) { return ''; }\n    };\n\n    var kgShouldUseProxy = function(){\n      try {\n        if (kgGetProxyOrigin()) return true;\n      } catch (e) {\n        void 0;\n      }\n      try {\n        var host = String((window && window.location && window.location.hostname) ? window.location.hostname : '').toLowerCase();\n        if (!host) return false;\n        return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';\n      } catch (e) {\n        return false;\n      }\n    };\n\n    var kgInferMediaKindFromUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        if (/^data:image\\//i.test(u)) {\n          if (/^data:image\\/svg\\+xml/i.test(u)) return 'svg';\n          return 'image';\n        }\n        var noHash = u.split('#')[0] || u;\n        var noQuery = noHash.split('?')[0] || noHash;\n        var lower = String(noQuery).toLowerCase();\n        if (lower.endsWith('.svg')) return 'svg';\n        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp')) return 'image';\n        if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.m4v')) return 'video';\n        return '';\n      } catch (e) {\n        return '';\n      }\n    };\n\n    var kgIsDirectIframeEmbedUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return false;\n        if (!/^https?:\\/\\//i.test(u)) return true;\n        if (/(^|\\/\\/)(www\\.)?youtube\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)(www\\.)?youtu\\.be\\//i.test(u)) return true;\n        if (/(^|\\/\\/)www\\.youtube-nocookie\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)player\\.vimeo\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)platform\\.twitter\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)twitframe\\.com\\//i.test(u)) return true;\n        return false;\n      } catch (e) {\n        return false;\n      }\n    };\n\n    var kgBuildRemoteFetchProxyUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        if (u.startsWith('/__fetch_remote?url=')) return u;\n        var origin = kgGetProxyOrigin();\n        if (/^https?:\\/\\//i.test(origin || '')) return String(origin).replace(/\\/+$/, '') + '/__fetch_remote?url=' + encodeURIComponent(u);\n        if (!kgShouldUseProxy()) return u;\n        return '/__fetch_remote?url=' + encodeURIComponent(u);\n      } catch (e) {\n        return String(rawUrl || '').trim();\n      }\n    };\n\n    var kgBuildWebpageProxyUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        if (u.startsWith('/__webpage_proxy?url=')) return u;\n        var origin = kgGetProxyOrigin();\n        if (/^https?:\\/\\//i.test(origin || '')) return String(origin).replace(/\\/+$/, '') + '/__webpage_proxy?url=' + encodeURIComponent(u);\n        if (!kgShouldUseProxy()) return u;\n        return '/__webpage_proxy?url=' + encodeURIComponent(u);\n      } catch (e) {\n        return String(rawUrl || '').trim();\n      }\n    };\n\n    var kgResolveMediaSrc = function(url, kind){\n      var u = String(url || '').trim();\n      if (!u) return '';\n      if (/^\\s*(data:|blob:|mailto:|tel:)/i.test(u)) return u;\n      if (u.startsWith('/__') || u.startsWith('/@')) return u;\n      var k = String(kind || '');\n      if (k === 'iframe') {\n        if (kgIsDirectIframeEmbedUrl(u)) return u;\n        return kgBuildWebpageProxyUrl(u);\n      }\n      if (k === 'video' || k === 'image' || k === 'svg') return kgBuildRemoteFetchProxyUrl(u);\n      return u;\n    };\n\n    var kgResolveIframeSandbox = function(url){\n      try {\n        return kgIsDirectIframeEmbedUrl(url)\n          ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation'\n          : 'allow-scripts allow-presentation';\n      } catch (e) {\n        return 'allow-scripts allow-presentation';\n      }\n    };\n\n    var kgApplyMediaSrcForEl = function(el){\n      try {\n        if (!el || !el.getAttribute) return;\n        var kind0 = String(el.getAttribute('data-kg-kind') || 'iframe');\n        var url0 = String(el.getAttribute('data-kg-url') || '');\n        var inferred = kgInferMediaKindFromUrl(url0);\n        var kind = (inferred && (kind0 === 'iframe' || kind0 === '')) ? inferred : kind0;\n        if (kind === 'image' || kind === 'svg') {\n          var img = el.querySelector ? el.querySelector('img') : null;\n          if (img) img.src = kgResolveMediaSrc(url0, kind);\n          return;\n        }\n        if (kind === 'video') {\n          var vid = el.querySelector ? el.querySelector('video') : null;\n          if (vid) vid.src = kgResolveMediaSrc(url0, kind);\n          return;\n        }\n        var iframe = el.querySelector ? el.querySelector('iframe') : null;\n        if (!iframe) return;\n        try { iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'); } catch (e0) { void 0; }\n        try { iframe.setAttribute('sandbox', kgResolveIframeSandbox(url0)); } catch (e1) { void 0; }\n        iframe.src = kgResolveMediaSrc(url0, 'iframe');\n      } catch (e) {\n        void 0;\n      }\n    };\n\n    var kgApplyMediaSrcToAll = function(){\n      try {\n        if (!overlay || !overlay.__kgMediaById) return;\n        var m = overlay.__kgMediaById;\n        for (var k in m) {\n          if (!k) continue;\n          kgApplyMediaSrcForEl(m[k]);\n        }\n      } catch (e) {\n        void 0;\n      }\n    };\n\n    var kgMaybeProbeProxyOrigin = function(){\n      try {\n        if (KG_PROXY_PROBE_STARTED) return;\n        if (kgGetProxyOrigin()) return;\n        if (!window || !window.location) return;\n        if (String(window.location.protocol || '') !== 'file:') return;\n        KG_PROXY_PROBE_STARTED = true;\n        var ports = [5173,5174,5175,5176,5177,5178,5179,5180];\n        var i = 0;\n        var probeNext = function(){\n          if (i >= ports.length) return;\n          var origin = 'http://localhost:' + ports[i++];\n          try {\n            var probeUrl = origin + '/__fetch_remote?url=' + encodeURIComponent('https://example.com/');\n            fetch(probeUrl, { method: 'HEAD', mode: 'cors' }).then(function(res){\n              if (!res) return probeNext();\n              if (res.status === 404) return probeNext();\n              KG_PROXY_ORIGIN_RUNTIME = origin;\n              kgApplyMediaSrcToAll();\n            }).catch(function(){ probeNext(); });\n          } catch (e) {\n            probeNext();\n          }\n        };\n        probeNext();\n      } catch (e) {\n        void 0;\n      }\n    };\n\n    kgMaybeProbeProxyOrigin();\n",
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
    "var richVisible = true;\n    var frontmatterEnabled = false;\n    var mode3dVisible = false;\n\n    function setRichVisible(next){\n      richVisible = !!next;\n      try { if (overlay && overlay.style) overlay.style.display = richVisible ? '' : 'none'; } catch (e0) {}\n      try { if (richBtn && richBtn.classList) richBtn.classList.toggle('kg-active', richVisible); } catch (e1) {}\n    }\n\n    function setFrontmatterEnabled(next){\n      frontmatterEnabled = !!next;\n      try { if (root && root.classList) root.classList.toggle('kg-frontmatter', frontmatterEnabled); } catch (e0) {}\n      try { if (frontmatterBtn && frontmatterBtn.classList) frontmatterBtn.classList.toggle('kg-active', frontmatterEnabled); } catch (e1) {}\n    }\n\n    function set3dVisible(next){\n      mode3dVisible = !!next;\n      try { if (cfg && mode3dVisible) cfg.preferWebgl3d = true; } catch (e0) {}\n      if (mode3dVisible) {\n        try { install3dCanvasRendererOnce(); } catch (e1) {}\n        try { if (root && root.classList) root.classList.add('kg-canvas3d'); } catch (e2) {}\n        try { if (schedule3dFrame) schedule3dFrame(); } catch (e3) {}\n        try { if (scheduleWebgl3dFrame) scheduleWebgl3dFrame(); } catch (e4) {}\n      } else {\n        try { if (root && root.classList) root.classList.remove('kg-canvas3d'); } catch (e5) {}\n      }\n      try { if (mode3dBtn && mode3dBtn.classList) mode3dBtn.classList.toggle('kg-active', mode3dVisible); } catch (e6) {}\n    }\n\n    if (mediaBtn) mediaBtn.addEventListener('click', function(){ setMediaInteractive(!mediaInteractive); });\n    if (richBtn) richBtn.addEventListener('click', function(){ setRichVisible(!richVisible); });\n    if (frontmatterBtn) frontmatterBtn.addEventListener('click', function(){ setFrontmatterEnabled(!frontmatterEnabled); });\n    if (mode3dBtn) mode3dBtn.addEventListener('click', function(){ set3dVisible(!mode3dVisible); });\n\n    setRichVisible(true);\n    setFrontmatterEnabled(false);\n    try { set3dVisible(!!(root && root.classList && root.classList.contains('kg-canvas3d'))); } catch (e7) {}",
  )

  out = replaceOnceExact(
    out,
    'var kgIsDirectIframeEmbedUrl = function(rawUrl){',
    "var kgInferMediaKindFromUrl2 = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        try {\n          var k0 = typeof kgInferMediaKindFromUrl === 'function' ? kgInferMediaKindFromUrl(u) : '';\n          if (k0) return k0;\n        } catch (e0) {\n          void 0;\n        }\n        try {\n          var p = new URL(u);\n          var host = String(p.hostname || '').toLowerCase();\n          var path = String(p.pathname || '').toLowerCase();\n          var query = String(p.search || '').toLowerCase();\n          var isWeChatAssetHost =\n            host === 'mmbiz.qpic.cn' || host.endsWith('.qpic.cn') ||\n            host === 'mmbiz.qlogo.cn' || host.endsWith('.qlogo.cn') ||\n            host === 'wx.qlogo.cn' || host.endsWith('.wx.qlogo.cn');\n          if (isWeChatAssetHost) {\n            if (path.indexOf('/mmbiz_png/') >= 0 || path.indexOf('/mmbiz_jpg/') >= 0 || path.indexOf('/mmbiz_gif/') >= 0 || path.indexOf('/mmbiz_webp/') >= 0) return 'image';\n            if (query.indexOf('wx_fmt=') >= 0 || query.indexOf('tp=') >= 0) return 'image';\n          }\n          if ((host === 'substackcdn.com' || host.endsWith('.substackcdn.com')) && path.indexOf('/image/fetch') >= 0) return 'image';\n        } catch (e1) {\n          void 0;\n        }\n        return '';\n      } catch (e) {\n        return '';\n      }\n    };\n\n    var kgIsDirectIframeEmbedUrl = function(rawUrl){",
  )

  out = replaceOnceExact(
    out,
    "el.className = 'kg-media';",
    "el.className = 'kg-media';\n        el.setAttribute('data-kg-canvas-wheel-ignore', 'true');",
  )

  out = replaceOnceExact(out, 'imgEl.src = url;', 'imgEl.src = kgResolveMediaSrc(url, kind);')
  out = replaceOnceExact(out, 'vid.src = url;', 'vid.src = kgResolveMediaSrc(url, kind);')
  out = replaceOnceExact(
    out,
    'iframe.src = url;',
    "iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');\n          iframe.setAttribute('sandbox', kgResolveIframeSandbox(url));\n          iframe.src = kgResolveMediaSrc(url, kind);",
  )

  out = replaceOnceExact(
    out,
    "var url = String(n.url || '');",
    "var url = String(n.url || '');\n        try { el.setAttribute('data-kg-url', url); } catch (e) { void 0; }",
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
  out = replaceAllExact(out, '__KG_PROXY_ORIGIN__', JSON.stringify(String(args.proxyOrigin || '')))
  return out
}
