import React from 'react'
import {
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from './xrMotionReferenceRuntime'

export type ThreeObjectInputOwnership = Readonly<{
  active: boolean
  nodeId: string | null
  pointerId: number | null
  revision: number
}>

export type ThreeViewportControlsTarget = {
  enabled: boolean
}

const listeners = new Set<() => void>()
let ownership: ThreeObjectInputOwnership = Object.freeze({
  active: false,
  nodeId: null,
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

export function claimThreeObjectInputOwnership(nodeId: string, pointerId: number): boolean {
  const normalizedNodeId = String(nodeId || '').trim()
  if (!normalizedNodeId || !Number.isFinite(pointerId)) return false
  if (ownership.active) {
    return ownership.nodeId === normalizedNodeId && ownership.pointerId === pointerId
  }
  ownership = Object.freeze({
    active: true,
    nodeId: normalizedNodeId,
    pointerId,
    revision: ownership.revision + 1,
  })
  publishOwnershipChange()
  return true
}

export function releaseThreeObjectInputOwnership(nodeId: string, pointerId?: number): void {
  if (!ownership.active || ownership.nodeId !== String(nodeId || '').trim()) return
  if (typeof pointerId === 'number' && pointerId !== ownership.pointerId) return
  ownership = Object.freeze({
    active: false,
    nodeId: null,
    pointerId: null,
    revision: ownership.revision + 1,
  })
  publishOwnershipChange()
}

export function bindThreeViewportControlsOwnership(args: {
  controls: ThreeViewportControlsTarget
  baseEnabled: boolean
}): () => void {
  const sync = () => {
    args.controls.enabled = args.baseEnabled
      && !readThreeObjectInputOwnership().active
      && !readXrMotionReferenceRuntime().viewportControlActive
  }
  const unsubscribeObject = subscribeThreeObjectInputOwnership(sync)
  const unsubscribeXr = subscribeXrMotionReferenceRuntime(sync)
  sync()
  return () => {
    unsubscribeObject()
    unsubscribeXr()
  }
}

function publishOwnershipChange(): void {
  for (const listener of [...listeners]) listener()
}
