import { useGraphStore } from '@/hooks/useGraphStore'
import { registerSW } from 'virtual:pwa-register'

const DISPLAY_MODE_STANDALONE_MEDIA = '(display-mode: standalone)'

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

const pushPwaToast = (args: {
  id: string
  kind: 'success' | 'warning' | 'neutral'
  message: string
  ttlMs?: number | null
  dismissible?: boolean
}): void => {
  try {
    useGraphStore.getState().upsertUiToast({
      id: args.id,
      kind: args.kind,
      message: args.message,
      ttlMs: args.ttlMs,
      dismissible: args.dismissible,
      log: false,
    })
  } catch {
    void 0
  }
}

const readStandaloneDisplayMode = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia(DISPLAY_MODE_STANDALONE_MEDIA).matches) {
      return true
    }
  } catch {
    void 0
  }
  try {
    return (window.navigator as NavigatorWithStandalone).standalone === true
  } catch {
    return false
  }
}

const applyPwaDisplayModeState = (installedHint: boolean): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root) return
  const standalone = readStandaloneDisplayMode()
  root.dataset.kgDisplayMode = standalone ? 'standalone' : 'browser'
  root.dataset.kgInstalled = standalone || installedHint ? '1' : '0'
}

export function installPwaRuntime(): void {
  if (typeof window === 'undefined') return
  let installedHint = readStandaloneDisplayMode()
  applyPwaDisplayModeState(installedHint)

  const standaloneMediaQuery =
    typeof window.matchMedia === 'function' ? window.matchMedia(DISPLAY_MODE_STANDALONE_MEDIA) : null
  const refreshDisplayModeState = () => applyPwaDisplayModeState(installedHint)
  const handleStandaloneDisplayModeChange = () => {
    installedHint = installedHint || readStandaloneDisplayMode()
    refreshDisplayModeState()
  }
  const handleAppInstalled = () => {
    installedHint = true
    refreshDisplayModeState()
    pushPwaToast({
      id: 'pwa:installed',
      kind: 'success',
      message: 'App installed for faster mobile relaunches.',
      ttlMs: 6000,
      dismissible: true,
    })
  }

  if (standaloneMediaQuery) {
    if (typeof standaloneMediaQuery.addEventListener === 'function') {
      standaloneMediaQuery.addEventListener('change', handleStandaloneDisplayModeChange)
    } else if (typeof standaloneMediaQuery.addListener === 'function') {
      standaloneMediaQuery.addListener(handleStandaloneDisplayModeChange)
    }
  }
  window.addEventListener('appinstalled', handleAppInstalled)

  registerSW({
    immediate: true,
    onOfflineReady() {
      refreshDisplayModeState()
      pushPwaToast({
        id: 'pwa:offline-ready',
        kind: 'success',
        message: 'Offline shell ready for cached mobile relaunches.',
        ttlMs: 5000,
        dismissible: true,
      })
    },
    onNeedRefresh() {
      refreshDisplayModeState()
      pushPwaToast({
        id: 'pwa:update-ready',
        kind: 'neutral',
        message: 'App update ready. Reload to use the latest shell.',
        ttlMs: 12000,
        dismissible: true,
      })
    },
    onRegisterError() {
      refreshDisplayModeState()
      pushPwaToast({
        id: 'pwa:register-error',
        kind: 'warning',
        message: 'Offline shell registration failed.',
        ttlMs: 12000,
        dismissible: true,
      })
    },
  })
}
