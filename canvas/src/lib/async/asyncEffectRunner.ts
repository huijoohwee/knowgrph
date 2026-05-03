import { abortControllerSafely, isAsyncRequestStale } from '@/lib/async/asyncGuards'

export function runAsyncEffect(args: {
  requestId?: number | null
  getLatestRequestId?: () => number | null
  onCleanup?: () => void
  onError?: (error: unknown, helpers: { isStale: () => boolean }) => void
  run: (helpers: { signal: AbortSignal; isStale: () => boolean }) => Promise<void> | void
}): () => void {
  const controller = new AbortController()
  let cancelled = false
  const isStale = () =>
    isAsyncRequestStale({
      cancelled,
      requestId: args.requestId,
      latestRequestId: args.getLatestRequestId?.() ?? null,
    })

  void Promise.resolve()
    .then(() => args.run({ signal: controller.signal, isStale }))
    .catch(error => {
      if (isStale()) return
      try {
        args.onError?.(error, { isStale })
      } catch {
        void 0
      }
    })

  return () => {
    cancelled = true
    abortControllerSafely(controller)
    try {
      args.onCleanup?.()
    } catch {
      void 0
    }
  }
}
