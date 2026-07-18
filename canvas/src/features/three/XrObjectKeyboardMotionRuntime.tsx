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

export const XR_OBJECT_KEYBOARD_STEP_METERS = 0.25
export const XR_OBJECT_KEYBOARD_FINE_STEP_METERS = 0.05
export const XR_OBJECT_KEYBOARD_HOLD_DELAY_MS = 160
export const XR_OBJECT_KEYBOARD_SPEED_METERS_PER_SECOND = 2
export const XR_OBJECT_KEYBOARD_FINE_SPEED_METERS_PER_SECOND = 0.4
export const XR_OBJECT_KEYBOARD_MAX_FRAME_DELTA_MS = 50

type XrObjectKeyboardEvent = Readonly<{
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}>

export type XrObjectKeyboardMotionTarget = Readonly<{
  actorId: string
  changed: boolean
  markId: string
  nextPosition: XrMotionReferenceVector
  ownerId: string
}>

const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

const normalizeMovementKey = (keyValue: string): string => {
  const key = String(keyValue || '')
  return key.length === 1 ? key.toLowerCase() : key
}

function readKeyboardTapDelta(event: XrObjectKeyboardEvent): readonly [number, number] | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null
  const key = normalizeMovementKey(event.key)
  if (!MOVEMENT_KEYS.has(key)) return null
  const step = event.shiftKey ? XR_OBJECT_KEYBOARD_FINE_STEP_METERS : XR_OBJECT_KEYBOARD_STEP_METERS
  if (key === 'a' || key === 'ArrowLeft') return [-step, 0]
  if (key === 'd' || key === 'ArrowRight') return [step, 0]
  if (key === 'w' || key === 'ArrowUp') return [0, -step]
  return [0, step]
}

export function resolveXrObjectKeyboardMotionDirection(
  keys: Iterable<string>,
): readonly [number, number] | null {
  const normalizedKeys = new Set([...keys].map(normalizeMovementKey))
  const x = Number(normalizedKeys.has('d') || normalizedKeys.has('ArrowRight'))
    - Number(normalizedKeys.has('a') || normalizedKeys.has('ArrowLeft'))
  const z = Number(normalizedKeys.has('s') || normalizedKeys.has('ArrowDown'))
    - Number(normalizedKeys.has('w') || normalizedKeys.has('ArrowUp'))
  const magnitude = Math.hypot(x, z)
  return magnitude > 0 ? [x / magnitude, z / magnitude] : null
}

export function resolveXrObjectKeyboardMotionFrameDistance(
  deltaMs: number,
  fine: boolean,
): number {
  const finiteDeltaMs = Number.isFinite(deltaMs) ? deltaMs : 0
  const boundedDeltaMs = Math.max(0, Math.min(XR_OBJECT_KEYBOARD_MAX_FRAME_DELTA_MS, finiteDeltaMs))
  const speed = fine
    ? XR_OBJECT_KEYBOARD_FINE_SPEED_METERS_PER_SECOND
    : XR_OBJECT_KEYBOARD_SPEED_METERS_PER_SECOND
  return speed * boundedDeltaMs / 1000
}

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
  const nextPosition = Object.freeze([
    Math.max(-halfWidth, Math.min(halfWidth, mark.position[0] + delta[0])),
    mark.position[1],
    Math.max(-halfDepth, Math.min(halfDepth, mark.position[2] + delta[1])),
  ]) as XrMotionReferenceVector
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
  event: XrObjectKeyboardEvent,
): XrObjectKeyboardMotionTarget | null {
  const delta = readKeyboardTapDelta(event)
  return delta ? resolveKeyboardMotionTarget(runtime, delta) : null
}

export function resolveXrObjectKeyboardMotionFrameTarget(
  runtime: XrMotionReferenceRuntimeSnapshot,
  keys: Iterable<string>,
  distanceMeters: number,
): XrObjectKeyboardMotionTarget | null {
  const direction = resolveXrObjectKeyboardMotionDirection(keys)
  if (!direction || !Number.isFinite(distanceMeters) || distanceMeters <= 0) return null
  return resolveKeyboardMotionTarget(runtime, [
    direction[0] * distanceMeters,
    direction[1] * distanceMeters,
  ])
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
        const direction = resolveXrObjectKeyboardMotionDirection(activeKeysRef.current)
        if (direction) {
          const deltaMs = timestamp - Math.max(previousFrameTime, holdReadyAtRef.current)
          const distanceMeters = resolveXrObjectKeyboardMotionFrameDistance(deltaMs, fineMotionRef.current)
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
      const key = normalizeMovementKey(event.key)
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
        holdReadyAtRef.current = performance.now() + XR_OBJECT_KEYBOARD_HOLD_DELAY_MS
        previousFrameTimeRef.current = null
      }
      scheduleAnimationFrame()
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = normalizeMovementKey(event.key)
      if (key === 'Shift') {
        fineMotionRef.current = false
        return
      }
      if (!MOVEMENT_KEYS.has(key)) return
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
