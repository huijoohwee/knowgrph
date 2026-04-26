import { coerceHttpUrl } from '@/lib/url'

export const CHAT_PROXY_PATH_PREFIX = '/__chat_proxy'
export const CHAT_BINARY_DOWNLOAD_PROXY_PATH = '/__chat_asset_proxy'
export const CHAT_COMPLETIONS_PATH = '/v1/chat/completions'
export const CHAT_BYTEPLUS_COMPLETIONS_PATH = '/api/v3/chat/completions'
export const CHAT_BYTEPLUS_IMAGES_GENERATIONS_PATH = '/api/v3/images/generations'
export const CHAT_BYTEPLUS_CONTENT_GENERATIONS_TASKS_PATH = '/api/v3/contents/generations/tasks'
export const CHAT_OPENAI_RESPONSES_PATH = '/v1/responses'
export const CHAT_BYTEPLUS_AP_SOUTHEAST_HOST = 'ark.ap-southeast.bytepluses.com'
export const CHAT_BYTEPLUS_EU_WEST_HOST = 'ark.eu-west.bytepluses.com'
export const CHAT_OPENAI_HOST = 'api.openai.com'
export const CHAT_BYTEPLUS_AP_SOUTHEAST_BASE = `https://${CHAT_BYTEPLUS_AP_SOUTHEAST_HOST}`
export const CHAT_BYTEPLUS_EU_WEST_BASE = `https://${CHAT_BYTEPLUS_EU_WEST_HOST}`
export const CHAT_OPENAI_BASE = `https://${CHAT_OPENAI_HOST}`
export const CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL = `${CHAT_BYTEPLUS_AP_SOUTHEAST_BASE}${CHAT_BYTEPLUS_COMPLETIONS_PATH}`
export const CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL = `${CHAT_BYTEPLUS_EU_WEST_BASE}${CHAT_BYTEPLUS_COMPLETIONS_PATH}`
export const CHAT_OPENAI_ENDPOINT_URL = `${CHAT_OPENAI_BASE}${CHAT_OPENAI_RESPONSES_PATH}`
export const CHAT_PROVIDER_OPENAI = 'openai'
export const CHAT_PROVIDER_BYTEPLUS = 'byteplus-modelark'
export const CHAT_PROVIDER_LM_STUDIO = 'lmstudio-local'
export const CHAT_PROVIDER_OPTIONS = [CHAT_PROVIDER_OPENAI, CHAT_PROVIDER_BYTEPLUS, CHAT_PROVIDER_LM_STUDIO] as const
export type ChatProviderId = (typeof CHAT_PROVIDER_OPTIONS)[number]
export const CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT = 'seed-2-0-mini-260215'
export const CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT = 'seedream-4-0-250828'
export const CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS = [
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  'seedream-4-5-251128',
  'seedream-5-0-260128',
] as const
export const CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT = 'seedance-1-0-pro-fast-251015'
export const CHAT_BYTEPLUS_VIDEO_MODEL_OPTIONS = [
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
  'seedance-1-5-pro-251215',
  'dreamina-seedance-2-0-fast-260128',
  'dreamina-seedance-2-0-260128',
] as const
export const CHAT_BYTEPLUS_TEXT_MODEL_OPTIONS = [
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  'seed-2-0-lite-260228',
  'seed-2-0-pro-260328',
  'seed-1-8-251228',
] as const
export const CHAT_BYTEPLUS_MODEL_OPTIONS = [
  ...CHAT_BYTEPLUS_TEXT_MODEL_OPTIONS,
  ...CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS,
  ...CHAT_BYTEPLUS_VIDEO_MODEL_OPTIONS,
] as const
export const CHAT_OPENAI_MODEL_OPTIONS = ['gpt-5.4-nano', 'gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5'] as const
export const CHAT_LOCAL_MODEL_OPTIONS = ['qwen/qwen3.5-9b@q4_k_m'] as const
export const CHAT_DEFAULT_PROVIDER: ChatProviderId = CHAT_PROVIDER_OPENAI
export const CHAT_DEFAULT_MODEL = CHAT_OPENAI_MODEL_OPTIONS[0]
export const CHAT_DEFAULT_ENDPOINT_URL = CHAT_OPENAI_ENDPOINT_URL
export const CHAT_LOCAL_DEFAULT_MODEL = CHAT_LOCAL_MODEL_OPTIONS[0]
export const CHAT_LEGACY_DEFAULT_MODEL = 'lmstudio-community/Qwen3.5-9B-Q4_K_M.gguf'
const CHAT_MODEL_ALIASES: Record<string, string> = {
  'gpt-5.4 nano': 'gpt-5.4-nano',
  'gpt-5.4 mini': 'gpt-5.4-mini',
  'gpt-5.4': 'gpt-5.4',
  'gpt-5.5': 'gpt-5.5',
  'seedream-4.0': 'seedream-4-0-250828',
  'seedream-4.5': 'seedream-4-5-251128',
  'seedream-5.0': 'seedream-5-0-260128',
}
const CHAT_PROVIDER_LABELS: Record<ChatProviderId, string> = {
  [CHAT_PROVIDER_BYTEPLUS]: 'BytePlus ModelArk',
  [CHAT_PROVIDER_OPENAI]: 'OpenAI',
  [CHAT_PROVIDER_LM_STUDIO]: 'Local Gateway',
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
  return host === CHAT_OPENAI_HOST
}

const isTrustedBytePlusHost = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase()
  return host === CHAT_BYTEPLUS_AP_SOUTHEAST_HOST || host === CHAT_BYTEPLUS_EU_WEST_HOST
}

const getProviderDefaultUpstreamBase = (provider: unknown): string | null => {
  const normalizedProvider = normalizeChatProviderId(provider)
  if (normalizedProvider === CHAT_PROVIDER_BYTEPLUS) return CHAT_BYTEPLUS_AP_SOUTHEAST_BASE
  if (normalizedProvider === CHAT_PROVIDER_OPENAI) return CHAT_OPENAI_BASE
  return null
}

const getProviderDefaultEndpointUrl = (provider: unknown): string => {
  const normalizedProvider = normalizeChatProviderId(provider)
  if (normalizedProvider === CHAT_PROVIDER_BYTEPLUS) return CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL
  if (normalizedProvider === CHAT_PROVIDER_OPENAI) return CHAT_OPENAI_ENDPOINT_URL
  return `${CHAT_PROXY_PATH_PREFIX}${CHAT_COMPLETIONS_PATH}`
}

const toAsciiRequestId = (value: unknown): string => {
  const raw = typeof value === 'string' ? value : ''
  const next = raw
    .trim()
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 512)
  return next
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
  if (/\/v1\/responses\/?$/i.test(normalized)) {
    return '/v1/models'
  }
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
  if (/\/v1\/responses\/?$/i.test(normalized)) {
    return '/v1/models'
  }
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
  if (raw === CHAT_PROVIDER_BYTEPLUS || raw === 'byteplus' || raw === 'modelark') return CHAT_PROVIDER_BYTEPLUS
  if (raw === CHAT_PROVIDER_OPENAI) return CHAT_PROVIDER_OPENAI
  if (raw === CHAT_PROVIDER_LM_STUDIO) return CHAT_PROVIDER_LM_STUDIO
  return CHAT_DEFAULT_PROVIDER
}

export function getChatModelOptions(provider: unknown): readonly string[] {
  const normalizedProvider = normalizeChatProviderId(provider)
  if (normalizedProvider === CHAT_PROVIDER_BYTEPLUS) return CHAT_BYTEPLUS_MODEL_OPTIONS
  if (normalizedProvider === CHAT_PROVIDER_LM_STUDIO) return CHAT_LOCAL_MODEL_OPTIONS
  return CHAT_OPENAI_MODEL_OPTIONS
}

export function getChatProviderLabel(provider: unknown): string {
  return CHAT_PROVIDER_LABELS[normalizeChatProviderId(provider)]
}

export function getChatProviderRegionLabel(provider: unknown, endpointUrl?: unknown): string {
  const normalizedProvider = normalizeChatProviderId(provider)
  if (normalizedProvider === CHAT_PROVIDER_OPENAI) return 'Global'
  if (normalizedProvider === CHAT_PROVIDER_LM_STUDIO) return 'Local'
  const upstream = resolveChatUpstreamBaseForProxy(endpointUrl, normalizedProvider)
  const host = (() => {
    if (!upstream) return ''
    try {
      return new URL(upstream).hostname
    } catch {
      return ''
    }
  })()
  if (host === CHAT_BYTEPLUS_EU_WEST_HOST) return 'EU-West-1'
  return 'AP-Southeast-1'
}

export function getDefaultChatModelForProvider(provider: unknown): string {
  const options = getChatModelOptions(provider)
  return options[0] || ''
}

export type ChatGenerationOutputKind = 'text' | 'image' | 'video'

export function getDefaultGenerationModelForProvider(provider: unknown, kind: ChatGenerationOutputKind): string {
  const normalizedProvider = normalizeChatProviderId(provider)
  if (normalizedProvider === CHAT_PROVIDER_BYTEPLUS) {
    if (kind === 'image') return CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT
    if (kind === 'video') return CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT
    return CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT
  }
  return getDefaultChatModelForProvider(normalizedProvider)
}

const toTitleToken = (token: string): string => {
  const t = String(token || '').trim()
  if (!t) return ''
  return t[0]!.toUpperCase() + t.slice(1)
}

export function getBytePlusVideoModelLabel(modelId: unknown): string {
  const raw = typeof modelId === 'string' ? modelId.trim() : ''
  if (!raw) return ''
  const parts = raw.split('-').map(v => v.trim()).filter(Boolean)
  if (parts.length === 0) return raw
  const last = parts[parts.length - 1] || ''
  const core = /^\d{6}$/.test(last) ? parts.slice(0, -1) : parts
  if (core.length === 0) return raw

  const first = core[0] || ''
  const rest = core.slice(1)

  const out: string[] = [toTitleToken(first)]

  if (rest.length >= 3 && rest[0]?.toLowerCase() === 'seedance' && /^\d+$/.test(rest[1] || '') && /^\d+$/.test(rest[2] || '')) {
    out.push('Seedance')
    out.push(`${rest[1]}.${rest[2]}`)
    out.push(...rest.slice(3))
  } else if (rest.length >= 2 && /^\d+$/.test(rest[0] || '') && /^\d+$/.test(rest[1] || '')) {
    out.push(`${rest[0]}.${rest[1]}`)
    out.push(...rest.slice(2))
  } else {
    out.push(...rest)
  }

  const label = out.filter(Boolean).join('-')
  const hasSeedance = core.some(v => String(v || '').toLowerCase() === 'seedance') || String(first || '').toLowerCase() === 'seedance'
  return hasSeedance ? `ByteDance-${label}` : label
}

export function normalizeChatModelIdForProvider(value: unknown, provider: unknown): string {
  const normalizedProvider = normalizeChatProviderId(provider)
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return getDefaultChatModelForProvider(normalizedProvider)
  if (raw === CHAT_LEGACY_DEFAULT_MODEL) return CHAT_LOCAL_DEFAULT_MODEL
  const alias = CHAT_MODEL_ALIASES[raw.toLowerCase()]
  return alias || raw
}

export function normalizeChatEndpointUrlInput(value: unknown, provider?: unknown): string {
  const raw = toCleanInput(value)
  if (!raw) return getProviderDefaultEndpointUrl(provider || CHAT_DEFAULT_PROVIDER)
  if (raw.startsWith('/')) {
    return resolveChatEndpointForRequest(raw) || getProviderDefaultEndpointUrl(provider || CHAT_DEFAULT_PROVIDER)
  }
  const absolute = coerceHttpUrl(raw)
  if (!absolute) return getProviderDefaultEndpointUrl(provider || CHAT_DEFAULT_PROVIDER)
  try {
    const parsed = new URL(absolute)
    if (isLocalHost(parsed.hostname) || isTrustedOpenAiHost(parsed.hostname) || isTrustedBytePlusHost(parsed.hostname)) {
      return parsed.toString()
    }
  } catch {
    void 0
  }
  return getProviderDefaultEndpointUrl(provider || CHAT_DEFAULT_PROVIDER)
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
    if (isLocalHost(parsed.hostname) || isTrustedOpenAiHost(parsed.hostname) || isTrustedBytePlusHost(parsed.hostname)) {
      return toProxyPathFromLocalUrl(parsed)
    }
    return null
  } catch {
    return null
  }
}

export function isResponsesEndpointUrl(value: unknown): boolean {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return false
  const withoutQuery = (() => {
    const q = raw.indexOf('?')
    return q >= 0 ? raw.slice(0, q) : raw
  })()
  const stripped = stripProxyPrefix(withoutQuery)
  return /\/v1\/responses\/?$/i.test(stripped)
}

export function resolveBytePlusContentEndpointForRequest(args: {
  endpointUrl?: unknown
  path: string
}): string | null {
  const rawPath = String(args.path || '').trim()
  if (!rawPath.startsWith('/')) return null
  const upstreamBase = resolveChatUpstreamBaseForProxy(args.endpointUrl, CHAT_PROVIDER_BYTEPLUS) || CHAT_BYTEPLUS_AP_SOUTHEAST_BASE
  return resolveChatEndpointForRequest(`${upstreamBase}${rawPath}`)
}

export function resolveBinaryDownloadProxyUrl(value: unknown): string {
  const raw = toCleanInput(value)
  if (!raw) return ''
  return `${CHAT_BINARY_DOWNLOAD_PROXY_PATH}?url=${encodeURIComponent(raw)}`
}

export function resolveChatUpstreamBaseForProxy(value: unknown, provider: unknown): string | null {
  const raw = toCleanInput(value)
  if (!raw || raw.startsWith('/')) {
    return getProviderDefaultUpstreamBase(provider)
  }
  const absolute = coerceHttpUrl(raw)
  if (!absolute) return getProviderDefaultUpstreamBase(provider)
  try {
    const parsed = new URL(absolute)
    if (isLocalHost(parsed.hostname)) return parsed.origin
    const normalizedProvider = normalizeChatProviderId(provider)
    if (normalizedProvider === CHAT_PROVIDER_OPENAI) {
      return isTrustedOpenAiHost(parsed.hostname) ? parsed.origin : null
    }
    if (normalizedProvider === CHAT_PROVIDER_BYTEPLUS) {
      return isTrustedBytePlusHost(parsed.hostname) ? parsed.origin : null
    }
    return null
  } catch {
    return null
  }
}

export function buildChatProxyHeaders(args: {
  provider: unknown
  apiKey?: unknown
  endpointUrl?: unknown
  clientRequestId?: unknown
}): Record<string, string> {
  const headers: Record<string, string> = {}
  const provider = normalizeChatProviderId(args.provider)
  headers['X-KG-Chat-Provider'] = provider
  const sanitizedApiKey = String(args.apiKey || '').trim()
  if (sanitizedApiKey) {
    headers['X-KG-Chat-Api-Key'] = sanitizedApiKey
  }
  const upstreamBase = resolveChatUpstreamBaseForProxy(args.endpointUrl, provider)
  if (upstreamBase) {
    headers['X-KG-Chat-Upstream'] = upstreamBase
  }
  const clientRequestId = toAsciiRequestId(args.clientRequestId)
  if (clientRequestId) {
    headers['X-Client-Request-Id'] = clientRequestId
  }
  return headers
}

export function getChatRecommendedModelHint(provider: unknown): string {
  const normalizedProvider = normalizeChatProviderId(provider)
  if (normalizedProvider === CHAT_PROVIDER_BYTEPLUS) {
    return `Default text: ${CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT}. Image Run uses ${CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT}; video Run uses ${CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT}.`
  }
  if (normalizedProvider === CHAT_PROVIDER_OPENAI) {
    return 'Use an OpenAI model id and keep API keys server-routed through the proxy.'
  }
  return 'Use a locally served OpenAI-compatible model id.'
}

export function getChatDefaultEndpointUrlForProvider(provider: unknown): string {
  return getProviderDefaultEndpointUrl(provider)
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
