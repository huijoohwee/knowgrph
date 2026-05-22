import React from 'react'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

export function CanvasLaunchSpotlightHotkeyRuntime() {
  const [, setSpotlightDismissed] = usePersistedBoolean(LS_KEYS.launchSpotlightDismissed, false)

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const lowerKey = e.key.toLowerCase()
      const isCmd = e.metaKey || e.ctrlKey
      if (!isCmd || !e.shiftKey || lowerKey !== 'g') return

      e.preventDefault()
      try {
        useGraphStore.getState().setEnableLaunchSpotlight(true)
        setSpotlightDismissed(false)
      } catch {
        void 0
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSpotlightDismissed])

  return null
}
