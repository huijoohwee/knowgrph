export type CanvasAspectRatioMode = '16:9' | '9:16'

export const CANVAS_ASPECT_RATIO_MODE_DEFAULT: CanvasAspectRatioMode = '16:9'
export const CANVAS_ASPECT_RATIO_DISPLAY_CONTROL_ID = 'control:aspectRatio' as const

export const CANVAS_ASPECT_RATIO_DISPLAY_CONTROL_TITLE = 'Aspect'
export const CANVAS_ASPECT_RATIO_DISPLAY_CONTROL_LABEL = 'Aspect'
export const CANVAS_ASPECT_RATIO_DISPLAY_CONTROL_DESCRIPTION = 'Toggle card aspect ratio'

export type CanvasAspectRatioDisplayControlId = typeof CANVAS_ASPECT_RATIO_DISPLAY_CONTROL_ID

export type CanvasAspectRatioOption = {
  value: CanvasAspectRatioMode
  label: string
}

export type CanvasAspectRatioSize = {
  width: number
  height: number
}

export const CANVAS_ASPECT_RATIO_OPTIONS: readonly CanvasAspectRatioOption[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
]

export const readCanvasAspectRatioMode = (raw: unknown): CanvasAspectRatioMode =>
  String(raw || '').trim() === '9:16' ? '9:16' : CANVAS_ASPECT_RATIO_MODE_DEFAULT

const readPositiveFiniteNumber = (value: unknown): number | null => {
  const next = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(next) && next > 0 ? next : null
}

export const readCanvasAspectRatioWidthToHeight = (mode: unknown): number =>
  readCanvasAspectRatioMode(mode) === '9:16' ? 9 / 16 : 16 / 9

export const resolveCanvasAspectRatioSize = (args: {
  defaultWidth: number
  mode: unknown
  width?: unknown
}): CanvasAspectRatioSize => {
  const width = readPositiveFiniteNumber(args.width) || readPositiveFiniteNumber(args.defaultWidth) || 1
  const ratio = readCanvasAspectRatioWidthToHeight(args.mode)
  return {
    width,
    height: Math.round(width / ratio),
  }
}

export const toggleCanvasAspectRatioMode = (mode: unknown): CanvasAspectRatioMode =>
  readCanvasAspectRatioMode(mode) === '16:9' ? '9:16' : '16:9'

export const readCanvasAspectRatioDisplayControlActive = (mode: unknown): boolean =>
  readCanvasAspectRatioMode(mode) === '9:16'

export const readCanvasAspectRatioDisplayControlTitle = (mode: unknown): string => {
  const current = readCanvasAspectRatioMode(mode)
  const option = CANVAS_ASPECT_RATIO_OPTIONS.find(candidate => candidate.value === current)
  return option ? `${CANVAS_ASPECT_RATIO_DISPLAY_CONTROL_TITLE}: ${option.label}` : CANVAS_ASPECT_RATIO_DISPLAY_CONTROL_TITLE
}
