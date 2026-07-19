import {
  readStrybldrCameraSettings,
  resolveStrybldrCameraOrbit,
  type StrybldrCameraSettings,
} from '@/features/strybldr/strybldrCamera'
import type { XrChoreographyEasing } from './xrChoreographyEasing'

export const XR_CAMERA_MOVE_PRESETS = [
  {
    id: 'orbit-clockwise',
    label: 'Orbit clockwise',
    description: 'Sweep from the subject camera-left side to camera-right on a constant framing radius.',
    rig: 'dolly',
    easing: 'ease-in-out',
    defaultDurationSeconds: 3,
  },
  {
    id: 'orbit-counterclockwise',
    label: 'Orbit counterclockwise',
    description: 'Reverse the subject-centered orbital sweep without changing the cast path.',
    rig: 'dolly',
    easing: 'ease-in-out',
    defaultDurationSeconds: 3,
  },
  {
    id: 'crane-rise',
    label: 'Crane rise',
    description: 'Rise from a low subject angle into a high reveal while retaining the selected framing.',
    rig: 'crane',
    easing: 'ease-in-out',
    defaultDurationSeconds: 3,
  },
  {
    id: 'crane-descend',
    label: 'Crane descend',
    description: 'Descend from a high reveal into a grounded subject-level composition.',
    rig: 'crane',
    easing: 'ease-in-out',
    defaultDurationSeconds: 3,
  },
  {
    id: 'drone-follow',
    label: 'Drone follow',
    description: 'Hold an elevated trailing offset that rides the subject path at every sampled frame.',
    rig: 'drone',
    easing: 'ease-in-out',
    defaultDurationSeconds: 4,
  },
  {
    id: 'vertigo-dolly-zoom',
    label: 'Vertigo dolly-zoom',
    description: 'Dolly away while zooming in so the subject scale stays stable and the background compresses.',
    rig: 'dolly',
    easing: 'ease-in-out',
    defaultDurationSeconds: 3,
  },
] as const

export type XrCameraMovePreset = (typeof XR_CAMERA_MOVE_PRESETS)[number]
export type XrCameraMovePresetId = XrCameraMovePreset['id']
export type XrCameraMoveId = 'custom' | XrCameraMovePresetId

export type XrCameraMoveMarkDraft = Readonly<{
  timeSeconds: number
  anchorId: string
  moveId: XrCameraMovePresetId
  rig: XrCameraMovePreset['rig']
  easing: XrChoreographyEasing
  settings: StrybldrCameraSettings
}>

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export function isXrCameraMovePresetId(value: unknown): value is XrCameraMovePresetId {
  return XR_CAMERA_MOVE_PRESETS.some(preset => preset.id === String(value || '').trim())
}

export function readXrCameraMoveId(value: unknown): XrCameraMoveId {
  return isXrCameraMovePresetId(value) ? value : 'custom'
}

export function resolveXrCameraMovePreset(value: unknown): XrCameraMovePreset {
  return XR_CAMERA_MOVE_PRESETS.find(preset => preset.id === value) || XR_CAMERA_MOVE_PRESETS[0]
}

export function resolveXrCameraMoveLabel(value: unknown): string {
  return isXrCameraMovePresetId(value) ? resolveXrCameraMovePreset(value).label : 'Custom marks'
}

function withOrbit(settings: StrybldrCameraSettings, orbitX: number, orbitY: number): StrybldrCameraSettings {
  return readStrybldrCameraSettings({
    ...settings,
    ...resolveStrybldrCameraOrbit(orbitX, orbitY),
  })
}

function resolveMoveSettings(
  moveId: XrCameraMovePresetId,
  settingsValue: unknown,
): readonly [StrybldrCameraSettings, StrybldrCameraSettings] {
  const settings = readStrybldrCameraSettings(settingsValue)
  if (moveId === 'orbit-clockwise') {
    return [withOrbit(settings, -0.42, settings.orbitY), withOrbit(settings, 0.42, settings.orbitY)]
  }
  if (moveId === 'orbit-counterclockwise') {
    return [withOrbit(settings, 0.42, settings.orbitY), withOrbit(settings, -0.42, settings.orbitY)]
  }
  if (moveId === 'crane-rise') {
    return [withOrbit(settings, settings.orbitX, 0.22), withOrbit(settings, settings.orbitX, -0.48)]
  }
  if (moveId === 'crane-descend') {
    return [withOrbit(settings, settings.orbitX, -0.48), withOrbit(settings, settings.orbitX, 0.12)]
  }
  if (moveId === 'drone-follow') {
    const follow = withOrbit(readStrybldrCameraSettings({ ...settings, shot: 'wide' }), 0, -0.22)
    return [follow, follow]
  }
  return [
    readStrybldrCameraSettings({ ...settings, focalLengthMm: 28 }),
    readStrybldrCameraSettings({ ...settings, focalLengthMm: 105 }),
  ]
}

export function buildXrCameraMoveMarkDrafts(args: {
  moveId: XrCameraMovePresetId
  anchorId: string
  playheadSeconds: number
  moveDurationSeconds?: number
  planDurationSeconds: number
  settings: unknown
}): readonly [XrCameraMoveMarkDraft, XrCameraMoveMarkDraft] {
  const preset = resolveXrCameraMovePreset(args.moveId)
  const planDurationSeconds = clamp(Number(args.planDurationSeconds) || 1, 1, 30)
  const requestedDuration = clamp(
    Number(args.moveDurationSeconds) || preset.defaultDurationSeconds,
    0.25,
    planDurationSeconds,
  )
  const requestedStart = clamp(Number(args.playheadSeconds) || 0, 0, planDurationSeconds)
  const startTimeSeconds = requestedStart + 0.25 <= planDurationSeconds
    ? requestedStart
    : Math.max(0, planDurationSeconds - requestedDuration)
  const endTimeSeconds = Math.min(planDurationSeconds, Math.max(startTimeSeconds + 0.25, startTimeSeconds + requestedDuration))
  const [startSettings, endSettings] = resolveMoveSettings(preset.id, args.settings)
  const base = {
    anchorId: String(args.anchorId || '').trim(),
    moveId: preset.id,
    rig: preset.rig,
    easing: preset.easing as XrChoreographyEasing,
  }
  return Object.freeze([
    Object.freeze({ ...base, timeSeconds: Number(startTimeSeconds.toFixed(3)), settings: startSettings }),
    Object.freeze({ ...base, timeSeconds: Number(endTimeSeconds.toFixed(3)), settings: endSettings }),
  ])
}
