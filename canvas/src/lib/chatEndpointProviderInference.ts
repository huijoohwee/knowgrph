import { coerceHttpUrl } from '@/lib/url'
import {
  CHAT_AGNES_HOST,
  CHAT_DEFAULT_PROVIDER,
  CHAT_GEMINI_HOST,
  CHAT_GOOGLE_CLOUD_ASIA_SOUTHEAST1_HOST,
  CHAT_GOOGLE_CLOUD_EUROPE_WEST4_HOST,
  CHAT_GOOGLE_CLOUD_GLOBAL_HOST,
  CHAT_GOOGLE_CLOUD_US_CENTRAL1_HOST,
  CHAT_MIROMIND_HOST,
  CHAT_OPENAI_HOST,
  CHAT_PROVIDER_AGNES,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_GEMINI,
  CHAT_PROVIDER_GOOGLE_CLOUD,
  CHAT_PROVIDER_LM_STUDIO,
  CHAT_PROVIDER_MIROMIND,
  CHAT_PROVIDER_OPENAI,
  CHAT_PROVIDER_OPTIONS,
  CHAT_PROVIDER_QWEN,
  CHAT_QWEN_CHINA_BEIJING_HOST,
  CHAT_QWEN_HONG_KONG_HOST,
  CHAT_QWEN_SINGAPORE_HOST,
  CHAT_QWEN_US_VIRGINIA_HOST,
  CHAT_BYTEPLUS_AP_SOUTHEAST_HOST,
  CHAT_BYTEPLUS_EU_WEST_HOST,
  type ChatProviderId,
  getChatModelOptions,
  normalizeChatModelIdForProvider,
  normalizeChatProviderId,
} from '@/lib/chatEndpoint'

const toCleanInput = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const isTrustedOpenAiHost = (hostname: string): boolean =>
  String(hostname || '').toLowerCase() === CHAT_OPENAI_HOST

const isTrustedMiroMindHost = (hostname: string): boolean =>
  String(hostname || '').toLowerCase() === CHAT_MIROMIND_HOST

const isTrustedAgnesHost = (hostname: string): boolean =>
  String(hostname || '').toLowerCase() === CHAT_AGNES_HOST

const isTrustedQwenHost = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase()
  return host === CHAT_QWEN_SINGAPORE_HOST
    || host === CHAT_QWEN_US_VIRGINIA_HOST
    || host === CHAT_QWEN_CHINA_BEIJING_HOST
    || host === CHAT_QWEN_HONG_KONG_HOST
}

const isTrustedGoogleCloudHost = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase()
  return host === CHAT_GOOGLE_CLOUD_GLOBAL_HOST
    || host === CHAT_GOOGLE_CLOUD_US_CENTRAL1_HOST
    || host === CHAT_GOOGLE_CLOUD_EUROPE_WEST4_HOST
    || host === CHAT_GOOGLE_CLOUD_ASIA_SOUTHEAST1_HOST
}

const isTrustedBytePlusHost = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase()
  return host === CHAT_BYTEPLUS_AP_SOUTHEAST_HOST || host === CHAT_BYTEPLUS_EU_WEST_HOST
}

const isTrustedGeminiHost = (hostname: string): boolean =>
  String(hostname || '').toLowerCase() === CHAT_GEMINI_HOST

export function inferChatProviderFromEndpointUrl(value: unknown, fallbackProvider?: unknown): ChatProviderId {
  const fallback = normalizeChatProviderId(fallbackProvider)
  const absolute = coerceHttpUrl(toCleanInput(value))
  if (!absolute) return fallback
  try {
    const hostname = new URL(absolute).hostname
    if (isTrustedOpenAiHost(hostname)) return CHAT_PROVIDER_OPENAI
    if (isTrustedMiroMindHost(hostname)) return CHAT_PROVIDER_MIROMIND
    if (isTrustedAgnesHost(hostname)) return CHAT_PROVIDER_AGNES
    if (isTrustedQwenHost(hostname)) return CHAT_PROVIDER_QWEN
    if (isTrustedGoogleCloudHost(hostname)) return CHAT_PROVIDER_GOOGLE_CLOUD
    if (isTrustedBytePlusHost(hostname)) return CHAT_PROVIDER_BYTEPLUS
    if (isTrustedGeminiHost(hostname)) return CHAT_PROVIDER_GEMINI
    return fallback
  } catch {
    return fallback
  }
}

const chatModelMatchesProvider = (model: unknown, provider: unknown): boolean => {
  const raw = typeof model === 'string' ? model.trim() : ''
  if (!raw) return false
  const normalizedProvider = normalizeChatProviderId(provider)
  const normalizedModel = normalizeChatModelIdForProvider(raw, normalizedProvider)
  return getChatModelOptions(normalizedProvider).includes(normalizedModel)
}

const CHAT_PROVIDER_BY_MODEL_PREFIX: Array<[RegExp, ChatProviderId]> = [
  [/^gpt-/i, CHAT_PROVIDER_OPENAI],
  [/^miro/i, CHAT_PROVIDER_MIROMIND],
  [/^agnes/i, CHAT_PROVIDER_AGNES],
  [/^qwen\//i, CHAT_PROVIDER_LM_STUDIO],
  [/^qwen(?:-|3)/i, CHAT_PROVIDER_QWEN],
  [/^google\/gemini-/i, CHAT_PROVIDER_GOOGLE_CLOUD],
  [/^(?:seed|seedream|seedance|dreamina)-/i, CHAT_PROVIDER_BYTEPLUS],
  [/^(?:gemini|veo)-/i, CHAT_PROVIDER_GEMINI],
]

export function inferChatProviderFromModelId(value: unknown, fallbackProvider?: unknown): ChatProviderId {
  const fallback = normalizeChatProviderId(fallbackProvider)
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback
  if (fallback !== CHAT_DEFAULT_PROVIDER && chatModelMatchesProvider(raw, fallback)) return fallback
  const exactProvider = CHAT_PROVIDER_OPTIONS.find(provider => chatModelMatchesProvider(raw, provider))
  if (exactProvider) return exactProvider
  const prefixMatch = CHAT_PROVIDER_BY_MODEL_PREFIX.find(([pattern]) => pattern.test(raw))
  return prefixMatch?.[1] || fallback
}
