import { isDirectIframeEmbedUrl } from '../url.js'

export type IframeSandboxMode = 'direct' | 'proxied'

const ALLOW_SANDBOX_DIRECT =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-top-navigation-by-user-activation allow-presentation'
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

    if (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be' ||
      host.endsWith('.youtu.be') ||
      host === 'youtube-nocookie.com' ||
      host.endsWith('.youtube-nocookie.com')
    ) {
      const parseStart = (): number | null => {
        const parseChunk = (raw: string): number | null => {
          const s = String(raw || '').trim()
          if (!s) return null
          if (/^\d+$/.test(s)) return Number(s)
          const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i)
          if (!m) return null
          const h = m[1] ? Number(m[1]) : 0
          const mm = m[2] ? Number(m[2]) : 0
          const sec = m[3] ? Number(m[3]) : 0
          const out = h * 3600 + mm * 60 + sec
          return out > 0 && Number.isFinite(out) ? out : null
        }
        const fromQuery = u.searchParams.get('t') || u.searchParams.get('start') || ''
        const fromHash = u.hash ? new URLSearchParams(u.hash.replace(/^#/, '')).get('t') || '' : ''
        return parseChunk(fromQuery) ?? parseChunk(fromHash)
      }

      const getId = (): string => {
        const v = String(u.searchParams.get('v') || '').trim()
        if (v) return v
        const parts = u.pathname.split('/').filter(Boolean)
        if (host === 'youtu.be' || host.endsWith('.youtu.be')) return String(parts[0] || '').trim()
        const head = String(parts[0] || '').toLowerCase()
        const id = String(parts[1] || '').trim()
        if ((head === 'embed' || head === 'shorts' || head === 'live') && id) return id
        return ''
      }

      const id = getId()
      if (id) {
        const params = new URLSearchParams()
        const start = parseStart()
        if (start != null) params.set('start', String(start))
        params.set('rel', '0')
        params.set('modestbranding', '1')
        params.set('playsinline', '1')
        const q = params.toString()
        return `https://www.youtube-nocookie.com/embed/${id}${q ? `?${q}` : ''}`
      }
    }

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
  embedMode?: 'auto' | 'direct' | 'proxy'
  scriptPolicy?: 'strip' | 'allow'
}): { iframeSrc: string; sandbox: string; direct: boolean } {
  const raw = String(args.url || '').trim()
  const normalized = normalizeIframeUrl(raw)
  const direct = args.embedMode === 'direct' ? true : args.embedMode === 'proxy' ? false : isDirectIframeEmbedUrl(normalized)
  const iframeSrc = (() => {
    if (direct) return normalized
    const base = buildWebpageProxyUrl(normalized)
    const p = args.scriptPolicy === 'allow' ? 'allow' : args.scriptPolicy === 'strip' ? 'strip' : ''
    if (!p) return base
    const joiner = base.includes('?') ? '&' : '?'
    return `${base}${joiner}kg_script_policy=${encodeURIComponent(p)}`
  })()
  const sandbox = resolveIframeSandbox(direct ? 'direct' : 'proxied')
  return { iframeSrc, sandbox, direct }
}
