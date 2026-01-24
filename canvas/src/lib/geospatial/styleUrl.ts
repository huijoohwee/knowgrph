import { normalizeGitHubBlobLikeUrl, unwrapUserProvidedText } from '@/lib/url'

const OPENFREEMAP_STYLE_RE = /^https?:\/\/tiles\.openfreemap\.org\/styles\/([^/]+)(?:\/style\.json)?\/?$/i

export function normalizeGeospatialStyleUrl(raw: unknown): string {
  const s = typeof raw === 'string' ? (unwrapUserProvidedText(raw) ?? raw.trim()) : ''
  if (!s) return ''

  const githubNormalized = normalizeGitHubBlobLikeUrl(s) ?? s
  const ofm = githubNormalized.match(OPENFREEMAP_STYLE_RE)
  if (ofm && ofm[1]) return `https://tiles.openfreemap.org/styles/${ofm[1]}`

  try {
    const u = new URL(githubNormalized)
    if (!/^https?:$/i.test(u.protocol)) return ''
    if (u.username || u.password) return ''
    const p = String(u.pathname || '')
    if (/\/planet(\/|$)/i.test(p)) return ''
    if (/\{z\}|\{x\}|\{y\}/i.test(p)) return ''
    if (/\.(pbf|mvt|png|jpg|jpeg|webp)(\?|$)/i.test(p)) return ''
    if (/\/(fonts|sprites)\//i.test(p)) return ''
    if (/\.json(\?|#|$)/i.test(p)) return u.toString()
    return ''
  } catch {
    return ''
  }
}
