import React from 'react'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

export function CanvasHotkeysRuntime(props: {
  geospatialModeEnabled: boolean
  launchSpotlightShortcutEnabled: boolean
}) {
  const { geospatialModeEnabled, launchSpotlightShortcutEnabled } = props
  const [, setSpotlightDismissed] = usePersistedBoolean(LS_KEYS.launchSpotlightDismissed, false)

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const isCmd = e.metaKey || e.ctrlKey
      if (!isCmd) return
      const lowerKey = e.key.toLowerCase()
      if (launchSpotlightShortcutEnabled && e.shiftKey && lowerKey === 'g') {
        e.preventDefault()
        try {
          useGraphStore.getState().setEnableLaunchSpotlight(true)
          setSpotlightDismissed(false)
        } catch {
          void 0
        }
        return
      }
      const k = e.key
      const isZoomIn = k === '+' || k === '='
      const isZoomOut = k === '-' || k === '_'
      const isReset = k === '0'
      if (!isZoomIn && !isZoomOut && !isReset) return

      e.preventDefault()
      const store = useGraphStore.getState()
      if (isReset) {
        if (geospatialModeEnabled) {
          store.requestZoom('reset')
          return
        }
        if (store.canvasRenderMode === '2d') store.requestZoom('reset')
        else store.requestThreeCamera('reset')
        return
      }

      const type = isZoomIn ? 'in' : 'out'
      if (geospatialModeEnabled) {
        store.requestZoom(type)
        return
      }
      if (store.canvasRenderMode === '2d') store.requestZoom(type)
      else store.requestThreeCamera(type)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [geospatialModeEnabled, launchSpotlightShortcutEnabled, setSpotlightDismissed])

  return null
}
