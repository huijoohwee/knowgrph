export function coerceHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = unwrapUserProvidedText(value) || value.trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) return null
  try {
    const url = new URL(raw)
    if (!/^https?:$/i.test(url.protocol)) return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function isYouTubeUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const raw = unwrapUserProvidedText(value) || value.trim()
  if (!raw) return false
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase()
    if (host === 'youtu.be') return true
    if (host === 'www.youtu.be') return true
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) return true
    return false
  } catch {
    return false
  }
}

export function coerceFetchUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = unwrapUserProvidedText(value) || value.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return coerceHttpUrl(raw)
  if (!raw.startsWith('/')) return null
  if (typeof window === 'undefined') return null
  const origin = window.location?.origin
  if (!origin) return null
  try {
    const isLikelyAbsoluteFsPath = (path: string): boolean => {
      const p = String(path || '').trim()
      if (!p.startsWith('/')) return false
      if (p.startsWith('/@fs/')) return false
      return /^\/(Users|home|private|var|tmp|Volumes)\//.test(p)
    }

    const effectivePath = isLikelyAbsoluteFsPath(raw) ? `/@fs${raw}` : raw
    const url = new URL(effectivePath, origin)
    if (!/^https?:$/i.test(url.protocol)) return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function unwrapUserProvidedText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let raw = value.trim()
  if (!raw) return null
  raw = raw.replace(/[.,;:]+$/g, '').trim()
  for (let i = 0; i < 5; i += 1) {
    const before = raw
    raw = raw.replace(/^["“‘'`]+/, '').replace(/["”’'`]+$/, '').trim()
    if (raw === before) break
  }
  for (let i = 0; i < 5; i += 1) {
    const before = raw
    if (raw.startsWith('(') && raw.endsWith(')')) raw = raw.slice(1, -1).trim()
    if (raw.startsWith('[') && raw.endsWith(']')) raw = raw.slice(1, -1).trim()
    if (raw.startsWith('{') && raw.endsWith('}')) raw = raw.slice(1, -1).trim()
    if (raw === before) break
  }
  raw = raw.replace(/^<|>$/g, '').trim()
  if (!raw) return null
  return raw
}

export function splitUserProvidedTextList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const raw = value.trim()
  if (!raw) return []
  const parts = raw
    .split(/\r?\n|[,;]+/g)
    .map(p => unwrapUserProvidedText(p) || '')
    .map(p => p.trim())
    .filter(Boolean)

  if (parts.length <= 1) return parts
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

export function normalizeGitHubBlobLikeUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    const host = u.hostname.toLowerCase()
    const path = u.pathname || ''
    if ((host === 'github.com' || host.endsWith('.github.com')) && path.includes('/blob/')) {
      const parts = path.split('/')
      const owner = parts[1] || ''
      const repo = parts[2] || ''
      const blobIndex = parts.indexOf('blob')
      const branch = blobIndex >= 0 && parts.length > blobIndex + 1 ? parts[blobIndex + 1] : ''
      const rel = blobIndex >= 0 && parts.length > blobIndex + 2 ? parts.slice(blobIndex + 2).join('/') : ''
      if (owner && repo && branch && rel) {
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rel}`
      }
    }
  } catch {
    void 0
  }
  return null
}

export function normalizeWebpageLikeUrl(rawHref: string): string {
  const raw = String(rawHref || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host === 'account.ycombinator.com') {
      const cont = u.searchParams.get('continue')
      if (cont) {
        const decoded = decodeURIComponent(cont)
        try {
          const inner = new URL(decoded)
          if (inner.pathname === '/__webpage_proxy') {
            const q = inner.searchParams.get('url')
            if (q) return decodeURIComponent(q)
          }
          return inner.toString()
        } catch {
          return decoded
        }
      }
    }
    if (u.pathname === '/__webpage_proxy') {
      const q = u.searchParams.get('url')
      if (q) return decodeURIComponent(q)
    }
    return raw
  } catch {
    return raw
  }
}

export function coerceMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^data:image\//i.test(raw)) return raw
  if (/^blob:/i.test(raw)) return raw
  if (raw.startsWith('/')) return raw
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null
  return raw
}

export function isLikelySvgUrl(url: string): boolean {
  const u = String(url || '').trim()
  if (!u) return false
  return /\.(svg)(\?|#|$)/i.test(u)
}

export function isLikelyVideoUrl(url: string): boolean {
  const u = String(url || '').trim()
  if (!u) return false
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(u)
}

export function isLikelyAudioUrl(url: string): boolean {
  const u = String(url || '').trim()
  if (!u) return false
  return /\.(mp3|wav|m4a|aac|flac|ogg)(\?|#|$)/i.test(u)
}

export function isSubstackCdnImageFetchUrl(url: string): boolean {
  const u = String(url || '').trim()
  if (!u) return false
  try {
    const parsed = new URL(u)
    return /(\.|^)substackcdn\.com$/i.test(parsed.hostname) && /\/image\/fetch\b/i.test(parsed.pathname)
  } catch {
    return false
  }
}

export function isLikelyImageUrl(url: string): boolean {
  const u = String(url || '').trim()
  if (!u) return false
  if (/^data:image\//i.test(u)) return true
  if (/\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(u)) return true
  if (isLikelySvgUrl(u)) return true
  if (isSubstackCdnImageFetchUrl(u) && /(\.png|\.jpe?g|\.gif|\.webp|\.svg)(\?|#|$)/i.test(decodeURIComponentSafe(u))) return true
  if (isSubstackCdnImageFetchUrl(u)) return true

  try {
    const parsed = new URL(u)
    const host = parsed.hostname.toLowerCase()

    if ((host === 'media.licdn.com' || host.endsWith('.licdn.com')) && /\/(dms\/image|image)\//i.test(parsed.pathname || '')) {
      return true
    }

    const isWeChatAssetHost =
      host === 'mmbiz.qpic.cn' ||
      host.endsWith('.qpic.cn') ||
      host === 'mmbiz.qlogo.cn' ||
      host.endsWith('.qlogo.cn') ||
      host === 'wx.qlogo.cn' ||
      host.endsWith('.wx.qlogo.cn')
    if (isWeChatAssetHost) {
      const wxFmt = String(parsed.searchParams.get('wx_fmt') || '').toLowerCase()
      if (wxFmt && /(png|jpe?g|gif|webp|svg)/i.test(wxFmt)) return true
      const tp = String(parsed.searchParams.get('tp') || '').toLowerCase()
      if (tp && /(png|jpe?g|gif|webp|svg)/i.test(tp)) return true
      const p = parsed.pathname.toLowerCase()
      if (p.includes('/mmbiz_png/') || p.includes('/mmbiz_jpg/') || p.includes('/mmbiz_gif/') || p.includes('/mmbiz_webp/')) return true
      if (p.includes('/mmbiz/') && (p.includes('wx_fmt=') || p.includes('tp='))) return true
    }
  } catch {
    void 0
  }
  return false
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function isDirectIframeEmbedUrl(url: string): boolean {
  const u = String(url || '').trim()
  if (!u) return false
  if (!/^https?:\/\//i.test(u)) return true
  if (/(^|\/\/)(www\.)?youtube\.com\//i.test(u)) return true
  if (/(^|\/\/)(www\.)?youtu\.be\//i.test(u)) return true
  if (/(^|\/\/)www\.youtube-nocookie\.com\//i.test(u)) return true
  if (/(^|\/\/)player\.vimeo\.com\//i.test(u)) return true
  if (/(^|\/\/)platform\.twitter\.com\//i.test(u)) return true
  if (/(^|\/\/)twitframe\.com\//i.test(u)) return true
  if (/(^|\/\/)player\.bilibili\.com\//i.test(u)) return true
  if (/(^|\/\/)(www\.)?linkedin\.com\/embed\//i.test(u)) return true
  return false
}

export function inferIframeScriptPolicyFromHtml(html: string): 'strip' | 'allow' {
  const h = String(html || '')
  if (!h.trim()) return 'strip'
  const needsJs =
    /enable-javascript\.com/i.test(h) ||
    /requires\s+java\s*script/i.test(h) ||
    /failed\s+to\s+load\s+posts/i.test(h) ||
    /substackcdn\.com/i.test(h) ||
    /<noscript\b[\s\S]*?(enable\s+javascript|requires\s+javascript|turn\s+on\s+javascript)/i.test(h)
  return needsJs ? 'allow' : 'strip'
}

export function deriveFilenameFromUrl(rawUrl: string, fallback: string): string {
  const fb = String(fallback || '').trim() || 'remote.txt'
  const raw = String(rawUrl || '').trim()
  if (!raw) return fb
  try {
    const url = new URL(raw)
    const parts = String(url.pathname || '')
      .split('/')
      .map(p => p.trim())
      .filter(Boolean)
    const last = parts.length > 0 ? parts[parts.length - 1] : ''
    if (last) return last
    const host = String(url.hostname || '').trim()
    if (host) return host
    return fb
  } catch {
    return fb
  }
}

export const REMOTE_FETCH_PROXY_ENDPOINT = '/__fetch_remote'
export const MEDIA_PROXY_ENDPOINT = REMOTE_FETCH_PROXY_ENDPOINT

function isLoopbackOrUnspecifiedIpv4Host(host: string): boolean {
  return host === '127.0.0.1' || host === '0.0.0.0'
}

function isPrivateIpv4Host(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map(part => Number.parseInt(part, 10))
  if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false
  if (octets[0] === 10) return true
  if (octets[0] === 192 && octets[1] === 168) return true
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true
  return false
}

function isLocalDevHost(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host) return false
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1' || host === '[::1]') return true
  if (isLoopbackOrUnspecifiedIpv4Host(host)) return true
  if (isPrivateIpv4Host(host)) return true
  return false
}

export function shouldUseRemoteFetchProxy(): boolean {
  if (typeof window === 'undefined') return false
  const origin = window.location?.origin
  if (!origin) return false
  try {
    const host = new URL(origin).hostname.toLowerCase()
    return isLocalDevHost(host)
  } catch {
    return false
  }
}

export function applyMediaProxySrc(src: string): string {
  const raw = String(src || '').trim()
  if (!raw) return ''
  if (/^data:image\/svg\+xml;base64,/i.test(raw)) {
    try {
      const b64 = raw.replace(/^data:image\/svg\+xml;base64,/i, '')
      const decodeBase64Utf8 = (input: string): string => {
        const bin = typeof atob === 'function' ? atob(input) : ''
        if (!bin) return ''
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i) & 0xff
        try {
          if (typeof TextDecoder === 'function') return new TextDecoder('utf-8').decode(bytes)
        } catch {
          void 0
        }
        try {
          let s = ''
          for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i] || 0)
          return decodeURIComponent(escape(s))
        } catch {
          return ''
        }
      }
      const encodeUtf8Base64 = (text: string): string => {
        let bytes: Uint8Array
        try {
          if (typeof TextEncoder === 'function') bytes = new TextEncoder().encode(text)
          else throw new Error('no TextEncoder')
        } catch {
          const esc = unescape(encodeURIComponent(text))
          bytes = new Uint8Array(esc.length)
          for (let i = 0; i < esc.length; i += 1) bytes[i] = esc.charCodeAt(i) & 0xff
        }
        let bin = ''
        for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i] || 0)
        return typeof btoa === 'function' ? btoa(bin) : ''
      }

      const svg = decodeBase64Utf8(b64)
      if (svg) {
        const idx = svg.toLowerCase().indexOf('<svg')
        if (idx >= 0) {
          const head = svg.slice(idx)
          const tagEnd = head.indexOf('>')
          if (tagEnd > 0) {
            const openTag = head.slice(0, tagEnd + 1)
            if (!/\bxmlns\s*=/.test(openTag)) {
              const injected = openTag.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"')
              const nextSvg = svg.slice(0, idx) + injected + head.slice(tagEnd + 1)
              const nextB64 = encodeUtf8Base64(nextSvg)
              if (nextB64) return `data:image/svg+xml;base64,${nextB64}`
            }
          }
        }
      }
    } catch {
      void 0
    }
    return raw
  }
  if (typeof window === 'undefined') return raw
  try {
    const base = window.location.origin
    const initial = new URL(raw, base)
    const normalized = normalizeGitHubBlobLikeUrl(initial.toString()) || initial.toString()
    const u = new URL(normalized, base)
    if (!/^https?:$/i.test(u.protocol)) return raw
    if (u.origin === window.location.origin) return raw

    if (!shouldUseRemoteFetchProxy()) return u.toString()
    return `${MEDIA_PROXY_ENDPOINT}?url=${encodeURIComponent(u.toString())}`
  } catch {
    return raw
  }
}
