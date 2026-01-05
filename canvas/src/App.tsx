import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { clearOnboardingSpotlight } from '@/features/spotlight/storage'
import { getLocalStorage } from '@/lib/persistence'

const Canvas = lazy(() => import('@/pages/Canvas'))

export default function App() {
  useEffect(() => {
    const storage = getLocalStorage()
    clearOnboardingSpotlight(storage)
  }, [])
  return (
    <Router>
      <ErrorBoundary>
        <Suspense fallback={<div className="h-screen flex items-center justify-center text-gray-500">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Canvas />} />
            <Route path="/canvas" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  )
}
