import { CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT } from '@/lib/chatEndpoint'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsInt, lsJson } from '@/lib/persistence'

export type BytePlusImageWidgetDefaults = {
  model: string
  size: string
  output_format: string
  response_format: string
  optimize_prompt_options: string
  aspect_ratio: number
  stream: boolean
  watermark: boolean
  seed: number
  guidance_scale: number
}

export function readBytePlusImageWidgetDefaults(): BytePlusImageWidgetDefaults {
  const model = lsJson<string>(LS_KEYS.byteplusImageModel, CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT, value => (typeof value === 'string' ? value : null))
  const size = lsJson<string>(LS_KEYS.byteplusImageSize, '2K', value => (typeof value === 'string' ? value : null))
  const outputFormat = lsJson<string>(LS_KEYS.byteplusImageOutputFormat, 'jpeg', value => (typeof value === 'string' ? value : null))
  const responseFormat = lsJson<string>(LS_KEYS.byteplusImageResponseFormat, 'b64_json', value => (typeof value === 'string' ? value : null))
  const optimizePromptOptions = lsJson<string>(LS_KEYS.byteplusImageOptimizePromptOptions, 'fast', value => (typeof value === 'string' ? value : null))
  const aspectRatio = lsJson<number>(LS_KEYS.byteplusImageAspectRatio, 0.0625, value => (typeof value === 'number' && Number.isFinite(value) ? value : null))
  const stream = lsBool(LS_KEYS.byteplusImageStream, true)
  const watermark = lsBool(LS_KEYS.byteplusImageWatermark, false)
  const seed = lsInt(LS_KEYS.byteplusImageSeed, 0)
  const guidanceScale = lsJson<number>(LS_KEYS.byteplusImageGuidanceScale, 0, value => (typeof value === 'number' && Number.isFinite(value) ? value : null))
  return {
    model: typeof model === 'string' && model.trim() ? model.trim() : CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
    size: typeof size === 'string' && size.trim() ? size.trim().toUpperCase() : '2K',
    output_format: typeof outputFormat === 'string' && outputFormat.trim() ? outputFormat.trim().toLowerCase() : 'jpeg',
    response_format: typeof responseFormat === 'string' && responseFormat.trim().toLowerCase() === 'url' ? 'url' : 'b64_json',
    optimize_prompt_options: typeof optimizePromptOptions === 'string' && optimizePromptOptions.trim().toLowerCase() === 'standard' ? 'standard' : 'fast',
    aspect_ratio: typeof aspectRatio === 'number' && Number.isFinite(aspectRatio) ? Math.max(0.0625, Math.min(16, aspectRatio)) : 0.0625,
    stream: stream === true,
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
    response_format: hasNonEmptyString(local.response_format) ? local.response_format.trim().toLowerCase() : defaults.response_format,
    optimize_prompt_options: hasNonEmptyString(local.optimize_prompt_options) ? local.optimize_prompt_options.trim().toLowerCase() : defaults.optimize_prompt_options,
    aspect_ratio: hasFiniteNumber(local.aspect_ratio) ? local.aspect_ratio : defaults.aspect_ratio,
    stream: typeof local.stream === 'boolean' ? local.stream : defaults.stream,
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
    response_format: defaults.response_format,
    optimize_prompt_options: defaults.optimize_prompt_options,
    aspect_ratio: defaults.aspect_ratio,
    stream: defaults.stream,
    watermark: defaults.watermark,
    seed: defaults.seed,
    guidance_scale: defaults.guidance_scale,
  }
}
