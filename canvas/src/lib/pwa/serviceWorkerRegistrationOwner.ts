const DEFAULT_SCOPE_PATH = '/knowgrph/'

type EventListenerTarget = {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

type ServiceWorkerStateTarget = EventListenerTarget & {
  state: string
  postMessage(message: unknown, transfer: Transferable[]): void
}

type ServiceWorkerRegistrationTarget = {
  active: ServiceWorkerStateTarget | null
  installing: ServiceWorkerStateTarget | null
  waiting: ServiceWorkerStateTarget | null
  update(): Promise<unknown>
}

type ServiceWorkerContainerTarget = EventListenerTarget & {
  controller: ServiceWorkerStateTarget | null
  register(
    scriptUrl: string,
    options: RegistrationOptions,
  ): Promise<ServiceWorkerRegistrationTarget>
}

type CanonicalServiceWorkerRegistrationOptions = {
  serviceWorkerTarget: ServiceWorkerContainerTarget
  scopePath?: string
  reload?: () => void
  onOfflineReady?: () => void
  onRegistered?: (registration: ServiceWorkerRegistrationTarget) => void
}

export type CanonicalServiceWorkerRegistrationOwner = {
  registration: ServiceWorkerRegistrationTarget
  dispose(): void
}

const normalizeScopePath = (scopePath: string): string => {
  if (!scopePath.startsWith('/') || !scopePath.endsWith('/')) {
    throw new Error('service-worker registration scope must be an absolute path ending in /')
  }
  return scopePath
}

export async function registerCanonicalServiceWorker(
  options: CanonicalServiceWorkerRegistrationOptions,
): Promise<CanonicalServiceWorkerRegistrationOwner> {
  const scopePath = normalizeScopePath(options.scopePath ?? DEFAULT_SCOPE_PATH)
  const previousController = options.serviceWorkerTarget.controller
  let reloaded = false
  let installingWorker: ServiceWorkerStateTarget | null = null

  const handleControllerChange = () => {
    if (
      reloaded
      || !previousController
      || !options.serviceWorkerTarget.controller
      || options.serviceWorkerTarget.controller === previousController
    ) return
    reloaded = true
    options.reload?.()
  }
  const handleInstallingStateChange = () => {
    if (installingWorker?.state === 'installed' && !previousController) {
      options.onOfflineReady?.()
    }
  }

  options.serviceWorkerTarget.addEventListener('controllerchange', handleControllerChange)
  try {
    const registration = await options.serviceWorkerTarget.register(
      `${scopePath}sw.js`,
      {
        scope: scopePath,
        type: 'classic',
        updateViaCache: 'none',
      },
    )
    installingWorker = registration.installing
    installingWorker?.addEventListener('statechange', handleInstallingStateChange)
    handleInstallingStateChange()
    options.onRegistered?.(registration)

    return {
      registration,
      dispose() {
        options.serviceWorkerTarget.removeEventListener('controllerchange', handleControllerChange)
        installingWorker?.removeEventListener('statechange', handleInstallingStateChange)
      },
    }
  } catch (error) {
    options.serviceWorkerTarget.removeEventListener('controllerchange', handleControllerChange)
    throw error
  }
}
