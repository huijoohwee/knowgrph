import { GRABMAPS_PROXY_PATH } from './grabMapsSsot.js'

export const toGrabMapsProxyUrl = (rawUrl: unknown, origin?: unknown): string | null => {
  const normalizedOrigin = (() => {
    const explicit = String(origin || '').trim()
    if (explicit) return explicit
    if (typeof window === 'undefined') return ''
    return String(window.location?.origin || '').trim()
  })()
  if (!normalizedOrigin) return null

  try {
    const parsed = new URL(String(rawUrl || '').trim())
    const proxied = new URL(GRABMAPS_PROXY_PATH, normalizedOrigin)
    proxied.searchParams.set('url', parsed.toString())
    return proxied.toString()
  } catch {
    return null
  }
}
