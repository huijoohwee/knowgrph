import { getKgHtmlViewerRuntimeTemplate } from './runtimeTemplate'
import { LS_KEYS } from '../../config.ls'

const replaceAllExact = (s: string, token: string, replacement: string): string => {
  if (!token) return s
  if (!s.includes(token)) return s
  return s.split(token).join(replacement)
}

const replaceOnceExact = (s: string, token: string, replacement: string, replacement2?: string): string => {
  if (!token) return s
  const rep = typeof replacement2 === 'string' ? replacement2 : replacement
  const i = s.indexOf(token)
  if (i < 0) return s
  return s.slice(0, i) + rep + s.slice(i + token.length)
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
  markdownBlocksJson: string
  nodeLabelByIdJson: string
  edgeMetaByIdJson: string
  frontmatterVisibilityJson: string
  initialFrontmatterEnabled?: boolean
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
  const safeMarkdownBlocksJson = (() => {
    const s = String(args.markdownBlocksJson || '').trim()
    if (!s) return '[]'
    try {
      const parsed = JSON.parse(s)
      return Array.isArray(parsed) ? s : '[]'
    } catch {
      return '[]'
    }
  })()
  const template = cookTemplateLiteral(getKgHtmlViewerRuntimeTemplate())
  if (!template) return ''

  let out = template

  out = replaceOnceExact(
    out,
    "function ensureMediaDom(){\n      if (!overlay) return;\n      if (!mediaNodes || mediaNodes.length === 0) return;\n      if (overlay.__kgMediaBuilt) return;\n      overlay.__kgMediaBuilt = true;\n      overlay.__kgMediaById = {};\n      for (var i = 0; i < mediaNodes.length; i += 1) {\n        var n = mediaNodes[i];\n        var el = document.createElement('div');\n        el.className = 'kg-media';",
    "function ensureMediaDom(){\n      if (!overlay) return;\n      if (overlay.__kgMediaBuilt) return;\n      overlay.__kgMediaBuilt = true;\n      overlay.__kgMediaById = {};\n\n      try {\n        var existing = overlay.querySelectorAll ? overlay.querySelectorAll(\\\"[data-kg-rich-media-panel='1'][data-node-id], .kg-media[data-node-id]\\\") : null;\n        if (existing && existing.length) {\n          for (var ei = 0; ei < existing.length; ei += 1) {\n            var ex = existing[ei];\n            if (!ex || !ex.getAttribute) continue;\n            var xid = String(ex.getAttribute('data-node-id') || '').trim();\n            if (!xid) continue;\n            try {\n              var curClass = String(ex.className || '');\n              if (curClass.indexOf('kg-media') < 0) ex.className = ('kg-media ' + curClass).trim();\n            } catch (e0) {\n              void 0;\n            }\n            overlay.__kgMediaById[xid] = ex;\n          }\n        }\n      } catch (e0) {\n        void 0;\n      }\n\n      if (!mediaNodes || mediaNodes.length === 0) return;\n      for (var i = 0; i < mediaNodes.length; i += 1) {\n        var n = mediaNodes[i];\n        var id = String(n.id || '');\n        if (overlay.__kgMediaById && overlay.__kgMediaById[id]) continue;\n        var el = document.createElement('div');\n        el.className = 'kg-media';",
  )

  out = replaceAllExact(
    out,
    "var b = markdownBlocks[i];\n        if (!b) continue;\n        var id = String(b.id || '');\n        if (!id) continue;",
    "var b = markdownBlocks[i];\n        if (!b) continue;\n        var id = String(b.id || '');\n        if (!id) continue;\n        var anchorId0 = __kgResolveNodeId(String((b && (b.anchorNodeId || b.anchorId)) || '').trim());\n        if (overlay.__kgMdById[id] || (anchorId0 && overlay.__kgMdById[anchorId0])) continue;",
  )

  out = replaceAllExact(
    out,
    "el.setAttribute('data-md-id', id);",
    "el.setAttribute('data-md-id', id);\n        if (anchorId0) {\n          try { el.setAttribute('data-kg-anchor-node-id', anchorId0); } catch (e0a) {}\n        }",
  )

  out = replaceAllExact(
    out,
    "overlay.__kgMdById[id] = el;",
    "overlay.__kgMdById[id] = el;\n        if (anchorId0) overlay.__kgMdById[anchorId0] = el;",
  )

  out = replaceAllExact(
    out,
    "el.setAttribute('data-kg-canvas-wheel-ignore', 'true');",
    '',
  )

  out = replaceAllExact(
    out,
    "var UI_IGNORE_SELECTOR = '[data-kg-canvas-wheel-ignore=\"true\"], [data-kg-canvas-pointer-ignore=\"true\"]';",
    "var UI_IGNORE_SELECTOR = '#kg-hud, #kg-hud *';",
  )

  out = replaceAllExact(
    out,
    "var pointerMode = 'select';",
    "var pointerMode = 'pan';",
  )

  out = replaceAllExact(
    out,
    "var xid2 = String(ex2.getAttribute('data-node-id') || '').trim();",
    "var xid2 = __kgResolveNodeId(String(ex2.getAttribute('data-node-id') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "var xanchor = String(ex.getAttribute('data-kg-anchor-node-id') || '').trim();",
    "var xanchor = __kgResolveNodeId(String(ex.getAttribute('data-kg-anchor-node-id') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "var src = String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim();\n      var tgt = String(edgeEl.getAttribute('data-target-id') || edgeEl.getAttribute('data-target') || '').trim();",
    "var src = __kgResolveNodeId(String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim());\n      var tgt = __kgResolveNodeId(String(edgeEl.getAttribute('data-target-id') || edgeEl.getAttribute('data-target') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "var src = String(ee.getAttribute('data-source-id') || ee.getAttribute('data-source') || '').trim();",
    "var src = __kgResolveNodeId(String(ee.getAttribute('data-source-id') || ee.getAttribute('data-source') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "var tgt = String(ee.getAttribute('data-target-id') || ee.getAttribute('data-target') || '').trim();",
    "var tgt = __kgResolveNodeId(String(ee.getAttribute('data-target-id') || ee.getAttribute('data-target') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "var xid = String(ex.getAttribute('data-node-id') || '').trim();",
    "var xid = __kgResolveNodeId(String(ex.getAttribute('data-node-id') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "var xid2 = String(ex2.getAttribute('data-node-id') || '').trim();",
    "var xid2 = __kgResolveNodeId(String(ex2.getAttribute('data-node-id') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "var id = String(n.id || '');",
    "var id = __kgResolveNodeId(String(n.id || '')); if (id) n.id = id;",
  )

  out = replaceAllExact(
    out,
    "var xid = String(ex.getAttribute('data-md-id') || ex.getAttribute('data-kg-markdown-design-block') || '').trim();\n            var xanchor = String(ex.getAttribute('data-kg-anchor-node-id') || '').trim();",
    "var xid = String(ex.getAttribute('data-md-id') || ex.getAttribute('data-kg-markdown-design-block') || '').trim();\n            var xanchor = __kgResolveNodeId(String(ex.getAttribute('data-kg-anchor-node-id') || '').trim());",
  )

  out = replaceOnceExact(
    out,
    `overlay.__kgMediaById[xid] = ex;\n          }\n        }\n      } catch (e0) {\n        void 0;\n      }\n\n      if (!mediaNodes || mediaNodes.length === 0) return;`,
    `overlay.__kgMediaById[xid] = ex;\n          }\n        }\n\n        try {\n          if ((!mediaNodes || mediaNodes.length === 0) && existing && existing.length) mediaNodes = [];\n          if (mediaNodes) {\n            var seen = Object.create(null);\n            for (var si = 0; si < mediaNodes.length; si += 1) {\n              var sn = mediaNodes[si];\n              var sid = sn && sn.id ? String(sn.id || '').trim() : '';\n              if (sid) seen[sid] = 1;\n            }\n            if (existing && existing.length) {\n              for (var ei2 = 0; ei2 < existing.length; ei2 += 1) {\n                var ex2 = existing[ei2];\n                if (!ex2 || !ex2.getAttribute) continue;\n                var xid2 = String(ex2.getAttribute('data-node-id') || '').trim();\n                if (!xid2 || seen[xid2]) continue;\n                seen[xid2] = 1;\n                var kind2 = '';\n                var url2 = '';\n                var open2 = '';\n                try { kind2 = String(ex2.getAttribute('data-kg-kind') || '').trim(); } catch (eK) { kind2 = ''; }\n                try { url2 = String(ex2.getAttribute('data-kg-url') || '').trim(); } catch (eU) { url2 = ''; }\n                try { open2 = String(ex2.getAttribute('data-kg-open-url') || '').trim(); } catch (eO) { open2 = ''; }\n                mediaNodes.push({ id: xid2, kind: kind2 || 'iframe', url: url2 || '', openUrl: open2 || '', title: xid2, interactive: true });\n              }\n            }\n          }\n        } catch (e2) {\n          void 0;\n        }\n      } catch (e0) {\n        void 0;\n      }\n\n      if (!mediaNodes || mediaNodes.length === 0) return;`,
  )

  out = replaceOnceExact(
    out,
    "var existing = overlay.querySelectorAll ? overlay.querySelectorAll(\\\"[data-kg-rich-media-panel='1'][data-node-id], .kg-media[data-node-id]\\\") : null;",
    "var existing = overlay.querySelectorAll ? overlay.querySelectorAll('[data-kg-rich-media-panel=1][data-node-id], .kg-media[data-node-id]') : null;",
  )
  out = replaceAllExact(out, '__KG_CFG__', args.interactionCfgJson)
  out = replaceAllExact(out, '__KG_MEDIA_NODES__', args.mediaNodesJson)
  out = replaceAllExact(out, '__KG_MD_BLOCKS__', safeMarkdownBlocksJson)
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
    'var mediaNodes = __KG_MEDIA_NODES__;\n    var nodeMetaById = __KG_NODE_META__;',
    `var mediaNodes = __KG_MEDIA_NODES__;\n    var markdownBlocks = ${safeMarkdownBlocksJson};\n    var nodeMetaById = __KG_NODE_META__;\n    var __kgNodeIdBySuffix = Object.create(null);\n    var __kgNodeIdSet = Object.create(null);\n    try {\n      if (nodePosById) {\n        for (var __kgNid in nodePosById) {\n          if (!Object.prototype.hasOwnProperty.call(nodePosById, __kgNid)) continue;\n          var __kgId = String(__kgNid || '').trim();\n          if (!__kgId) continue;\n          __kgNodeIdSet[__kgId] = 1;\n          var __kgSuffix = (__kgId.split('::').pop() || '').trim();\n          if (__kgSuffix && !__kgNodeIdBySuffix[__kgSuffix]) __kgNodeIdBySuffix[__kgSuffix] = __kgId;\n        }\n      }\n    } catch (e0) {\n      void 0;\n    }\n    function __kgResolveNodeId(raw){\n      try {\n        var id = String(raw || '').trim();\n        if (!id) return '';\n        if (__kgNodeIdSet[id] === 1) return id;\n        var suffix = (id.split('::').pop() || '').trim();\n        if (suffix && __kgNodeIdBySuffix[suffix]) return String(__kgNodeIdBySuffix[suffix] || '').trim();\n        return id;\n      } catch (e1) {\n        return String(raw || '').trim();\n      }\n    }\n    try {\n      if (mediaNodes && mediaNodes.length) {\n        for (var __kgMi = 0; __kgMi < mediaNodes.length; __kgMi += 1) {\n          var __kgMn = mediaNodes[__kgMi];\n          if (!__kgMn) continue;\n          var __kgMid = __kgResolveNodeId(__kgMn.id || '');\n          if (__kgMid) __kgMn.id = __kgMid;\n        }\n      }\n      if (markdownBlocks && markdownBlocks.length) {\n        for (var __kgBi = 0; __kgBi < markdownBlocks.length; __kgBi += 1) {\n          var __kgB = markdownBlocks[__kgBi];\n          if (!__kgB) continue;\n          try {\n            if (__kgB.anchorNodeId) __kgB.anchorNodeId = __kgResolveNodeId(__kgB.anchorNodeId);\n            if (__kgB.anchorId) __kgB.anchorId = __kgResolveNodeId(__kgB.anchorId);\n          } catch (e2) {\n            void 0;\n          }\n        }\n      }\n    } catch (e3) {\n      void 0;\n    }`,
  )

  out = replaceOnceExact(
    out,
    "var tip = document.getElementById('kg-tooltip');",
    "var tip = document.getElementById('kg-tooltip');\n\n    var __kgNodeIdBySuffix = Object.create(null);\n    var __kgNodeIdSet = Object.create(null);\n    var __kgNodeIdMapReady = false;\n    function __kgEnsureNodeIdMap(){\n      if (__kgNodeIdMapReady) return;\n      __kgNodeIdMapReady = true;\n      try {\n        if (!nodePosById) return;\n        for (var __kgNid in nodePosById) {\n          if (!Object.prototype.hasOwnProperty.call(nodePosById, __kgNid)) continue;\n          var __kgId = String(__kgNid || '').trim();\n          if (!__kgId) continue;\n          __kgNodeIdSet[__kgId] = 1;\n          var __kgSuffix = (__kgId.split('::').pop() || '').trim();\n          if (__kgSuffix && !__kgNodeIdBySuffix[__kgSuffix]) __kgNodeIdBySuffix[__kgSuffix] = __kgId;\n        }\n      } catch (e0) {\n        void 0;\n      }\n    }\n    function __kgResolveNodeId(raw){\n      try {\n        __kgEnsureNodeIdMap();\n        var id = String(raw || '').trim();\n        if (!id) return '';\n        if (__kgNodeIdSet[id] === 1) return id;\n        var suffix = (id.split('::').pop() || '').trim();\n        if (suffix && __kgNodeIdBySuffix[suffix]) return String(__kgNodeIdBySuffix[suffix] || '').trim();\n        return id;\n      } catch (e1) {\n        return String(raw || '').trim();\n      }\n    }",
  )

  out = replaceOnceExact(
    out,
    "el.className = 'kg-media';",
    "el.className = 'kg-media';",
  )

  out = replaceOnceExact(
    out,
    "var header = document.createElement('div');\n        header.className = 'kg-mediaHeader';\n        var title = document.createElement('div');\n        title.className = 'kg-mediaTitle';",
    "var header = document.createElement('header');\n        header.className = 'kg-mediaHeader';\n        try { header.setAttribute('data-kg-media-panel-header', '1'); } catch (e0) {}\n        var title = document.createElement('h3');\n        title.className = 'kg-mediaTitle';",
  )

  out = replaceOnceExact(
    out,
    'header.appendChild(title);\n        var body = document.createElement(\'div\');',
    "header.appendChild(title);\n        try {\n          var openUrl = String(n.openUrl || '');\n          if (openUrl) {\n            var menu = document.createElement('menu');\n            menu.className = 'kg-mediaActions';\n            var li = document.createElement('li');\n            li.style.listStyle = 'none';\n            var btn = document.createElement('button');\n            btn.type = 'button';\n            btn.className = 'kg-mediaActionBtn';\n            btn.setAttribute('data-kg-panel-action', '1');\n            btn.setAttribute('aria-label', 'Open source');\n            btn.innerHTML = '<svg viewBox=\\\"0 0 24 24\\\" width=\\\"14\\\" height=\\\"14\\\" aria-hidden=\\\"true\\\" fill=\\\"none\\\" stroke=\\\"currentColor\\\" stroke-width=\\\"2\\\" stroke-linecap=\\\"round\\\" stroke-linejoin=\\\"round\\\"><path d=\\\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\\\"/><polyline points=\\\"15 3 21 3 21 9\\\"/><line x1=\\\"10\\\" y1=\\\"14\\\" x2=\\\"21\\\" y2=\\\"3\\\"/></svg>';\n            btn.addEventListener('pointerdown', function(e){ try { e.preventDefault(); e.stopPropagation(); } catch (e0) {} }, { capture: true });\n            btn.addEventListener('click', function(e){\n              try { if (e) { e.preventDefault(); e.stopPropagation(); } } catch (e0) {}\n              try { window.open(openUrl, '_blank', 'noopener,noreferrer'); } catch (e1) {}\n            });\n            li.appendChild(btn);\n            menu.appendChild(li);\n            header.appendChild(menu);\n          }\n        } catch (e0) {}\n        var body = document.createElement('div');",
  )

  out = replaceOnceExact(
    out,
    'if (fitBtn) fitBtn.addEventListener(\'click\', function(){ fitToCenter(); });\n    if (resetBtn) resetBtn.addEventListener(\'click\', function(){ resetView(); });\n    if (mediaBtn) mediaBtn.addEventListener(\'click\', function(){ setMediaInteractive(!mediaInteractive); });',
    "if (fitBtn) fitBtn.addEventListener('click', function(){ fitToCenter(); });\n    if (resetBtn) resetBtn.addEventListener('click', function(){ resetView(); });\n    if (mediaBtn) mediaBtn.addEventListener('click', function(){ setMediaInteractive(!mediaInteractive); });\n\n    try {\n      window.addEventListener('keydown', function(e){\n        try {\n          if (!e) return;\n          if (e.defaultPrevented) return;\n          if (e.ctrlKey || e.metaKey || e.altKey) return;\n          var k = String(e.key || '').toLowerCase();\n          if (k !== 'i') return;\n          var t = e.target && (e.target instanceof Element) ? e.target : null;\n          if (t && t.closest && t.closest('input,textarea,select,[contenteditable=\"true\"]')) return;\n          setMediaInteractive(!mediaInteractive);\n          try { e.preventDefault(); } catch (e0) {}\n        } catch (err) {}\n      }, { capture: true });\n    } catch (err) {}",
  )

  out = replaceOnceExact(
    out,
    "var pe = (mediaInteractive && pointerMode !== 'pan' && !panHeld && !headerDrag) ? 'auto' : 'none';",
    "var pe = (mediaInteractive && pointerMode !== 'pan' && !panHeld && !headerDrag) ? 'auto' : 'none';",
  )

  out = replaceOnceExact(
    out,
    "function applyMediaPointerEvents(){\n      var pe = (mediaInteractive && pointerMode !== 'pan' && !panHeld && !headerDrag) ? 'auto' : 'none';\n      try {\n        if (pe !== lastMediaPointerEvents) {\n          lastMediaPointerEvents = pe;\n          document.documentElement.style.setProperty('--kg-media-pointer-events', pe);\n        }\n      } catch (err) {}\n      try {\n        if (mediaBtn && mediaBtn.classList) {\n          if (lastMediaBtnActive !== mediaInteractive) {\n            lastMediaBtnActive = mediaInteractive;\n            if (mediaInteractive) mediaBtn.classList.add('kg-active');\n            else mediaBtn.classList.remove('kg-active');\n          }\n        }\n      } catch (err) {}\n    }",
    "function applyMediaPointerEvents(){\n      var pe = (mediaInteractive && pointerMode !== 'pan' && !panHeld && !headerDrag) ? 'auto' : 'none';\n      try {\n        if (pe !== lastMediaPointerEvents) {\n          lastMediaPointerEvents = pe;\n          document.documentElement.style.setProperty('--kg-media-pointer-events', pe);\n        }\n      } catch (err) {}\n      try {\n        if (mediaBtn && mediaBtn.classList) {\n          if (lastMediaBtnActive !== mediaInteractive) {\n            lastMediaBtnActive = mediaInteractive;\n            if (mediaInteractive) mediaBtn.classList.add('kg-active');\n            else mediaBtn.classList.remove('kg-active');\n          }\n        }\n      } catch (err) {}\n      try {\n        if (overlay && overlay.__kgMediaById && mediaNodes && mediaNodes.length) {\n          for (var i = 0; i < mediaNodes.length; i += 1) {\n            var n = mediaNodes[i];\n            if (!n) continue;\n            var id = String(n.id || '');\n            if (!id) continue;\n            var holder = overlay.__kgMediaById[id];\n            if (!holder || !holder.querySelectorAll) continue;\n            var interactive0 = !!n.interactive;\n            var perPe = interactive0 ? pe : 'none';\n            var els = holder.querySelectorAll('iframe,img,video,source');\n            for (var j = 0; j < els.length; j += 1) {\n              var el = els[j];\n              if (!el || !el.style) continue;\n              try { el.style.pointerEvents = perPe; } catch (e0) {}\n            }\n          }\n        }\n      } catch (err) {}\n    }",
  )

  out = replaceOnceExact(
    out,
    "function updateEdgeGeometryByEl(edgeEl){\n      if (!edgeEl || !edgeEl.getAttribute) return;\n      var src = String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim();\n      var tgt = String(edgeEl.getAttribute('data-target-id') || edgeEl.getAttribute('data-target') || '').trim();\n      if (!src || !tgt) return;\n      var a = nodePosById && nodePosById[src] ? nodePosById[src] : null;\n      var b = nodePosById && nodePosById[tgt] ? nodePosById[tgt] : null;\n      if (!a || !b) return;\n      var x1 = Number(a.x);\n      var y1 = Number(a.y);\n      var x2 = Number(b.x);\n      var y2 = Number(b.y);\n      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;\n      var tag = String(edgeEl.tagName || '').toLowerCase();\n      if (tag === 'line') {\n        edgeEl.setAttribute('x1', String(x1));\n        edgeEl.setAttribute('y1', String(y1));\n        edgeEl.setAttribute('x2', String(x2));\n        edgeEl.setAttribute('y2', String(y2));\n        return;\n      }\n      if (tag === 'polyline') {\n        edgeEl.setAttribute('points', String(x1) + ',' + String(y1) + ' ' + String(x2) + ',' + String(y2));\n        return;\n      }\n      if (tag === 'path') {\n        edgeEl.setAttribute('d', 'M ' + String(x1) + ' ' + String(y1) + ' L ' + String(x2) + ' ' + String(y2));\n      }\n    }",
    "function updateEdgeGeometryByEl(edgeEl){\n      if (!edgeEl || !edgeEl.getAttribute) return;\n      var src = String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim();\n      var tgt = String(edgeEl.getAttribute('data-target-id') || edgeEl.getAttribute('data-target') || '').trim();\n      if (!src || !tgt) return;\n      var a = nodePosById && nodePosById[src] ? nodePosById[src] : null;\n      var b = nodePosById && nodePosById[tgt] ? nodePosById[tgt] : null;\n      if (!a || !b) return;\n      var x1 = Number(a.x);\n      var y1 = Number(a.y);\n      var x2 = Number(b.x);\n      var y2 = Number(b.y);\n      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;\n\n      function applyPanelEndpointIntersection(nodeId, x, y, toX, toY){\n        try {\n          if (!overlay) return { x: x, y: y };\n          var box = null;\n          try {\n            if (overlay.__kgMediaBoxById && overlay.__kgMediaBoxById[nodeId]) box = overlay.__kgMediaBoxById[nodeId];\n          } catch (e0) {}\n          if (!box) {\n            try {\n              if (overlay.__kgMdBoxById && overlay.__kgMdBoxById[nodeId]) box = overlay.__kgMdBoxById[nodeId];\n            } catch (e1) {}\n          }\n          if (!box) return { x: x, y: y };\n\n          var baseSx = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;\n          var baseSy = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;\n          var k0 = (state && isFinite(state.k) && state.k > 0) ? state.k : 1;\n          var wpx = Number(box.w) || 0;\n          var hpx = Number(box.h) || 0;\n          if (!(wpx > 0) || !(hpx > 0)) return { x: x, y: y };\n\n          var hw = wpx / (2 * baseSx * k0);\n          var hh = hpx / (2 * baseSy * k0);\n          if (!(hw > 0) || !(hh > 0)) return { x: x, y: y };\n\n          var dx = toX - x;\n          var dy = toY - y;\n          if (!isFinite(dx) || !isFinite(dy)) return { x: x, y: y };\n          if (dx === 0 && dy === 0) return { x: x, y: y };\n\n          var sx = Math.abs(dx) / hw;\n          var sy = Math.abs(dy) / hh;\n          var m = Math.max(sx, sy);\n          if (!(m > 0) || !isFinite(m)) return { x: x, y: y };\n          var t = 1 / m;\n          if (!(t > 0) || !isFinite(t)) return { x: x, y: y };\n          return { x: x + dx * t, y: y + dy * t };\n        } catch (e) {\n          return { x: x, y: y };\n        }\n      }\n\n      try {\n        var a1 = applyPanelEndpointIntersection(src, x1, y1, x2, y2);\n        x1 = Number(a1.x);\n        y1 = Number(a1.y);\n        var b1 = applyPanelEndpointIntersection(tgt, x2, y2, x1, y1);\n        x2 = Number(b1.x);\n        y2 = Number(b1.y);\n      } catch (e0) {}\n\n      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;\n      var tag = String(edgeEl.tagName || '').toLowerCase();\n      if (tag === 'line') {\n        edgeEl.setAttribute('x1', String(x1));\n        edgeEl.setAttribute('y1', String(y1));\n        edgeEl.setAttribute('x2', String(x2));\n        edgeEl.setAttribute('y2', String(y2));\n        return;\n      }\n      if (tag === 'polyline') {\n        edgeEl.setAttribute('points', String(x1) + ',' + String(y1) + ' ' + String(x2) + ',' + String(y2));\n        return;\n      }\n      if (tag === 'path') {\n        edgeEl.setAttribute('d', 'M ' + String(x1) + ' ' + String(y1) + ' L ' + String(x2) + ' ' + String(y2));\n      }\n    }",
    "function updateEdgeGeometryByEl(edgeEl){\n      if (!edgeEl || !edgeEl.getAttribute) return;\n      var src = String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim();\n      var tgt = String(edgeEl.getAttribute('data-target-id') || edgeEl.getAttribute('data-target') || '').trim();\n      if (!src || !tgt) return;\n      var a = nodePosById && nodePosById[src] ? nodePosById[src] : null;\n      var b = nodePosById && nodePosById[tgt] ? nodePosById[tgt] : null;\n      if (!a || !b) return;\n      var x1 = Number(a.x);\n      var y1 = Number(a.y);\n      var x2 = Number(b.x);\n      var y2 = Number(b.y);\n      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;\n\n      var baseSx = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;\n      var baseSy = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;\n      var ox = (svgBase && isFinite(svgBase.ox)) ? svgBase.ox : 0;\n      var oy = (svgBase && isFinite(svgBase.oy)) ? svgBase.oy : 0;\n      var k0 = (state && isFinite(state.k) && state.k > 0) ? state.k : 1;\n\n      function applyNodeScreenOffset(nodeId, x, y){\n        try {\n          if (!svg) return { x: x, y: y };\n          var m = svg.__kgNodeOffsetById || null;\n          if (!m) return { x: x, y: y };\n          var o = m[nodeId] || null;\n          if (!o) return { x: x, y: y };\n          var dx = (Number(o.x) || 0) / (k0 * baseSx);\n          var dy = (Number(o.y) || 0) / (k0 * baseSy);\n          if (!isFinite(dx) || !isFinite(dy)) return { x: x, y: y };\n          return { x: x + dx, y: y + dy };\n        } catch (e0) {\n          return { x: x, y: y };\n        }\n      }\n\n      function rectWorldByNodeId(nodeId){\n        try {\n          if (!overlay) return null;\n          var box = null;\n          try { if (overlay.__kgMediaBoxById && overlay.__kgMediaBoxById[nodeId]) box = overlay.__kgMediaBoxById[nodeId]; } catch (e0) {}\n          if (!box) { try { if (overlay.__kgMdBoxById && overlay.__kgMdBoxById[nodeId]) box = overlay.__kgMdBoxById[nodeId]; } catch (e1) {} }\n          if (!box) return null;\n          var lpx = Number(box.left);\n          var tpx = Number(box.top);\n          var wpx = Number(box.w);\n          var hpx = Number(box.h);\n          if (!isFinite(lpx) || !isFinite(tpx) || !isFinite(wpx) || !isFinite(hpx) || !(wpx > 0) || !(hpx > 0)) return null;\n          var left = (lpx - state.x - ox) / (k0 * baseSx);\n          var top = (tpx - state.y - oy) / (k0 * baseSy);\n          var right = (lpx + wpx - state.x - ox) / (k0 * baseSx);\n          var bottom = (tpx + hpx - state.y - oy) / (k0 * baseSy);\n          if (!isFinite(left) || !isFinite(top) || !isFinite(right) || !isFinite(bottom)) return null;\n          if (right < left) { var tmp = right; right = left; left = tmp; }\n          if (bottom < top) { var tmp2 = bottom; bottom = top; top = tmp2; }\n          if (!(right > left) || !(bottom > top)) return null;\n          return { left: left, top: top, right: right, bottom: bottom };\n        } catch (e2) {\n          return null;\n        }\n      }\n\n      function clipToRectBoundary(nodeId, ax, ay, bx, by){\n        try {\n          var r = rectWorldByNodeId(nodeId);\n          if (!r) return { x: ax, y: ay };\n          var vx = bx - ax;\n          var vy = by - ay;\n          if (!isFinite(vx) || !isFinite(vy)) return { x: ax, y: ay };\n          if (vx === 0 && vy === 0) return { x: ax, y: ay };\n          var t = Infinity;\n          if (vx > 0) t = Math.min(t, (r.right - ax) / vx);\n          else if (vx < 0) t = Math.min(t, (r.left - ax) / vx);\n          if (vy > 0) t = Math.min(t, (r.bottom - ay) / vy);\n          else if (vy < 0) t = Math.min(t, (r.top - ay) / vy);\n          if (!isFinite(t) || t === Infinity || t < 0) return { x: ax, y: ay };\n          return { x: ax + vx * t, y: ay + vy * t };\n        } catch (e3) {\n          return { x: ax, y: ay };\n        }\n      }\n\n      var a0 = applyNodeScreenOffset(src, x1, y1);\n      var b0 = applyNodeScreenOffset(tgt, x2, y2);\n      x1 = Number(a0.x);\n      y1 = Number(a0.y);\n      x2 = Number(b0.x);\n      y2 = Number(b0.y);\n\n      try {\n        var p1 = clipToRectBoundary(src, x1, y1, x2, y2);\n        x1 = Number(p1.x);\n        y1 = Number(p1.y);\n        var p2 = clipToRectBoundary(tgt, x2, y2, x1, y1);\n        x2 = Number(p2.x);\n        y2 = Number(p2.y);\n      } catch (e4) {}\n\n      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;\n      var tag = String(edgeEl.tagName || '').toLowerCase();\n      if (tag === 'line') {\n        edgeEl.setAttribute('x1', String(x1));\n        edgeEl.setAttribute('y1', String(y1));\n        edgeEl.setAttribute('x2', String(x2));\n        edgeEl.setAttribute('y2', String(y2));\n        return;\n      }\n      if (tag === 'polyline') {\n        edgeEl.setAttribute('points', String(x1) + ',' + String(y1) + ' ' + String(x2) + ',' + String(y2));\n        return;\n      }\n      if (tag === 'path') {\n        edgeEl.setAttribute('d', 'M ' + String(x1) + ' ' + String(y1) + ' L ' + String(x2) + ' ' + String(y2));\n      }\n    }",
  )

  out = replaceOnceExact(out, 'var mediaInteractive = false;', 'var mediaInteractive = true;')

  out = replaceOnceExact(
    out,
    "function isMediaHeaderTarget(t){\n      try {\n        if (!(t instanceof Element)) return false;\n        return !!t.closest('.kg-mediaHeader');\n      } catch (err) {\n        return false;\n      }\n    }",
    "function isMediaHeaderTarget(t){\n      try {\n        if (!(t instanceof Element)) return false;\n        return !!t.closest('.kg-mediaHeader,[data-kg-media-panel-header=\\\"1\\\"]');\n      } catch (err) {\n        return false;\n      }\n    }",
  )


  out = replaceOnceExact(
    out,
    "if (isMediaHeaderTarget(e.target)) {",
    "if (isMediaHeaderTarget(e.target)) {\n        try {\n          var headerEl = e.target instanceof Element ? e.target.closest('.kg-mediaHeader,[data-kg-media-panel-header=\"1\"]') : null;\n        } catch (err0) {}\n        try {\n          if (pointerMode === 'pan' || panHeld) {\n            startDrag(e.pointerId, e.clientX, e.clientY);\n            try { root.setPointerCapture(e.pointerId); } catch (err5) {}\n            try { e.preventDefault(); } catch (err6) {}\n            try { e.stopPropagation(); } catch (err7) {}\n            return;\n          }\n        } catch (err0) {}",
  )

  out = replaceOnceExact(
    out,
    "overlay.__kgMediaById[id] = el;\n      }\n    }\n\n    var overlayRaf = null;",
    "overlay.__kgMediaById[id] = el;\n      }\n    }\n\n    function ensureMarkdownDom(){\n      if (!overlay) return;\n      if (!markdownBlocks || markdownBlocks.length === 0) return;\n      if (overlay.__kgMdBuilt) return;\n      overlay.__kgMdBuilt = true;\n      overlay.__kgMdById = {};\n      for (var i = 0; i < markdownBlocks.length; i += 1) {\n        var b = markdownBlocks[i];\n        if (!b) continue;\n        var id = String(b.id || '');\n        if (!id) continue;\n        try {\n          var pv = b.preview || null;\n          var kind = pv && pv.kind ? String(pv.kind) : '';\n          if (kind === 'html') {\n            var raw = pv && pv.html && pv.html.raw ? String(pv.html.raw || '') : '';\n            if (/<\\s*iframe\\b/i.test(raw)) continue;\n          }\n        } catch (e0) {}\n\n        var el = document.createElement('div');\n        el.className = 'kg-md';\n        el.setAttribute('data-md-id', id);\n        try { el.setAttribute('data-kg-canvas-wheel-ignore', 'true'); } catch (e1) {}\n        try { el.setAttribute('data-kg-canvas-pointer-ignore', 'true'); } catch (e2) {}\n        try { el.setAttribute('data-kg-md-panel', '1'); } catch (e3) {}\n\n        var header = document.createElement('div');\n        header.className = 'kg-mdHeader';\n        var title = document.createElement('div');\n        title.className = 'kg-mdTitle';\n        title.textContent = String(b.title || b.id || 'Block');\n        header.appendChild(title);\n\n        var body = document.createElement('div');\n        body.className = 'kg-mdBody';\n\n        try {\n          var preview = b.preview || null;\n          var k = preview && preview.kind ? String(preview.kind) : '';\n          if (k === 'table' && preview.table) {\n            var tbl = document.createElement('table');\n            tbl.className = 'kg-mdTable';\n            var cols = Array.isArray(preview.table.columns) ? preview.table.columns : [];\n            var rows = Array.isArray(preview.table.rows) ? preview.table.rows : [];\n            if (cols.length) {\n              var thead = document.createElement('thead');\n              var trh = document.createElement('tr');\n              for (var ci = 0; ci < cols.length; ci += 1) {\n                var th = document.createElement('th');\n                th.textContent = String(cols[ci] || '');\n                trh.appendChild(th);\n              }\n              thead.appendChild(trh);\n              tbl.appendChild(thead);\n            }\n            var tbody = document.createElement('tbody');\n            var maxRows = Math.max(1, Math.min(12, rows.length));\n            for (var ri = 0; ri < maxRows; ri += 1) {\n              var tr = document.createElement('tr');\n              var row = Array.isArray(rows[ri]) ? rows[ri] : [];\n              var cells = cols.length ? cols.length : row.length;\n              for (var cj = 0; cj < cells; cj += 1) {\n                var td = document.createElement('td');\n                td.textContent = String(row[cj] != null ? row[cj] : '');\n                tr.appendChild(td);\n              }\n              tbody.appendChild(tr);\n            }\n            tbl.appendChild(tbody);\n            body.appendChild(tbl);\n          } else if (k === 'code' && preview.code) {\n            var pre = document.createElement('pre');\n            pre.className = 'kg-mdCode';\n            var lines = Array.isArray(preview.code.lines) ? preview.code.lines : [];\n            pre.textContent = String(lines.slice(0, 18).join('\\n'));\n            body.appendChild(pre);\n          } else if (k === 'blockquote' && preview.blockquote) {\n            var div = document.createElement('div');\n            div.className = 'kg-mdQuote';\n            var qLines = Array.isArray(preview.blockquote.lines) ? preview.blockquote.lines : [];\n            div.textContent = String(qLines.slice(0, 10).join('\\n'));\n            body.appendChild(div);\n          } else if (k === 'callout' && preview.callout) {\n            var cdiv = document.createElement('div');\n            cdiv.className = 'kg-mdCallout';\n            var cTitle = (preview.callout.title ? String(preview.callout.title || '').trim() : '');\n            var ct = document.createElement('div');\n            ct.className = 'kg-mdCalloutTitle';\n            ct.textContent = cTitle || String(b.title || 'Callout');\n            cdiv.appendChild(ct);\n            body.appendChild(cdiv);\n          } else {\n            var p = document.createElement('div');\n            p.className = 'kg-mdText';\n            p.textContent = String(b.summary || b.title || '');\n            body.appendChild(p);\n          }\n        } catch (e4) {\n          void 0;\n        }\n\n        el.appendChild(header);\n        el.appendChild(body);\n        overlay.appendChild(el);\n        overlay.__kgMdById[id] = el;\n      }\n    }\n\n    var overlayRaf = null;",
  )

  out = replaceAllExact(
    out,
    "try { el.setAttribute('data-kg-canvas-pointer-ignore', 'true'); } catch (e2) {}",
    '',
  )

  out = replaceAllExact(
    out,
    "try { el.setAttribute('data-kg-canvas-wheel-ignore', 'true'); } catch (e1) {}",
    '',
  )

  out = replaceOnceExact(
    out,
    'overlay.__kgMdById = {};\n      for (var i = 0; i < markdownBlocks.length; i += 1) {',
    "overlay.__kgMdById = {};\n\n      try {\n        var existing = overlay.querySelectorAll ? overlay.querySelectorAll('[data-md-id],[data-kg-markdown-design-block],[data-node-id][data-kg-md-panel]') : null;\n        if (existing && existing.length) {\n          for (var ei = 0; ei < existing.length; ei += 1) {\n            var ex = existing[ei];\n            if (!ex || !ex.getAttribute) continue;\n            var xid = String(ex.getAttribute('data-md-id') || ex.getAttribute('data-kg-markdown-design-block') || ex.getAttribute('data-node-id') || '').trim();\n            var xanchor = __kgResolveNodeId(String(ex.getAttribute('data-kg-anchor-node-id') || ex.getAttribute('data-node-id') || '').trim());\n            xid = __kgResolveNodeId(xid);\n            if (!xid && !xanchor) continue;\n            try {\n              var curClass = String(ex.className || '');\n              if (curClass.indexOf('kg-md') < 0) ex.className = ('kg-md ' + curClass).trim();\n            } catch (e0) {\n              void 0;\n            }\n            if (xid) overlay.__kgMdById[xid] = ex;\n            if (xanchor) overlay.__kgMdById[xanchor] = ex;\n          }\n        }\n      } catch (e0) {\n        void 0;\n      }\n\n      for (var i = 0; i < markdownBlocks.length; i += 1) {",
  )

  out = replaceAllExact(
    out,
    "var b = markdownBlocks[i];\n        if (!b) continue;\n        var id = String(b.id || '');\n        if (!id) continue;",
    "var b = markdownBlocks[i];\n        if (!b) continue;\n        var id = String(b.id || '');\n        if (!id) continue;\n        var anchorId0 = __kgResolveNodeId(String((b && (b.anchorNodeId || b.anchorId)) || '').trim());\n        if (overlay.__kgMdById[id] || (anchorId0 && overlay.__kgMdById[anchorId0])) continue;",
  )

  out = replaceAllExact(
    out,
    "el.setAttribute('data-md-id', id);",
    "el.setAttribute('data-md-id', id);\n        if (anchorId0) {\n          try { el.setAttribute('data-kg-anchor-node-id', anchorId0); } catch (e0a) {}\n        }",
  )

  out = replaceAllExact(
    out,
    "overlay.__kgMdById[id] = el;",
    "overlay.__kgMdById[id] = el;\n        if (anchorId0) overlay.__kgMdById[anchorId0] = el;",
  )

  out = replaceOnceExact(
    out,
    'ensureMediaDom();\n      if (!mediaNodes || mediaNodes.length === 0) return;',
    "ensureMediaDom();\n      ensureMarkdownDom();\n      try {\n        if ((!mediaNodes || mediaNodes.length === 0) && overlay && overlay.__kgMediaById) {\n          mediaNodes = mediaNodes || [];\n          for (var mid in overlay.__kgMediaById) {\n            if (!Object.prototype.hasOwnProperty.call(overlay.__kgMediaById, mid)) continue;\n            var mid0 = __kgResolveNodeId(String(mid || '').trim());\n            if (!mid0) continue;\n            var seen0 = false;\n            for (var mi0 = 0; mi0 < mediaNodes.length; mi0 += 1) {\n              var mn0 = mediaNodes[mi0];\n              if (mn0 && String(mn0.id || '').trim() === mid0) { seen0 = true; break; }\n            }\n            if (!seen0) mediaNodes.push({ id: mid0, title: mid0, url: '', openUrl: '', interactive: true, kind: 'iframe' });\n          }\n        }\n      } catch (eHyd0) { void 0; }\n      if ((!mediaNodes || mediaNodes.length === 0) && (!markdownBlocks || markdownBlocks.length === 0)) return;",
  )

  out = replaceOnceExact(
    out,
    'if (!markdownBlocks || markdownBlocks.length === 0) return;',
    "if (!markdownBlocks || markdownBlocks.length === 0) return;\n      try {\n        var hasOverlayMd = false;\n        try {\n          hasOverlayMd = !!(overlay && overlay.querySelector && overlay.querySelector('[data-md-id],[data-kg-markdown-design-block],[data-node-id][data-kg-md-panel]'));\n        } catch (e0) {\n          hasOverlayMd = false;\n        }\n        if (!hasOverlayMd && typeof svg !== 'undefined' && svg && svg.querySelector && svg.querySelector('[data-kg-layer=\\\"markdown-design-blocks\\\"] foreignObject')) return;\n      } catch (eSkip) {}",
  )

  out = replaceOnceExact(
    out,
    'var offMap = svg.__kgNodeOffsetById || (svg.__kgNodeOffsetById = {});',
    "var offMap = svg.__kgNodeOffsetById || (svg.__kgNodeOffsetById = {});\n\n          try {\n            var foList = svg.querySelectorAll('[data-kg-layer=\\\"markdown-design-blocks\\\"] foreignObject[data-kg-markdown-block-id]');\n            if (foList && foList.length) {\n              for (var fi = 0; fi < foList.length; fi += 1) {\n                var fo = foList[fi];\n                if (!fo || !fo.getAttribute) continue;\n                var fid = String(fo.getAttribute('data-kg-markdown-block-id') || '');\n                var fanchor = String(fo.getAttribute('data-kg-anchor-node-id') || '').trim();\n                var fkey = fanchor || fid;\n                if (!fkey) continue;\n                var pz = nodePosById && nodePosById[fkey] ? nodePosById[fkey] : null;\n                if (!pz) continue;\n                var nx = Number(pz.x);\n                var ny = Number(pz.y);\n                if (!isFinite(nx) || !isFinite(ny)) continue;\n                var fx = Number(fo.getAttribute('x'));\n                var fy = Number(fo.getAttribute('y'));\n                var fw = Number(fo.getAttribute('width'));\n                var fh = Number(fo.getAttribute('height'));\n                if (!isFinite(fx) || !isFinite(fy) || !isFinite(fw) || !isFinite(fh) || !(fw > 0) || !(fh > 0)) continue;\n\n                var nodeSx = nx * state.k * baseSx1 + state.x + ox1;\n                var nodeSy = ny * state.k * baseSy1 + state.y + oy1;\n                var anchorSx = (fx + fw * 0.5) * state.k * baseSx1 + state.x + ox1;\n                var anchorSy = fy * state.k * baseSy1 + state.y + oy1 - 6;\n                var dx = anchorSx - nodeSx;\n                var dy = anchorSy - nodeSy;\n                var prev = offMap[fkey] || null;\n                if (!prev || Math.abs((Number(prev.x) || 0) - dx) > 0.5 || Math.abs((Number(prev.y) || 0) - dy) > 0.5) {\n                  offMap[fkey] = { x: dx, y: dy };\n                  try { scheduleEdgeGeometryUpdateForNode(fkey); } catch (eFo) {}\n                }\n              }\n            }\n          } catch (eF0) {}",
  )

  out = replaceOnceExact(
    out,
    "lastBoxById[id] = { left: left, top: top, w: panelW, h: panelH, display: 'block' };\n        }\n      }\n    }\n\n    function onWheel(e){",
    "lastBoxById[id] = { left: left, top: top, w: panelW, h: panelH, display: 'block' };\n        }\n      }\n\n      try {\n        if (markdownBlocks && markdownBlocks.length) {\n          var mdById = overlay.__kgMdById || {};\n          var lastMdBoxById = overlay.__kgMdBoxById || (overlay.__kgMdBoxById = {});\n          var baseSx0 = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;\n          var baseSy0 = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;\n          var ox0 = (svgBase && isFinite(svgBase.ox)) ? svgBase.ox : 0;\n          var oy0 = (svgBase && isFinite(svgBase.oy)) ? svgBase.oy : 0;\n          for (var mi = 0; mi < markdownBlocks.length; mi += 1) {\n            var b = markdownBlocks[mi];\n            if (!b) continue;\n            var bid = String(b.id || '');\n            var anchorId = String((b && (b.anchorNodeId || b.anchorId)) || '').trim();\n            if (!bid && !anchorId) continue;\n            var el = mdById[bid] || mdById[anchorId] || null;\n            if (!el) continue;\n            var xw = Number(b.x);\n            var yw = Number(b.y);\n            var ww = Number(b.w);\n            var hh = Number(b.h);\n            if (!isFinite(xw) || !isFinite(yw) || !isFinite(ww) || !isFinite(hh) || !(ww > 0) || !(hh > 0)) continue;\n            var left = xw * state.k * baseSx0 + state.x + ox0;\n            var top = yw * state.k * baseSy0 + state.y + oy0;\n            var sw = ww * state.k * baseSx0;\n            var sh = hh * state.k * baseSy0;\n            var il = Math.round(left);\n            var it = Math.round(top);\n            var iw = Math.max(1, Math.round(sw));\n            var ih = Math.max(1, Math.round(sh));\n            var key0 = anchorId || bid;\n            var prev = lastMdBoxById[key0] || null;\n            if (!prev || prev.left !== il || prev.top !== it || prev.w !== iw || prev.h !== ih || prev.display !== 'block') {\n              applyPanelBox(el, { left: il, top: it, w: iw, h: ih, display: 'block', zIndex: 1 });\n              var boxVal = { left: il, top: it, w: iw, h: ih, display: 'block' };\n              if (bid) lastMdBoxById[bid] = boxVal;\n              if (anchorId) lastMdBoxById[anchorId] = boxVal;\n            }\n          }\n        }\n      } catch (mdErr) {}\n\n      try {\n        if (svg && overlay && nodePosById) {\n          var baseSx1 = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;\n          var baseSy1 = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;\n          var ox1 = (svgBase && isFinite(svgBase.ox)) ? svgBase.ox : 0;\n          var oy1 = (svgBase && isFinite(svgBase.oy)) ? svgBase.oy : 0;\n          var density1 = __KG_DENSITY__;\n          var headerH = density1 === 'compact' ? 22 : 28;\n          var offMap = svg.__kgNodeOffsetById || (svg.__kgNodeOffsetById = {});\n\n          var mediaBoxById = overlay.__kgMediaBoxById || {};\n          if (mediaNodes && mediaNodes.length) {\n            for (var mi2 = 0; mi2 < mediaNodes.length; mi2 += 1) {\n              var n0 = mediaNodes[mi2];\n              var id0 = String(n0 && n0.id ? n0.id : '');\n              if (!id0) continue;\n              var box0 = mediaBoxById[id0] || null;\n              var p0 = nodePosById && nodePosById[id0] ? nodePosById[id0] : null;\n              if (!p0 || !box0) continue;\n              var x0 = Number(p0.x);\n              var y0 = Number(p0.y);\n              if (!isFinite(x0) || !isFinite(y0)) continue;\n              var asx = x0 * state.k * baseSx1 + state.x + ox1;\n              var asy = y0 * state.k * baseSy1 + state.y + oy1;\n              var dx0 = (Number(box0.left) || 0) + (Number(box0.w) || 0) * 0.5 - asx;\n              var dy0 = (Number(box0.top) || 0) + Math.min(headerH, Number(box0.h) || 0) * 0.5 - asy;\n              var prev0 = offMap[id0] || null;\n              if (!prev0 || Math.abs((Number(prev0.x) || 0) - dx0) > 0.5 || Math.abs((Number(prev0.y) || 0) - dy0) > 0.5) {\n                offMap[id0] = { x: dx0, y: dy0 };\n                try { scheduleEdgeGeometryUpdateForNode(id0); } catch (e0) {}\n              }\n            }\n          }\n\n          var mdBoxById = overlay.__kgMdBoxById || {};\n          if (markdownBlocks && markdownBlocks.length) {\n            for (var mi3 = 0; mi3 < markdownBlocks.length; mi3 += 1) {\n              var b0 = markdownBlocks[mi3];\n              if (!b0) continue;\n              var bid0 = String(b0.id || '');\n              var anchorId0 = String((b0 && (b0.anchorNodeId || b0.anchorId)) || '').trim();\n              var key1 = anchorId0 || bid0;\n              if (!key1) continue;\n              var box1 = mdBoxById[key1] || mdBoxById[bid0] || null;\n              var p1 = nodePosById && nodePosById[key1] ? nodePosById[key1] : null;\n              if (!p1 || !box1) continue;\n              var x1 = Number(p1.x);\n              var y1 = Number(p1.y);\n              if (!isFinite(x1) || !isFinite(y1)) continue;\n              var bsx = x1 * state.k * baseSx1 + state.x + ox1;\n              var bsy = y1 * state.k * baseSy1 + state.y + oy1;\n              var dx1 = (Number(box1.left) || 0) + (Number(box1.w) || 0) * 0.5 - bsx;\n              var dy1 = (Number(box1.top) || 0) + (Number(box1.h) || 0) * 0.5 - bsy;\n              var prev1 = offMap[key1] || null;\n              if (!prev1 || Math.abs((Number(prev1.x) || 0) - dx1) > 0.5 || Math.abs((Number(prev1.y) || 0) - dy1) > 0.5) {\n                offMap[key1] = { x: dx1, y: dy1 };\n                try { scheduleEdgeGeometryUpdateForNode(key1); } catch (e1) {}\n              }\n            }\n          }\n        }\n      } catch (errOff) {}\n    }\n\n    function onWheel(e){",
  )


  out = replaceOnceExact(
    out,
    "if (/(^|\\/\\/)twitframe\\.com\\//i.test(u)) return true;\n        return false;",
    "if (/(^|\\/\\/)twitframe\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)player\\.bilibili\\.com\\//i.test(u)) return true;\n        return false;",
  )

  out = replaceOnceExact(
    out,
    "var mediaBtn = document.getElementById('kg-media-toggle');",
    "var mediaBtn = document.getElementById('kg-media-toggle');\n\n    var KG_TOGGLE_MEDIA_INTERACTION_LABEL = 'Toggle media interaction';\n\n    var KG_PROXY_ORIGIN = __KG_PROXY_ORIGIN__;\n    var KG_PROXY_ORIGIN_RUNTIME = (typeof KG_PROXY_ORIGIN === 'string' ? String(KG_PROXY_ORIGIN || '').trim() : '');\n    var KG_PROXY_PROBE_STARTED = false;\n\n    var kgGetProxyOrigin = function(){\n      try { return String(KG_PROXY_ORIGIN_RUNTIME || '').trim(); } catch (e) { return ''; }\n    };\n\n    var kgShouldUseProxy = function(){\n      try {\n        if (kgGetProxyOrigin()) return true;\n      } catch (e) {\n        void 0;\n      }\n      try {\n        var host = String((window && window.location && window.location.hostname) ? window.location.hostname : '').toLowerCase();\n        if (!host) return false;\n        return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';\n      } catch (e) {\n        return false;\n      }\n    };\n\n    var kgInferMediaKindFromUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        if (/^data:image\\//i.test(u)) {\n          if (/^data:image\\/svg\\+xml/i.test(u)) return 'svg';\n          return 'image';\n        }\n        var noHash = u.split('#')[0] || u;\n        var noQuery = noHash.split('?')[0] || noHash;\n        var lower = String(noQuery).toLowerCase();\n        if (lower.endsWith('.svg')) return 'svg';\n        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp')) return 'image';\n        if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.m4v')) return 'video';\n        return '';\n      } catch (e) {\n        return '';\n      }\n    };\n\n    var kgIsDirectIframeEmbedUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return false;\n        if (!/^https?:\\/\\//i.test(u)) return true;\n        if (/(^|\\/\\/)(www\\.)?youtube\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)(www\\.)?youtu\\.be\\//i.test(u)) return true;\n        if (/(^|\\/\\/)www\\.youtube-nocookie\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)player\\.vimeo\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)platform\\.twitter\\.com\\//i.test(u)) return true;\n        if (/(^|\\/\\/)twitframe\\.com\\//i.test(u)) return true;\n        return false;\n      } catch (e) {\n        return false;\n      }\n    };\n\n    var kgBuildRemoteFetchProxyUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        if (u.startsWith('/__fetch_remote?url=')) return u;\n        var origin = kgGetProxyOrigin();\n        if (/^https?:\\/\\//i.test(origin || '')) return String(origin).replace(/\\/+$/, '') + '/__fetch_remote?url=' + encodeURIComponent(u);\n        if (!kgShouldUseProxy()) return u;\n        return '/__fetch_remote?url=' + encodeURIComponent(u);\n      } catch (e) {\n        return String(rawUrl || '').trim();\n      }\n    };\n\n    var kgBuildWebpageProxyUrl = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        if (u.startsWith('/__webpage_proxy?url=')) return u;\n        var origin = kgGetProxyOrigin();\n        if (/^https?:\\/\\//i.test(origin || '')) return String(origin).replace(/\\/+$/, '') + '/__webpage_proxy?url=' + encodeURIComponent(u);\n        if (!kgShouldUseProxy()) return u;\n        return '/__webpage_proxy?url=' + encodeURIComponent(u);\n      } catch (e) {\n        return String(rawUrl || '').trim();\n      }\n    };\n\n    var kgResolveMediaSrc = function(url, kind){\n      var u = String(url || '').trim();\n      if (!u) return '';\n      if (/^\\s*(data:|blob:|mailto:|tel:)/i.test(u)) return u;\n      if (u.startsWith('/__') || u.startsWith('/@')) return u;\n      var k = String(kind || '');\n      if (k === 'iframe') {\n        if (kgIsDirectIframeEmbedUrl(u)) return u;\n        return kgBuildWebpageProxyUrl(u);\n      }\n      if (k === 'video' || k === 'image' || k === 'svg') return kgBuildRemoteFetchProxyUrl(u);\n      return u;\n    };\n\n    var kgResolveIframeSandbox = function(url){\n      try {\n        return kgIsDirectIframeEmbedUrl(url)\n          ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation'\n          : 'allow-scripts allow-presentation';\n      } catch (e) {\n        return 'allow-scripts allow-presentation';\n      }\n    };\n\n    var kgApplyMediaSrcForEl = function(el){\n      try {\n        if (!el || !el.getAttribute) return;\n        var kind0 = String(el.getAttribute('data-kg-kind') || 'iframe');\n        var url0 = String(el.getAttribute('data-kg-url') || '');\n        var inferred = kgInferMediaKindFromUrl(url0);\n        var kind = (inferred && (kind0 === 'iframe' || kind0 === '')) ? inferred : kind0;\n        if (kind === 'image' || kind === 'svg') {\n          var img = el.querySelector ? el.querySelector('img') : null;\n          if (img) img.src = kgResolveMediaSrc(url0, kind);\n          return;\n        }\n        if (kind === 'video') {\n          var vid = el.querySelector ? el.querySelector('video') : null;\n          if (vid) vid.src = kgResolveMediaSrc(url0, kind);\n          return;\n        }\n        var iframe = el.querySelector ? el.querySelector('iframe') : null;\n        if (!iframe) return;\n        try { iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'); } catch (e0) { void 0; }\n        try { iframe.setAttribute('sandbox', kgResolveIframeSandbox(url0)); } catch (e1) { void 0; }\n        iframe.src = kgResolveMediaSrc(url0, 'iframe');\n      } catch (e) {\n        void 0;\n      }\n    };\n\n    var kgApplyMediaSrcToAll = function(){\n      try {\n        if (!overlay || !overlay.__kgMediaById) return;\n        var m = overlay.__kgMediaById;\n        for (var k in m) {\n          if (!k) continue;\n          kgApplyMediaSrcForEl(m[k]);\n        }\n      } catch (e) {\n        void 0;\n      }\n    };\n\n    var kgMaybeProbeProxyOrigin = function(){\n      try {\n        if (KG_PROXY_PROBE_STARTED) return;\n        if (kgGetProxyOrigin()) return;\n        if (!window || !window.location) return;\n        if (String(window.location.protocol || '') !== 'file:') return;\n        KG_PROXY_PROBE_STARTED = true;\n        var ports = [5173,5174,5175,5176,5177,5178,5179,5180];\n        var i = 0;\n        var probeNext = function(){\n          if (i >= ports.length) return;\n          var origin = 'http://localhost:' + ports[i++];\n          try {\n            var probeUrl = origin + '/__fetch_remote?url=' + encodeURIComponent('https://example.com/');\n            fetch(probeUrl, { method: 'HEAD', mode: 'cors' }).then(function(res){\n              if (!res) return probeNext();\n              if (res.status === 404) return probeNext();\n              KG_PROXY_ORIGIN_RUNTIME = origin;\n              kgApplyMediaSrcToAll();\n            }).catch(function(){ probeNext(); });\n          } catch (e) {\n            probeNext();\n          }\n        };\n        probeNext();\n      } catch (e) {\n        void 0;\n      }\n    };\n\n    kgMaybeProbeProxyOrigin();\n",
  )

  out = replaceOnceExact(
    out,
    'var kgResolveMediaSrc = function(url, kind){',
    "var kgIsWeChatHotlinkProtectedAssetUrl = function(absUrl){\n      try {\n        var raw = String(absUrl || '').trim();\n        if (!/^https?:\\/\\//i.test(raw)) return false;\n        var p = new URL(raw);\n        var host = String(p.hostname || '').toLowerCase();\n        if (host === 'mmbiz.qpic.cn' || host.endsWith('.qpic.cn')) return true;\n        if (host === 'mmbiz.qlogo.cn' || host.endsWith('.qlogo.cn')) return true;\n        if (host === 'wx.qlogo.cn' || host.endsWith('.wx.qlogo.cn')) return true;\n        return false;\n      } catch (e) {\n        return false;\n      }\n    };\n\n    var kgBuildWebpageAssetPathProxyUrl = function(absUrl){\n      try {\n        var raw = String(absUrl || '').trim();\n        if (!raw) return '';\n        if (raw.startsWith('/__webpage_asset_path/')) return raw;\n        if (raw.startsWith('/__webpage_asset_proxy?url=')) return raw;\n        if (!/^https?:\\/\\//i.test(raw)) return raw;\n        var p = new URL(raw);\n        var originEnc = encodeURIComponent(p.origin);\n        var pp = String(p.pathname || '/');\n        var qq = String(p.search || '');\n        var out = '/__webpage_asset_path/' + originEnc + pp + qq;\n        try {\n          var origin = kgGetProxyOrigin();\n          if (/^https?:\\/\\//i.test(origin || '') && window && window.location && String(window.location.protocol || '') === 'file:') {\n            return String(origin).replace(/\\/+$/, '') + out;\n          }\n        } catch (e0) {\n          void 0;\n        }\n        return out;\n      } catch (e) {\n        return String(absUrl || '').trim();\n      }\n    };\n\n    var kgBuildWebpageMetaProxyUrl = function(absUrl){\n      try {\n        var raw = String(absUrl || '').trim();\n        if (!raw) return '';\n        var out = '/__webpage_meta?url=' + encodeURIComponent(raw);\n        try {\n          var origin = kgGetProxyOrigin();\n          if (/^https?:\\/\\//i.test(origin || '') && window && window.location && String(window.location.protocol || '') === 'file:') {\n            return String(origin).replace(/\\/+$/, '') + out;\n          }\n        } catch (e0) {\n          void 0;\n        }\n        return out;\n      } catch (e) {\n        return '';\n      }\n    };\n\n    var kgGetWebpageMetaCache = function(){\n      try {\n        var w = (typeof window !== 'undefined') ? window : null;\n        if (!w) return null;\n        if (!w.__kgWebpageMetaCache) w.__kgWebpageMetaCache = Object.create(null);\n        return w.__kgWebpageMetaCache;\n      } catch (e) {\n        return null;\n      }\n    };\n\n    var kgFetchWebpageMeta = function(absUrl, onDone){\n      try {\n        var url = String(absUrl || '').trim();\n        if (!url) return;\n        var cache = kgGetWebpageMetaCache();\n        var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;\n        var rec = (cache && cache[url]) ? cache[url] : null;\n        if (rec && rec.v && rec.exp && now && rec.exp > now) {\n          try { onDone && onDone(rec.v); } catch (e0) {}\n          return;\n        }\n        if (rec && rec.p) {\n          try { rec.p.then(function(v){ try { onDone && onDone(v); } catch (e0) {} }).catch(function(){ try { onDone && onDone(null); } catch (e1) {} }); } catch (e2) { try { onDone && onDone(null); } catch (e3) {} }\n          return;\n        }\n        var endpoint = kgBuildWebpageMetaProxyUrl(url);\n        if (!endpoint) { try { onDone && onDone(null); } catch (e4) {} return; }\n        var p = fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' } })\n          .then(function(res){\n            try { if (!res || !res.ok) return null; } catch (e0) { return null; }\n            try { return res.json(); } catch (e1) { return null; }\n          })\n          .then(function(json){\n            try {\n              if (!json || typeof json !== 'object' || Array.isArray(json)) return null;\n              if (json.ok !== true) return null;\n              return {\n                url: String(json.url || url),\n                title: String(json.title || ''),\n                siteName: String(json.siteName || ''),\n                imageUrl: String(json.imageUrl || ''),\n              };\n            } catch (e0) {\n              return null;\n            }\n          })\n          .catch(function(){ return null; });\n        if (cache) {\n          cache[url] = { v: null, exp: now + 8 * 60 * 1000, p: p };\n        }\n        p.then(function(v){\n          try {\n            if (cache) cache[url] = { v: v, exp: now + 8 * 60 * 1000 };\n          } catch (e0) {}\n          try { onDone && onDone(v); } catch (e1) {}\n        }).catch(function(){\n          try { if (cache) cache[url] = { v: null, exp: now + 60 * 1000 }; } catch (e0) {}\n          try { onDone && onDone(null); } catch (e1) {}\n        });\n      } catch (e) {\n        try { onDone && onDone(null); } catch (e0) {}\n      }\n    };\n\n    var kgCreateWebpageSnapshotPreview = function(args){\n      try {\n        var url = String((args && args.url) || '').trim();\n        var title = String((args && args.title) || '').trim();\n        var host = '';\n        try { host = url ? String((new URL(url)).hostname || '').trim() : ''; } catch (e0) { host = ''; }\n\n        var wrap = document.createElement('div');\n        wrap.className = 'kg-mediaSnap';\n\n        var img = document.createElement('img');\n        img.className = 'kg-mediaSnapImg';\n        img.setAttribute('alt', title || host || 'Webpage');\n        img.loading = 'lazy';\n\n        var meta = document.createElement('div');\n        meta.className = 'kg-mediaSnapMeta';\n        var t = document.createElement('div');\n        t.className = 'kg-mediaSnapTitle';\n        t.textContent = title || host || url || 'Webpage';\n        var h = document.createElement('div');\n        h.className = 'kg-mediaSnapHost';\n        h.textContent = host || '';\n        meta.appendChild(t);\n        meta.appendChild(h);\n\n        wrap.appendChild(img);\n        wrap.appendChild(meta);\n\n        img.addEventListener('load', function(){\n          try { img.style.opacity = '1'; } catch (e0) {}\n        });\n\n        if (url) {\n          kgFetchWebpageMeta(url, function(m){\n            try {\n              if (!m) return;\n              var imageUrl = String((m && m.imageUrl) || '').trim();\n              var mTitle = String((m && m.title) || '').trim();\n              var siteName = String((m && m.siteName) || '').trim();\n              if (mTitle && (!title || t.textContent === host || t.textContent === url)) t.textContent = mTitle;\n              if (siteName && (!h.textContent || h.textContent === host)) h.textContent = siteName;\n              if (imageUrl) {\n                var resolved = kgShouldUseProxy() ? kgBuildWebpageAssetPathProxyUrl(imageUrl) : kgResolveMediaSrc(imageUrl, 'image');\n                img.src = resolved || kgResolveMediaSrc(imageUrl, 'image');\n              }\n            } catch (e0) {\n              void 0;\n            }\n          });\n        }\n\n        return wrap;\n      } catch (e) {\n        return null;\n      }\n    };\n\n    var kgResolveMediaSrc = function(url, kind){",
  )

  out = replaceOnceExact(
    out,
    "} else {\n          var iframe = document.createElement('iframe');\n          iframe.loading = 'eager';\n          iframe.referrerPolicy = 'no-referrer';\n          iframe.src = url;\n          body.appendChild(iframe);\n        }",
    "} else {\n          var useSnapshot = false;\n          try {\n            var srcDoc0 = String((n && (n.srcDoc || n.srcdoc)) || '');\n            if (srcDoc0 && String(srcDoc0).trim()) {\n              useSnapshot = false;\n            } else {\n              var direct = false;\n              try { direct = typeof kgIsDirectIframeEmbedUrl === 'function' ? kgIsDirectIframeEmbedUrl(url) : false; } catch (e0) { direct = false; }\n              var forceSnap = false;\n              try { forceSnap = (!direct) && (typeof kgShouldForceSnapshotUrl === 'function' ? kgShouldForceSnapshotUrl(url) : false); } catch (e1) { forceSnap = false; }\n              useSnapshot = (!mediaInteractive) || forceSnap;\n            }\n          } catch (e0) {\n            useSnapshot = (!mediaInteractive);\n          }\n\n          if (useSnapshot) {\n            try {\n              var snapUrl = '';\n              try { snapUrl = String((typeof openUrl !== 'undefined' && openUrl) ? openUrl : url); } catch (e1) { snapUrl = String(url || ''); }\n              var snap = kgCreateWebpageSnapshotPreview({ url: snapUrl, title: String(n && n.title ? n.title : '') });\n              if (snap) body.appendChild(snap);\n            } catch (e2) {\n              void 0;\n            }\n          } else {\n            var iframe = document.createElement('iframe');\n            iframe.loading = 'eager';\n            iframe.referrerPolicy = 'no-referrer';\n            iframe.src = url;\n            body.appendChild(iframe);\n          }\n        }",
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
    "map[nodeId] = { x: ox + dx, y: oy + dy };\n          return;",
    "map[nodeId] = { x: ox + dx, y: oy + dy };\n          try { scheduleEdgeGeometryUpdateForNode(nodeId); } catch (e0) {}\n          return;",
  )

  out = replaceOnceExact(
    out,
    'map[id] = { x: ox + dx, y: oy + dy };',
    'map[id] = { x: ox + dx, y: oy + dy };\n              try { scheduleEdgeGeometryUpdateForNode(id); } catch (e0) {}',
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
      try { kgPanelMode = String((window && window.localStorage) ? (window.localStorage.getItem('${LS_KEYS.renderRichMediaPanelMode}') || '') : ''); } catch (e0) { kgPanelMode = ''; }
      setMediaInteractive(String(kgPanelMode || '').trim() === 'embed');
    } catch (e8) {}
    try { set3dVisible(!!(root && root.classList && root.classList.contains('kg-canvas3d'))); } catch (e7) {}`,
  )

  out = replaceOnceExact(
    out,
    'var kgIsDirectIframeEmbedUrl = function(rawUrl){',
    "var kgInferMediaKindFromUrl2 = function(rawUrl){\n      try {\n        var u = String(rawUrl || '').trim();\n        if (!u) return '';\n        try {\n          var k0 = typeof kgInferMediaKindFromUrl === 'function' ? kgInferMediaKindFromUrl(u) : '';\n          if (k0) return k0;\n        } catch (e0) {\n          void 0;\n        }\n        try {\n          var p = new URL(u);\n          var host = String(p.hostname || '').toLowerCase();\n          var path = String(p.pathname || '').toLowerCase();\n          var query = String(p.search || '').toLowerCase();\n          var isWeChatAssetHost =\n            host === 'mmbiz.qpic.cn' || host.endsWith('.qpic.cn') ||\n            host === 'mmbiz.qlogo.cn' || host.endsWith('.qlogo.cn') ||\n            host === 'wx.qlogo.cn' || host.endsWith('.wx.qlogo.cn');\n          if (isWeChatAssetHost) {\n            if (path.indexOf('/mmbiz_png/') >= 0 || path.indexOf('/mmbiz_jpg/') >= 0 || path.indexOf('/mmbiz_gif/') >= 0 || path.indexOf('/mmbiz_webp/') >= 0) return 'image';\n            if (query.indexOf('wx_fmt=') >= 0 || query.indexOf('tp=') >= 0) return 'image';\n          }\n          if ((host === 'substackcdn.com' || host.endsWith('.substackcdn.com')) && path.indexOf('/image/fetch') >= 0) return 'image';\n        } catch (e1) {\n          void 0;\n        }\n        return '';\n      } catch (e) {\n        return '';\n      }\n    };\n\n    var kgIsDirectIframeEmbedUrl = function(rawUrl){",
  )

  out = replaceAllExact(
    out,
    'setFrontmatterEnabled(false);',
    `setFrontmatterEnabled(${args.initialFrontmatterEnabled === true ? 'true' : 'false'});`,
  )

  out = replaceAllExact(
    out,
    "setMediaInteractive(String(kgPanelMode || '').trim() === 'embed');",
    'setMediaInteractive(false);',
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
    "iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');\n          iframe.setAttribute('sandbox', kgResolveIframeSandbox(url));\n          var srcDoc = String((n && (n.srcDoc || n.srcdoc)) || '');\n          if (srcDoc && String(srcDoc).trim()) {\n            try { iframe.removeAttribute('src'); } catch (e0) {}\n            try { iframe.srcdoc = String(srcDoc); } catch (e1) {}\n          } else {\n            iframe.src = kgResolveMediaSrc(url, kind);\n          }",
  )

  const markdownBlockInteractionsSnippet = `var __kgMdDrag = null;

    function installMarkdownBlockInteractions(){
      try {
        if (!svg) return;
        if (svg.__kgMarkdownBlocksInstalled) return;
        svg.__kgMarkdownBlocksInstalled = true;
        var layer = svg.querySelector('g[data-kg-layer="markdown-design-blocks"]');
        if (!layer) return;

        try {
          window.addEventListener('pointermove', function(ev){
            try {
              if (!__kgMdDrag || !ev) return;
              if (ev.pointerId !== __kgMdDrag.pid) return;
              var baseSx0 = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;
              var baseSy0 = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;
              var dx = (Number(ev.clientX) - Number(__kgMdDrag.sx)) / Math.max(0.001, state.k * baseSx0);
              var dy = (Number(ev.clientY) - Number(__kgMdDrag.sy)) / Math.max(0.001, state.k * baseSy0);
              var nx = Number(__kgMdDrag.x0) + dx;
              var ny = Number(__kgMdDrag.y0) + dy;
              if (!isFinite(nx) || !isFinite(ny)) return;
              try { __kgMdDrag.fo.setAttribute('x', String(nx)); } catch (e0) {}
              try { __kgMdDrag.fo.setAttribute('y', String(ny)); } catch (e1) {}
              try {
                var aid = String((__kgMdDrag.anchorId || '') || (__kgMdDrag.fo && __kgMdDrag.fo.getAttribute ? (__kgMdDrag.fo.getAttribute('data-kg-anchor-node-id') || '') : '')).trim();
                if (aid && nodePosById && typeof nodePosById === 'object') {
                  var w = Number(__kgMdDrag.w);
                  var h = Number(__kgMdDrag.h);
                  if (!isFinite(w) || w <= 0) {
                    try { w = parseFloat(String(__kgMdDrag.fo.getAttribute('width') || 'NaN')); } catch (e2) { w = NaN; }
                  }
                  if (!isFinite(h) || h <= 0) {
                    try { h = parseFloat(String(__kgMdDrag.fo.getAttribute('height') || 'NaN')); } catch (e3) { h = NaN; }
                  }
                  var cx = isFinite(w) ? (nx + w / 2) : nx;
                  var cy = isFinite(h) ? (ny + h / 2) : ny;
                  nodePosById[aid] = { x: cx, y: cy };
                  try { scheduleEdgeGeometryUpdateForNode(aid); } catch (e4) { void 0; }
                }
              } catch (e5) { void 0; }
            } catch (e6) { void 0; }
          }, { passive: true });
          window.addEventListener('pointerup', function(ev){
            try {
              if (!__kgMdDrag || !ev) return;
              if (ev.pointerId !== __kgMdDrag.pid) return;
              __kgMdDrag = null;
            } catch (e0) { __kgMdDrag = null; }
          }, { passive: true });
          window.addEventListener('pointercancel', function(ev){
            try {
              if (!__kgMdDrag || !ev) return;
              if (ev.pointerId !== __kgMdDrag.pid) return;
              __kgMdDrag = null;
            } catch (e0) { __kgMdDrag = null; }
          }, { passive: true });
        } catch (eBind) { void 0; }

        var fos = layer.querySelectorAll('foreignObject');
        for (var i = 0; i < fos.length; i += 1) {
          var fo = fos[i];
          if (!fo || !fo.querySelector) continue;
          try { fo.style.pointerEvents = 'auto'; } catch (e0) {}
          var rootEl = null;
          try { rootEl = fo.querySelector('[data-kg-markdown-design-block],[data-kg-markdown-block-id]'); } catch (e1) { rootEl = null; }
          if (!rootEl) {
            try { rootEl = fo.firstElementChild; } catch (e2) { rootEl = null; }
          }
          if (rootEl && rootEl.style) {
            try { rootEl.style.pointerEvents = 'auto'; } catch (e3) {}
            try { rootEl.setAttribute('data-kg-md-panel', '1'); } catch (e4) {}
          }
          var header = null;
          try { header = rootEl && rootEl.querySelector ? rootEl.querySelector('[data-kg-media-panel-header="1"]') : null; } catch (e6) { header = null; }
          if (header && !header.__kgMdBound) {
            header.__kgMdBound = true;
            try { header.style.pointerEvents = 'auto'; header.style.cursor = 'grab'; header.style.touchAction = 'none'; } catch (e7) {}
            try {
              header.addEventListener('pointerdown', function(ev){
                try {
                  if (!ev || ev.button !== 0) return;
                  if (panHeld || pointerMode === 'pan' || ev.shiftKey) return;
                  try { ev.preventDefault(); } catch (e0) {}
                  try { ev.stopPropagation(); } catch (e1) {}
                  var x0 = parseFloat(String(fo.getAttribute('x') || '0'));
                  var y0 = parseFloat(String(fo.getAttribute('y') || '0'));
                  var ww = parseFloat(String(fo.getAttribute('width') || 'NaN'));
                  var hh = parseFloat(String(fo.getAttribute('height') || 'NaN'));
                  var aid = String((fo.getAttribute('data-kg-anchor-node-id') || '')).trim();
                  __kgMdDrag = { fo: fo, pid: ev.pointerId, sx: ev.clientX, sy: ev.clientY, x0: isFinite(x0) ? x0 : 0, y0: isFinite(y0) ? y0 : 0, w: isFinite(ww) ? ww : 0, h: isFinite(hh) ? hh : 0, anchorId: aid };
                } catch (e2) { void 0; }
              }, { passive: false });
            } catch (e8) { void 0; }
          }
        }
      } catch (e) { void 0; }
    }

    function updateOverlays(){`

  out = replaceOnceExact(out, 'function updateOverlays(){', markdownBlockInteractionsSnippet)

  out = replaceOnceExact(
    out,
    '      updateOverlays();',
    '      updateOverlays();\n      try { installMarkdownBlockInteractions(); } catch (e0) {}',
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
    'var x1 = Number(a.x);\n      var y1 = Number(a.y);\n      var x2 = Number(b.x);\n      var y2 = Number(b.y);',
    "var x1 = Number(a.x);\n      var y1 = Number(a.y);\n      var x2 = Number(b.x);\n      var y2 = Number(b.y);\n      try {\n        if (overlayFollowAnimation && svg && svg.__kgNodeOffsetById) {\n          var om = svg.__kgNodeOffsetById;\n          var oa = (om && om[src]) ? om[src] : null;\n          var ob = (om && om[tgt]) ? om[tgt] : null;\n          if (oa && isFinite(oa.x) && isFinite(oa.y)) { x1 += Number(oa.x); y1 += Number(oa.y); }\n          if (ob && isFinite(ob.x) && isFinite(ob.y)) { x2 += Number(ob.x); y2 += Number(ob.y); }\n        }\n      } catch (eOff) { void 0; }",
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

  out = replaceOnceExact(
    out,
    "if (anchorId) lastMdBoxById[anchorId] = boxVal;\n            }\n          }\n        }\n      } catch (mdErr) {}",
    "if (anchorId) lastMdBoxById[anchorId] = boxVal;\n            }\n          }\n        } else {\n          try {\n            var els0 = overlay && overlay.querySelectorAll ? overlay.querySelectorAll('[data-kg-markdown-design-block][data-kg-world-x][data-kg-world-y][data-kg-world-w][data-kg-world-h]') : null;\n            if (els0 && els0.length) {\n              var mdById0 = overlay.__kgMdById || (overlay.__kgMdById = {});\n              var lastMdBoxById0 = overlay.__kgMdBoxById || (overlay.__kgMdBoxById = {});\n              var baseSx0b = (svgBase && isFinite(svgBase.sx) && svgBase.sx > 0) ? svgBase.sx : 1;\n              var baseSy0b = (svgBase && isFinite(svgBase.sy) && svgBase.sy > 0) ? svgBase.sy : 1;\n              var ox0b = (svgBase && isFinite(svgBase.ox)) ? svgBase.ox : 0;\n              var oy0b = (svgBase && isFinite(svgBase.oy)) ? svgBase.oy : 0;\n              for (var ei = 0; ei < els0.length; ei += 1) {\n                var el0 = els0[ei];\n                if (!el0 || !el0.getAttribute) continue;\n                var bid0 = String(el0.getAttribute('data-kg-markdown-design-block') || el0.getAttribute('data-md-id') || '').trim();\n                var anchorId0 = String(el0.getAttribute('data-kg-anchor-node-id') || '').trim();\n                if (!bid0 && !anchorId0) continue;\n                if (bid0 && !mdById0[bid0]) mdById0[bid0] = el0;\n                if (anchorId0 && !mdById0[anchorId0]) mdById0[anchorId0] = el0;\n                var xw0 = parseFloat(el0.getAttribute('data-kg-world-x') || 'NaN');\n                var yw0 = parseFloat(el0.getAttribute('data-kg-world-y') || 'NaN');\n                var ww0 = parseFloat(el0.getAttribute('data-kg-world-w') || 'NaN');\n                var hh0 = parseFloat(el0.getAttribute('data-kg-world-h') || 'NaN');\n                if (!isFinite(xw0) || !isFinite(yw0) || !isFinite(ww0) || !isFinite(hh0) || !(ww0 > 0) || !(hh0 > 0)) continue;\n                var left0 = xw0 * state.k * baseSx0b + state.x + ox0b;\n                var top0 = yw0 * state.k * baseSy0b + state.y + oy0b;\n                var sw0 = ww0 * state.k * baseSx0b;\n                var sh0 = hh0 * state.k * baseSy0b;\n                var il0 = Math.round(left0);\n                var it0 = Math.round(top0);\n                var iw0 = Math.max(1, Math.round(sw0));\n                var ih0 = Math.max(1, Math.round(sh0));\n                var key0 = anchorId0 || bid0;\n                var prev0 = lastMdBoxById0[key0] || null;\n                if (!prev0 || prev0.left !== il0 || prev0.top !== it0 || prev0.w !== iw0 || prev0.h !== ih0 || prev0.display !== 'block') {\n                  applyPanelBox(el0, { left: il0, top: it0, w: iw0, h: ih0, display: 'block', zIndex: 1 });\n                  var boxVal0 = { left: il0, top: it0, w: iw0, h: ih0, display: 'block' };\n                  if (bid0) lastMdBoxById0[bid0] = boxVal0;\n                  if (anchorId0) lastMdBoxById0[anchorId0] = boxVal0;\n                  try { scheduleEdgeGeometryUpdateForNode(key0); } catch (e1) {}\n                }\n              }\n            }\n          } catch (e0) {}\n        }\n      } catch (mdErr) {}",
  )

  out = replaceAllExact(
    out,
    "lastBoxById[id] = { left: left, top: top, w: panelW, h: panelH, display: 'block' };",
    "lastBoxById[id] = { left: left, top: top, w: panelW, h: panelH, display: 'block' };\n          try { scheduleEdgeGeometryUpdateForNode(id); } catch (e0) {}",
  )

  out = replaceAllExact(
    out,
    "if (bid) lastMdBoxById[bid] = boxVal;\n              if (anchorId) lastMdBoxById[anchorId] = boxVal;",
    "if (bid) lastMdBoxById[bid] = boxVal;\n              if (anchorId) lastMdBoxById[anchorId] = boxVal;\n              try { scheduleEdgeGeometryUpdateForNode(anchorId || bid); } catch (e0) {}",
  )

  out = replaceOnceExact(
    out,
    "var mdBoxById = overlay.__kgMdBoxById || {};\n          if (markdownBlocks && markdownBlocks.length) {\n            for (var mi3 = 0; mi3 < markdownBlocks.length; mi3 += 1) {",
    "var mdBoxById = overlay.__kgMdBoxById || {};\n          var hasMdBlocks0 = !!(markdownBlocks && markdownBlocks.length);\n          if (hasMdBlocks0) {\n            for (var mi3 = 0; mi3 < markdownBlocks.length; mi3 += 1) {",
  )

  out = replaceOnceExact(
    out,
    "              if (!prev1 || Math.abs((Number(prev1.x) || 0) - dx1) > 0.5 || Math.abs((Number(prev1.y) || 0) - dy1) > 0.5) {\n                offMap[key1] = { x: dx1, y: dy1 };\n                try { scheduleEdgeGeometryUpdateForNode(key1); } catch (e1) {}\n              }\n            }\n          }\n        }\n      } catch (errOff) {}\n    }\n\n    function onWheel(e){",
    "              if (!prev1 || Math.abs((Number(prev1.x) || 0) - dx1) > 0.5 || Math.abs((Number(prev1.y) || 0) - dy1) > 0.5) {\n                offMap[key1] = { x: dx1, y: dy1 };\n                try { scheduleEdgeGeometryUpdateForNode(key1); } catch (e1) {}\n              }\n            }\n          }\n          if (!hasMdBlocks0 && mdBoxById) {\n            for (var mid0 in mdBoxById) {\n              if (!Object.prototype.hasOwnProperty.call(mdBoxById, mid0)) continue;\n              var key2 = String(mid0 || '').trim();\n              if (!key2) continue;\n              var p2 = nodePosById && nodePosById[key2] ? nodePosById[key2] : null;\n              var box2 = mdBoxById[key2] || null;\n              if (!p2 || !box2) continue;\n              var x2 = Number(p2.x);\n              var y2 = Number(p2.y);\n              if (!isFinite(x2) || !isFinite(y2)) continue;\n              var csx = x2 * state.k * baseSx1 + state.x + ox1;\n              var csy = y2 * state.k * baseSy1 + state.y + oy1;\n              var dx2 = (Number(box2.left) || 0) + (Number(box2.w) || 0) * 0.5 - csx;\n              var dy2 = (Number(box2.top) || 0) + (Number(box2.h) || 0) * 0.5 - csy;\n              var prev2 = offMap[key2] || null;\n              if (!prev2 || Math.abs((Number(prev2.x) || 0) - dx2) > 0.5 || Math.abs((Number(prev2.y) || 0) - dy2) > 0.5) {\n                offMap[key2] = { x: dx2, y: dy2 };\n                try { scheduleEdgeGeometryUpdateForNode(key2); } catch (e2) {}\n              }\n            }\n          }\n        }\n      } catch (errOff) {}\n    }\n\n    function onWheel(e){",
  )

  out = replaceAllExact(
    out,
    "var xid2 = String(ex2.getAttribute('data-node-id') || '').trim();",
    "var xid2 = __kgResolveNodeId(String(ex2.getAttribute('data-node-id') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "var xanchor = String(ex.getAttribute('data-kg-anchor-node-id') || '').trim();",
    "var xanchor = __kgResolveNodeId(String(ex.getAttribute('data-kg-anchor-node-id') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "var src = String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim();\n      var tgt = String(edgeEl.getAttribute('data-target-id') || edgeEl.getAttribute('data-target') || '').trim();",
    "var src = __kgResolveNodeId(String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim());\n      var tgt = __kgResolveNodeId(String(edgeEl.getAttribute('data-target-id') || edgeEl.getAttribute('data-target') || '').trim());",
  )

  out = replaceAllExact(
    out,
    "el.setAttribute('data-kg-canvas-wheel-ignore', 'true');",
    '',
  )

  out = replaceAllExact(
    out,
    "var UI_IGNORE_SELECTOR = '[data-kg-canvas-wheel-ignore=\"true\"], [data-kg-canvas-pointer-ignore=\"true\"]';",
    "var UI_IGNORE_SELECTOR = '#kg-hud, #kg-hud *';",
  )

  if (!out.includes('var markdownBlocks =')) {
    const mediaDecl = out.match(/var\s+mediaNodes\s*=\s*[\s\S]*?;/)
    if (mediaDecl && mediaDecl.index != null) {
      const ix = mediaDecl.index + mediaDecl[0].length
      out = `${out.slice(0, ix)}\n    var markdownBlocks = ${safeMarkdownBlocksJson};${out.slice(ix)}`
    } else {
      const anchor = "var nodeMetaById = "
      const ix = out.indexOf(anchor)
      if (ix >= 0) {
        out = `${out.slice(0, ix)}var markdownBlocks = ${safeMarkdownBlocksJson};\n    ${out.slice(ix)}`
      } else {
        out = `var markdownBlocks = ${safeMarkdownBlocksJson};\n` + out
      }
    }
  }

  out = replaceAllExact(out, '__KG_PROXY_ORIGIN__', JSON.stringify(String(args.proxyOrigin || '')))
  return out
}
