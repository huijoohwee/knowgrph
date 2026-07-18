import React from 'react'
import { isEditableTarget } from '@/lib/canvas/arrangeShortcuts'
import {
  resolveXrMotionReferenceStage,
  type XrMotionReferenceVector,
} from './xrMotionReferenceModel'
import {
  readXrMotionReferenceRuntime,
  setXrMotionReferenceCastMarkChoreography,
  type XrMotionReferenceRuntimeSnapshot,
} from './xrMotionReferenceRuntime'
import {
  claimThreeObjectKeyboardInputOwnership,
  releaseThreeObjectKeyboardInputOwnership,
} from './threeObjectInputOwnership'
import {
  THREE_OBJECT_KEYBOARD_HOLD_DELAY_MS,
  clampThreeObjectPlanarPosition,
  normalizeThreeObjectKeyboardKey,
  readThreeObjectKeyboardMovementKey,
  resolveThreeObjectKeyboardMotionDirection,
  resolveThreeObjectKeyboardMotionFrameDistance,
  resolveThreeObjectKeyboardMotionPosition,
  resolveThreeObjectKeyboardTapDelta,
  type ThreeObjectKeyboardEvent,
} from './threeObjectKeyboardMotion'

export type XrObjectKeyboardMotionTarget = Readonly<{
  actorId: string
  changed: boolean
  markId: string
  nextPosition: XrMotionReferenceVector
  ownerId: string
}>

function resolveKeyboardMotionTarget(
  runtime: XrMotionReferenceRuntimeSnapshot,
  delta: readonly [number, number],
): XrObjectKeyboardMotionTarget | null {
  const selection = runtime.selectedMark
  if (selection?.kind !== 'cast') return null
  const mark = runtime.plan.cast
    .find(track => track.actorId === selection.actorId)
    ?.marks.find(candidate => candidate.id === selection.markId)
  if (!mark) return null
  const stage = resolveXrMotionReferenceStage(runtime.plan.stageId)
  const halfWidth = stage.sizeMeters[0] / 2
  const halfDepth = stage.sizeMeters[1] / 2
  const nextPosition = clampThreeObjectPlanarPosition({
    bounds: { halfDepth, halfWidth },
    delta,
    position: mark.position,
  }) as XrMotionReferenceVector
  return Object.freeze({
    actorId: selection.actorId,
    changed: nextPosition[0] !== mark.position[0] || nextPosition[2] !== mark.position[2],
    markId: selection.markId,
    ownerId: `xr:keyboard:${selection.actorId}:${selection.markId}`,
    nextPosition,
  })
}

export function resolveXrObjectKeyboardMotionTarget(
  runtime: XrMotionReferenceRuntimeSnapshot,
  event: ThreeObjectKeyboardEvent,
): XrObjectKeyboardMotionTarget | null {
  const delta = resolveThreeObjectKeyboardTapDelta(event)
  return delta ? resolveKeyboardMotionTarget(runtime, delta) : null
}

export function resolveXrObjectKeyboardMotionFrameTarget(
  runtime: XrMotionReferenceRuntimeSnapshot,
  keys: Iterable<string>,
  distanceMeters: number,
): XrObjectKeyboardMotionTarget | null {
  const selection = runtime.selectedMark
  if (selection?.kind !== 'cast') return null
  const mark = runtime.plan.cast
    .find(track => track.actorId === selection.actorId)
    ?.marks.find(candidate => candidate.id === selection.markId)
  if (!mark) return null
  const stage = resolveXrMotionReferenceStage(runtime.plan.stageId)
  const nextPosition = resolveThreeObjectKeyboardMotionPosition({
    bounds: {
      halfDepth: stage.sizeMeters[1] / 2,
      halfWidth: stage.sizeMeters[0] / 2,
    },
    distanceMeters,
    keys,
    position: mark.position,
  })
  if (!nextPosition) return null
  return Object.freeze({
    actorId: selection.actorId,
    changed: nextPosition[0] !== mark.position[0] || nextPosition[2] !== mark.position[2],
    markId: selection.markId,
    ownerId: `xr:keyboard:${selection.actorId}:${selection.markId}`,
    nextPosition: nextPosition as XrMotionReferenceVector,
  })
}

function isKeyboardMotionSurface(target: EventTarget | null): boolean {
  if (isEditableTarget(target)) return false
  const element = target instanceof Element ? target : null
  if (element?.closest('[data-kg-xr-lane-cast-mark][aria-pressed="true"]')) return true
  return !element?.closest('button, a, summary, [role="button"], [role="menuitem"], [role="option"], [role="slider"], [role="tab"]')
}

export function XrObjectKeyboardMotionRuntime() {
  const activeKeysRef = React.useRef(new Set<string>())
  const fineMotionRef = React.useRef(false)
  const frameRequestRef = React.useRef<number | null>(null)
  const holdReadyAtRef = React.useRef(0)
  const previousFrameTimeRef = React.useRef<number | null>(null)
  const ownerIdRef = React.useRef('')

  React.useEffect(() => {
    const releaseOwnership = () => {
      if (frameRequestRef.current !== null) window.cancelAnimationFrame(frameRequestRef.current)
      frameRequestRef.current = null
      fineMotionRef.current = false
      holdReadyAtRef.current = 0
      previousFrameTimeRef.current = null
      const ownerId = ownerIdRef.current
      ownerIdRef.current = ''
      activeKeysRef.current.clear()
      if (ownerId) releaseThreeObjectKeyboardInputOwnership(ownerId)
    }

    const applyTarget = (target: XrObjectKeyboardMotionTarget) => {
      if (!target.changed) return
      setXrMotionReferenceCastMarkChoreography({
        actorId: target.actorId,
        markId: target.markId,
        position: target.nextPosition,
      })
    }

    function scheduleAnimationFrame() {
      if (frameRequestRef.current !== null) return
      frameRequestRef.current = window.requestAnimationFrame(runAnimationFrame)
    }

    function runAnimationFrame(timestamp: number) {
      frameRequestRef.current = null
      if (!ownerIdRef.current || activeKeysRef.current.size === 0) {
        releaseOwnership()
        return
      }
      const previousFrameTime = previousFrameTimeRef.current
      previousFrameTimeRef.current = timestamp
      if (previousFrameTime !== null && timestamp > holdReadyAtRef.current) {
        const direction = resolveThreeObjectKeyboardMotionDirection(activeKeysRef.current)
        if (direction) {
          const deltaMs = timestamp - Math.max(previousFrameTime, holdReadyAtRef.current)
          const distanceMeters = resolveThreeObjectKeyboardMotionFrameDistance(deltaMs, fineMotionRef.current)
          const target = resolveXrObjectKeyboardMotionFrameTarget(
            readXrMotionReferenceRuntime(),
            activeKeysRef.current,
            distanceMeters,
          )
          if (!target || target.ownerId !== ownerIdRef.current) {
            releaseOwnership()
            return
          }
          applyTarget(target)
        }
      }
      scheduleAnimationFrame()
    }

    const isolateKeyboardEvent = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = normalizeThreeObjectKeyboardKey(event.key)
      if (key === 'Alt' || key === 'Control' || key === 'Meta') {
        if (activeKeysRef.current.size > 0) releaseOwnership()
        return
      }
      if (key === 'Shift') {
        if (activeKeysRef.current.size > 0) fineMotionRef.current = true
        return
      }
      if (!isKeyboardMotionSurface(event.target)) return
      const target = resolveXrObjectKeyboardMotionTarget(readXrMotionReferenceRuntime(), event)
      if (!target) return
      if (ownerIdRef.current && ownerIdRef.current !== target.ownerId) releaseOwnership()
      if (!claimThreeObjectKeyboardInputOwnership(target.ownerId)) return
      ownerIdRef.current = target.ownerId
      fineMotionRef.current = Boolean(event.shiftKey)
      isolateKeyboardEvent(event)
      if (activeKeysRef.current.has(key)) return
      activeKeysRef.current.add(key)
      applyTarget(target)
      if (activeKeysRef.current.size === 1) {
        holdReadyAtRef.current = performance.now() + THREE_OBJECT_KEYBOARD_HOLD_DELAY_MS
        previousFrameTimeRef.current = null
      }
      scheduleAnimationFrame()
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = normalizeThreeObjectKeyboardKey(event.key)
      if (key === 'Shift') {
        fineMotionRef.current = false
        return
      }
      if (!readThreeObjectKeyboardMovementKey(key)) return
      if (!activeKeysRef.current.has(key)) return
      isolateKeyboardEvent(event)
      fineMotionRef.current = Boolean(event.shiftKey)
      activeKeysRef.current.delete(key)
      if (activeKeysRef.current.size === 0) releaseOwnership()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') releaseOwnership()
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    window.addEventListener('blur', releaseOwnership)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('keyup', handleKeyUp, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('blur', releaseOwnership)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      releaseOwnership()
    }
  }, [])

  return null
}
