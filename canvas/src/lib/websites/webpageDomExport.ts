export type WebpageDomExportMode = 'text' | 'html'

export type WebpageDomExportResult = { text: string; title: string; clipped: boolean }

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
  scrollCrawl?: boolean
  expandFaq?: boolean
  waitForNetworkIdle?: boolean
  networkIdleMs?: number
  minWaitAfterLoadMs?: number
}): Promise<WebpageDomExportResult | null> {
  const url = String(args.url || '').trim()
  if (!url) return null

  const timeoutMs = Math.max(2000, Math.min(60_000, Math.floor(args.timeoutMs ?? 20_000)))
  const maxChars = Math.max(100_000, Math.min(12_000_000, Math.floor(args.maxChars ?? 8_000_000)))
  const waitForNetworkIdle = args.waitForNetworkIdle !== false
  const networkIdleMs = Math.max(150, Math.min(2500, Math.floor(args.networkIdleMs ?? 600)))
  const minWaitAfterLoadMs = Math.max(0, Math.min(5000, Math.floor(args.minWaitAfterLoadMs ?? 350)))

  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.setAttribute('referrerpolicy', 'no-referrer')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '900px'
  iframe.style.height = '700px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'

  const proxySrc = `/__webpage_proxy?url=${encodeURIComponent(url)}`

  try {
    const loaded = await new Promise<boolean>((resolve) => {
      let settled = false
      const done = (v: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        iframe.removeEventListener('load', onLoad)
        resolve(v)
      }
      const onLoad = () => done(true)
      const timeoutId = setTimeout(() => done(false), Math.min(15_000, timeoutMs))
      iframe.addEventListener('load', onLoad)
      document.body.appendChild(iframe)
      iframe.src = proxySrc
    })
    if (!loaded) return null

    const win = iframe.contentWindow
    if (!win) return null

    const id = `${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`

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
    if (!first) return null
    if (args.mode !== 'text') return first

    let best = first
    let stableRounds = 0
    const start = Date.now()
    while (Date.now() - start < Math.min(timeoutMs, 25_000)) {
      await waitMs(650)
      await waitNetIdle()
      const next = await requestOnce()
      if (!next) break
      if (next.text.length >= best.text.length) best = next
      if (next.text.length <= best.text.length + 80) stableRounds += 1
      else stableRounds = 0
      if (stableRounds >= 2 && best.text.length >= 1200) break
    }
    return best
  } finally {
    try {
      iframe.remove()
    } catch {
      void 0
    }
  }
}
