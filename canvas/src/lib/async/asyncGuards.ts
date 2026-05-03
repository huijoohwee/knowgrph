export function abortControllerSafely(controller: AbortController | null | undefined): void {
  if (!controller) return
  try {
    controller.abort()
  } catch {
    void 0
  }
}

export function isAsyncRequestStale(args: {
  cancelled?: boolean
  requestId?: number | null
  latestRequestId?: number | null
}): boolean {
  if (args.cancelled === true) return true
  if (typeof args.requestId === 'number' && typeof args.latestRequestId === 'number' && args.requestId !== args.latestRequestId) {
    return true
  }
  return false
}
