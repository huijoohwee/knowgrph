export type YouTubeEmbedOptions = {
  noCookie?: boolean
  includeOrigin?: boolean
  origin?: string | null
}

export function getYouTubeId(href: string): string | null {
  try {
    const url = new URL(String(href || '').trim())
    const host = String(url.hostname || '').toLowerCase()
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const id = url.pathname.replace(/^\/+/, '').split('/')[0]?.trim() || ''
      return id || null
    }
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const v = String(url.searchParams.get('v') || '').trim()
      if (v) return v
      const parts = url.pathname.split('/').filter(Boolean)
      const head = parts[0] || ''
      const id = parts[1] || ''
      if ((head === 'embed' || head === 'shorts' || head === 'live') && id) return id
      if (head === 'watch') {
        const maybe = String(url.searchParams.get('v') || '').trim()
        return maybe || null
      }
    }
  } catch {
    return null
  }
  return null
}

export function parseYouTubeStartSeconds(href: string): number | null {
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
  try {
    const u = new URL(String(href || '').trim())
    const fromQuery = u.searchParams.get('t') || u.searchParams.get('start') || ''
    const fromHash = u.hash ? new URLSearchParams(u.hash.replace(/^#/, '')).get('t') || '' : ''
    return parseChunk(fromQuery) ?? parseChunk(fromHash)
  } catch {
    return null
  }
}

export function buildYouTubeEmbedUrl(href: string, opts?: YouTubeEmbedOptions): string | null {
  const id = getYouTubeId(href)
  if (!id) return null
  const start = parseYouTubeStartSeconds(href)
  const params = new URLSearchParams()
  if (start != null) params.set('start', String(start))
  params.set('rel', '0')
  params.set('modestbranding', '1')
  params.set('playsinline', '1')
  params.set('enablejsapi', '1')
  const includeOrigin = opts?.includeOrigin !== false
  const explicitOrigin = typeof opts?.origin === 'string' ? String(opts.origin || '').trim() : ''
  if (includeOrigin) {
    const origin = explicitOrigin || ''
    if (origin) params.set('origin', origin)
  }
  const host = opts?.noCookie === false ? 'www.youtube.com' : 'www.youtube-nocookie.com'
  const q = params.toString()
  return `https://${host}/embed/${id}${q ? `?${q}` : ''}`
}

export function getTwitterStatusId(href: string): string | null {
  try {
    const u = new URL(String(href || '').trim())
    const host = String(u.hostname || '').toLowerCase()
    if (!(host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com'))) return null
    const m = u.pathname.match(/\/status\/(\d+)(?:\/|$)/)
    return m && m[1] ? m[1] : null
  } catch {
    return null
  }
}

export function buildTwitterEmbedUrl(href: string): string | null {
  const id = getTwitterStatusId(href)
  if (!id) return null
  return `https://platform.twitter.com/embed/Tweet.html?id=${id}`
}

export function getVimeoId(href: string): string | null {
  try {
    const url = new URL(String(href || '').trim())
    if (!String(url.hostname || '').toLowerCase().endsWith('vimeo.com')) return null
    const parts = url.pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    return /^\d+$/.test(last) ? last : null
  } catch {
    return null
  }
}

export function buildVimeoEmbedUrl(href: string): string | null {
  const id = getVimeoId(href)
  if (!id) return null
  return `https://player.vimeo.com/video/${id}`
}

export function getBilibiliVideoId(href: string): string | null {
  try {
    const url = new URL(String(href || '').trim())
    const host = String(url.hostname || '').toLowerCase()
    if (!(host === 'www.bilibili.com' || host.endsWith('.bilibili.com'))) return null
    const m = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+)(?:\/|$)/)
    return m && m[1] ? m[1] : null
  } catch {
    return null
  }
}

export function buildBilibiliEmbedUrl(href: string): string | null {
  const bvid = getBilibiliVideoId(href)
  if (!bvid) return null
  return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=1&autoplay=0`
}
