import { coerceHttpUrl } from '@/lib/url'

export const CHAT_PROXY_PATH_PREFIX = '/__chat_proxy'
export const CHAT_COMPLETIONS_PATH = '/v1/chat/completions'
export const CHAT_DEFAULT_ENDPOINT_URL = `${CHAT_PROXY_PATH_PREFIX}${CHAT_COMPLETIONS_PATH}`
export const CHAT_PROVIDER_OPENAI = 'openai'
export const CHAT_PROVIDER_LM_STUDIO = 'lmstudio-local'
export const CHAT_PROVIDER_OPTIONS = [CHAT_PROVIDER_OPENAI, CHAT_PROVIDER_LM_STUDIO] as const
export type ChatProviderId = (typeof CHAT_PROVIDER_OPTIONS)[number]
export const CHAT_OPENAI_MODEL_OPTIONS = ['gpt-5.4-nano', 'gpt-4o-mini-tts', 'gpt-realtime-mini'] as const
export const CHAT_LOCAL_MODEL_OPTIONS = ['qwen/qwen3.5-9b@q4_k_m'] as const
export const CHAT_DEFAULT_PROVIDER: ChatProviderId = CHAT_PROVIDER_OPENAI
export const CHAT_DEFAULT_MODEL = CHAT_OPENAI_MODEL_OPTIONS[0]
export const CHAT_LOCAL_DEFAULT_MODEL = CHAT_LOCAL_MODEL_OPTIONS[0]
export const CHAT_LEGACY_DEFAULT_MODEL = 'lmstudio-community/Qwen3.5-9B-Q4_K_M.gguf'
const CHAT_MODEL_ALIASES: Record<string, string> = {
  'gpt-5.4 nano': 'gpt-5.4-nano',
  'gpt-4o mini tts': 'gpt-4o-mini-tts',
  'gpt-realtime-mini': 'gpt-realtime-mini',
}

const toCleanInput = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const isLocalHost = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
}

const isTrustedOpenAiHost = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase()
  return host === 'api.openai.com'
}

const toProxyPathFromLocalUrl = (url: URL): string => {
  const pathname = String(url.pathname || '').trim()
  const pathWithSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  const basePath = pathWithSlash === '/' ? CHAT_COMPLETIONS_PATH : pathWithSlash
  return `${CHAT_PROXY_PATH_PREFIX}${basePath}${url.search || ''}`
}

const replaceCompletionsPath = (path: string): string => {
  const normalized = String(path || '').trim()
  if (!normalized) return '/v1/models'
  if (/\/chat\/completions\/?$/i.test(normalized)) {
    return normalized.replace(/\/chat\/completions\/?$/i, '/models')
  }
  if (/\/v1\/chat\/completions\/?$/i.test(normalized)) {
    return normalized.replace(/\/v1\/chat\/completions\/?$/i, '/v1/models')
  }
  return '/v1/models'
}

const toModelsPath = (path: string): string => {
  const normalized = String(path || '').trim()
  if (!normalized) return '/v1/models'
  if (/\/chat\/completions\/?$/i.test(normalized)) {
    return normalized.replace(/\/chat\/completions\/?$/i, '/models')
  }
  if (/\/v1\/chat\/completions\/?$/i.test(normalized)) {
    return normalized.replace(/\/v1\/chat\/completions\/?$/i, '/v1/models')
  }
  return '/v1/models'
}

const stripProxyPrefix = (path: string): string => {
  const normalized = String(path || '').trim()
  if (!normalized.startsWith(CHAT_PROXY_PATH_PREFIX)) return normalized
  const next = normalized.slice(CHAT_PROXY_PATH_PREFIX.length)
  if (!next) return '/'
  return next.startsWith('/') ? next : `/${next}`
}

export function normalizeChatModelId(value: unknown): string {
  return normalizeChatModelIdForProvider(value, CHAT_DEFAULT_PROVIDER)
}

export function normalizeChatProviderId(value: unknown): ChatProviderId {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === CHAT_PROVIDER_LM_STUDIO) return CHAT_PROVIDER_LM_STUDIO
  return CHAT_PROVIDER_OPENAI
}

export function getChatModelOptions(provider: unknown): readonly string[] {
  const normalizedProvider = normalizeChatProviderId(provider)
  if (normalizedProvider === CHAT_PROVIDER_LM_STUDIO) return CHAT_LOCAL_MODEL_OPTIONS
  return CHAT_OPENAI_MODEL_OPTIONS
}

export function getDefaultChatModelForProvider(provider: unknown): string {
  const options = getChatModelOptions(provider)
  return options[0] || CHAT_DEFAULT_MODEL
}

export function normalizeChatModelIdForProvider(value: unknown, provider: unknown): string {
  const normalizedProvider = normalizeChatProviderId(provider)
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return getDefaultChatModelForProvider(normalizedProvider)
  if (raw === CHAT_LEGACY_DEFAULT_MODEL) return CHAT_LOCAL_DEFAULT_MODEL
  const alias = CHAT_MODEL_ALIASES[raw.toLowerCase()]
  return alias || raw
}

export function resolveChatEndpointForRequest(value: unknown): string | null {
  const raw = toCleanInput(value)
  if (!raw) return null
  if (raw.startsWith('/')) {
    if (raw.startsWith(CHAT_PROXY_PATH_PREFIX)) return raw
    return `${CHAT_PROXY_PATH_PREFIX}${raw.startsWith('/') ? raw : `/${raw}`}`
  }
  const absolute = coerceHttpUrl(raw)
  if (!absolute) return null
  try {
    const parsed = new URL(absolute)
    if (isLocalHost(parsed.hostname) || isTrustedOpenAiHost(parsed.hostname)) {
      return toProxyPathFromLocalUrl(parsed)
    }
    return null
  } catch {
    return null
  }
}

export function resolveChatEndpointForHealth(value: unknown): string | null {
  const requestTarget = resolveChatEndpointForRequest(value)
  if (!requestTarget) return null
  if (requestTarget.startsWith('/')) {
    const splitAt = requestTarget.indexOf('?')
    const pathname = splitAt >= 0 ? requestTarget.slice(0, splitAt) : requestTarget
    const hasProxyPrefix = pathname.startsWith(CHAT_PROXY_PATH_PREFIX)
    const effectivePath = hasProxyPrefix ? stripProxyPrefix(pathname) : pathname
    const healthPath = replaceCompletionsPath(effectivePath)
    if (hasProxyPrefix) {
      return `${CHAT_PROXY_PATH_PREFIX}${healthPath}`
    }
    return healthPath
  }
  try {
    const parsed = new URL(requestTarget)
    parsed.pathname = replaceCompletionsPath(parsed.pathname)
    parsed.search = ''
    return parsed.toString()
  } catch {
    return null
  }
}

export function resolveChatEndpointForModels(value: unknown): string | null {
  const requestTarget = resolveChatEndpointForRequest(value)
  if (!requestTarget) return null
  if (requestTarget.startsWith('/')) {
    const splitAt = requestTarget.indexOf('?')
    const pathname = splitAt >= 0 ? requestTarget.slice(0, splitAt) : requestTarget
    const hasProxyPrefix = pathname.startsWith(CHAT_PROXY_PATH_PREFIX)
    const effectivePath = hasProxyPrefix ? stripProxyPrefix(pathname) : pathname
    const modelsPath = toModelsPath(effectivePath)
    if (hasProxyPrefix) {
      return `${CHAT_PROXY_PATH_PREFIX}${modelsPath}`
    }
    return modelsPath
  }
  try {
    const parsed = new URL(requestTarget)
    parsed.pathname = toModelsPath(parsed.pathname)
    parsed.search = ''
    return parsed.toString()
  } catch {
    return null
  }
}
