import { CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT } from '@/lib/chatEndpoint'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsInt, lsJson } from '@/lib/persistence'

export type BytePlusImageWidgetDefaults = {
  model: string
  size: string
  output_format: string
  watermark: boolean
  seed: number
  guidance_scale: number
}

export function readBytePlusImageWidgetDefaults(): BytePlusImageWidgetDefaults {
  const model = lsJson<string>(LS_KEYS.byteplusImageModel, CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT, value => (typeof value === 'string' ? value : null))
  const size = lsJson<string>(LS_KEYS.byteplusImageSize, '2K', value => (typeof value === 'string' ? value : null))
  const outputFormat = lsJson<string>(LS_KEYS.byteplusImageOutputFormat, 'jpeg', value => (typeof value === 'string' ? value : null))
  const watermark = lsBool(LS_KEYS.byteplusImageWatermark, false)
  const seed = lsInt(LS_KEYS.byteplusImageSeed, 0)
  const guidanceScale = lsJson<number>(LS_KEYS.byteplusImageGuidanceScale, 0, value => (typeof value === 'number' && Number.isFinite(value) ? value : null))
  return {
    model: typeof model === 'string' && model.trim() ? model.trim() : CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
    size: typeof size === 'string' && size.trim() ? size.trim().toUpperCase() : '2K',
    output_format: typeof outputFormat === 'string' && outputFormat.trim() ? outputFormat.trim().toLowerCase() : 'jpeg',
    watermark: watermark === true,
    seed: Number.isFinite(seed) ? seed : 0,
    guidance_scale: typeof guidanceScale === 'number' && Number.isFinite(guidanceScale) ? guidanceScale : 0,
  }
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function resolveEffectiveBytePlusImageWidgetProperties(args: {
  localProperties?: Record<string, unknown>
}): Record<string, unknown> {
  const local = { ...(args.localProperties || {}) }
  const defaults = readBytePlusImageWidgetDefaults()
  return {
    ...local,
    model: hasNonEmptyString(local.model) ? local.model.trim() : defaults.model,
    size: hasNonEmptyString(local.size) ? local.size.trim().toUpperCase() : defaults.size,
    output_format: hasNonEmptyString(local.output_format) ? local.output_format.trim().toLowerCase() : defaults.output_format,
    watermark: typeof local.watermark === 'boolean' ? local.watermark : defaults.watermark,
    seed: hasFiniteNumber(local.seed) ? local.seed : defaults.seed,
    guidance_scale: hasFiniteNumber(local.guidance_scale) ? local.guidance_scale : defaults.guidance_scale,
  }
}

export function buildBytePlusImageWidgetSeedProperties(args?: {
  prompt?: string
}): Record<string, unknown> {
  const defaults = readBytePlusImageWidgetDefaults()
  return {
    model: defaults.model,
    prompt: String(args?.prompt || '').trim(),
    size: defaults.size,
    output_format: defaults.output_format,
    watermark: defaults.watermark,
    seed: defaults.seed,
    guidance_scale: defaults.guidance_scale,
  }
}
