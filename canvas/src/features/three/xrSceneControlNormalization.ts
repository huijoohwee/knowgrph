import type {
  XrMotionReferenceTransition,
  XrMotionReferenceVector,
} from './xrMotionReferenceModel'
import {
  normalizeXrPhysicsControl,
  parseXrInteractiveInvocation,
  type XrPhysicsControlInput,
} from './xrSceneInteractiveInvocation'
import {
  XR_SCENE_INVOCATION_COMMANDS,
  XR_SCENE_INVOCATION_SEMANTICS,
} from './xrSceneMcpContract.mjs'

export type XrSceneTransition = XrMotionReferenceTransition
export type XrSceneControlAction = 'stage' | 'place' | 'transform' | 'transition' | 'label' | 'remove' | 'physics' | 'present'

export type XrSceneControlInput = Readonly<{
  invocation?: string
  action?: XrSceneControlAction
  stageId?: string
  assetId?: string
  subjectId?: string
  label?: string
  transition?: XrSceneTransition
  position?: XrMotionReferenceVector
  rotationYDegrees?: number
  scale?: number
  color?: string
  physics?: XrPhysicsControlInput
}>

export type NormalizedXrSceneControl = Readonly<{
  action: XrSceneControlAction
  stageId: string
  assetId: string
  subjectId: string
  label: string
  transition: XrSceneTransition
  position?: XrMotionReferenceVector
  rotationYDegrees?: number
  scale?: number
  color?: string
  physics: XrPhysicsControlInput | null
  invocation: string
}>

const asTransition = (value: unknown): XrSceneTransition | null => {
  const normalized = String(value || '').trim()
  if (!normalized) return 'linear'
  return normalized === 'linear' || normalized === 'hold' ? normalized : null
}

const cleanTarget = (value: unknown): string => {
  const normalized = String(value || '').trim().replace(/^@+/, '')
  try {
    return decodeURIComponent(normalized)
  } catch {
    return normalized
  }
}

const cleanLabel = (value: unknown): string => String(value || '').trim()
const textLength = (value: string): number => Array.from(value).length
const hasBoundedText = (value: unknown, maxLength?: number): value is string => {
  if (typeof value !== 'string' || !value.trim()) return false
  return maxLength === undefined || textLength(value) <= maxLength
}
const hasValidTransition = (value: unknown): boolean => (
  value === undefined || value === 'linear' || value === 'hold'
)

function parsePairs(tokens: readonly string[], allowedKeys: readonly string[]): Readonly<Record<string, string>> | null {
  const entries: Array<readonly [string, string]> = []
  const seen = new Set<string>()
  for (const token of tokens) {
    const separator = token.indexOf('=')
    if (separator <= 0 || separator === token.length - 1) return null
    const key = token.slice(0, separator)
    const value = token.slice(separator + 1)
    if (!allowedKeys.includes(key) || seen.has(key)) return null
    seen.add(key)
    entries.push([key, value])
  }
  return Object.freeze(Object.fromEntries(entries))
}

function parseXrSceneInvocation(invocationValue: unknown): Partial<NormalizedXrSceneControl> | null {
  const invocation = String(invocationValue || '').trim()
  if (!invocation) return null
  const interactive = parseXrInteractiveInvocation(invocation)
  if (interactive?.action === 'physics') {
    return { action: 'physics', physics: interactive.physics, invocation }
  }
  if (interactive?.action === 'present') return { action: 'present', invocation }
  const tokens = invocation.split(/\s+/).filter(Boolean)
  const command = tokens[0]
  const action = command === XR_SCENE_INVOCATION_COMMANDS.stage
    ? 'stage'
    : command === XR_SCENE_INVOCATION_COMMANDS.place
      ? 'place'
      : command === XR_SCENE_INVOCATION_COMMANDS.transform
        ? 'transform'
        : command === XR_SCENE_INVOCATION_COMMANDS.label
          ? 'label'
          : command === XR_SCENE_INVOCATION_COMMANDS.remove
            ? 'remove'
            : null
  if (!action || tokens.slice(1).some(token => token.startsWith('/'))) return null
  const semantics = tokens.slice(1).filter(token => token.startsWith('#'))
  if (action === 'transform') {
    if (semantics.length !== 1 || semantics[0] !== XR_SCENE_INVOCATION_SEMANTICS.transform) return null
  } else if (semantics.length > 0) return null
  const bindings = tokens.slice(1).filter(token => token.startsWith('@'))
  if (bindings.length !== 1) return null
  const target = cleanTarget(bindings[0])
  if (!target) return null
  const allowedPairKeys = action === 'place'
    ? ['transition', 'label']
    : action === 'transform'
      ? ['asset', 'position', 'rotation', 'scale', 'color']
      : action === 'label' ? ['label'] : []
  const pairs = parsePairs(tokens.slice(1).filter(token => !token.startsWith('@') && !token.startsWith('#')), allowedPairKeys)
  if (!pairs) return null
  const transition = asTransition(pairs.transition)
  if (!transition || (action === 'label' && !String(pairs.label || '').trim())) return null
  const label = cleanLabel(pairs.label)
  if (textLength(label) > 80 || ((action === 'transform' || action === 'label' || action === 'remove') && textLength(target) > 160)) return null
  if (action === 'stage') return { action, stageId: target, invocation, transition }
  if (action === 'place') return { action, assetId: target, invocation, transition, label }
  if (action === 'transform') {
    const assetId = cleanTarget(pairs.asset)
    const positionValues = pairs.position?.split(',').map(Number)
    const position = positionValues?.length === 3 && positionValues.every(Number.isFinite)
      ? [positionValues[0]!, positionValues[1]!, positionValues[2]!] as XrMotionReferenceVector
      : undefined
    const rotationYDegrees = pairs.rotation === undefined ? undefined : Number(pairs.rotation)
    const scale = pairs.scale === undefined ? undefined : Number(pairs.scale)
    const color = String(pairs.color || '').trim().toLowerCase()
    if (pairs.position !== undefined && !position) return null
    if (pairs.asset !== undefined && (!assetId || textLength(assetId) > 160)) return null
    if (rotationYDegrees !== undefined && !Number.isFinite(rotationYDegrees)) return null
    if (scale !== undefined && !Number.isFinite(scale)) return null
    if (pairs.color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) return null
    if (!assetId && !position && rotationYDegrees === undefined && scale === undefined && !color) return null
    return {
      action,
      subjectId: target,
      assetId,
      invocation,
      transition,
      ...(position ? { position } : {}),
      ...(rotationYDegrees !== undefined ? { rotationYDegrees } : {}),
      ...(scale !== undefined ? { scale } : {}),
      ...(color ? { color } : {}),
    }
  }
  return { action, subjectId: target, invocation, transition, label }
}

export function normalizeXrSceneControl(input: XrSceneControlInput): NormalizedXrSceneControl | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const inputKeys = Object.keys(input)
  if (input.invocation !== undefined && typeof input.invocation !== 'string') return null
  const invocation = String(input.invocation || '').trim()
  const parsed = parseXrSceneInvocation(invocation)
  if (invocation && (inputKeys.length !== 1 || inputKeys[0] !== 'invocation' || !parsed)) return null
  const action = (parsed?.action || input.action) as XrSceneControlAction | undefined
  if (!action || !['stage', 'place', 'transform', 'transition', 'label', 'remove', 'physics', 'present'].includes(action)) return null
  if (!invocation) {
    if (typeof input.action !== 'string') return null
    const shape = {
      stage: { allowed: ['action', 'stageId'], required: ['stageId'] },
      place: { allowed: ['action', 'assetId', 'label', 'transition'], required: ['assetId'] },
      transform: { allowed: ['action', 'subjectId', 'assetId', 'position', 'rotationYDegrees', 'scale', 'color'], required: ['subjectId'] },
      transition: { allowed: ['action', 'subjectId', 'transition'], required: ['subjectId'] },
      label: { allowed: ['action', 'subjectId', 'label'], required: ['subjectId', 'label'] },
      remove: { allowed: ['action', 'subjectId'], required: ['subjectId'] },
      physics: { allowed: ['action', 'physics'], required: ['physics'] },
      present: { allowed: ['action'], required: [] },
    }[action]
    if (inputKeys.some(key => !shape.allowed.includes(key))
      || shape.required.some(key => !Object.hasOwn(input, key))) return null
    if (action === 'stage' && (!hasBoundedText(input.stageId) || !cleanTarget(input.stageId))) return null
    if (action === 'place' && (
      !hasBoundedText(input.assetId)
      || !cleanTarget(input.assetId)
      || (Object.hasOwn(input, 'label') && !hasBoundedText(input.label, 80))
      || !hasValidTransition(input.transition)
    )) return null
    if (action === 'transition' && (
      !hasBoundedText(input.subjectId, 160)
      || !cleanTarget(input.subjectId)
      || !hasValidTransition(input.transition)
    )) return null
    if (action === 'transform' && (
      !hasBoundedText(input.subjectId, 160)
      || !cleanTarget(input.subjectId)
      || (!Object.hasOwn(input, 'assetId') && !Object.hasOwn(input, 'position') && !Object.hasOwn(input, 'rotationYDegrees') && !Object.hasOwn(input, 'scale') && !Object.hasOwn(input, 'color'))
      || (input.assetId !== undefined && (!hasBoundedText(input.assetId, 160) || !cleanTarget(input.assetId)))
      || (input.position !== undefined && (
        !Array.isArray(input.position)
        || input.position.length !== 3
        || input.position.some((value, index) => !Number.isFinite(value) || value < (index === 1 ? 0 : -50) || value > 50)
      ))
      || (input.rotationYDegrees !== undefined && (!Number.isFinite(input.rotationYDegrees) || input.rotationYDegrees < -180 || input.rotationYDegrees > 180))
      || (input.scale !== undefined && (!Number.isFinite(input.scale) || input.scale < 0.25 || input.scale > 4))
      || (input.color !== undefined && !/^#[0-9a-f]{6}$/i.test(input.color))
    )) return null
    if (action === 'label' && (
      !hasBoundedText(input.subjectId, 160)
      || !cleanTarget(input.subjectId)
      || !hasBoundedText(input.label, 80)
    )) return null
    if (action === 'remove' && (
      !hasBoundedText(input.subjectId, 160) || !cleanTarget(input.subjectId)
    )) return null
  }
  const transition = asTransition(parsed?.transition ?? input.transition)
  if (!transition) return null
  const assetId = cleanTarget(parsed?.assetId || input.assetId)
  const position = parsed?.position || input.position
  const rotationYDegrees = parsed?.rotationYDegrees ?? input.rotationYDegrees
  const scale = parsed?.scale ?? input.scale
  const color = String(parsed?.color || input.color || '').toLowerCase()
  if (action === 'transform' && (
    !assetId && !position && rotationYDegrees === undefined && scale === undefined && !color
    || (assetId && textLength(assetId) > 160)
    || (position !== undefined && (
      position.length !== 3
      || position.some((value, index) => !Number.isFinite(value) || value < (index === 1 ? 0 : -50) || value > 50)
    ))
    || (rotationYDegrees !== undefined && (!Number.isFinite(rotationYDegrees) || rotationYDegrees < -180 || rotationYDegrees > 180))
    || (scale !== undefined && (!Number.isFinite(scale) || scale < 0.25 || scale > 4))
    || (color && !/^#[0-9a-f]{6}$/i.test(color))
  )) return null
  const physics = action === 'physics'
    ? parsed?.physics || normalizeXrPhysicsControl(input.physics)
    : null
  if (action === 'physics' && !physics) return null
  return {
    action,
    stageId: cleanTarget(parsed?.stageId || input.stageId),
    assetId,
    subjectId: cleanTarget(parsed?.subjectId || input.subjectId),
    label: cleanLabel(parsed?.label || input.label),
    transition,
    ...(position ? { position: [...position] as XrMotionReferenceVector } : {}),
    ...(rotationYDegrees !== undefined ? { rotationYDegrees } : {}),
    ...(scale !== undefined ? { scale } : {}),
    ...(color ? { color } : {}),
    physics,
    invocation: String(parsed?.invocation || input.invocation || '').trim(),
  }
}
