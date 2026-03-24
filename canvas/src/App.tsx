import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { clearOnboardingSpotlight } from '@/features/spotlight/storage'
import { getLocalStorage } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { subscribeToSystemThemeChanges } from '@/lib/ui/theme'
import { useGraphStore } from '@/hooks/useGraphStore'
import { installGlobalUserSelectFailsafe } from '@/lib/canvas/interaction-user-select'
import { installGlobalInteractionRecovery } from '@/lib/canvas/interaction-recovery'
import { ensureSpacePanKeyListenerInstalled } from '@/lib/canvas/space-pan'
import { ensureKgTokensInstalled } from '@/lib/ui/tokens-ssot'

const Canvas = lazy(() => import('@/pages/Canvas'))

export default function App() {
  useEffect(() => {
    installGlobalUserSelectFailsafe()
  }, [])
  useEffect(() => {
    ensureSpacePanKeyListenerInstalled()
    installGlobalInteractionRecovery()
  }, [])
  useEffect(() => {
    ensureKgTokensInstalled()
  }, [])
  useEffect(() => {
    const storage = getLocalStorage()
    clearOnboardingSpotlight(storage)
  }, [])
  useEffect(() => {
    return subscribeToSystemThemeChanges(() => {
      try {
        useGraphStore.getState().refreshResolvedThemeModeFromSystem()
      } catch {
        void 0
      }
      ensureKgTokensInstalled()
    })
  }, [])
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      try {
        if (e.storageArea !== window.localStorage) return
        if (e.key !== LS_KEYS.themeMode) return
        const v = String(e.newValue || '').trim()
        const mode = v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
        useGraphStore.getState().setThemeMode(mode)
        ensureKgTokensInstalled()
      } catch {
        void 0
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])
  return (
    <Router>
      <ErrorBoundary>
        <Suspense fallback={<div className={`h-screen flex items-center justify-center ${UI_THEME_TOKENS.text.tertiary}`}>Loading…</div>}>
          <Routes>
            <Route path="/*" element={<Canvas />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  )
}
