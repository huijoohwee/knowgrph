import { normalizeGitHubBlobLikeUrl } from '@/lib/url'

const OPENFREEMAP_STYLE_RE = /^https?:\/\/tiles\.openfreemap\.org\/styles\/([^/]+)(?:\/style\.json)?\/?$/i

export function normalizeGeospatialStyleUrl(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return ''

  const githubNormalized = normalizeGitHubBlobLikeUrl(s) ?? s
  const ofm = githubNormalized.match(OPENFREEMAP_STYLE_RE)
  if (ofm && ofm[1]) return `https://tiles.openfreemap.org/styles/${ofm[1]}`

  return githubNormalized
}
