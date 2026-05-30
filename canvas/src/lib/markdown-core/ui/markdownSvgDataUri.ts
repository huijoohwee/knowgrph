import { decodeBase64ToUtf8, encodeUtf8ToBase64 } from '@/features/markdown/markdownRoundTrip'

const SVG_DATA_URI_BASE64_PREFIX = 'data:image/svg+xml;base64,'

const padBase64 = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return ''
  const mod = s.length % 4
  if (mod === 0) return s
  return `${s}${'='.repeat(4 - mod)}`
}

export const normalizeSvgDataUriForImg = (src: string): string => {
  const raw = String(src || '').trim()
  if (!raw.toLowerCase().startsWith(SVG_DATA_URI_BASE64_PREFIX)) return raw
  const b64 = padBase64(raw.slice(SVG_DATA_URI_BASE64_PREFIX.length))
  if (!b64) return raw
  if (b64.length > 50_000) return raw
  const decoded = decodeBase64ToUtf8(b64)
  if (!decoded) return raw
  const m = decoded.match(/<svg\b([^>]*)>/i)
  if (!m) return raw
  const attrs = String(m[1] || '')
  if (/xmlns\s*=/.test(attrs)) return raw
  const replacement = `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>`
  const nextB64 = encodeUtf8ToBase64(decoded.replace(m[0], replacement))
  if (!nextB64) return raw
  return `${SVG_DATA_URI_BASE64_PREFIX}${nextB64}`
}
