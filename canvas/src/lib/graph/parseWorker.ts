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
      const cleanup = () => {
        try { worker.terminate() } catch (err) { void err }
      }
      type ParseResponse = { ok: boolean; data: GraphData | null };
      worker.onmessage = (e: MessageEvent<ParseResponse>) => {
        const { ok, data } = e.data || { ok: false, data: null }
        cleanup()
        resolve(ok ? data : null)
      }
      worker.onerror = () => {
        cleanup()
        resolve(null)
      }
      worker.postMessage({ type: 'parse', name, text })
    })
  } catch {
    return Promise.resolve(null)
  }
}
