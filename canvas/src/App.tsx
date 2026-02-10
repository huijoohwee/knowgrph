import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { clearOnboardingSpotlight } from '@/features/spotlight/storage'
import { getLocalStorage } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { subscribeToSystemThemeChanges } from '@/lib/ui/theme'
import { useGraphStore } from '@/hooks/useGraphStore'

const Canvas = lazy(() => import('@/pages/Canvas'))
const PdfDocumentViewer = lazy(() => import('@/pages/PdfDocumentViewer'))

export default function App() {
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
            <Route path="/" element={<Canvas />} />
            <Route path="/canvas" element={<Navigate to="/" replace />} />
            <Route path="/workspace" element={<Navigate to="/?openMainPanel=workflow" replace />} />
            <Route path="/import" element={<Navigate to="/?openMainPanel=workflow" replace />} />
            <Route path="/doc/:docId" element={<PdfDocumentViewer />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  )
}
