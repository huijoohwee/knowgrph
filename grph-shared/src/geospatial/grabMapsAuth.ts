export const GRABMAPS_AUTH_MODE_LS_KEY = 'kg:maps:grabmaps:authMode'
export const GRABMAPS_BROWSER_API_KEY_SLOT = '__kgGrabMapsApiKey'

export type GrabMapsAuthMode = 'byok' | 'serverManaged'

export const normalizeGrabMapsAuthMode = (value: unknown): GrabMapsAuthMode => {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'byok' ? 'byok' : 'serverManaged'
}

export const sanitizeGrabMapsApiKey = (value: unknown): string => {
  const trimmed = String(value || '')
    .replace(/[\r\n]/g, '')
    .trim()
    .slice(0, 512)
  return trimmed
    .replace(/^authorization\s*:\s*bearer\s+/i, '')
    .replace(/^bearer\s+/i, '')
    .trim()
}

export const readGrabMapsAuthModeFromBrowser = (): GrabMapsAuthMode => {
  if (typeof window === 'undefined') return 'serverManaged'
  try {
    return normalizeGrabMapsAuthMode(window.localStorage.getItem(GRABMAPS_AUTH_MODE_LS_KEY))
  } catch {
    return 'serverManaged'
  }
}

export const readGrabMapsByokApiKeyFromBrowser = (): string => {
  if (typeof globalThis === 'undefined') return ''
  try {
    const root = globalThis as Record<string, unknown>
    const live = sanitizeGrabMapsApiKey(root[GRABMAPS_BROWSER_API_KEY_SLOT])
    if (live) return live
  } catch {
    void 0
  }
  return ''
}

export const writeGrabMapsByokApiKeyToBrowser = (value: unknown): string => {
  const next = sanitizeGrabMapsApiKey(value)
  if (typeof globalThis === 'undefined') return next
  try {
    const root = globalThis as Record<string, unknown>
    root[GRABMAPS_BROWSER_API_KEY_SLOT] = next
  } catch {
    void 0
  }
  return next
}

export const buildGrabMapsProxyRequestHeaders = (): Record<string, string> => {
  return buildGrabMapsProxyRequestHeadersFromAuth({
    authMode: readGrabMapsAuthModeFromBrowser(),
    apiKey: readGrabMapsByokApiKeyFromBrowser(),
  })
}

export const buildGrabMapsProxyRequestHeadersFromAuth = (args: {
  authMode: unknown
  apiKey?: unknown
}): Record<string, string> => {
  const authMode = normalizeGrabMapsAuthMode(args.authMode)
  const apiKey = authMode === 'byok' ? sanitizeGrabMapsApiKey(args.apiKey) : ''
  const headers: Record<string, string> = { 'x-kg-grabmaps-auth-mode': authMode }
  if (apiKey) headers['x-kg-grabmaps-api-key'] = apiKey
  return headers
}
