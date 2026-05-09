import { CHAT_GEMINI_VIDEO_MODEL_DEFAULT } from '@/lib/chatEndpoint'
import { LS_KEYS } from '@/lib/config'
import { lsJson } from '@/lib/persistence'

type GeminiVideoWidgetDefaults = {
  model: string
  aspectRatio: string
  resolution: string
  durationSeconds: string
  personGeneration: string
}

const hasNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const normalizeAspectRatio = (value: string): string => {
  const raw = value.trim().toLowerCase()
  return raw === '9:16' ? '9:16' : '16:9'
}

const normalizeResolution = (value: string): string => {
  const raw = value.trim().toLowerCase()
  if (raw === '1080p' || raw === '4k') return raw
  return '720p'
}

const normalizeDurationSeconds = (value: string): string => {
  const raw = value.trim()
  if (raw === '4' || raw === '6') return raw
  return '8'
}

const normalizePersonGeneration = (value: string): string => {
  const raw = value.trim().toLowerCase()
  if (raw === 'allow_adult' || raw === 'dont_allow') return raw
  return 'allow_all'
}

export function readGeminiVideoWidgetDefaults(): GeminiVideoWidgetDefaults {
  const model = lsJson<string>(LS_KEYS.geminiVideoModel, CHAT_GEMINI_VIDEO_MODEL_DEFAULT, value => (typeof value === 'string' ? value : null))
  const aspectRatio = lsJson<string>(LS_KEYS.geminiVideoAspectRatio, '16:9', value => (typeof value === 'string' ? value : null))
  const resolution = lsJson<string>(LS_KEYS.geminiVideoResolution, '720p', value => (typeof value === 'string' ? value : null))
  const durationSeconds = lsJson<string>(LS_KEYS.geminiVideoDurationSeconds, '8', value => (typeof value === 'string' ? value : null))
  const personGeneration = lsJson<string>(LS_KEYS.geminiVideoPersonGeneration, 'allow_all', value => (typeof value === 'string' ? value : null))
  return {
    model: hasNonEmptyString(model) ? model.trim() : CHAT_GEMINI_VIDEO_MODEL_DEFAULT,
    aspectRatio: normalizeAspectRatio(aspectRatio),
    resolution: normalizeResolution(resolution),
    durationSeconds: normalizeDurationSeconds(durationSeconds),
    personGeneration: normalizePersonGeneration(personGeneration),
  }
}
