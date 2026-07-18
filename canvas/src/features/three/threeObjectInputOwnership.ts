import React from 'react'

export type ThreeObjectInputOwnership = Readonly<{
  active: boolean
  objectId: string | null
  pointerId: number | null
  revision: number
}>

export type ThreeViewportControlsTarget = {
  enabled: boolean
}

export type ThreeObjectCameraPoseLock<Pose> = Readonly<{
  start: () => void
  enforce: () => void
  finish: () => void
}>

const listeners = new Set<() => void>()
let ownership: ThreeObjectInputOwnership = Object.freeze({
  active: false,
  objectId: null,
  pointerId: null,
  revision: 0,
})

export function readThreeObjectInputOwnership(): ThreeObjectInputOwnership {
  return ownership
}

export function subscribeThreeObjectInputOwnership(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useThreeObjectInputOwnership(): ThreeObjectInputOwnership {
  return React.useSyncExternalStore(
    subscribeThreeObjectInputOwnership,
    readThreeObjectInputOwnership,
    readThreeObjectInputOwnership,
  )
}

export function canStartThreeObjectDrag(button: number): boolean {
  return button === 0
}

export function hasThreeObjectDragMoved(
  start: Readonly<{ x: number; y: number }>,
  current: Readonly<{ x: number; y: number }>,
  thresholdPx = 3,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= Math.max(0, thresholdPx)
}

export function threeObjectDragTerminationMatchesPointer(
  event: { readonly pointerId?: unknown },
  activePointerId: number | null,
): boolean {
  return typeof event.pointerId !== 'number' || event.pointerId === activePointerId
}

export function isolateThreeObjectPointerEvent(event: {
  stopPropagation: () => void
  nativeEvent?: {
    preventDefault?: () => void
    stopImmediatePropagation?: () => void
  }
}): void {
  event.stopPropagation()
  event.nativeEvent?.preventDefault?.()
  event.nativeEvent?.stopImmediatePropagation?.()
}

export function captureThreeObjectPointer(event: {
  pointerId: number
  target?: unknown
}): void {
  try {
    const target = event.target as { setPointerCapture?: (pointerId: number) => void } | undefined
    target?.setPointerCapture?.(event.pointerId)
  } catch {
    void 0
  }
}

export function releaseThreeObjectPointerCapture(event: {
  pointerId: number
  target?: unknown
}): void {
  try {
    const target = event.target as { releasePointerCapture?: (pointerId: number) => void } | undefined
    target?.releasePointerCapture?.(event.pointerId)
  } catch {
    void 0
  }
}

export function createThreeObjectCameraPoseLock<Pose>(args: {
  capture: () => Pose
  restore: (pose: Pose) => void
}): ThreeObjectCameraPoseLock<Pose> {
  let lockedPose: Pose | null = null
  return Object.freeze({
    start: () => {
      if (lockedPose === null) lockedPose = args.capture()
    },
    enforce: () => {
      if (lockedPose !== null) args.restore(lockedPose)
    },
    finish: () => {
      if (lockedPose === null) return
      const pose = lockedPose
      lockedPose = null
      args.restore(pose)
    },
  })
}

export function claimThreeObjectInputOwnership(objectId: string, pointerId: number): boolean {
  const normalizedObjectId = String(objectId || '').trim()
  if (!normalizedObjectId || !Number.isFinite(pointerId)) return false
  if (ownership.active) {
    return ownership.objectId === normalizedObjectId && ownership.pointerId === pointerId
  }
  ownership = Object.freeze({
    active: true,
    objectId: normalizedObjectId,
    pointerId,
    revision: ownership.revision + 1,
  })
  publishOwnershipChange()
  return true
}

export function releaseThreeObjectInputOwnership(objectId: string, pointerId?: number): void {
  if (!ownership.active || ownership.objectId !== String(objectId || '').trim()) return
  if (typeof pointerId === 'number' && pointerId !== ownership.pointerId) return
  ownership = Object.freeze({
    active: false,
    objectId: null,
    pointerId: null,
    revision: ownership.revision + 1,
  })
  publishOwnershipChange()
}

export function bindThreeViewportControlsOwnership(args: {
  controls: ThreeViewportControlsTarget
  baseEnabled: boolean
  onActiveChange?: (active: boolean) => void
}): () => void {
  let previousActive: boolean | null = null
  const sync = () => {
    const active = readThreeObjectInputOwnership().active
    if (active !== previousActive) {
      previousActive = active
      args.onActiveChange?.(active)
    }
    args.controls.enabled = args.baseEnabled
      && !active
  }
  const unsubscribeObject = subscribeThreeObjectInputOwnership(sync)
  sync()
  return () => {
    unsubscribeObject()
  }
}

function publishOwnershipChange(): void {
  for (const listener of [...listeners]) listener()
}
