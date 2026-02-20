import type { GraphData } from './types'
import { requestFromSingletonWorker } from '@/lib/workers/singletonWorkerClient'

export function parseGraphInWorker(name: string, text: string): Promise<GraphData | null> {
  try {
    const isOffline = typeof navigator !== 'undefined' && navigator && 'onLine' in navigator && !navigator.onLine
    const hasWorker = typeof Worker !== 'undefined'
    if (isOffline || !hasWorker) {
      return Promise.resolve(null)
    }

    type ParseResponse = { id: number; ok: boolean; data: GraphData | null; error?: string }
    return requestFromSingletonWorker<GraphData | null>({
      globalStateKey: '__kgParseWorker',
      createWorker: () => new Worker(new URL('../../workers/graphParser.worker.ts', import.meta.url), { type: 'module' }),
      timeoutMs: 20_000,
      postMessage: (worker, id) => {
        worker.postMessage({ type: 'parse', id, name, text })
      },
      readResponse: (data: unknown) => {
        const msg = data as ParseResponse
        if (!msg || typeof msg.id !== 'number') return null
        return { id: msg.id, ok: msg.ok === true, value: (msg.data || null) as GraphData | null, error: msg.error }
      },
    })
  } catch {
    return Promise.resolve(null)
  }
}
