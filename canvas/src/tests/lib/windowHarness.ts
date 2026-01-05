import type { MemoryStorage } from '@/tests/lib/memoryStorage'

type HarnessWindow = Window &
  typeof globalThis & {
    navigator?: Navigator
  }

export type WindowHarnessEnv = {
  g: HarnessWindow
  storage: Storage
  restore: () => void
}

type WindowHarnessOptions = {
  storage?: MemoryStorage | Storage
  navigatorOnline?: boolean
  withCustomEvent?: boolean
}

export function initWindowHarness(options?: WindowHarnessOptions): WindowHarnessEnv {
  const g = globalThis as unknown as HarnessWindow
  const originalWindow = g.window
  const originalLocalStorage = g.localStorage
  const originalNavigator = Object.prototype.hasOwnProperty.call(g, 'navigator') ? g.navigator : undefined
  const originalCustomEvent = g.CustomEvent
  const originalDispatchEvent = g.dispatchEvent

  const resolvedStorage: Storage =
    options && options.storage ? options.storage : (g.localStorage ?? ({} as Storage))

  if (!g.window) {
    g.window = g
  }
  g.localStorage = resolvedStorage
  g.window.localStorage = resolvedStorage

  if (typeof options?.navigatorOnline === 'boolean') {
    try {
      Object.defineProperty(g, 'navigator', {
        value: { onLine: options.navigatorOnline } as unknown as Navigator,
        configurable: true,
      })
    } catch {
      void 0
    }
  }

  if (options?.withCustomEvent !== false) {
    g.CustomEvent = class CustomEventImpl<T = unknown> {
      type: string
      detail: T | null
      constructor(type: string, init?: CustomEventInit<T>) {
        this.type = type
        this.detail = init && typeof init.detail !== 'undefined' ? init.detail ?? null : null
      }
    } as unknown as typeof CustomEvent
    g.dispatchEvent = () => true
    g.window.dispatchEvent = g.dispatchEvent
  }

  const restore = () => {
    g.window = originalWindow
    if (typeof originalLocalStorage === 'undefined') {
      if ('localStorage' in g) {
        g.localStorage = undefined as unknown as Storage
      }
      if (g.window && 'localStorage' in g.window) {
        g.window.localStorage = undefined as unknown as Storage
      }
    } else {
      g.localStorage = originalLocalStorage
      if (g.window) {
        g.window.localStorage = originalLocalStorage
      }
    }
    if (typeof originalNavigator !== 'undefined') {
      try {
        Object.defineProperty(g, 'navigator', {
          value: originalNavigator,
          configurable: true,
        })
      } catch {
        void 0
      }
    }
    g.CustomEvent = originalCustomEvent
    g.dispatchEvent = originalDispatchEvent
    if (g.window) {
      g.window.dispatchEvent = originalDispatchEvent
    }
  }

  return { g, storage: resolvedStorage, restore }
}
