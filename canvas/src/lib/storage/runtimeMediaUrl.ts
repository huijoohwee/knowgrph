const LOCAL_STORAGE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
const DEFAULT_MEDIA_TOKEN_TTL_MS = 15 * 60 * 1000

const normalizeString = (value: unknown): string => String(value || '').trim()

const readRuntimeOrigin = (): string => {
  if (typeof window === 'undefined') return ''
  return normalizeString(window.location?.origin)
}

const isLocalStorageHost = (hostname: string): boolean => LOCAL_STORAGE_HOSTS.has(hostname.toLowerCase())

const isStorageMediaPath = (pathname: string): boolean => pathname.startsWith('/api/storage/media/')

const encodeBase64Url = (value: string): string => {
  try {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  } catch {
    return ''
  }
}

const readRunIdFromStorageMediaPath = (pathname: string): string => {
  const parts = pathname.split('/').filter(Boolean)
  const runsIndex = parts.indexOf('runs')
  return runsIndex >= 0 ? normalizeString(parts[runsIndex + 1]) : ''
}

export function normalizeRuntimeStorageMediaUrl(value: unknown, runtimeOrigin = readRuntimeOrigin()): string {
  const raw = normalizeString(value)
  const origin = normalizeString(runtimeOrigin)
  if (!raw || !origin) return raw
  try {
    const current = new URL(origin)
    if (!isLocalStorageHost(current.hostname)) return raw
    const parsed = new URL(raw, current.origin)
    if (!/^https?:$/i.test(parsed.protocol) || !isLocalStorageHost(parsed.hostname) || !isStorageMediaPath(parsed.pathname)) return raw
    return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, current.origin).toString()
  } catch {
    return raw
  }
}

export function buildRuntimeStorageMediaAccessUrl(args: {
  publicUrl: string
  runId?: string | null
  runtimeOrigin?: string | null
  ttlMs?: number | null
}): string {
  const runtimeOrigin = normalizeString(args.runtimeOrigin) || readRuntimeOrigin()
  const publicUrl = normalizeRuntimeStorageMediaUrl(args.publicUrl, runtimeOrigin)
  if (!publicUrl) return ''
  try {
    const url = new URL(publicUrl, runtimeOrigin || 'https://example.invalid')
    if (!isStorageMediaPath(url.pathname)) return publicUrl
    const runId = normalizeString(args.runId) || readRunIdFromStorageMediaPath(url.pathname)
    if (!runId) return publicUrl
    const authToken = encodeBase64Url(JSON.stringify({
      runId,
      expiresAt: Date.now() + Math.max(60_000, args.ttlMs ?? DEFAULT_MEDIA_TOKEN_TTL_MS),
    }))
    if (!authToken) return publicUrl
    url.searchParams.set('kg_media_token', authToken)
    return url.toString()
  } catch {
    return publicUrl
  }
}
