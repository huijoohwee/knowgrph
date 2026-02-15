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
  if (!/content-security-policy/i.test(raw)) return raw
  return raw.replace(/<meta\s+[^>]*http-equiv\s*=\s*("|')?content-security-policy\1?[^>]*>/gi, '')
}

const stripRefreshMeta = (html: string): string => {
  const raw = String(html || '')
  if (!/http-equiv/i.test(raw)) return raw
  return raw.replace(/<meta\s+[^>]*http-equiv\s*=\s*("|')?refresh\1?[^>]*>/gi, '')
}

const stripScriptTags = (html: string): string => {
  const raw = String(html || '')
  if (!/<script\b/i.test(raw)) return raw
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
  if (/http-equiv\s*=\s*("|')?content-security-policy\1?/i.test(raw)) {
    return raw.replace(/<meta\s+[^>]*http-equiv\s*=\s*("|')?content-security-policy\1?[^>]*>/i, injection)
  }
  const headMatch = /<head\b[^>]*>/i.exec(raw)
  if (headMatch && typeof headMatch.index === 'number') {
    const end = headMatch.index + headMatch[0].length
    return `${raw.slice(0, end)}\n${injection}\n${raw.slice(end)}`
  }
  const htmlMatch = /<html\b[^>]*>/i.exec(raw)
  if (htmlMatch && typeof htmlMatch.index === 'number') {
    const end = htmlMatch.index + htmlMatch[0].length
    return `${raw.slice(0, end)}\n<head>\n${injection}\n</head>\n${raw.slice(end)}`
  }
  return `<!doctype html><html><head>\n${injection}\n</head><body>\n${raw}\n</body></html>`
}

const upsertBaseTag = (html: string, baseHref: string): string => {
  const raw = String(html || '')
  const href = String(baseHref || '').trim()
  if (!href) return raw
  const injection = `<base href="${escapeHtml(href)}">`
  if (/<\s*base\b/i.test(raw)) {
    return raw.replace(/<\s*base\b[^>]*>/i, injection)
  }
  const headMatch = /<head\b[^>]*>/i.exec(raw)
  if (headMatch && typeof headMatch.index === 'number') {
    const end = headMatch.index + headMatch[0].length
    return `${raw.slice(0, end)}\n${injection}\n${raw.slice(end)}`
  }
  const htmlMatch = /<html\b[^>]*>/i.exec(raw)
  if (htmlMatch && typeof htmlMatch.index === 'number') {
    const end = htmlMatch.index + htmlMatch[0].length
    return `${raw.slice(0, end)}\n<head>\n${injection}\n</head>\n${raw.slice(end)}`
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
  if (raw.includes('kg-scroll-sync')) return raw
  const injection = SCROLL_SYNC_SCRIPT
  const headMatch = /<head\b[^>]*>/i.exec(raw)
  if (headMatch && typeof headMatch.index === 'number') {
    const end = headMatch.index + headMatch[0].length
    return `${raw.slice(0, end)}\n${injection}\n${raw.slice(end)}`
  }
  const htmlMatch = /<html\b[^>]*>/i.exec(raw)
  if (htmlMatch && typeof htmlMatch.index === 'number') {
    const end = htmlMatch.index + htmlMatch[0].length
    return `${raw.slice(0, end)}\n<head>\n${injection}\n</head>\n${raw.slice(end)}`
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

const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0))

const fetchBoundedText = async (res: Response, limit: number, onProgress?: (bytes: number) => void): Promise<string> => {
  if (!res.body) return await res.text()
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  let lastProgressAt = 0
  let lastYieldAtBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        bytes += value.byteLength
        text += decoder.decode(value, { stream: true })
        
        const now = Date.now()
        if (onProgress && now - lastProgressAt > 100) {
          onProgress(bytes)
          lastProgressAt = now
        }
        
        if (bytes - lastYieldAtBytes > 500_000) {
          await yieldToMain()
          lastYieldAtBytes = bytes
        }

        if (bytes > limit) {
           throw new Error(`Response too large (> ${(limit / 1024 / 1024).toFixed(1)}MB)`)
        }
      }
    }
  } finally {
    try { reader.cancel() } catch { void 0 }
  }
  text += decoder.decode()
  if (onProgress) onProgress(bytes)
  return text
}

const createAbortError = (): Error => {
  const err = new Error('Aborted') as Error & { name?: string }
  err.name = 'AbortError'
  return err
}

const setTimeoutFn: (handler: () => void, timeout?: number) => number =
  typeof window !== 'undefined' && typeof window.setTimeout === 'function'
    ? (handler, timeout) => window.setTimeout(handler, timeout)
    : (handler, timeout) => setTimeout(handler, timeout) as unknown as number

const clearTimeoutFn: (id: number) => void =
  typeof window !== 'undefined' && typeof window.clearTimeout === 'function'
    ? (id) => window.clearTimeout(id)
    : (id) => {
        clearTimeout(id as unknown as any)
      }

const withAbort = async <T,>(p: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (!signal) return await p
  if (signal.aborted) throw createAbortError()
  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup()
      reject(createAbortError())
    }
    const cleanup = () => {
      try {
        signal.removeEventListener('abort', onAbort)
      } catch {
        void 0
      }
    }
    try {
      signal.addEventListener('abort', onAbort, { once: true })
    } catch {
      void 0
    }
    void p.then(
      (v) => {
        cleanup()
        resolve(v)
      },
      (e) => {
        cleanup()
        reject(e)
      },
    )
  })
}

const fetchCached = (key: string, run: (signal: AbortSignal) => Promise<string>, signal: AbortSignal): Promise<string> => {
  const cached = CACHE.get(key)
  if (cached) {
    if (signal?.aborted) return Promise.reject(createAbortError())
    return Promise.resolve(cached.html)
  }

  const inflight = INFLIGHT.get(key)
  if (inflight) return withAbort(inflight, signal)

  const ctrl = new AbortController()
  const timeoutId = setTimeoutFn(() => {
    try {
      ctrl.abort()
    } catch {
      void 0
    }
  }, 30_000)

  const p = run(ctrl.signal)
    .then((html) => {
      CACHE.set(key, { html, atMs: Date.now() })
      if (CACHE.size > CACHE_MAX) {
        const oldest = CACHE.keys().next().value as string | undefined
        if (oldest) CACHE.delete(oldest)
      }
      return html
    })
    .finally(() => {
      try {
        clearTimeoutFn(timeoutId)
      } catch {
        void 0
      }
      INFLIGHT.delete(key)
    })

  INFLIGHT.set(key, p)
  return withAbort(p, signal)
}

export async function fetchWebpageHtmlViaProxy(args: { url: string; signal: AbortSignal; onProgress?: (bytes: number) => void }): Promise<string> {
  const u = String(args.url || '').trim()
  if (!u) return ''
  const key = `proxy:${u}`
  return fetchCached(
    key,
    async (signal) => {
      const res = await fetch(`/__webpage_proxy?url=${encodeURIComponent(u)}`, { signal, headers: { Accept: 'text/html,*/*;q=0.9' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await fetchBoundedText(res, 5_000_000, args.onProgress)
    },
    args.signal,
  )
}
export async function fetchWebpageHtmlAuto(args: { url: string; signal: AbortSignal; onProgress?: (bytes: number) => void }): Promise<string> {
  return await fetchWebpageHtmlViaProxy(args)
}

export async function fetchWebpageConversionJsonViaConvert(args: {
  url: string
  includeImages: boolean
  signal: AbortSignal
}): Promise<string> {
  void args.includeImages
  const u = String(args.url || '').trim()
  if (!u) return ''
  const key = `convert-json-client:${u}`
  return fetchCached(
    key,
    async () => {
      const { convertWebpageUrlToMarkdownViaBrowser } = await import('./webpageClientConvert')
      const res = await convertWebpageUrlToMarkdownViaBrowser({ url: u })
      if (res.ok !== true) throw new Error(res.error)
      return JSON.stringify({ ok: true, name: 'webpage.md', markdown: res.markdown, title: res.title, source_url: u, images: [] }, null, 2)
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

export const buildWebpageHtmlSrcdocAsync = async (args: {
  html: string
  baseHref: string
  scriptPolicy?: 'strip' | 'allow'
  onProgress?: (step: string) => void
}): Promise<string> => {
  const baseHref = String(args.baseHref || '').trim() || 'https://example.invalid/'
  const rawHtml = String(args.html || '')
  const scriptPolicy = args.scriptPolicy === 'allow' ? 'allow' : 'strip'
  
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

  if (rawHtml.length > 50_000) await yieldToMain()

  let current = rawHtml
  const stepYield = async (label: string) => {
    if (args.onProgress) args.onProgress(label)
    if (current.length > 50_000) await yieldToMain()
  }

  if (scriptPolicy === 'allow') {
    await stepYield('Sanitizing CSP')
    current = stripCspMeta(current)
    
    await stepYield('Sanitizing Refresh')
    current = stripRefreshMeta(current)
  } else {
    await stepYield('Sanitizing CSP')
    current = stripCspMeta(current)
    
    await stepYield('Sanitizing Refresh')
    current = stripRefreshMeta(current)
    
    await stepYield('Stripping Scripts')
    current = stripScriptTags(current)
    
    await stepYield('Stripping Handlers')
    current = stripInlineEventHandlers(current)
  }

  await stepYield('Injecting Base')
  const csp = scriptPolicy === 'allow'
    ? "default-src https: http: data: blob:; img-src https: http: data: blob:; media-src https: http: data: blob:; style-src 'unsafe-inline' https: http:; font-src https: http: data: blob:; connect-src https: http: ws: wss:; frame-src https: http:; worker-src blob: data:; script-src 'unsafe-inline' 'unsafe-eval' https: http: blob: data:"
    : "default-src 'none'; img-src https: http: data: blob:; media-src https: http: data: blob:; style-src 'unsafe-inline' https: http:; font-src https: http: data: blob:; connect-src https: http:; frame-src https: http:; script-src 'unsafe-inline'"
  
  const withBase = upsertBaseTag(current, chosen)
  
  await stepYield('Injecting CSP')
  const withCsp = upsertSandboxCspMeta(withBase, csp)
  
  await stepYield('Injecting Scroll Sync')
  const built = injectScrollSync(withCsp)

  SRCDOC_CACHE.set(cacheKey, built)
  if (SRCDOC_CACHE.size > SRCDOC_CACHE_MAX) {
    const oldest = SRCDOC_CACHE.keys().next().value as string | undefined
    if (oldest) SRCDOC_CACHE.delete(oldest)
  }

  return built
}

export const buildWebpageHtmlSrcdoc = (args: { html: string; baseHref: string; scriptPolicy?: 'strip' | 'allow' }): string => {
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

  const scriptPolicy = args.scriptPolicy === 'allow' ? 'allow' : 'strip'
  let current = rawHtml
  if (scriptPolicy === 'allow') {
    current = stripRefreshMeta(stripCspMeta(current))
  } else {
    current = stripInlineEventHandlers(stripScriptTags(stripRefreshMeta(stripCspMeta(current))))
  }

  const csp = scriptPolicy === 'allow'
    ? "default-src https: http: data: blob:; img-src https: http: data: blob:; media-src https: http: data: blob:; style-src 'unsafe-inline' https: http:; font-src https: http: data: blob:; connect-src https: http: ws: wss:; frame-src https: http:; worker-src blob: data:; script-src 'unsafe-inline' 'unsafe-eval' https: http: blob: data:"
    : "default-src 'none'; img-src https: http: data: blob:; media-src https: http: data: blob:; style-src 'unsafe-inline' https: http:; font-src https: http: data: blob:; connect-src https: http:; frame-src https: http:; script-src 'unsafe-inline'"

  const withBase = upsertBaseTag(current, baseHref)
  const withCsp = upsertSandboxCspMeta(withBase, csp)
  return injectScrollSync(withCsp)
}
