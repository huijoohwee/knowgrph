import { coerceHttpUrl } from '@/lib/url'

export const CHAT_PROXY_PATH_PREFIX = '/__chat_proxy'
export const CHAT_COMPLETIONS_PATH = '/v1/chat/completions'
export const CHAT_DEFAULT_ENDPOINT_URL = `${CHAT_PROXY_PATH_PREFIX}${CHAT_COMPLETIONS_PATH}`
export const CHAT_DEFAULT_MODEL = 'qwen/qwen3.5-9b@q4_k_m'
export const CHAT_LEGACY_DEFAULT_MODEL = 'lmstudio-community/Qwen3.5-9B-Q4_K_M.gguf'

const toCleanInput = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const isLocalHost = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
}

const toProxyPathFromLocalUrl = (url: URL): string => {
  const pathname = String(url.pathname || '').trim()
  const pathWithSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  const basePath = pathWithSlash === '/' ? CHAT_COMPLETIONS_PATH : pathWithSlash
  return `${CHAT_PROXY_PATH_PREFIX}${basePath}${url.search || ''}`
}

const replaceCompletionsPath = (path: string): string => {
  const normalized = String(path || '').trim()
  if (!normalized) return '/health'
  if (/\/chat\/completions\/?$/i.test(normalized)) {
    return normalized.replace(/\/chat\/completions\/?$/i, '/health')
  }
  if (/\/v1\/chat\/completions\/?$/i.test(normalized)) {
    return normalized.replace(/\/v1\/chat\/completions\/?$/i, '/health')
  }
  return '/health'
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
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return CHAT_DEFAULT_MODEL
  if (raw === CHAT_LEGACY_DEFAULT_MODEL) return CHAT_DEFAULT_MODEL
  return raw
}

export function resolveChatEndpointForRequest(value: unknown): string | null {
  const raw = toCleanInput(value)
  if (!raw) return null
  if (raw.startsWith('/')) return raw
  const absolute = coerceHttpUrl(raw)
  if (!absolute) return null
  try {
    const parsed = new URL(absolute)
    if (isLocalHost(parsed.hostname)) return toProxyPathFromLocalUrl(parsed)
    return parsed.toString()
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
