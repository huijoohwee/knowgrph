export type WebpageIframeMode = 'html' | 'json' | 'text'

export type WebsiteImportMeta = { importId: string; nodeId: string; outputDirRel?: string }

const CACHE = new Map<string, { html: string; atMs: number }>()
const INFLIGHT = new Map<string, Promise<string>>()

const CACHE_MAX = 24

const SRCDOC_CACHE = new Map<string, string>()
const SRCDOC_CACHE_MAX = 8

const hash32 = (s: string): string => {
  const str = String(s || '')
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

const escapeHtml = (raw: string): string =>
  String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const stripCspMeta = (html: string): string => {
  const raw = String(html || '')
  if (!raw.toLowerCase().includes('content-security-policy')) return raw
  return raw.replace(/<meta\s+[^>]*http-equiv\s*=\s*("|')?content-security-policy\1?[^>]*>/gi, '')
}

const stripRefreshMeta = (html: string): string => {
  const raw = String(html || '')
  if (!raw.toLowerCase().includes('http-equiv')) return raw
  return raw.replace(/<meta\s+[^>]*http-equiv\s*=\s*("|')?refresh\1?[^>]*>/gi, '')
}

const stripScriptTags = (html: string): string => {
  const raw = String(html || '')
  if (!raw.toLowerCase().includes('<script')) return raw
  return raw.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
}

const stripInlineEventHandlers = (html: string): string => {
  const raw = String(html || '')
  if (!/\son[a-z]+\s*=/.test(raw)) return raw
  return raw.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
}

const upsertSandboxCspMeta = (html: string, csp: string): string => {
  const raw = String(html || '')
  const content = String(csp || '').trim()
  if (!content) return raw
  const injection = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(content)}">`
  const lower = raw.toLowerCase()
  if (lower.includes('http-equiv') && lower.includes('content-security-policy')) {
    return raw.replace(/<meta\s+[^>]*http-equiv\s*=\s*("|')?content-security-policy\1?[^>]*>/i, injection)
  }
  const headOpen = lower.indexOf('<head')
  if (headOpen >= 0) {
    const headEnd = lower.indexOf('>', headOpen)
    if (headEnd >= 0) return `${raw.slice(0, headEnd + 1)}\n${injection}\n${raw.slice(headEnd + 1)}`
  }
  const htmlOpen = lower.indexOf('<html')
  if (htmlOpen >= 0) {
    const htmlEnd = lower.indexOf('>', htmlOpen)
    if (htmlEnd >= 0) return `${raw.slice(0, htmlEnd + 1)}\n<head>\n${injection}\n</head>\n${raw.slice(htmlEnd + 1)}`
  }
  return `<!doctype html><html><head>\n${injection}\n</head><body>\n${raw}\n</body></html>`
}

const upsertBaseTag = (html: string, baseHref: string): string => {
  const raw = String(html || '')
  const href = String(baseHref || '').trim()
  if (!href) return raw
  const lower = raw.toLowerCase()
  const injection = `<base href="${escapeHtml(href)}">`
  if (lower.includes('<base')) {
    return raw.replace(/<\s*base\b[^>]*>/i, injection)
  }
  const headOpen = lower.indexOf('<head')
  if (headOpen >= 0) {
    const headEnd = lower.indexOf('>', headOpen)
    if (headEnd >= 0) return `${raw.slice(0, headEnd + 1)}\n${injection}\n${raw.slice(headEnd + 1)}`
  }
  const htmlOpen = lower.indexOf('<html')
  if (htmlOpen >= 0) {
    const htmlEnd = lower.indexOf('>', htmlOpen)
    if (htmlEnd >= 0) return `${raw.slice(0, htmlEnd + 1)}\n<head>\n${injection}\n</head>\n${raw.slice(htmlEnd + 1)}`
  }
  return `<!doctype html><html><head>\n${injection}\n</head><body>\n${raw}\n</body></html>`
}

const SCROLL_SYNC_SCRIPT = (() => {
  const lines = [
    '<script>',
    '(function(){',
    '  var KG_SCROLL_SYNC_KIND = "kg-scroll-sync";',
    '  var lockOwner = null;',
    '  var lockUntil = 0;',
    '  var now = function(){ return Date.now ? Date.now() : +new Date(); };',
    '  var canSync = function(owner){',
    '    var t = now();',
    '    if (!lockOwner || t > lockUntil) { lockOwner = null; lockUntil = 0; return true; }',
    '    return lockOwner === owner;',
    '  };',
    '  var getScrollEl = function(){ return document.scrollingElement || document.documentElement || document.body; };',
    '  var clamp01 = function(n){ return n <= 0 ? 0 : n >= 1 ? 1 : n; };',
    '  var getRatio = function(){',
    '    var el = getScrollEl();',
    '    if (!el) return 0;',
    '    var max = Math.max(1, el.scrollHeight - el.clientHeight);',
    '    return clamp01(el.scrollTop / max);',
    '  };',
    '  var setRatio = function(r){',
    '    var el = getScrollEl();',
    '    if (!el) return;',
    '    var max = Math.max(0, el.scrollHeight - el.clientHeight);',
    '    el.scrollTop = Math.round(clamp01(r) * max);',
    '  };',
    '  var postRatio = function(){',
    '    try { window.parent && window.parent.postMessage({ kind: KG_SCROLL_SYNC_KIND, ratio: getRatio() }, "*"); } catch { void 0; }',
    '  };',
    '  var onScroll = function(){',
    '    if (!canSync("iframe")) return;',
    '    lockOwner = "iframe"; lockUntil = now() + 160;',
    '    postRatio();',
    '  };',
    '  try {',
    '    var el = getScrollEl();',
    '    if (el && el.addEventListener) el.addEventListener("scroll", onScroll, { passive: true });',
    '    window.addEventListener("message", function(e){',
    '      var d = e && e.data;',
    '      if (!d || d.kind !== KG_SCROLL_SYNC_KIND || typeof d.ratio !== "number") return;',
    '      if (!canSync("parent")) return;',
    '      lockOwner = "parent"; lockUntil = now() + 160;',
    '      setRatio(d.ratio);',
    '    });',
    '  } catch {',
    '    void 0;',
    '  }',
    '})();',
    '</script>',
  ]
  return lines.join('\n')
})()

export const injectScrollSync = (html: string): string => {
  const raw = String(html || '')
  const lower = raw.toLowerCase()
  if (lower.includes('kg-scroll-sync')) return raw
  const injection = SCROLL_SYNC_SCRIPT
  const headOpen = lower.indexOf('<head')
  if (headOpen >= 0) {
    const headEnd = lower.indexOf('>', headOpen)
    if (headEnd >= 0) return `${raw.slice(0, headEnd + 1)}\n${injection}\n${raw.slice(headEnd + 1)}`
  }
  const htmlOpen = lower.indexOf('<html')
  if (htmlOpen >= 0) {
    const htmlEnd = lower.indexOf('>', htmlOpen)
    if (htmlEnd >= 0) return `${raw.slice(0, htmlEnd + 1)}\n<head>\n${injection}\n</head>\n${raw.slice(htmlEnd + 1)}`
  }
  return `<!doctype html><html><head>\n${injection}\n</head><body>\n${raw}\n</body></html>`
}

export const buildCodeViewerSrcdoc = (args: { baseHref: string; title: string; mode: 'json' | 'text'; text: string }): string => {
  const title = escapeHtml(args.title)
  const baseHref = String(args.baseHref || '').trim() || 'https://example.invalid/'
  const label = args.mode === 'json' ? 'JSON' : 'Text'
  const rawText = String(args.text || '')
  const clippedText = rawText.length > 450_000 ? `${rawText.slice(0, 450_000)}\n\n…(clipped ${rawText.length - 450_000} chars)…` : rawText
  const body = escapeHtml(clippedText)
  const csp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"
  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`,
    `<base href="${escapeHtml(baseHref)}">`,
    `<title>${title}</title>`,
    '<style>',
    '  :root{color-scheme: dark light;}',
    '  body{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;}',
    '  header{position:sticky;top:0;z-index:1;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);color:#fff;padding:8px 12px;font-size:12px;display:flex;gap:8px;align-items:center;}',
    '  main{padding:12px;}',
    '  pre{margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.45;}',
    '</style>',
    '</head>',
    '<body>',
    `<header><strong>${label}</strong><span style="opacity:.7">sandboxed</span></header>`,
    `<main><pre>${body}</pre></main>`,
    '</body>',
    '</html>',
  ].join('\n')
  return injectScrollSync(html)
}

const fetchCached = async (key: string, run: (signal: AbortSignal) => Promise<string>, signal: AbortSignal): Promise<string> => {
  const cached = CACHE.get(key)
  if (cached) return cached.html
  const inflight = INFLIGHT.get(key)
  if (inflight) return inflight
  const p = run(signal).then((html) => {
    CACHE.set(key, { html, atMs: Date.now() })
    if (CACHE.size > CACHE_MAX) {
      const oldest = CACHE.keys().next().value as string | undefined
      if (oldest) CACHE.delete(oldest)
    }
    return html
  })
  INFLIGHT.set(key, p)
  try {
    return await p
  } finally {
    INFLIGHT.delete(key)
  }
}

export async function fetchWebpageHtmlViaProxy(args: { url: string; signal: AbortSignal }): Promise<string> {
  const u = String(args.url || '').trim()
  if (!u) return ''
  const key = `proxy:${u}`
  return fetchCached(
    key,
    async (signal) => {
      const res = await fetch(`/__webpage_proxy?url=${encodeURIComponent(u)}`, { signal, headers: { Accept: 'text/html,*/*;q=0.9' } })
      const text = await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return text
    },
    args.signal,
  )
}

export async function fetchWebpageConversionJsonViaConvert(args: {
  url: string
  includeImages: boolean
  signal: AbortSignal
}): Promise<string> {
  const u = String(args.url || '').trim()
  if (!u) return ''
  const key = `convert-json:${u}:img:${args.includeImages ? '1' : '0'}`
  return fetchCached(
    key,
    async (signal) => {
      const res = await fetch(`/__webpage_convert?url=${encodeURIComponent(u)}&includeImages=${args.includeImages ? 'true' : 'false'}`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return text
    },
    args.signal,
  )
}

export async function fetchWebsiteImportArtifact(args: {
  importId: string
  nodeId: string
  outputDirRel?: string
  kind: 'rawHtml' | 'markdown' | 'conversionJson'
  signal: AbortSignal
}): Promise<string> {
  const importId = String(args.importId || '').trim()
  const nodeId = String(args.nodeId || '').trim()
  const outputDirRel = String(args.outputDirRel || '').trim()
  const kind = args.kind
  if (!importId || !nodeId) return ''
  const key = `artifact:${outputDirRel}:${importId}:${nodeId}:${kind}`
  return fetchCached(
    key,
    async (signal) => {
      const outputDirQuery = outputDirRel ? `outputDirRel=${encodeURIComponent(outputDirRel)}&` : ''
      const res = await fetch(
        `/__website_import/artifact?${outputDirQuery}importId=${encodeURIComponent(importId)}&nodeId=${encodeURIComponent(nodeId)}&kind=${encodeURIComponent(kind)}`,
        { signal, headers: { Accept: '*/*' } },
      )
      const text = await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return text
    },
    args.signal,
  )
}

export const buildWebpageHtmlSrcdoc = (args: { html: string; baseHref: string }): string => {
  const baseHref = String(args.baseHref || '').trim() || 'https://example.invalid/'
  const rawHtml = String(args.html || '')
  if (rawHtml.length > 1_500_000) {
    return buildCodeViewerSrcdoc({
      baseHref,
      title: baseHref,
      mode: 'text',
      text: `HTML too large for sandboxed srcdoc (${rawHtml.length} chars).\n\nTip: switch to Markdown view, or reduce the HTML override.`,
    })
  }
  const looksProxied = rawHtml.includes('/__webpage_asset_proxy?url=') || rawHtml.includes('/__webpage_proxy?url=')
  const selfOriginBaseHref = (() => {
    try {
      const origin = typeof window !== 'undefined' && window.location && typeof window.location.origin === 'string' ? window.location.origin : ''
      return origin ? `${origin}/` : ''
    } catch {
      return ''
    }
  })()
  const chosen = looksProxied ? (selfOriginBaseHref || baseHref) : baseHref

  const cacheKey = `srcdoc:${chosen}:${rawHtml.length}:${hash32(rawHtml)}`
  const cached = SRCDOC_CACHE.get(cacheKey)
  if (cached) return cached

  const cleaned = stripInlineEventHandlers(stripScriptTags(stripRefreshMeta(stripCspMeta(rawHtml))))
  const csp =
    "default-src 'none'; img-src https: http: data: blob:; media-src https: http: data: blob:; style-src 'unsafe-inline' https: http:; font-src https: http: data: blob:; connect-src https: http:; frame-src https: http:; script-src 'unsafe-inline'"
  const withBase = upsertBaseTag(cleaned, chosen)
  const withCsp = upsertSandboxCspMeta(withBase, csp)
  const built = injectScrollSync(withCsp)

  SRCDOC_CACHE.set(cacheKey, built)
  if (SRCDOC_CACHE.size > SRCDOC_CACHE_MAX) {
    const oldest = SRCDOC_CACHE.keys().next().value as string | undefined
    if (oldest) SRCDOC_CACHE.delete(oldest)
  }

  return built
}
