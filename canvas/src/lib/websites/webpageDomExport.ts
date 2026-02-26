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
          return null
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
    const enableMultiSnapshot = args.mode === 'text' || (args.mode === 'html' && !!args.scrollCrawl)
    if (!enableMultiSnapshot) return { ok: true, result: first }

    let best = first
    let stableRounds = 0
    const start = Date.now()
    while (Date.now() - start < Math.min(timeoutMs, 55_000)) {
      await waitMs(900)
      await waitNetIdle()
      const next = await requestOnce()
      if (!next) break
      const minGain = args.mode === 'text' ? 40 : 500
      const improved = next.text.length > best.text.length + minGain
      if (improved) {
        best = next
        stableRounds = 0
      } else {
        stableRounds += 1
      }
      const minLen = args.mode === 'text' ? 1200 : 40_000
      if (stableRounds >= 2 && best.text.length >= minLen) break
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
