import { readWebglSupport } from '@/lib/three/webglSupport'
import type { FlightSimMission } from './flightSimMission'
import type { FlightSimSnapshot } from './flightSimModel'
import {
  armFlightSimReadyFrame,
  beginFlightSimReadyFrame,
  cancelFlightSimReadyFrame,
  measureFlightSimGameplayNetworkBlock,
  measureFlightSimWebglAdmission,
} from './flightSimDeadlineRuntime'
import {
  blockFlightSimGameplayNetworkAttempt,
  FlightSimExternalCallBlockedError,
} from './flightSimExternalCallGuard'

export function readFlightSimWebglAdmission(
  webglSupported: boolean | undefined,
): Readonly<{ available: boolean; failureReason: string | null }> {
  if (webglSupported !== undefined) {
    return Object.freeze({
      available: webglSupported,
      failureReason: webglSupported ? null : 'WebGL is unavailable.',
    })
  }
  const admission = measureFlightSimWebglAdmission(() => readWebglSupport())
  return Object.freeze({
    available: admission.available,
    failureReason: admission.available
      ? null
      : admission.observation.withinLimit
        ? 'WebGL is unavailable.'
        : `WebGL admission exceeded ${admission.observation.limitMs} ms.`,
  })
}

export function startFlightSimWithReadyFrame(
  start: () => FlightSimSnapshot,
): FlightSimSnapshot {
  const requestId = beginFlightSimReadyFrame()
  const snapshot = start()
  if (snapshot.phase === 'ready' && snapshot.tick === 0 && !snapshot.runtimeError) {
    armFlightSimReadyFrame(requestId, snapshot.runId, snapshot.tick)
  } else {
    cancelFlightSimReadyFrame(requestId)
  }
  return snapshot
}

export function rejectFlightSimGameplayNetworkAttemptWithinDeadline(
  mission: FlightSimMission | null,
  operation: string,
  executor: () => unknown,
  reportError: (message: string) => FlightSimSnapshot,
): FlightSimSnapshot {
  if (!mission) {
    return reportError(
      `Flight Sim cannot reject gameplay network operation without a mission: ${operation}`,
    )
  }
  try {
    measureFlightSimGameplayNetworkBlock(
      operation,
      () => blockFlightSimGameplayNetworkAttempt(mission, operation, executor),
    )
  } catch (error) {
    if (error instanceof FlightSimExternalCallBlockedError) {
      return reportError(error.message)
    }
    throw error
  }
}
