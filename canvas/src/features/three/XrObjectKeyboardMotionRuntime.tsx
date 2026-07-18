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

function readKeyboardDelta(event: XrObjectKeyboardEvent): readonly [number, number] | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null
  const key = normalizeMovementKey(event.key)
  if (!MOVEMENT_KEYS.has(key)) return null
  const step = event.shiftKey ? XR_OBJECT_KEYBOARD_FINE_STEP_METERS : XR_OBJECT_KEYBOARD_STEP_METERS
  if (key === 'a' || key === 'ArrowLeft') return [-step, 0]
  if (key === 'd' || key === 'ArrowRight') return [step, 0]
  if (key === 'w' || key === 'ArrowUp') return [0, -step]
  return [0, step]
}

export function resolveXrObjectKeyboardMotionTarget(
  runtime: XrMotionReferenceRuntimeSnapshot,
  event: XrObjectKeyboardEvent,
): XrObjectKeyboardMotionTarget | null {
  const delta = readKeyboardDelta(event)
  const selection = runtime.selectedMark
  if (!delta || selection?.kind !== 'cast') return null
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

function isKeyboardMotionSurface(target: EventTarget | null): boolean {
  if (isEditableTarget(target)) return false
  const element = target instanceof Element ? target : null
  if (element?.closest('[data-kg-xr-lane-cast-mark][aria-pressed="true"]')) return true
  return !element?.closest('button, a, summary, [role="button"], [role="menuitem"], [role="option"], [role="slider"], [role="tab"]')
}

export function XrObjectKeyboardMotionRuntime() {
  const activeKeysRef = React.useRef(new Set<string>())
  const ownerIdRef = React.useRef('')

  React.useEffect(() => {
    const releaseOwnership = () => {
      const ownerId = ownerIdRef.current
      ownerIdRef.current = ''
      activeKeysRef.current.clear()
      if (ownerId) releaseThreeObjectKeyboardInputOwnership(ownerId)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isKeyboardMotionSurface(event.target)) return
      const target = resolveXrObjectKeyboardMotionTarget(readXrMotionReferenceRuntime(), event)
      if (!target) return
      if (ownerIdRef.current && ownerIdRef.current !== target.ownerId) releaseOwnership()
      if (!claimThreeObjectKeyboardInputOwnership(target.ownerId)) return
      ownerIdRef.current = target.ownerId
      activeKeysRef.current.add(normalizeMovementKey(event.key))
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      if (target.changed) {
        setXrMotionReferenceCastMarkChoreography({
          actorId: target.actorId,
          markId: target.markId,
          position: target.nextPosition,
        })
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = normalizeMovementKey(event.key)
      if (!MOVEMENT_KEYS.has(key)) return
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
