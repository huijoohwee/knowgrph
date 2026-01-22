import type { GraphData } from './types'

export function parseGraphInWorker(name: string, text: string): Promise<GraphData | null> {
  try {
    const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
    const isOffline = typeof navigator !== 'undefined' && navigator && 'onLine' in navigator && !navigator.onLine
    const hasWorker = typeof Worker !== 'undefined'
    if (isDev || isOffline || !hasWorker) {
      return Promise.resolve(null)
    }
    const worker = new Worker(new URL('../../workers/graphParser.worker.ts', import.meta.url), { type: 'module' })
    return new Promise((resolve) => {
      let settled = false
      const settle = (value: GraphData | null) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(value)
      }
      const cleanup = () => {
        if (timeoutId != null) {
          try { clearTimeout(timeoutId) } catch (err) { void err }
        }
        try { worker.terminate() } catch (err) { void err }
      }
      const timeoutId = setTimeout(() => settle(null), 20_000) as unknown as number
      type ParseResponse = { ok: boolean; data: GraphData | null };
      worker.onmessage = (e: MessageEvent<ParseResponse>) => {
        const { ok, data } = e.data || { ok: false, data: null }
        settle(ok ? data : null)
      }
      worker.onerror = () => {
        settle(null)
      }
      worker.postMessage({ type: 'parse', name, text })
    })
  } catch {
    return Promise.resolve(null)
  }
}
