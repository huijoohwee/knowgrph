import React from 'react'

export function useHoverOpenState(closeDelayMs = 160) {
  const [open, setOpen] = React.useState(false)
  const closeTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [])

  const openNow = React.useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(true)
  }, [])

  const scheduleClose = React.useCallback(() => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setOpen(false)
    }, closeDelayMs)
  }, [closeDelayMs])

  const closeNow = React.useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(false)
  }, [])

  return { open, setOpen, openNow, scheduleClose, closeNow }
}

