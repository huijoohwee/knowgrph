import {
  CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS,
  CHAT_BYTEPLUS_VIDEO_MODEL_OPTIONS,
  CHAT_GEMINI_VIDEO_MODEL_OPTIONS,
} from '@/lib/chatEndpointModels'
import type { MediaLightboxPromptParameter } from '@/lib/ui/MediaLightbox'

export type MediaLightboxPromptKind = 'image' | 'video' | 'audio' | 'media'

export const IMAGE_ASPECT_RATIO_PARAMETER_OPTIONS = [
  { value: 'landscape', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: 'square', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: 'portrait', label: '9:16' },
] as const

export const VIDEO_ASPECT_RATIO_PARAMETER_OPTIONS = [
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
] as const

export const MEDIA_RESOLUTION_PARAMETER_OPTIONS = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '2K', label: '2K' },
] as const

export const MEDIA_DURATION_PARAMETER_OPTIONS = [
  { value: '4', label: '4s' },
  { value: '8', label: '8s' },
  { value: '12', label: '12s' },
] as const

export const MEDIA_VARIATION_COUNT_PARAMETER_OPTIONS = [
  { value: '1', label: 'x1' },
  { value: '2', label: 'x2' },
  { value: '4', label: 'x4' },
] as const

export const MEDIA_KIND_PARAMETER_OPTIONS = [
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
] as const

export function normalizeMediaLightboxPromptText(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function buildUniquePromptParameterOptions(values: readonly string[], currentValue: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const seen = new Set<string>()
  const push = (value: string) => {
    const cleanValue = normalizeMediaLightboxPromptText(value)
    if (!cleanValue || seen.has(cleanValue)) return
    seen.add(cleanValue)
    options.push({ value: cleanValue, label: cleanValue })
  }
  push(currentValue)
  values.forEach(push)
  return options
}

export function buildMediaLightboxPromptParameters(props: {
  kind: MediaLightboxPromptKind
  model?: string
}): readonly MediaLightboxPromptParameter[] {
  const currentModel = normalizeMediaLightboxPromptText(props.model || '')
  const modelOptions = props.kind === 'image'
    ? buildUniquePromptParameterOptions(CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS, currentModel)
    : props.kind === 'video'
      ? buildUniquePromptParameterOptions([...CHAT_BYTEPLUS_VIDEO_MODEL_OPTIONS, ...CHAT_GEMINI_VIDEO_MODEL_OPTIONS], currentModel)
      : currentModel
        ? buildUniquePromptParameterOptions([currentModel], currentModel)
        : []
  const parameters: MediaLightboxPromptParameter[] = []
  if (modelOptions.length > 0) {
    parameters.push({
      id: 'model',
      label: 'Model',
      value: currentModel || modelOptions[0]?.value,
      options: modelOptions,
    })
  }
  if (props.kind === 'media') {
    parameters.push(
      { id: 'kind', label: 'Kind', value: 'video', options: MEDIA_KIND_PARAMETER_OPTIONS },
      { id: 'aspectRatio', label: 'Aspect', value: '16:9', options: VIDEO_ASPECT_RATIO_PARAMETER_OPTIONS },
      { id: 'resolution', label: 'Resolution', value: '720p', options: MEDIA_RESOLUTION_PARAMETER_OPTIONS },
      { id: 'duration', label: 'Duration', value: '4', options: MEDIA_DURATION_PARAMETER_OPTIONS },
    )
  } else if (props.kind === 'image') {
    parameters.push(
      { id: 'aspectRatio', label: 'Aspect', value: 'landscape', options: IMAGE_ASPECT_RATIO_PARAMETER_OPTIONS },
      { id: 'resolution', label: 'Resolution', value: '2K', options: MEDIA_RESOLUTION_PARAMETER_OPTIONS },
      { id: 'count', label: 'Count', value: '1', options: MEDIA_VARIATION_COUNT_PARAMETER_OPTIONS },
    )
  } else if (props.kind === 'video') {
    parameters.push(
      { id: 'aspectRatio', label: 'Aspect', value: '16:9', options: VIDEO_ASPECT_RATIO_PARAMETER_OPTIONS },
      { id: 'resolution', label: 'Resolution', value: '1080p', options: MEDIA_RESOLUTION_PARAMETER_OPTIONS },
      { id: 'duration', label: 'Duration', value: '8', options: MEDIA_DURATION_PARAMETER_OPTIONS },
    )
  } else if (props.kind === 'audio') {
    parameters.push(
      { id: 'duration', label: 'Duration', value: '8', options: MEDIA_DURATION_PARAMETER_OPTIONS },
      { id: 'count', label: 'Count', value: '1', options: MEDIA_VARIATION_COUNT_PARAMETER_OPTIONS },
    )
  }
  return parameters
}
