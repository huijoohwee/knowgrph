import type { JSONValue } from '@/lib/graph/types'
import {
  CAMERA_DEFAULT_ASPECT_RATIO_ID,
  CAMERA_DEFAULT_FOCUS_DISTANCE_METERS,
  CAMERA_DEFAULT_SENSOR_FORMAT_ID,
  clampCameraFocusDistanceMeters,
  formatCameraOptics,
  readCameraAspectRatioId,
  readCameraSensorFormatId,
  type CameraAspectRatioId,
  type CameraSensorFormatId,
} from './cameraOptics'

export const STRYBLDR_CAMERA_PROPERTY_KEY = 'strybldrCamera'

export const STRYBLDR_CAMERA_ANGLES = ['front', 'left-side', 'right-side', 'overhead'] as const
export const STRYBLDR_CAMERA_LEVELS = ['eye-level', 'high-angle', 'low-angle'] as const
export const STRYBLDR_CAMERA_SHOTS = ['wide', 'medium', 'close-up'] as const
export const STRYBLDR_CAMERA_MIN_FOCAL_LENGTH_MM = 8
export const STRYBLDR_CAMERA_MAX_FOCAL_LENGTH_MM = 300
export const STRYBLDR_CAMERA_DEFAULT_FOCAL_LENGTH_MM = 50

export type StrybldrCameraAngle = (typeof STRYBLDR_CAMERA_ANGLES)[number]
export type StrybldrCameraLevel = (typeof STRYBLDR_CAMERA_LEVELS)[number]
export type StrybldrCameraShot = (typeof STRYBLDR_CAMERA_SHOTS)[number]

export type StrybldrCameraSettings = {
  angle: StrybldrCameraAngle
  level: StrybldrCameraLevel
  shot: StrybldrCameraShot
  note: string
  orbitX: number
  orbitY: number
  sensorId: CameraSensorFormatId
  focalLengthMm: number
  focusDistanceMeters: number
  aspectRatio: CameraAspectRatioId
}

export const STRYBLDR_DEFAULT_CAMERA_SETTINGS: StrybldrCameraSettings = {
  angle: 'front',
  level: 'eye-level',
  shot: 'medium',
  note: '',
  orbitX: 0,
  orbitY: 0,
  sensorId: CAMERA_DEFAULT_SENSOR_FORMAT_ID,
  focalLengthMm: STRYBLDR_CAMERA_DEFAULT_FOCAL_LENGTH_MM,
  focusDistanceMeters: CAMERA_DEFAULT_FOCUS_DISTANCE_METERS,
  aspectRatio: CAMERA_DEFAULT_ASPECT_RATIO_ID,
}

const STRYBLDR_CAMERA_LABELS: Record<StrybldrCameraAngle | StrybldrCameraLevel | StrybldrCameraShot, string> = {
  front: 'Front',
  'left-side': 'Left Side',
  'right-side': 'Right Side',
  overhead: 'Overhead',
  'eye-level': 'Eye Level',
  'high-angle': 'High Angle',
  'low-angle': 'Low Angle',
  wide: 'Wide',
  medium: 'Medium',
  'close-up': 'Close-up',
}

const normalizeCameraToken = (value: unknown): string => {
  return String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-')
}

const normalizeCameraOption = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => {
  const normalized = normalizeCameraToken(value)
  return options.find(option => option === normalized) || fallback
}

const readRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

const clampCameraOrbit = (value: unknown): number => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return 0
  return Math.max(-1, Math.min(1, numberValue))
}

const clampFocalLengthMm = (value: unknown): number => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return STRYBLDR_CAMERA_DEFAULT_FOCAL_LENGTH_MM
  return Math.round(Math.max(STRYBLDR_CAMERA_MIN_FOCAL_LENGTH_MM, Math.min(STRYBLDR_CAMERA_MAX_FOCAL_LENGTH_MM, numberValue)) * 10) / 10
}

export const resolveStrybldrCameraOrbit = (
  orbitX: number,
  orbitY: number,
): Pick<StrybldrCameraSettings, 'angle' | 'level' | 'orbitX' | 'orbitY'> => {
  const x = clampCameraOrbit(orbitX)
  const y = clampCameraOrbit(orbitY)
  const level: StrybldrCameraLevel = y < -0.28 ? 'high-angle' : y > 0.28 ? 'low-angle' : 'eye-level'
  let angle: StrybldrCameraAngle = 'front'
  if (y < -0.72 && Math.abs(x) < 0.4) angle = 'overhead'
  else if (x < -0.22) angle = 'left-side'
  else if (x > 0.22) angle = 'right-side'
  return { angle, level, orbitX: x, orbitY: y }
}

const resolveStrybldrCameraOptionOrbit = (
  angle: StrybldrCameraAngle,
  level: StrybldrCameraLevel,
): Pick<StrybldrCameraSettings, 'orbitX' | 'orbitY'> => {
  const orbitX = angle === 'left-side' ? -0.25 : angle === 'right-side' ? 0.25 : 0
  const orbitY = angle === 'overhead' ? -1 : level === 'high-angle' ? -0.5 : level === 'low-angle' ? 0.5 : 0
  return { orbitX, orbitY }
}

export const hasStrybldrCameraSettings = (value: unknown): boolean => {
  const record = readRecord(value)
  return Object.keys(record).length > 0
}

export const readStrybldrCameraSettings = (value: unknown): StrybldrCameraSettings => {
  const record = readRecord(value)
  const angle = normalizeCameraOption(record.angle, STRYBLDR_CAMERA_ANGLES, STRYBLDR_DEFAULT_CAMERA_SETTINGS.angle)
  const level = normalizeCameraOption(record.level, STRYBLDR_CAMERA_LEVELS, STRYBLDR_DEFAULT_CAMERA_SETTINGS.level)
  const fallbackOrbit = resolveStrybldrCameraOptionOrbit(angle, level)
  return {
    angle,
    level,
    shot: normalizeCameraOption(record.shot, STRYBLDR_CAMERA_SHOTS, STRYBLDR_DEFAULT_CAMERA_SETTINGS.shot),
    note: String(record.note || '').trim(),
    orbitX: record.orbitX === undefined ? fallbackOrbit.orbitX : clampCameraOrbit(record.orbitX),
    orbitY: record.orbitY === undefined ? fallbackOrbit.orbitY : clampCameraOrbit(record.orbitY),
    sensorId: readCameraSensorFormatId(record.sensorId),
    focalLengthMm: clampFocalLengthMm(record.focalLengthMm),
    focusDistanceMeters: clampCameraFocusDistanceMeters(record.focusDistanceMeters),
    aspectRatio: readCameraAspectRatioId(record.aspectRatio),
  }
}

export const serializeStrybldrCameraSettings = (
  settings: Omit<StrybldrCameraSettings, 'orbitX' | 'orbitY' | 'sensorId' | 'focalLengthMm' | 'focusDistanceMeters' | 'aspectRatio'>
    & Partial<Pick<StrybldrCameraSettings, 'orbitX' | 'orbitY' | 'sensorId' | 'focalLengthMm' | 'focusDistanceMeters' | 'aspectRatio'>>,
): JSONValue => {
  return {
    angle: settings.angle,
    level: settings.level,
    shot: settings.shot,
    note: settings.note.trim(),
    orbitX: clampCameraOrbit(settings.orbitX),
    orbitY: clampCameraOrbit(settings.orbitY),
    sensorId: readCameraSensorFormatId(settings.sensorId),
    focalLengthMm: clampFocalLengthMm(settings.focalLengthMm),
    focusDistanceMeters: clampCameraFocusDistanceMeters(settings.focusDistanceMeters),
    aspectRatio: readCameraAspectRatioId(settings.aspectRatio),
  } as JSONValue
}

export const getStrybldrCameraLabel = (value: StrybldrCameraAngle | StrybldrCameraLevel | StrybldrCameraShot): string => {
  return STRYBLDR_CAMERA_LABELS[value]
}

export const formatStrybldrCameraSettings = (settings: StrybldrCameraSettings): string => {
  const base = [
    getStrybldrCameraLabel(settings.angle),
    getStrybldrCameraLabel(settings.level),
    getStrybldrCameraLabel(settings.shot),
  ].join(' · ')
  const note = settings.note.trim()
  return note ? `${base} · ${note}` : base
}

export const buildStrybldrCameraHandoffLine = (settings: StrybldrCameraSettings): string => {
  return `Camera: ${formatStrybldrCameraSettings(settings)} · ${formatCameraOptics(settings)}`
}
