import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { exportWebpageDomViaHiddenIframe } from '@/lib/websites/webpageDomExport'

const WEBPAGE_TEST_URL = 'https://docs.byteplus.com/'

const waitMs = async (ms: number) => {
  await new Promise<void>(resolve => setTimeout(resolve, ms))
}

const createEvent = (type: string): Event => {
  const Ctor = (window as unknown as { Event?: typeof Event }).Event
  if (typeof Ctor === 'function') return new Ctor(type)
  const e = document.createEvent('Event')
  e.initEvent(type, false, false)
  return e
}

const createMessageEvent = (data: unknown, source: Window): MessageEvent => {
  const Ctor = (window as unknown as { MessageEvent?: typeof MessageEvent }).MessageEvent
  if (typeof Ctor === 'function') return new Ctor('message', { data, source })
  const e = document.createEvent('MessageEvent')
  ;(e as unknown as { initMessageEvent?: unknown }).initMessageEvent &&
    (e as unknown as { initMessageEvent: (...args: unknown[]) => void }).initMessageEvent('message', false, false, data, '', '', source, null)
  return e as unknown as MessageEvent
}

export function testWebpageDomExportUsesSharedSemanticKeyForInflightDedupe() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'lib', 'websites', 'webpageDomExport.ts'), 'utf8')
  if (!text.includes("buildScopedGraphSemanticKey('webpage-dom-export'")) {
    throw new Error('expected DOM export inflight dedupe to use shared semantic-key helper')
  }
}

export async function testWebpageDomExportWaitsForNetworkIdleAndReturnsSnapshot() {
  const { restore } = initJsdomHarness()
  try {
    const p = exportWebpageDomViaHiddenIframe({
      url: WEBPAGE_TEST_URL,
      mode: 'html',
      timeoutMs: 4000,
      waitForNetworkIdle: true,
      networkIdleMs: 200,
      minWaitAfterLoadMs: 0,
    })

    await waitMs(0)
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null
    if (!iframe) throw new Error('expected iframe mounted')
    const win = iframe.contentWindow
    if (!win) throw new Error('expected iframe contentWindow')

    let requestedId = ''
    ;(win as unknown as { postMessage?: unknown }).postMessage = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const rec = payload as Record<string, unknown>
      if (rec.kind !== 'kg-export-dom') return
      const id = typeof rec.id === 'string' ? rec.id : ''
      if (id) requestedId = id
    }

    iframe.dispatchEvent(createEvent('load'))
    await waitMs(0)
    window.dispatchEvent(createMessageEvent({ kind: 'kg-webpage-net', pending: 1 }, win))
    await waitMs(60)
    window.dispatchEvent(createMessageEvent({ kind: 'kg-webpage-net', pending: 0 }, win))
    await waitMs(240)
    window.dispatchEvent(createMessageEvent({ kind: 'kg-webpage-net', pending: 0 }, win))

    const startedAt = Date.now()
    while (!requestedId && Date.now() - startedAt < 1200) {
      await waitMs(15)
    }
    if (!requestedId) throw new Error('expected export request after network idle')

    window.dispatchEvent(
      createMessageEvent({ kind: 'kg-export-dom', id: requestedId, mode: 'html', title: 'T', clipped: false, text: '<html>OK</html>' }, win),
    )

    const res = await p
    if (!res) throw new Error('expected result')
    if (res.text !== '<html>OK</html>') throw new Error('expected returned html snapshot')
    if (res.title !== 'T') throw new Error('expected title')
  } finally {
    restore()
  }
}

export async function testWebpageDomExportDedupesInflightRequests() {
  const { restore } = initJsdomHarness()
  try {
    const p1 = exportWebpageDomViaHiddenIframe({
      url: WEBPAGE_TEST_URL,
      mode: 'html',
      timeoutMs: 4000,
      waitForNetworkIdle: true,
      networkIdleMs: 200,
      minWaitAfterLoadMs: 0,
    })
    const p2 = exportWebpageDomViaHiddenIframe({
      url: WEBPAGE_TEST_URL,
      mode: 'html',
      timeoutMs: 4000,
      waitForNetworkIdle: true,
      networkIdleMs: 200,
      minWaitAfterLoadMs: 0,
    })

    await waitMs(0)
    const iframes = Array.from(document.querySelectorAll('iframe'))
    if (iframes.length !== 1) throw new Error(`expected 1 iframe mounted, got ${iframes.length}`)
    const iframe = iframes[0] as HTMLIFrameElement
    const win = iframe.contentWindow
    if (!win) throw new Error('expected iframe contentWindow')

    let requestedId = ''
    ;(win as unknown as { postMessage?: unknown }).postMessage = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const rec = payload as Record<string, unknown>
      if (rec.kind !== 'kg-export-dom') return
      const id = typeof rec.id === 'string' ? rec.id : ''
      if (id) requestedId = id
    }

    iframe.dispatchEvent(createEvent('load'))
    await waitMs(0)
    window.dispatchEvent(createMessageEvent({ kind: 'kg-webpage-net', pending: 0 }, win))
    await waitMs(240)
    window.dispatchEvent(createMessageEvent({ kind: 'kg-webpage-net', pending: 0 }, win))

    const startedAt = Date.now()
    while (!requestedId && Date.now() - startedAt < 1200) {
      await waitMs(15)
    }
    if (!requestedId) throw new Error('expected export request')

    window.dispatchEvent(
      createMessageEvent({ kind: 'kg-export-dom', id: requestedId, mode: 'html', title: 'T', clipped: false, text: '<html>OK</html>' }, win),
    )

    const [r1, r2] = await Promise.all([p1, p2])
    if (!r1 || !r2) throw new Error('expected results')
    if (r1.text !== '<html>OK</html>' || r2.text !== '<html>OK</html>') throw new Error('expected returned html snapshot')
  } finally {
    restore()
  }
}

export async function testWebpageDomExportAbortsAndRemovesIframe() {
  const { restore } = initJsdomHarness()
  try {
    const ctrl = new AbortController()
    const p = exportWebpageDomViaHiddenIframe({
      url: WEBPAGE_TEST_URL,
      mode: 'html',
      timeoutMs: 4000,
      waitForNetworkIdle: true,
      networkIdleMs: 200,
      minWaitAfterLoadMs: 0,
      signal: ctrl.signal,
    })
    await waitMs(0)
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null
    if (!iframe) throw new Error('expected iframe mounted')
    ctrl.abort()
    const res = await p
    if (res != null) throw new Error('expected null result on abort')
    await waitMs(0)
    const remaining = document.querySelector('iframe')
    if (remaining) throw new Error('expected iframe removed')
  } finally {
    restore()
  }
}
