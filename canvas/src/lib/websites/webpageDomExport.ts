export type WebpageDomExportMode = 'text' | 'html'

export type WebpageDomExportResult = { text: string; title: string; clipped: boolean }

const KG_EXPORT_DOM_KIND = 'kg-export-dom'

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
}): Promise<WebpageDomExportResult | null> {
  const url = String(args.url || '').trim()
  if (!url) return null

  const timeoutMs = Math.max(2000, Math.min(60_000, Math.floor(args.timeoutMs ?? 20_000)))
  const maxChars = Math.max(100_000, Math.min(12_000_000, Math.floor(args.maxChars ?? 8_000_000)))

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

    const requestOnce = async (): Promise<WebpageDomExportResult | null> => {
      return await new Promise((resolve) => {
        let done = false
        const onMessage = (e: MessageEvent) => {
          if (e.source !== win) return
          const d = e && (e.data as any)
          if (!d || d.kind !== KG_EXPORT_DOM_KIND || d.id !== id) return
          if (done) return
          done = true
          clearTimeout(tid)
          window.removeEventListener('message', onMessage)
          resolve({
            text: String(d.text || ''),
            title: String(d.title || ''),
            clipped: !!d.clipped,
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

    const first = await requestOnce()
    if (!first) return null
    if (args.mode !== 'text') return first

    let best = first
    let stableRounds = 0
    const start = Date.now()
    while (Date.now() - start < Math.min(10_000, timeoutMs)) {
      await waitMs(650)
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

