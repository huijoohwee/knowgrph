import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'

export function useSelectionFlash(selectionId: string | null | undefined) {
  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)
  const selectionFlashOpacity = useGraphStore(s => s.selectionFlashOpacity || 0.18)
  const flashAlpha = Math.max(0, Math.min(1, selectionFlashOpacity * 1.7))
  const [flashSelectionId, setFlashSelectionId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!selectionId) {
      setFlashSelectionId(null)
      return
    }
    setFlashSelectionId(selectionId)
    let timer: number | null = null
    try {
      timer = window.setTimeout(() => {
        setFlashSelectionId(current => (current === selectionId ? null : current))
      }, selectionFlashDurationMs)
    } catch {
      timer = null
    }
    return () => {
      if (timer != null) {
        try {
          window.clearTimeout(timer)
        } catch {
          void 0
        }
      }
    }
  }, [selectionId, selectionFlashDurationMs])

  return { flashSelectionId, flashAlpha }
}
