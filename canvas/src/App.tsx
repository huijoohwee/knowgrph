import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { clearOnboardingSpotlight } from '@/features/spotlight/storage'
import { getLocalStorage } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const Canvas = lazy(() => import('@/pages/Canvas'))

export default function App() {
  useEffect(() => {
    const storage = getLocalStorage()
    clearOnboardingSpotlight(storage)
  }, [])
  return (
    <Router>
      <ErrorBoundary>
        <Suspense fallback={<div className={`h-screen flex items-center justify-center ${UI_THEME_TOKENS.text.tertiary}`}>Loading…</div>}>
          <Routes>
            <Route path="/" element={<Canvas />} />
            <Route path="/canvas" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  )
}
