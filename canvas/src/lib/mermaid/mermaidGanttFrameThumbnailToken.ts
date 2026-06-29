const FRAME_THUMBNAIL_TOKEN_PREFIX = 'kgthumb_'

const readBase64Host = (): {
  atob?: (value: string) => string
  btoa?: (value: string) => string
  Buffer?: {
    from: (value: string | Uint8Array, encoding?: BufferEncoding) => {
      toString: (encoding?: BufferEncoding) => string
    }
  }
} => globalThis as unknown as {
  atob?: (value: string) => string
  btoa?: (value: string) => string
  Buffer?: {
    from: (value: string | Uint8Array, encoding?: BufferEncoding) => {
      toString: (encoding?: BufferEncoding) => string
    }
  }
}

const encodeBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  const host = readBase64Host()
  const base64 = typeof host.btoa === 'function'
    ? host.btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    : host.Buffer?.from(bytes).toString('base64') || ''
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const decodeBase64Url = (value: string): string => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`
  const host = readBase64Host()
  if (typeof host.atob === 'function') {
    const binary = host.atob(padded)
    return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
  }
  return host.Buffer?.from(padded, 'base64').toString('utf8') || ''
}

export const formatMermaidGanttFrameThumbnailToken = (thumbnailUrl: unknown): string => {
  const value = String(thumbnailUrl || '').trim()
  if (!value) return ''
  const encoded = encodeBase64Url(value)
  return encoded ? `${FRAME_THUMBNAIL_TOKEN_PREFIX}${encoded}` : ''
}

export const readMermaidGanttFrameThumbnailUrl = (line: string): string => {
  const tokens = String(line || '')
    .slice(Math.max(0, String(line || '').indexOf(':') + 1))
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)
  const token = tokens.find(item => item.startsWith(FRAME_THUMBNAIL_TOKEN_PREFIX))
  if (!token) return ''
  try {
    return decodeBase64Url(token.slice(FRAME_THUMBNAIL_TOKEN_PREFIX.length)).trim()
  } catch {
    return ''
  }
}
