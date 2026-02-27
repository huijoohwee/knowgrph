export type WebpageDomExportMode = 'text' | 'html' | 'layout'

export type WebpageDomExportResult = { text: string; title: string; clipped: boolean; diag?: string }

export type WebpageDomProbeResult =
  | { ok: true; result: WebpageDomExportResult }
  | { ok: false; stage: string; error: string; attempts?: { src: string; sandbox: string }[] }

const KG_EXPORT_DOM_KIND = 'kg-export-dom'
const KG_WEBPAGE_NET_KIND = 'kg-webpage-net'

async function waitMs(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

export async function exportWebpageDomViaHiddenIframe(args: {
  url: string
  mode: WebpageDomExportMode
  timeoutMs?: number
  maxChars?: number
  maxElements?: number
  scrollCrawl?: boolean
  expandFaq?: boolean
  waitForNetworkIdle?: boolean
  networkIdleMs?: number
  minWaitAfterLoadMs?: number
}): Promise<WebpageDomExportResult | null> {
  const probe = await probeWebpageDomViaHiddenIframe(args)
  return probe.ok ? probe.result : null
}

export async function probeWebpageDomViaHiddenIframe(args: {
  url: string
  mode: WebpageDomExportMode
  timeoutMs?: number
  maxChars?: number
  maxElements?: number
  scrollCrawl?: boolean
  expandFaq?: boolean
  waitForNetworkIdle?: boolean
  networkIdleMs?: number
  minWaitAfterLoadMs?: number
}): Promise<WebpageDomProbeResult> {
  const url = String(args.url || '').trim()
  if (!url) return { ok: false, stage: 'init', error: 'Missing url' }

  const timeoutMs = Math.max(2000, Math.min(60_000, Math.floor(args.timeoutMs ?? 20_000)))
  const maxChars = Math.max(100_000, Math.min(12_000_000, Math.floor(args.maxChars ?? 8_000_000)))
  const waitForNetworkIdle = args.waitForNetworkIdle !== false
  const networkIdleMs = Math.max(150, Math.min(2500, Math.floor(args.networkIdleMs ?? 600)))
  const minWaitAfterLoadMs = Math.max(0, Math.min(5000, Math.floor(args.minWaitAfterLoadMs ?? 350)))

  const iframe = document.createElement('iframe')
  iframe.setAttribute('referrerpolicy', 'no-referrer')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '900px'
  iframe.style.height = '700px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'

  const iframePath = `/__webpage_proxy?url=${encodeURIComponent(url)}`
  const candidates = (() => {
    const out: { src: string; sandbox: string }[] = []
    const seen = new Set<string>()
    const push = (src: string, sandbox: string) => {
      const key = `${sandbox}|${src}`
      if (seen.has(key)) return
      seen.add(key)
      out.push({ src, sandbox })
    }
    push(iframePath, 'allow-scripts allow-same-origin')
    push(iframePath, 'allow-scripts')
    try {
      const loc = typeof window !== 'undefined' && window.location ? window.location : null
      const host = String(loc?.hostname || '')
      const port = String(loc?.port || '')
      const protocol = String(loc?.protocol || 'http:')
      const abs = (h: string) => `${protocol}//${h}${port ? `:${port}` : ''}${iframePath}`
      if (host && host !== '127.0.0.1') push(abs('127.0.0.1'), 'allow-scripts allow-same-origin')
      if (host && host !== 'localhost') push(abs('localhost'), 'allow-scripts allow-same-origin')
    } catch {
      void 0
    }
    return out
  })()

  try {
    let loadedCandidate: { src: string; sandbox: string } | null = null
    const loaded = await (async () => {
      document.body.appendChild(iframe)
      const perAttemptTimeout = Math.max(1500, Math.min(7000, Math.floor(timeoutMs / 2)))
      for (const cand of candidates) {
        const ok = await new Promise<boolean>((resolve) => {
          let settled = false
          const done = (v: boolean) => {
            if (settled) return
            settled = true
            clearTimeout(timeoutId)
            iframe.removeEventListener('load', onLoad)
            resolve(v)
          }
          const onLoad = () => done(true)
          const timeoutId = setTimeout(() => done(false), perAttemptTimeout)
          iframe.addEventListener('load', onLoad)
          try {
            iframe.setAttribute('sandbox', cand.sandbox)
          } catch {
            void 0
          }
          iframe.src = cand.src
        })
        if (ok) {
          loadedCandidate = cand
          return true
        }
      }
      return false
    })()
    if (!loaded) return { ok: false, stage: 'load', error: 'Iframe load timeout', attempts: candidates }

    const win = iframe.contentWindow
    if (!win) return { ok: false, stage: 'contentWindow', error: 'Missing iframe.contentWindow', attempts: loadedCandidate ? [loadedCandidate] : candidates }

    const id = `${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`

    const tryDirectRead = (): WebpageDomExportResult | null => {
      try {
        const doc = iframe.contentDocument
        if (!doc) return null
        const title = String(doc.title || '').trim()
        if (args.mode === 'text') {
          const body = doc.body
          const innerText = body && typeof body.innerText === 'string' ? body.innerText : ''
          const visibleText = String(innerText || '').replace(/\s+/g, ' ').trim()
          const cleanedText = (() => {
            try {
              if (!body) return ''
              const cloned = body.cloneNode(true) as HTMLElement
              try {
                cloned.querySelectorAll('script,style,noscript,template').forEach((el) => el.remove())
              } catch {
                void 0
              }
              const raw = String(cloned.textContent || '').replace(/\s+/g, ' ').trim()
              if (!visibleText && /(^|\\W)(self\\.__next_f|__next_f|__NEXT_DATA__)(\\W|$)/.test(raw)) return ''
              return raw
            } catch {
              return ''
            }
          })()
          const text = visibleText || cleanedText
          if (!text && !title) return null
          const payload = {
            ok: false,
            stage: 'export',
            error: 'No postMessage response; used direct DOM read',
            href: (() => {
              try {
                const w = iframe.contentWindow
                return String(w?.location?.href || '')
              } catch {
                return ''
              }
            })(),
            readyState: String(doc.readyState || ''),
            title,
            usedTextSource: visibleText ? 'innerText' : cleanedText ? 'cleanTextContent' : 'none',
            bodyTextLen: text.length,
            scripts: (() => {
              try {
                return Array.from(doc.querySelectorAll('script[src]'))
                  .slice(0, 80)
                  .map(s => String(s.getAttribute('src') || ''))
              } catch {
                return []
              }
            })(),
            links: (() => {
              try {
                return Array.from(doc.querySelectorAll('link[href]'))
                  .slice(0, 80)
                  .map(l => String(l.getAttribute('href') || ''))
              } catch {
                return []
              }
            })(),
          }
          return { text: text.slice(0, maxChars), title, clipped: text.length > maxChars, diag: JSON.stringify(payload).slice(0, 18000) }
        }
        if (args.mode === 'layout') {
          const win = iframe.contentWindow
          if (!win) return null
          const safeStyleValue = (value: unknown) => {
            try {
              const v = String(value || '').trim()
              if (!v) return ''
              if (v.length > 240) return ''
              if (/url\s*\(|expression\s*\(|@import/i.test(v)) return ''
              if (!/^[a-zA-Z0-9\s().,%:/_+\-'\"#]+$/.test(v)) return ''
              const lower = v.toLowerCase()
              if (/javascript:|data:/.test(lower)) return ''
              return v
            } catch {
              return ''
            }
          }
          const isSkippableTag = (tag: string) => {
            const t = String(tag || '').toUpperCase()
            return (
              t === 'SCRIPT' ||
              t === 'STYLE' ||
              t === 'NOSCRIPT' ||
              t === 'TEMPLATE' ||
              t === 'META' ||
              t === 'LINK' ||
              t === 'HEAD' ||
              t === 'BASE'
            )
          }
          const isVisibleBox = (cs: CSSStyleDeclaration | null, rect: DOMRect | null) => {
            try {
              if (!rect) return false
              const w = Number(rect.width || 0)
              const h = Number(rect.height || 0)
              if (!(w > 2 && h > 2)) return false
              if (w * h < 24) return false
              if (!cs) return true
              const display = String(cs.display || '').toLowerCase()
              if (display === 'none') return false
              const vis = String(cs.visibility || '').toLowerCase()
              if (vis === 'hidden') return false
              const op = Number.parseFloat(String(cs.opacity || '1'))
              if (Number.isFinite(op) && op <= 0.02) return false
              return true
            } catch {
              return true
            }
          }
          const safeAttr = (el: { getAttribute?: ((name: string) => string | null) | null } | null, name: string) => {
            try {
              const v = typeof el?.getAttribute === 'function' ? el.getAttribute(name) || '' : ''
              const s = String(v || '').trim()
              if (!s) return ''
              if (s.length > 240) return ''
              return s
            } catch {
              return ''
            }
          }
          const safeText = (el: { textContent?: unknown } | null) => {
            try {
              const t = String(el?.textContent || '').replace(/\s+/g, ' ').trim()
              return t.length > 240 ? t.slice(0, 240) : t
            } catch {
              return ''
            }
          }
          const pickStyle = (cs: CSSStyleDeclaration | null) => {
            try {
              if (!cs) return null
              return {
                display: safeStyleValue(cs.display),
                position: safeStyleValue(cs.position),
                zIndex: safeStyleValue(cs.zIndex),
                backgroundColor: safeStyleValue((cs as unknown as { backgroundColor?: unknown }).backgroundColor),
                color: safeStyleValue((cs as unknown as { color?: unknown }).color),
                borderRadius: safeStyleValue((cs as unknown as { borderRadius?: unknown }).borderRadius),
                borderColor: safeStyleValue((cs as unknown as { borderColor?: unknown }).borderColor),
                borderWidth: safeStyleValue((cs as unknown as { borderWidth?: unknown }).borderWidth),
                padding: safeStyleValue((cs as unknown as { padding?: unknown }).padding),
                margin: safeStyleValue((cs as unknown as { margin?: unknown }).margin),
                gap: safeStyleValue((cs as unknown as { gap?: unknown }).gap),
                justifyContent: safeStyleValue((cs as unknown as { justifyContent?: unknown }).justifyContent),
                alignItems: safeStyleValue((cs as unknown as { alignItems?: unknown }).alignItems),
                flexDirection: safeStyleValue((cs as unknown as { flexDirection?: unknown }).flexDirection),
                flexWrap: safeStyleValue((cs as unknown as { flexWrap?: unknown }).flexWrap),
                fontSize: safeStyleValue((cs as unknown as { fontSize?: unknown }).fontSize),
                fontWeight: safeStyleValue((cs as unknown as { fontWeight?: unknown }).fontWeight),
                fontFamily: safeStyleValue((cs as unknown as { fontFamily?: unknown }).fontFamily),
                lineHeight: safeStyleValue((cs as unknown as { lineHeight?: unknown }).lineHeight),
                letterSpacing: safeStyleValue((cs as unknown as { letterSpacing?: unknown }).letterSpacing),
                textTransform: safeStyleValue((cs as unknown as { textTransform?: unknown }).textTransform),
                textAlign: safeStyleValue((cs as unknown as { textAlign?: unknown }).textAlign),
                boxShadow: safeStyleValue((cs as unknown as { boxShadow?: unknown }).boxShadow),
                opacity: safeStyleValue((cs as unknown as { opacity?: unknown }).opacity),
              }
            } catch {
              return null
            }
          }
          const idByEl = new WeakMap<object, string>()
          let nextId = 0
          const getId = (el: object | null) => {
            if (!el) return ''
            const prev = idByEl.get(el)
            if (prev) return prev
            nextId += 1
            const id = `e${nextId}`
            idByEl.set(el, id)
            return id
          }
          const root = doc.documentElement || doc.body
          const meta = {
            kind: 'layout',
            title: title || String(win.location?.hostname || '').trim(),
            href: String(args.url || '').trim(),
            viewport: { w: Number(win.innerWidth || 0) || 0, h: Number(win.innerHeight || 0) || 0 },
            scroll: {
              x: Number((win as unknown as { scrollX?: unknown }).scrollX || 0) || 0,
              y: Number((win as unknown as { scrollY?: unknown }).scrollY || 0) || 0,
              height: (() => {
                try {
                  const el = doc.scrollingElement || doc.documentElement || doc.body
                  return Number(el?.scrollHeight || 0) || 0
                } catch {
                  return 0
                }
              })(),
            },
            ts: Date.now(),
          }
          const els = Array.from((root as unknown as { querySelectorAll?: unknown }).querySelectorAll ? root.querySelectorAll('*') : [])
          const out: unknown[] = []
          const limit = typeof args.maxElements === 'number' && Number.isFinite(args.maxElements) ? Math.floor(args.maxElements) : 1400
          for (let i = 0; i < els.length; i += 1) {
            const el = els[i] as unknown as { tagName?: unknown; parentElement?: unknown; getBoundingClientRect?: unknown } | null
            const tagName = el && typeof el.tagName === 'string' ? el.tagName : ''
            if (!tagName) continue
            if (isSkippableTag(tagName)) continue
            let rect: DOMRect | null = null
            try {
              rect = typeof el?.getBoundingClientRect === 'function' ? (el.getBoundingClientRect as () => DOMRect)() : null
            } catch {
              rect = null
            }
            let cs: CSSStyleDeclaration | null = null
            try {
              cs = win.getComputedStyle ? win.getComputedStyle(el as unknown as Element) : null
            } catch {
              cs = null
            }
            if (!isVisibleBox(cs, rect)) continue
            const id = getId(el as unknown as object)
            const parent =
              el && el.parentElement && typeof el.parentElement === 'object' ? (el.parentElement as unknown as object) : null
            const pid = parent ? getId(parent) : ''
            const x = (rect ? Number(rect.left) : 0) + (Number((win as unknown as { scrollX?: unknown }).scrollX || 0) || 0)
            const y = (rect ? Number(rect.top) : 0) + (Number((win as unknown as { scrollY?: unknown }).scrollY || 0) || 0)
            const w = rect ? Number(rect.width) : 0
            const h = rect ? Number(rect.height) : 0
            const tag = String(tagName || '').toUpperCase()
            const attrs = {
              id: safeAttr(el as unknown as { getAttribute?: ((name: string) => string | null) | null }, 'id'),
              class: safeAttr(el as unknown as { getAttribute?: ((name: string) => string | null) | null }, 'class'),
              role: safeAttr(el as unknown as { getAttribute?: ((name: string) => string | null) | null }, 'role'),
              ariaLabel: safeAttr(el as unknown as { getAttribute?: ((name: string) => string | null) | null }, 'aria-label'),
              placeholder:
                tag === 'INPUT' || tag === 'TEXTAREA'
                  ? safeAttr(el as unknown as { getAttribute?: ((name: string) => string | null) | null }, 'placeholder')
                  : '',
              href: tag === 'A' ? safeAttr(el as unknown as { getAttribute?: ((name: string) => string | null) | null }, 'href') : '',
              src:
                tag === 'IMG' || tag === 'VIDEO' || tag === 'IFRAME'
                  ? safeAttr(el as unknown as { getAttribute?: ((name: string) => string | null) | null }, 'src')
                  : '',
              alt: tag === 'IMG' ? safeAttr(el as unknown as { getAttribute?: ((name: string) => string | null) | null }, 'alt') : '',
            }
            const inputValue =
              tag === 'INPUT' || tag === 'TEXTAREA'
                ? safeAttr(el as unknown as { getAttribute?: ((name: string) => string | null) | null }, 'value')
                : ''
            const text = (inputValue || '').trim() ? inputValue : attrs.placeholder || safeText(el as unknown as { textContent?: unknown })
            out.push({ id, pid, tag, rect: { x, y, w, h }, text, attrs, style: pickStyle(cs) })
            if (out.length >= Math.max(200, Math.min(3500, limit))) break
          }
          const payload = { meta, elements: out }
          const raw = JSON.stringify(payload)
          return {
            text: raw.slice(0, maxChars),
            title,
            clipped: raw.length > maxChars,
            diag: JSON.stringify({
              ok: false,
              stage: 'export',
              error: 'No postMessage response; used direct DOM read (layout)',
              readyState: String(doc.readyState || ''),
              title,
              elements: out.length,
            }).slice(0, 18000),
          }
        }
        const html = String(doc.documentElement?.outerHTML || '').trim()
        if (!html && !title) return null
        const payload = {
          ok: false,
          stage: 'export',
          error: 'No postMessage response; used direct DOM read',
          readyState: String(doc.readyState || ''),
          title,
          htmlLen: html.length,
        }
        return { text: html.slice(0, maxChars), title, clipped: html.length > maxChars, diag: JSON.stringify(payload).slice(0, 18000) }
      } catch {
        return null
      }
    }

    const waitNetIdle = async (): Promise<void> => {
      if (!waitForNetworkIdle) return
      let sawStatus = false
      let idleSince = 0
      await new Promise<void>((resolve) => {
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          clearTimeout(hardTimeout)
          clearTimeout(fallbackTimeout)
          window.removeEventListener('message', onMessage)
          resolve()
        }
        const onMessage = (e: MessageEvent) => {
          if (e.source !== win) return
          const d = e?.data as unknown
          if (!d || typeof d !== 'object') return
          const rec = d as Record<string, unknown>
          if (rec.kind !== KG_WEBPAGE_NET_KIND) return
          const pending = typeof rec.pending === 'number' ? rec.pending : NaN
          if (!Number.isFinite(pending)) return
          sawStatus = true
          if (pending === 0) {
            if (!idleSince) idleSince = Date.now()
            if (Date.now() - idleSince >= networkIdleMs) return done()
          } else {
            idleSince = 0
          }
        }
        const hardTimeout = setTimeout(done, Math.min(timeoutMs, 15_000))
        const fallbackTimeout = setTimeout(() => {
          if (!sawStatus) done()
        }, 1200)
        window.addEventListener('message', onMessage)
      })
      if (minWaitAfterLoadMs > 0) await waitMs(Math.min(minWaitAfterLoadMs, 1200))
    }

    const requestOnce = async (): Promise<WebpageDomExportResult | null> => {
      return await new Promise((resolve) => {
        let done = false
        const onMessage = (e: MessageEvent) => {
          if (e.source !== win) return
          const raw = e?.data as unknown
          if (!raw || typeof raw !== 'object') return
          const d = raw as Record<string, unknown>
          if (d.kind !== KG_EXPORT_DOM_KIND || d.id !== id) return
          if (done) return
          done = true
          clearTimeout(tid)
          window.removeEventListener('message', onMessage)
          resolve({
            text: String(d.text ?? ''),
            title: String(d.title ?? ''),
            clipped: Boolean(d.clipped),
            diag: String(d.diag ?? ''),
          })
        }
        const tid = setTimeout(() => {
          if (done) return
          done = true
          window.removeEventListener('message', onMessage)
          resolve(null)
        }, timeoutMs)
        window.addEventListener('message', onMessage)
        try {
          win.postMessage(
            {
              kind: KG_EXPORT_DOM_KIND,
              id,
              mode: args.mode,
              maxChars,
              maxElements: typeof args.maxElements === 'number' && Number.isFinite(args.maxElements) ? Math.floor(args.maxElements) : undefined,
              expandFaq: args.expandFaq !== false,
              scrollCrawl: !!args.scrollCrawl,
            },
            '*',
          )
        } catch {
          clearTimeout(tid)
          window.removeEventListener('message', onMessage)
          resolve(null)
        }
      })
    }

    await waitNetIdle()
    const first = await requestOnce()
    if (!first) {
      const direct = tryDirectRead()
      if (direct) return { ok: true, result: direct }
      return {
        ok: false,
        stage: 'export',
        error: 'No response to export request (postMessage timeout)',
        attempts: loadedCandidate ? [loadedCandidate] : candidates,
      }
    }
    const enableMultiSnapshot = args.mode === 'text' || args.mode === 'layout' || (args.mode === 'html' && !!args.scrollCrawl)
    if (!enableMultiSnapshot) return { ok: true, result: first }

    let best = first
    let stableRounds = 0
    const start = Date.now()
    const layoutScore = (raw: string): number => {
      try {
        const parsed = JSON.parse(String(raw || '')) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 0
        const obj = parsed as Record<string, unknown>
        const elements = obj.elements
        if (!Array.isArray(elements)) return 0
        return elements.length
      } catch {
        return 0
      }
    }
    let bestLayoutScore = args.mode === 'layout' ? layoutScore(best.text) : 0
    while (Date.now() - start < Math.min(timeoutMs, 55_000)) {
      await waitMs(900)
      await waitNetIdle()
      const next = await requestOnce()
      if (!next) break
      const improved = (() => {
        if (args.mode === 'layout') {
          const score = layoutScore(next.text)
          if (score > bestLayoutScore + 10) return true
          if (score > bestLayoutScore) return true
          return next.text.length > best.text.length + 1200
        }
        const minGain = args.mode === 'text' ? 40 : 500
        return next.text.length > best.text.length + minGain
      })()
      if (improved) {
        best = next
        if (args.mode === 'layout') bestLayoutScore = layoutScore(best.text)
        stableRounds = 0
      } else {
        stableRounds += 1
      }
      const minLen = args.mode === 'text' ? 1200 : args.mode === 'layout' ? 120_000 : 40_000
      const minScore = args.mode === 'layout' ? 350 : 0
      if (stableRounds >= 2 && best.text.length >= minLen && bestLayoutScore >= minScore) break
    }
    return { ok: true, result: best }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
    return { ok: false, stage: 'exception', error: msg || 'Iframe export failed', attempts: candidates }
  } finally {
    try {
      iframe.remove()
    } catch {
      void 0
    }
  }
}
