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
  const hadLocalStorageOnGlobal = Object.prototype.hasOwnProperty.call(g, 'localStorage')
  const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(g, 'localStorage')
  const originalLocalStorage = g.localStorage
  const hadLocalStorageOnWindow = !!g.window && Object.prototype.hasOwnProperty.call(g.window, 'localStorage')
  const originalWindowLocalStorageDescriptor = g.window ? Object.getOwnPropertyDescriptor(g.window, 'localStorage') : undefined
  const originalNavigator = Object.prototype.hasOwnProperty.call(g, 'navigator') ? g.navigator : undefined
  const originalCustomEvent = g.CustomEvent
  const originalDispatchEvent = g.dispatchEvent

  const resolvedStorage: Storage =
    options && options.storage ? options.storage : (g.localStorage ?? ({} as Storage))

  if (!g.window) {
    g.window = g
  }

  const setLocalStorage = (target: unknown, value: Storage) => {
    if (!target) return
    try {
      Object.defineProperty(target as object, 'localStorage', {
        value,
        configurable: true,
        writable: true,
      })
      return
    } catch {
      void 0
    }
    try {
      ;(target as { localStorage?: Storage }).localStorage = value
    } catch {
      void 0
    }
  }

  setLocalStorage(g, resolvedStorage)
  setLocalStorage(g.window, resolvedStorage)

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

    try {
      if (hadLocalStorageOnGlobal && originalLocalStorageDescriptor) {
        Object.defineProperty(g, 'localStorage', originalLocalStorageDescriptor)
      } else if (!hadLocalStorageOnGlobal) {
        delete (g as unknown as { localStorage?: unknown }).localStorage
      } else {
        Object.defineProperty(g, 'localStorage', {
          value: originalLocalStorage,
          configurable: true,
          writable: true,
        })
      }
    } catch {
      void 0
    }

    if (g.window) {
      try {
        if (hadLocalStorageOnWindow && originalWindowLocalStorageDescriptor) {
          Object.defineProperty(g.window, 'localStorage', originalWindowLocalStorageDescriptor)
        } else if (!hadLocalStorageOnWindow) {
          delete (g.window as unknown as { localStorage?: unknown }).localStorage
        } else {
          Object.defineProperty(g.window, 'localStorage', {
            value: originalLocalStorage,
            configurable: true,
            writable: true,
          })
        }
      } catch {
        void 0
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
