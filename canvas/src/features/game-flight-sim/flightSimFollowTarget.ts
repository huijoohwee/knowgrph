import { flightSimForwardVector } from './flightModel'
import type { FlightSimSnapshot } from './flightSimModel'

export type FlightSimFollowTarget = Readonly<{
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  fovDegrees: number
  resetKey: number
  sequence: number
}>

export function resolveFlightSimFollowTarget(
  snapshot: FlightSimSnapshot,
  coordinateScale: number,
): FlightSimFollowTarget {
  const scale = Number.isFinite(coordinateScale) && coordinateScale > 0
    ? coordinateScale
    : 1
  const forward = flightSimForwardVector(
    snapshot.aircraft.pitch,
    snapshot.aircraft.yaw,
  )
  const target = Object.freeze([
    snapshot.aircraft.position[0] * scale,
    (snapshot.aircraft.position[1] + 0.8) * scale,
    snapshot.aircraft.position[2] * scale,
  ] as const)
  return Object.freeze({
    position: Object.freeze([
      target[0] - forward[0] * 8 * scale,
      target[1] - forward[1] * 2 * scale + 3.2 * scale,
      target[2] - forward[2] * 8 * scale,
    ] as const),
    target,
    fovDegrees: 58,
    resetKey: snapshot.runId,
    sequence: snapshot.tick,
  })
}
