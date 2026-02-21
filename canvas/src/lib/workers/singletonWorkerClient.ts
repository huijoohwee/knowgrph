export type SingletonWorkerPendingEntry<T> = {
  resolve: (v: T) => void
  timeoutId: number
}

export type SingletonWorkerState<T> = {
  worker: Worker | null
  nextId: number
  pending: Map<number, SingletonWorkerPendingEntry<T>>
}

export type SingletonWorkerRequestArgs<T> = {
  globalStateKey: string
  createWorker: () => Worker
  timeoutMs: number
  postMessage: (worker: Worker, id: number) => void
  readResponse: (data: unknown) => { id: number; ok: boolean; value: T; error?: string } | null
  onWorkerErrorMessage?: (message: string) => void
}

const getGlobalRecord = (): Record<string, unknown> => {
  return globalThis as unknown as Record<string, unknown>
}

export function requestFromSingletonWorker<T>(args: SingletonWorkerRequestArgs<T>): Promise<T> {
  try {
    const global = getGlobalRecord()
    const existing = global[args.globalStateKey] as SingletonWorkerState<T> | undefined
    const state: SingletonWorkerState<T> =
      existing && typeof existing === 'object'
        ? existing
        : { worker: null, nextId: 1, pending: new Map<number, SingletonWorkerPendingEntry<T>>() }

    global[args.globalStateKey] = state

    const resetWorker = (w: Worker, message?: string) => {
      if (message && typeof message === 'string') {
        try {
          args.onWorkerErrorMessage?.(message)
        } catch {
          void 0
        }
      }
      const pending = Array.from(state.pending.values())
      state.pending.clear()
      for (const p of pending) {
        try {
          clearTimeout(p.timeoutId)
        } catch {
          void 0
        }
        try {
          p.resolve(null as unknown as T)
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

    const ensureWorker = (): Worker | null => {
      if (state.worker) return state.worker
      const w = args.createWorker()
      w.onmessage = (e: MessageEvent<unknown>) => {
        const parsed = args.readResponse(e.data)
        if (!parsed) return
        if (parsed.ok !== true && typeof parsed.error === 'string' && parsed.error.trim()) {
          try {
            args.onWorkerErrorMessage?.(parsed.error)
          } catch {
            void 0
          }
        }
        const entry = state.pending.get(parsed.id)
        if (!entry) return
        state.pending.delete(parsed.id)
        try {
          clearTimeout(entry.timeoutId)
        } catch {
          void 0
        }
        entry.resolve(parsed.ok === true ? parsed.value : (null as unknown as T))
      }
      w.onerror = () => resetWorker(w, 'Worker crashed')
      state.worker = w
      return w
    }

    const worker = ensureWorker()
    if (!worker) return Promise.resolve(null as unknown as T)

    const id = state.nextId++
    const timeoutMs = (() => {
      const raw = args.timeoutMs
      if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.max(50, Math.floor(raw))
      return 20_000
    })()

    return new Promise<T>((resolve) => {
      const timeoutId = setTimeout(() => {
        if (!state.pending.has(id)) return
        state.pending.delete(id)
        try {
          args.onWorkerErrorMessage?.('Worker request timed out')
        } catch {
          void 0
        }
        resolve(null as unknown as T)
      }, timeoutMs) as unknown as number
      state.pending.set(id, { resolve, timeoutId })
      args.postMessage(worker, id)
    })
  } catch {
    try {
      args.onWorkerErrorMessage?.('Worker request failed')
    } catch {
      void 0
    }
    return Promise.resolve(null as unknown as T)
  }
}
