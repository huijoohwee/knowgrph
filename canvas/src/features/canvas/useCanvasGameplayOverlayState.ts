import React from 'react'
import {
  readFlightSimSnapshot,
  subscribeFlightSimSnapshot,
} from '@/features/game-flight-sim/flightSimRuntime'
import {
  readGameModeSnapshot,
  subscribeGameModeSnapshot,
} from '@/features/game-fps/gameModeRuntime'

export function useCanvasGameplayOverlayState() {
  const gameMode = React.useSyncExternalStore(
    subscribeGameModeSnapshot,
    readGameModeSnapshot,
    readGameModeSnapshot,
  )
  const flightSim = React.useSyncExternalStore(
    subscribeFlightSimSnapshot,
    readFlightSimSnapshot,
    readFlightSimSnapshot,
  )
  return {
    gameMode,
    flightSim,
    gameFpsActive: gameMode.active,
    flightSimActive: flightSim.active,
  } as const
}
