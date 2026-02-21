import type { GraphData } from '@/lib/graph/types'
import { requestFromSingletonWorker } from '@/lib/workers/singletonWorkerClient'
import { runDeferredWithTimeout } from '@/lib/async/runDeferredWithTimeout'

export type KeywordGraphWorkerArgs = {
  documentId: string
  documentText: string
  sourceLabel?: string
  sourceTextHash?: string
  tuning?: { edgesPerNode?: number; maxEdgesCap?: number }
  timeoutMs?: number
}

type KeywordWorkerResponse = { id: number; ok: boolean; graph: GraphData | null; error?: string }

const setLastKeywordError = (message: string) => {
  try {
    ;(globalThis as unknown as { __kgKeywordWorkerLastError?: string }).__kgKeywordWorkerLastError = String(message || '')
  } catch {
    void 0
  }
}

const clampTimeoutMs = (raw: unknown, fallback: number, min: number, max: number): number => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(min, Math.min(max, Math.floor(raw)))
  return fallback
}

const deriveDeferred = (args: KeywordGraphWorkerArgs, timeoutMs: number): Promise<GraphData | null> => {
  return runDeferredWithTimeout({
    timeoutMs,
    deferMs: 0,
    onErrorMessage: setLastKeywordError,
    run: async () => {
      const mod = await import('./keywordGraph')
      return (
        (await mod.deriveKeywordGraphFromText({
          documentId: args.documentId,
          documentText: args.documentText,
          sourceLabel: args.sourceLabel,
          sourceTextHash: args.sourceTextHash,
          tuning: args.tuning,
        })).graph || null
      )
    },
  })
}

const deriveViaWorker = (
  globalStateKey: string,
  args: KeywordGraphWorkerArgs,
  timeoutMs: number,
): Promise<GraphData | null> => {
  return requestFromSingletonWorker<GraphData | null>({
    globalStateKey,
    createWorker: () => new Worker(new URL('../../workers/keywordGraph.worker.ts', import.meta.url), { type: 'module' }),
    timeoutMs,
    postMessage: (worker, id) => {
      worker.postMessage({
        type: 'deriveKeywordGraph',
        id,
        documentId: args.documentId,
        documentText: args.documentText,
        sourceLabel: args.sourceLabel,
        sourceTextHash: args.sourceTextHash,
        tuning: args.tuning,
      })
    },
    readResponse: (data: unknown) => {
      const msg = data as KeywordWorkerResponse
      if (!msg || typeof msg.id !== 'number') return null
      return {
        id: msg.id,
        ok: msg.ok === true,
        value: (msg.graph || null) as GraphData | null,
        error: msg.error,
      }
    },
    onWorkerErrorMessage: setLastKeywordError,
  })
}

export function deriveKeywordGraphInWorker(args: KeywordGraphWorkerArgs): Promise<GraphData | null> {
  try {
    const hasWorker = typeof Worker !== 'undefined'
    const timeoutMs = clampTimeoutMs(args.timeoutMs, 25_000, 2_000, 180_000)
    if (!hasWorker) return deriveDeferred(args, timeoutMs)
    return deriveViaWorker('__kgKeywordWorker', args, timeoutMs).then((g) => {
      if (g) return g
      return deriveDeferred(args, timeoutMs)
    })
  } catch {
    return Promise.resolve(null)
  }
}

export function deriveKeywordGraphPreviewInWorker(args: KeywordGraphWorkerArgs): Promise<GraphData | null> {
  try {
    const hasWorker = typeof Worker !== 'undefined'
    const timeoutMs = clampTimeoutMs(args.timeoutMs, 4_000, 750, 25_000)
    if (!hasWorker) return deriveDeferred(args, timeoutMs)
    return deriveViaWorker('__kgKeywordPreviewWorker', args, timeoutMs).then((g) => {
      if (g) return g
      return deriveDeferred(args, timeoutMs)
    })
  } catch {
    return Promise.resolve(null)
  }
}
