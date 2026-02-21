import type { GraphData } from './types'
import { requestFromSingletonWorker } from '@/lib/workers/singletonWorkerClient'

const setLastParseWorkerError = (message: string) => {
  try {
    ;(globalThis as unknown as { __kgParseWorkerLastError?: string }).__kgParseWorkerLastError = String(message || '')
  } catch {
    void 0
  }
}

export function parseGraphInWorker(name: string, text: string): Promise<GraphData | null> {
  try {
    const hasWorker = typeof Worker !== 'undefined'
    if (!hasWorker) {
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
      onWorkerErrorMessage: setLastParseWorkerError,
    })
  } catch {
    return Promise.resolve(null)
  }
}
