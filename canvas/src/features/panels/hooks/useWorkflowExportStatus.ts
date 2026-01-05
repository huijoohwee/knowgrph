import { useCallback, useEffect, useRef, useState } from 'react'

export function useWorkflowExportStatus() {
  const [exportedThisSession, setExportedThisSession] = useState(false)
  const [exportedAt, setExportedAt] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const exportStatusTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return
      if (exportStatusTimeoutRef.current !== null) {
        window.clearTimeout(exportStatusTimeoutRef.current)
        exportStatusTimeoutRef.current = null
      }
    }
  }, [])

  const markExported = useCallback(() => {
    setExportedThisSession(true)
    try {
      const now = new Date()
      setExportedAt(now.toLocaleTimeString())
    } catch {
      setExportedAt(null)
    }
  }, [])

  const setTransientExportStatus = useCallback((msg: string) => {
    setExportStatus(msg)
    try {
      if (typeof window === 'undefined') return
      if (exportStatusTimeoutRef.current !== null) {
        window.clearTimeout(exportStatusTimeoutRef.current)
      }
      exportStatusTimeoutRef.current = window.setTimeout(() => {
        setExportStatus(prev => (prev === msg ? null : prev))
      }, 2500)
    } catch {
      void 0
    }
  }, [])

  return {
    exportedThisSession,
    exportedAt,
    exportStatus,
    markExported,
    setTransientExportStatus,
  }
}

