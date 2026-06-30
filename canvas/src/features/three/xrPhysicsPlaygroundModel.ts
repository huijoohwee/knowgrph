export type XrPhysicsControllerMode = 'roll' | 'thrust'

export type XrPhysicsPlaygroundMetrics = {
  cx: number
  cy: number
  z: number
  span: number
}

export type XrPhysicsPlaygroundState = {
  activeMode: XrPhysicsControllerMode
  rollWorldPosition: [number, number, number]
  thrustWorldPosition: [number, number, number]
  rollPosition: [number, number, number]
  thrustPosition: [number, number, number]
  velocityVector: [number, number, number]
  cameraAnchorWorldPosition: [number, number, number]
  cameraAnchor: [number, number, number]
  collisionBoundaryRadius: number
  stabilization: number
  inputIntensity: number
}

export type XrPhysicsPlaygroundControls = {
  activeMode?: XrPhysicsControllerMode
  moveX?: number
  moveY?: number
  jump?: boolean
  thrust?: boolean
  stabilize?: boolean
}

export const XR_PHYSICS_CONTROLLER_MODES: readonly XrPhysicsControllerMode[] = ['roll', 'thrust']
export const XR_PHYSICS_WORLD_AXES = {
  x: 'lateral-left-right',
  y: 'vertical-gravity-up',
  z: 'forward-depth',
} as const

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function resolveXrPhysicsPlaygroundState(
  metrics: XrPhysicsPlaygroundMetrics,
  elapsedSeconds: number,
  controls: XrPhysicsPlaygroundControls = {},
): XrPhysicsPlaygroundState {
  const span = Math.max(1, metrics.span)
  const t = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0
  const activeMode: XrPhysicsControllerMode = controls.activeMode || (Math.floor(t / 5) % 2 === 0 ? 'roll' : 'thrust')
  const moveX = clamp(Number(controls.moveX) || 0, -1, 1)
  const moveY = clamp(Number(controls.moveY) || 0, -1, 1)
  const inputIntensity = clamp(Math.hypot(moveX, moveY) + (controls.jump ? 0.4 : 0) + (controls.thrust ? 0.5 : 0), 0, 1)
  const trackRadius = span * 0.26
  const rollAngle = t * 0.72
  const thrustPhase = t * 1.16
  const rollWorldPosition: [number, number, number] = [
    Math.cos(rollAngle) * trackRadius + moveX * span * 0.08,
    34 + Math.max(0, Math.sin(t * 2.1)) * span * 0.018 + (controls.jump ? span * 0.035 : 0),
    Math.sin(rollAngle) * trackRadius * 0.42 - span * 0.18 + moveY * span * 0.06,
  ]
  const thrustWorldPosition: [number, number, number] = [
    Math.sin(thrustPhase) * span * 0.2 + moveX * span * 0.1,
    62 + Math.max(0, Math.sin(thrustPhase)) * span * 0.06 + (controls.thrust ? span * 0.08 : 0),
    span * 0.18 + Math.cos(thrustPhase * 0.7) * span * 0.08 + moveY * span * 0.07,
  ]
  const rollPosition = projectXrPhysicsWorldToCanvasStage(metrics, rollWorldPosition)
  const thrustPosition = projectXrPhysicsWorldToCanvasStage(metrics, thrustWorldPosition)
  const velocityVector: [number, number, number] = activeMode === 'roll'
    ? [Math.sin(rollAngle) * span * 0.08 + moveX * span * 0.05, controls.jump ? span * 0.025 : 0, Math.cos(rollAngle) * span * 0.03 + moveY * span * 0.04]
    : [Math.sin(thrustPhase) * span * 0.035 + moveX * span * 0.04, span * 0.08 + (controls.thrust ? span * 0.055 : 0), Math.cos(thrustPhase) * span * 0.025 + moveY * span * 0.05]
  const anchorSource = activeMode === 'roll' ? rollWorldPosition : thrustWorldPosition
  const cameraAnchorWorldPosition: [number, number, number] = [
    anchorSource[0] * 0.42,
    anchorSource[1] + span * 0.16,
    anchorSource[2] * 0.42,
  ]
  const cameraAnchor = projectXrPhysicsWorldToCanvasStage(metrics, cameraAnchorWorldPosition)
  return {
    activeMode,
    rollWorldPosition,
    thrustWorldPosition,
    rollPosition,
    thrustPosition,
    velocityVector,
    cameraAnchorWorldPosition,
    cameraAnchor,
    collisionBoundaryRadius: clamp(span * 0.31, 80, 260),
    stabilization: clamp((activeMode === 'thrust' ? 0.55 + Math.sin(t * 1.4) * 0.18 : 0.2) + (controls.stabilize ? 0.28 : 0), 0, 1),
    inputIntensity,
  }
}

export function projectXrPhysicsWorldToCanvasStage(
  metrics: XrPhysicsPlaygroundMetrics,
  worldPosition: [number, number, number],
): [number, number, number] {
  return [worldPosition[0], worldPosition[2], metrics.z + worldPosition[1]]
}
