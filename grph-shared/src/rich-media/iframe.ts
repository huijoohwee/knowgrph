import { isDirectIframeEmbedUrl } from '../url.js'

export type IframeSandboxMode = 'direct' | 'proxied'

const ALLOW_SANDBOX_DIRECT = 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation'
const ALLOW_SANDBOX_PROXIED = 'allow-scripts allow-presentation'

const allowedHostsCache = new Map<string, string[]>()

function parseAllowedHostsCsv(value: string): string[] {
  const raw = String(value || '').trim()
  const cached = allowedHostsCache.get(raw)
  if (cached) return cached
  const out = raw
    .split(/[\s,]+/g)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  allowedHostsCache.set(raw, out)
  return out
}

export function buildWebpageProxyUrl(rawUrl: string): string {
  const u = String(rawUrl || '').trim()
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) return u
  return `/__webpage_proxy?url=${encodeURIComponent(u)}`
}

export function normalizeIframeUrl(url: string): string {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()

    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
      const m = u.pathname.match(/^\/(\d+)(\/|$)/)
      if (m && m[1]) return `https://player.vimeo.com/video/${m[1]}`
    }
  } catch {
    void 0
  }
  return raw
}

export function resolveIframeSandbox(mode: IframeSandboxMode): string {
  return mode === 'direct' ? ALLOW_SANDBOX_DIRECT : ALLOW_SANDBOX_PROXIED
}

export function isSafeIframeUrl(
  rawUrl: string,
  opts?: {
    allowedHostsCsv?: string
    allowYouTube?: boolean
    allowInternalPaths?: boolean
  },
): boolean {
  const allowInternalPaths = opts?.allowInternalPaths !== false
  const allowYouTube = opts?.allowYouTube === true
  const raw = String(rawUrl || '').trim()
  if (!raw) return false
  if (allowInternalPaths) {
    if (raw.startsWith('/__webpage_proxy?url=')) return true
    if (raw.startsWith('/__repo_file/')) return true
  }
  try {
    const u = new URL(raw)
    if (u.username || u.password) return false
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()
    if (!allowYouTube) {
      if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) return false
      if (host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) return false
    }
    const allowed = parseAllowedHostsCsv(opts?.allowedHostsCsv || '')
    if (allowed.length === 0) return true
    return allowed.some(h => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

export function resolveIframeEmbed(args: {
  url: string
  embedMode?: 'auto' | 'direct'
}): { iframeSrc: string; sandbox: string; direct: boolean } {
  const raw = String(args.url || '').trim()
  const direct = args.embedMode === 'direct' ? true : isDirectIframeEmbedUrl(raw)
  const iframeSrc = direct ? raw : buildWebpageProxyUrl(raw)
  const sandbox = resolveIframeSandbox(direct ? 'direct' : 'proxied')
  return { iframeSrc, sandbox, direct }
}
