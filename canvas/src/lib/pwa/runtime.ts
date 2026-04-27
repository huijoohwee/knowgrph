import { useGraphStore } from '@/hooks/useGraphStore'
import { registerSW } from 'virtual:pwa-register'

const DISPLAY_MODE_STANDALONE_MEDIA = '(display-mode: standalone)'
const DISPLAY_MODE_FULLSCREEN_MEDIA = '(display-mode: fullscreen)'
const DISPLAY_MODE_MINIMAL_UI_MEDIA = '(display-mode: minimal-ui)'

type NavigatorWithStandalone = Navigator & { standalone?: boolean }
type PwaDisplayMode = 'browser' | 'standalone' | 'fullscreen' | 'minimal-ui'

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

const readPwaDisplayMode = (): PwaDisplayMode => {
  if (typeof window === 'undefined') return 'browser'
  try {
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia(DISPLAY_MODE_FULLSCREEN_MEDIA).matches) return 'fullscreen'
      if (window.matchMedia(DISPLAY_MODE_STANDALONE_MEDIA).matches) return 'standalone'
      if (window.matchMedia(DISPLAY_MODE_MINIMAL_UI_MEDIA).matches) return 'minimal-ui'
    }
  } catch {
    void 0
  }
  try {
    if ((window.navigator as NavigatorWithStandalone).standalone === true) return 'standalone'
  } catch {
    void 0
  }
  return 'browser'
}

const applyPwaDisplayModeState = (installedHint: boolean, swState?: { offlineReady?: boolean; updateReady?: boolean }): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root) return
  const displayMode = readPwaDisplayMode()
  root.dataset.kgDisplayMode = displayMode
  root.dataset.kgInstalled = displayMode === 'browser' && !installedHint ? '0' : '1'
  root.dataset.kgOfflineReady = swState?.offlineReady ? '1' : '0'
  root.dataset.kgUpdateReady = swState?.updateReady ? '1' : '0'
}

export function installPwaRuntime(): void {
  if (typeof window === 'undefined') return
  const swState = { offlineReady: false, updateReady: false }
  let installedHint = readPwaDisplayMode() !== 'browser'
  let attemptedAutoUpdate = false
  applyPwaDisplayModeState(installedHint, swState)

  const displayModeMediaQueries =
    typeof window.matchMedia === 'function'
      ? [
          window.matchMedia(DISPLAY_MODE_STANDALONE_MEDIA),
          window.matchMedia(DISPLAY_MODE_FULLSCREEN_MEDIA),
          window.matchMedia(DISPLAY_MODE_MINIMAL_UI_MEDIA),
        ]
      : []
  const refreshDisplayModeState = () => applyPwaDisplayModeState(installedHint, swState)
  const handleStandaloneDisplayModeChange = () => {
    installedHint = installedHint || readPwaDisplayMode() !== 'browser'
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

  for (let i = 0; i < displayModeMediaQueries.length; i += 1) {
    const mediaQuery = displayModeMediaQueries[i]
    if (typeof mediaQuery?.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleStandaloneDisplayModeChange)
    } else if (typeof mediaQuery?.addListener === 'function') {
      mediaQuery.addListener(handleStandaloneDisplayModeChange)
    }
  }
  window.addEventListener('appinstalled', handleAppInstalled)

  const updateServiceWorker = registerSW({
    immediate: true,
    onOfflineReady() {
      swState.offlineReady = true
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
      swState.updateReady = true
      refreshDisplayModeState()
      if (!attemptedAutoUpdate) {
        attemptedAutoUpdate = true
        void updateServiceWorker(true)
        return
      }
      pushPwaToast({
        id: 'pwa:update-ready',
        kind: 'neutral',
        message: 'App update ready. Reload to use the latest shell.',
        ttlMs: 12000,
        dismissible: true,
      })
    },
    onRegisterError(error) {
      swState.offlineReady = false
      swState.updateReady = false
      refreshDisplayModeState()
      try {
        console.warn('[knowgrph] Offline shell registration failed.', error)
      } catch {
        void 0
      }
    },
  })
}
