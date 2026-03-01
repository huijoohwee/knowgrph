import { unwrapUserProvidedText } from 'grph-shared/url'

export * from 'grph-shared/url'

export function isHttpUrl(value: unknown): boolean {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return false
  return /^https?:\/\//i.test(raw)
}

export function encodeRepoPathForUrl(relPath: string): string {
  return String(relPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map(seg => encodeURIComponent(seg))
    .join('/')
}

export function buildRepoFilePath(relPath: string): string {
  const normalized = String(relPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized) return '/__repo_file'
  return `/__repo_file/${encodeRepoPathForUrl(normalized)}`
}

export function isYouTubeUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const raw = unwrapUserProvidedText(value) || value.trim()
  if (!raw) return false
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase()
    if (host === 'youtu.be' || host === 'www.youtu.be') return true
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) return true
    return false
  } catch {
    return false
  }
}

export function resolveUrlAgainstBase(baseUrl: string | null | undefined, rawUrl: string): string {
  const raw = String(rawUrl || '').trim()
  if (!raw) return ''
  if (/^(data:|blob:|mailto:|tel:|javascript:)/i.test(raw)) return raw
  const base = String(baseUrl || '').trim()
  if (!base) return raw
  try {
    return new URL(raw, base).toString()
  } catch {
    return raw
  }
}
