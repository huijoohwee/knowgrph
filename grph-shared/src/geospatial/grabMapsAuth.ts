export const GRABMAPS_AUTH_MODE_LS_KEY = 'kg:maps:grabmaps:authMode'
export const GRABMAPS_BROWSER_API_KEY_SLOT = '__kgGrabMapsApiKey'
export const GRABMAPS_BYOK_API_KEY_SESSION_KEY = 'kg:maps:grabmaps:byokApiKey'

export type GrabMapsAuthMode = 'byok' | 'serverManaged'

export const normalizeGrabMapsAuthMode = (value: unknown): GrabMapsAuthMode => {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'servermanaged' ? 'serverManaged' : 'byok'
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
  if (typeof window === 'undefined') return 'byok'
  try {
    return normalizeGrabMapsAuthMode(window.localStorage.getItem(GRABMAPS_AUTH_MODE_LS_KEY))
  } catch {
    return 'byok'
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
  try {
    if (typeof window === 'undefined') return ''
    const persisted = sanitizeGrabMapsApiKey(window.sessionStorage.getItem(GRABMAPS_BYOK_API_KEY_SESSION_KEY))
    if (!persisted) return ''
    const root = globalThis as Record<string, unknown>
    root[GRABMAPS_BROWSER_API_KEY_SLOT] = persisted
    return persisted
  } catch {
    return ''
  }
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
  try {
    if (typeof window !== 'undefined') {
      if (next) window.sessionStorage.setItem(GRABMAPS_BYOK_API_KEY_SESSION_KEY, next)
      else window.sessionStorage.removeItem(GRABMAPS_BYOK_API_KEY_SESSION_KEY)
    }
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
