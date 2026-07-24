import React from 'react'
import {
  exitFlightSimSurface,
  startFlightSim,
} from '@/features/game-flight-sim/flightSimRuntime'
import { isFlightSimRunReadyDemoActive } from '@/features/workspace-fs/workspaceRunReadyDemos'
import { useGraphStore } from '@/hooks/useGraphStore'

export function FlightSimRunReadyDemoRuntime() {
  const markdownDocumentName = useGraphStore(state => state.markdownDocumentName)
  const markdownDocumentText = useGraphStore(state => state.markdownDocumentText)
  const active = isFlightSimRunReadyDemoActive(markdownDocumentName, markdownDocumentText)
  const ownsDocumentLaunchRef = React.useRef(false)
  const launchGenerationRef = React.useRef(0)

  React.useLayoutEffect(() => {
    const generation = launchGenerationRef.current + 1
    launchGenerationRef.current = generation
    if (!active) {
      if (ownsDocumentLaunchRef.current) {
        ownsDocumentLaunchRef.current = false
        exitFlightSimSurface({ restorePreviousSurface: false })
      }
      return
    }
    if (ownsDocumentLaunchRef.current) return
    ownsDocumentLaunchRef.current = true
    void startFlightSim({ openPanel: true }).catch(error => {
      if (launchGenerationRef.current !== generation) return
      const message = error instanceof Error ? error.message : String(error || 'Flight Sim launch failed')
      useGraphStore.getState().pushUiToast({
        id: 'flight-sim:run-ready-launch:error',
        kind: 'error',
        message,
      })
    })
  }, [active])

  React.useLayoutEffect(() => () => {
    const teardownGeneration = launchGenerationRef.current + 1
    launchGenerationRef.current = teardownGeneration
    queueMicrotask(() => {
      if (launchGenerationRef.current !== teardownGeneration) return
      if (!ownsDocumentLaunchRef.current || isFlightSimRunReadyDemoActive()) return
      ownsDocumentLaunchRef.current = false
      exitFlightSimSurface({ restorePreviousSurface: false })
    })
  }, [])
  return null
}
