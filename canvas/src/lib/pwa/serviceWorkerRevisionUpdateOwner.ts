export const SERVICE_WORKER_UPDATE_MIN_INTERVAL_MS = 5 * 60 * 1000

type EventListenerTarget = {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

type VisibilityEventTarget = EventListenerTarget & {
  visibilityState: DocumentVisibilityState
}

type ServiceWorkerRegistrationUpdateTarget = {
  update(): Promise<unknown>
}

type ServiceWorkerRevisionUpdateOwnerOptions = {
  registration: ServiceWorkerRegistrationUpdateTarget
  documentTarget: VisibilityEventTarget
  windowTarget: EventListenerTarget
  now?: () => number
  minIntervalMs?: number
  onUpdateSettled?: () => void
  onError?: (error: unknown) => void
}

export function installServiceWorkerRevisionUpdateOwner(
  options: ServiceWorkerRevisionUpdateOwnerOptions,
): () => void {
  const now = options.now ?? Date.now
  const minIntervalMs = options.minIntervalMs ?? SERVICE_WORKER_UPDATE_MIN_INTERVAL_MS
  let disposed = false
  let lastSuccessfulUpdateAt = Number.NEGATIVE_INFINITY
  let updateInFlight: Promise<void> | null = null

  const requestUpdate = (force = false): Promise<void> => {
    if (disposed) return Promise.resolve()
    if (updateInFlight) return updateInFlight

    const attemptedAt = now()
    if (!force && attemptedAt - lastSuccessfulUpdateAt < minIntervalMs) return Promise.resolve()
    updateInFlight = Promise.resolve()
      .then(() => options.registration.update())
      .then(() => {
        lastSuccessfulUpdateAt = attemptedAt
      })
      .catch(error => options.onError?.(error))
      .finally(() => {
        updateInFlight = null
        try {
          options.onUpdateSettled?.()
        } catch (error) {
          options.onError?.(error)
        }
      })
    return updateInFlight
  }

  const handleForeground = () => {
    if (options.documentTarget.visibilityState === 'visible') void requestUpdate()
  }
  const handleOnline = () => {
    void requestUpdate()
  }

  options.documentTarget.addEventListener('visibilitychange', handleForeground)
  options.windowTarget.addEventListener('online', handleOnline)
  void requestUpdate(true)

  return () => {
    disposed = true
    options.documentTarget.removeEventListener('visibilitychange', handleForeground)
    options.windowTarget.removeEventListener('online', handleOnline)
  }
}
