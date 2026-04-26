import { CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } from '@/lib/chatEndpoint'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsInt, lsJson } from '@/lib/persistence'

export type BytePlusVideoWidgetDefaults = {
  model: string
  content_json: string
  ratio: string
  resolution: string
  duration: number
  generate_audio: boolean
  draft: boolean
  camera_fixed: boolean
  image_url_url: string
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeResolution(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === '1080p') return '1080p'
  if (raw === '720p') return '720p'
  return '480p'
}

function normalizeDuration(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : Number.NaN
  if (Number.isFinite(numeric) && numeric > 0) return Math.max(2, Math.min(15, numeric))
  return 2
}

function normalizeRatio(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  const normalized = raw.replace(/\s+/g, '').toLowerCase()
  if (normalized === '4:3') return '4:3'
  if (normalized === '1:1') return '1:1'
  if (normalized === '3:4') return '3:4'
  if (normalized === '9:16') return '9:16'
  if (normalized === '21:9') return '21:9'
  return '16:9'
}

function normalizeImageUrlUrlMode(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return raw === 'url' ? 'url' : 'base64'
}

export function readBytePlusVideoWidgetDefaults(): BytePlusVideoWidgetDefaults {
  const model = lsJson<string>(LS_KEYS.byteplusVideoModel, CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT, value => (typeof value === 'string' ? value : null))
  const contentJson = lsJson<string>(LS_KEYS.byteplusVideoContentJson, '', value => (typeof value === 'string' ? value : null))
  const ratio = lsJson<string>(LS_KEYS.byteplusVideoRatio, '16:9', value => (typeof value === 'string' ? value : null))
  const resolution = lsJson<string>(LS_KEYS.byteplusVideoResolution, '480p', value => (typeof value === 'string' ? value : null))
  const duration = lsInt(LS_KEYS.byteplusVideoDuration, 2)
  const generateAudio = lsBool(LS_KEYS.byteplusVideoGenerateAudio, false)
  const draft = lsBool(LS_KEYS.byteplusVideoDraft, true)
  const cameraFixed = lsBool(LS_KEYS.byteplusVideoCameraFixed, false)
  const imageUrlUrlMode = lsJson<string>(LS_KEYS.byteplusVideoImageUrlUrl, 'base64', value => (typeof value === 'string' ? value : null))
  return {
    model: hasNonEmptyString(model) ? model.trim() : CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
    content_json: typeof contentJson === 'string' ? contentJson : '',
    ratio: normalizeRatio(ratio),
    resolution: normalizeResolution(resolution),
    duration: normalizeDuration(duration),
    generate_audio: generateAudio === true,
    draft: draft === true,
    camera_fixed: cameraFixed === true,
    image_url_url: normalizeImageUrlUrlMode(imageUrlUrlMode),
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
    ratio: hasNonEmptyString(local.ratio) ? normalizeRatio(local.ratio) : defaults.ratio,
    resolution: hasNonEmptyString(local.resolution) ? normalizeResolution(local.resolution) : defaults.resolution,
    duration: hasFiniteNumber(local.duration) ? normalizeDuration(local.duration) : defaults.duration,
    generate_audio: typeof local.generate_audio === 'boolean' ? local.generate_audio : defaults.generate_audio,
    draft: typeof local.draft === 'boolean' ? local.draft : defaults.draft,
    camera_fixed: typeof local.camera_fixed === 'boolean' ? local.camera_fixed : defaults.camera_fixed,
    image_url_url: hasNonEmptyString(local.image_url_url) ? normalizeImageUrlUrlMode(local.image_url_url) : defaults.image_url_url,
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
    ratio: defaults.ratio,
    resolution: defaults.resolution,
    duration: defaults.duration,
    generate_audio: defaults.generate_audio,
    draft: defaults.draft,
    camera_fixed: defaults.camera_fixed,
    image_url_url: defaults.image_url_url,
  }
}
