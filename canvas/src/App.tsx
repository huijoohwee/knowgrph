import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { clearOnboardingSpotlight } from '@/features/spotlight/storage'
import { getLocalStorage } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { subscribeToSystemThemeChanges } from '@/lib/ui/theme'
import { useGraphStore } from '@/hooks/useGraphStore'
import { installGlobalUserSelectFailsafe } from '@/lib/canvas/interaction-user-select'

const Canvas = lazy(() => import('@/pages/Canvas'))

export default function App() {
  useEffect(() => {
    installGlobalUserSelectFailsafe()
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
    })
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
