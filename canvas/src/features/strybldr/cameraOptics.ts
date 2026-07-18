export const CAMERA_SENSOR_FORMAT_IDS = ['super-16', 'super-35', 'full-frame', '65mm'] as const
export const CAMERA_ASPECT_RATIO_IDS = ['4:3', '16:9', '1.85:1', '2.39:1'] as const

export type CameraSensorFormatId = (typeof CAMERA_SENSOR_FORMAT_IDS)[number]
export type CameraAspectRatioId = (typeof CAMERA_ASPECT_RATIO_IDS)[number]

export type CameraSensorFormat = Readonly<{
  id: CameraSensorFormatId
  label: string
  widthMm: number
  heightMm: number
}>

export type CameraAspectRatio = Readonly<{
  id: CameraAspectRatioId
  label: string
  value: number
}>

export const CAMERA_SENSOR_FORMATS: readonly CameraSensorFormat[] = Object.freeze([
  Object.freeze({ id: 'super-16', label: 'Super 16', widthMm: 12.4, heightMm: 7 }),
  Object.freeze({ id: 'super-35', label: 'Super 35', widthMm: 27.99, heightMm: 19.22 }),
  Object.freeze({ id: 'full-frame', label: 'Full Frame', widthMm: 36, heightMm: 24 }),
  Object.freeze({ id: '65mm', label: '65mm', widthMm: 54.12, heightMm: 25.58 }),
])

export const CAMERA_ASPECT_RATIOS: readonly CameraAspectRatio[] = Object.freeze([
  Object.freeze({ id: '4:3', label: '4:3', value: 4 / 3 }),
  Object.freeze({ id: '16:9', label: '16:9', value: 16 / 9 }),
  Object.freeze({ id: '1.85:1', label: '1.85:1', value: 1.85 }),
  Object.freeze({ id: '2.39:1', label: '2.39:1', value: 2.39 }),
])

export const CAMERA_DEFAULT_SENSOR_FORMAT_ID: CameraSensorFormatId = 'full-frame'
export const CAMERA_DEFAULT_ASPECT_RATIO_ID: CameraAspectRatioId = '16:9'
export const CAMERA_MIN_FOCUS_DISTANCE_METERS = 0.1
export const CAMERA_MAX_FOCUS_DISTANCE_METERS = 1_000
export const CAMERA_DEFAULT_FOCUS_DISTANCE_METERS = 5

const round = (value: number, precision = 10): number => Math.round(value * precision) / precision

export const readCameraSensorFormatId = (value: unknown): CameraSensorFormatId => {
  const normalized = String(value || '').trim().toLowerCase()
  return CAMERA_SENSOR_FORMAT_IDS.find(id => id === normalized) || CAMERA_DEFAULT_SENSOR_FORMAT_ID
}

export const readCameraAspectRatioId = (value: unknown): CameraAspectRatioId => {
  const normalized = String(value || '').trim().toLowerCase()
  return CAMERA_ASPECT_RATIO_IDS.find(id => id === normalized) || CAMERA_DEFAULT_ASPECT_RATIO_ID
}

export const clampCameraFocusDistanceMeters = (value: unknown): number => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return CAMERA_DEFAULT_FOCUS_DISTANCE_METERS
  return round(Math.max(CAMERA_MIN_FOCUS_DISTANCE_METERS, Math.min(CAMERA_MAX_FOCUS_DISTANCE_METERS, numberValue)))
}

export const resolveCameraSensorFormat = (value: unknown): CameraSensorFormat => {
  const id = readCameraSensorFormatId(value)
  return CAMERA_SENSOR_FORMATS.find(sensor => sensor.id === id) || CAMERA_SENSOR_FORMATS[2]!
}

export const resolveCameraAspectRatio = (value: unknown): CameraAspectRatio => {
  const id = readCameraAspectRatioId(value)
  return CAMERA_ASPECT_RATIOS.find(aspect => aspect.id === id) || CAMERA_ASPECT_RATIOS[1]!
}

export const resolveCameraVerticalFovDegreesForOptics = (sensorId: unknown, focalLengthMmValue: unknown): number => {
  const focalLengthMm = Math.max(0.001, Number(focalLengthMmValue) || 50)
  const sensor = resolveCameraSensorFormat(sensorId)
  return 2 * Math.atan(sensor.heightMm / (2 * focalLengthMm)) * 180 / Math.PI
}

export const resolveCameraHorizontalFovDegreesForOptics = (sensorId: unknown, focalLengthMmValue: unknown): number => {
  const focalLengthMm = Math.max(0.001, Number(focalLengthMmValue) || 50)
  const sensor = resolveCameraSensorFormat(sensorId)
  return 2 * Math.atan(sensor.widthMm / (2 * focalLengthMm)) * 180 / Math.PI
}

export const resolveFullFrameEquivalentFocalLengthMm = (sensorId: unknown, focalLengthMmValue: unknown): number => {
  const focalLengthMm = Math.max(0.001, Number(focalLengthMmValue) || 50)
  return round(focalLengthMm * 36 / resolveCameraSensorFormat(sensorId).widthMm)
}

export const resolveCameraFramingFocalScale = (sensorId: unknown, focalLengthMmValue: unknown): number => {
  const focalLengthMm = Math.max(0.001, Number(focalLengthMmValue) || 50)
  return focalLengthMm / 50 * 24 / resolveCameraSensorFormat(sensorId).heightMm
}

export const formatCameraOptics = (settings: Readonly<{
  sensorId: CameraSensorFormatId
  focalLengthMm: number
  focusDistanceMeters: number
  aspectRatio: CameraAspectRatioId
}>): string => {
  return `${resolveCameraSensorFormat(settings.sensorId).label} · ${settings.focalLengthMm}mm · focus ${settings.focusDistanceMeters}m · ${settings.aspectRatio}`
}
