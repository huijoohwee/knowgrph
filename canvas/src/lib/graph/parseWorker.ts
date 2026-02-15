import type { GraphData } from './types'

export function parseGraphInWorker(name: string, text: string): Promise<GraphData | null> {
  try {
    const isOffline = typeof navigator !== 'undefined' && navigator && 'onLine' in navigator && !navigator.onLine
    const hasWorker = typeof Worker !== 'undefined'
    if (isOffline || !hasWorker) {
      return Promise.resolve(null)
    }

    type ParseResponse = { id: number; ok: boolean; data: GraphData | null; error?: string }

    const state = (globalThis as unknown as {
      __kgParseWorker?: {
        worker: Worker | null
        nextId: number
        pending: Map<number, { resolve: (v: GraphData | null) => void; timeoutId: number }>
      }
    }).__kgParseWorker || {
      worker: null as Worker | null,
      nextId: 1,
      pending: new Map<number, { resolve: (v: GraphData | null) => void; timeoutId: number }>(),
    }
    ;(globalThis as unknown as { __kgParseWorker?: unknown }).__kgParseWorker = state

    const ensureWorker = (): Worker | null => {
      if (state.worker) return state.worker
      const w = new Worker(new URL('../../workers/graphParser.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<ParseResponse>) => {
        const msg = e.data
        const id = msg && typeof msg.id === 'number' ? msg.id : 0
        const entry = state.pending.get(id)
        if (!entry) return
        state.pending.delete(id)
        try {
          clearTimeout(entry.timeoutId)
        } catch {
          void 0
        }
        entry.resolve(msg && msg.ok === true ? (msg.data || null) : null)
      }
      w.onerror = () => {
        const pending = Array.from(state.pending.values())
        state.pending.clear()
        for (const p of pending) {
          try {
            clearTimeout(p.timeoutId)
          } catch {
            void 0
          }
          try {
            p.resolve(null)
          } catch {
            void 0
          }
        }
        try {
          w.terminate()
        } catch {
          void 0
        }
        state.worker = null
      }
      state.worker = w
      return w
    }

    const worker = ensureWorker()
    if (!worker) return Promise.resolve(null)

    const id = state.nextId++
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        if (!state.pending.has(id)) return
        state.pending.delete(id)
        resolve(null)
      }, 20_000) as unknown as number
      state.pending.set(id, { resolve, timeoutId })
      worker.postMessage({ type: 'parse', id, name, text })
    })
  } catch {
    return Promise.resolve(null)
  }
}
