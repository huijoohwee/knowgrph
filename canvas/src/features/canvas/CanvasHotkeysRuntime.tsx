import React from 'react'
import {
  handleCanvasPointerModeHotkey,
  handleCanvasZoomHotkey,
} from '@/features/canvas/canvasHotkeyHandlers'

const CanvasLaunchSpotlightHotkeyRuntimeLazy = React.lazy(() =>
  import('@/features/canvas/CanvasLaunchSpotlightHotkeyRuntime').then(mod => ({ default: mod.CanvasLaunchSpotlightHotkeyRuntime })),
)

export function CanvasHotkeysRuntime(props: {
  geospatialModeEnabled: boolean
  launchSpotlightShortcutEnabled: boolean
}) {
  const { launchSpotlightShortcutEnabled } = props

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (handleCanvasPointerModeHotkey(e)) return
      void handleCanvasZoomHotkey(e)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return launchSpotlightShortcutEnabled ? (
    <React.Suspense fallback={null}>
      <CanvasLaunchSpotlightHotkeyRuntimeLazy />
    </React.Suspense>
  ) : null
}
