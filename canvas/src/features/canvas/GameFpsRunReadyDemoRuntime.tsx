import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isGameFpsRunReadyDemoActive } from '@/features/workspace-fs/workspaceRunReadyDemos'
import {
  exitGameModeSurface,
  readGameModeSnapshot,
  startGameMode,
} from '@/features/game-fps/gameModeRuntime'

export function GameFpsRunReadyDemoRuntime() {
  const markdownDocumentName = useGraphStore(state => state.markdownDocumentName)
  const markdownDocumentText = useGraphStore(state => state.markdownDocumentText)
  const active = isGameFpsRunReadyDemoActive(markdownDocumentName, markdownDocumentText)
  const dedicatedDemo = isGameFpsRunReadyDemoActive()
  const ownsDocumentLaunchRef = React.useRef(false)
  const unmountTeardownTokenRef = React.useRef(0)

  React.useLayoutEffect(() => {
    unmountTeardownTokenRef.current += 1
    return () => {
      const teardownToken = unmountTeardownTokenRef.current + 1
      unmountTeardownTokenRef.current = teardownToken
      queueMicrotask(() => {
        if (unmountTeardownTokenRef.current !== teardownToken) return
        if (!ownsDocumentLaunchRef.current) return
        ownsDocumentLaunchRef.current = false
        if (isGameFpsRunReadyDemoActive()) return
        if (readGameModeSnapshot().active) exitGameModeSurface()
      })
    }
  }, [])

  React.useLayoutEffect(() => {
    if (!active) {
      if (ownsDocumentLaunchRef.current) {
        ownsDocumentLaunchRef.current = false
        exitGameModeSurface()
      }
      return undefined
    }
    if (!ownsDocumentLaunchRef.current && !readGameModeSnapshot().active) {
      ownsDocumentLaunchRef.current = true
    }
    void startGameMode({ surfaceMode: '3d', openPanel: !dedicatedDemo })
    if (dedicatedDemo) useGraphStore.getState().setBottomSurfaceCollapsed(true)
    return undefined
  }, [active, dedicatedDemo])

  return null
}
