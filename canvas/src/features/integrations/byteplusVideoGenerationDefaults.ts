import { CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } from '@/lib/chatEndpoint'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsInt, lsJson } from '@/lib/persistence'

export type BytePlusVideoWidgetDefaults = {
  model: string
  content_json: string
  aspect_ratio: string
  resolution: string
  duration: number
  generate_audio: boolean
  fast: boolean
  watermark: boolean
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeAspectRatio(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'portrait' || raw === 'square') return raw
  return 'landscape'
}

function normalizeResolution(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return raw === '1080p' ? '1080p' : '720p'
}

function normalizeDuration(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : Number.NaN
  if (Number.isFinite(numeric) && numeric > 0) return Math.max(1, Math.min(60, numeric))
  return 5
}

export function readBytePlusVideoWidgetDefaults(): BytePlusVideoWidgetDefaults {
  const model = lsJson<string>(LS_KEYS.byteplusVideoModel, CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT, value => (typeof value === 'string' ? value : null))
  const contentJson = lsJson<string>(LS_KEYS.byteplusVideoContentJson, '', value => (typeof value === 'string' ? value : null))
  const aspectRatio = lsJson<string>(LS_KEYS.byteplusVideoAspectRatio, 'landscape', value => (typeof value === 'string' ? value : null))
  const resolution = lsJson<string>(LS_KEYS.byteplusVideoResolution, '720p', value => (typeof value === 'string' ? value : null))
  const duration = lsInt(LS_KEYS.byteplusVideoDuration, 5)
  const generateAudio = lsBool(LS_KEYS.byteplusVideoGenerateAudio, false)
  const fast = lsBool(LS_KEYS.byteplusVideoFast, false)
  const watermark = lsBool(LS_KEYS.byteplusVideoWatermark, false)
  return {
    model: hasNonEmptyString(model) ? model.trim() : CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
    content_json: typeof contentJson === 'string' ? contentJson : '',
    aspect_ratio: normalizeAspectRatio(aspectRatio),
    resolution: normalizeResolution(resolution),
    duration: normalizeDuration(duration),
    generate_audio: generateAudio === true,
    fast: fast === true,
    watermark: watermark === true,
  }
}

export function resolveEffectiveBytePlusVideoWidgetProperties(args: {
  localProperties?: Record<string, unknown>
}): Record<string, unknown> {
  const local = { ...(args.localProperties || {}) }
  const defaults = readBytePlusVideoWidgetDefaults()
  return {
    ...local,
    model: hasNonEmptyString(local.model) ? local.model.trim() : defaults.model,
    content_json: typeof local.content_json === 'string' ? local.content_json : defaults.content_json,
    aspect_ratio: hasNonEmptyString(local.aspect_ratio) ? normalizeAspectRatio(local.aspect_ratio) : defaults.aspect_ratio,
    resolution: hasNonEmptyString(local.resolution) ? normalizeResolution(local.resolution) : defaults.resolution,
    duration: hasFiniteNumber(local.duration) ? normalizeDuration(local.duration) : defaults.duration,
    generate_audio: typeof local.generate_audio === 'boolean' ? local.generate_audio : defaults.generate_audio,
    fast: typeof local.fast === 'boolean' ? local.fast : defaults.fast,
    watermark: typeof local.watermark === 'boolean' ? local.watermark : defaults.watermark,
  }
}

export function buildBytePlusVideoWidgetSeedProperties(args?: {
  prompt?: string
}): Record<string, unknown> {
  const defaults = readBytePlusVideoWidgetDefaults()
  return {
    model: defaults.model,
    prompt: String(args?.prompt || '').trim(),
    content_json: defaults.content_json,
    aspect_ratio: defaults.aspect_ratio,
    resolution: defaults.resolution,
    duration: defaults.duration,
    generate_audio: defaults.generate_audio,
    fast: defaults.fast,
    watermark: defaults.watermark,
  }
}
