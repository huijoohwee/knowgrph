import { coerceMarkdownParenUrl, extractMarkdownInlineRefs } from '@/features/parsers/markdownJsonLdUtils'
import type { NodeMediaKind } from '@/lib/canvas/graph-elements/mediaProperties'
import { inferMediaKindFromResourceUrl } from '@/lib/graph/mediaUrlKind'
import { fixBrokenMarkdownImageSyntax } from '@/lib/markdown/sanitizeImportedMarkdown'
import { buildBilibiliEmbedUrl, buildTwitterEmbedUrl, buildVimeoEmbedUrl, buildYouTubeEmbedUrl } from 'grph-shared/rich-media/providers'

export function normalizeExternalUrl(u: string): string {
  const trimmed = String(u || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed
}

export function extractMarkdownMediaUrl(text: string): { kind: NodeMediaKind; url: string } | null {
  const raw = String(text || '')
  if (!raw.trim()) return null
  const normalized = fixBrokenMarkdownImageSyntax(raw).text
  const trimmed = normalized.trim()

  for (const kind of ['iframe', 'video', 'audio'] as const) {
    const match = trimmed.match(new RegExp(`<${kind}\\b[^>]*\\bsrc\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, 'i'))
    if (match) {
      const resolved = normalizeExternalUrl(String(match[1] || match[2] || match[3] || '').trim())
      if (resolved) return { kind, url: resolved }
    }
  }

  const imgStandalone = trimmed.match(/^!\[[^\]]*\]\(([^)]+)\)\s*$/)
  if (imgStandalone && imgStandalone[1]) {
    const resolved = normalizeExternalUrl(coerceMarkdownParenUrl(imgStandalone[1]))
    if (resolved) return { kind: 'image', url: resolved }
  }

  const linkStandalone = trimmed.match(/^\[[^\]]+\]\(([^)]+)\)\s*$/)
  if (linkStandalone && linkStandalone[1]) {
    const resolved = normalizeExternalUrl(coerceMarkdownParenUrl(linkStandalone[1]))
    if (resolved) {
      const yt = buildYouTubeEmbedUrl(resolved, { noCookie: false, includeOrigin: false })
      if (yt) return { kind: 'iframe', url: yt }
      const x = buildTwitterEmbedUrl(resolved)
      if (x) return { kind: 'iframe', url: x }
      const vimeo = buildVimeoEmbedUrl(resolved)
      if (vimeo) return { kind: 'iframe', url: vimeo }
      const bili = buildBilibiliEmbedUrl(resolved)
      if (bili) return { kind: 'iframe', url: bili }
      const inferred = inferMediaKindFromResourceUrl(resolved)
      if (inferred === 'video') return { kind: 'video', url: resolved }
      if (inferred === 'audio') return { kind: 'audio', url: resolved }
      if (inferred === 'svg') return { kind: 'svg', url: resolved }
      if (inferred === 'image') return { kind: 'image', url: resolved }
      return { kind: 'iframe', url: resolved }
    }
  }

  const refs = extractMarkdownInlineRefs(normalized)
  const firstImg = refs.images && refs.images.length > 0 ? refs.images[0] : null
  if (firstImg && firstImg.url) {
    const resolved = normalizeExternalUrl(firstImg.url)
    if (resolved) return { kind: 'image', url: resolved }
  }
  const firstLink = refs.links && refs.links.length > 0 ? refs.links[0] : null
  if (firstLink && firstLink.url) {
    const resolved = normalizeExternalUrl(firstLink.url)
    if (!resolved) return null
    const inferred = inferMediaKindFromResourceUrl(resolved)
    if (inferred === 'video') return { kind: 'video', url: resolved }
    if (inferred === 'audio') return { kind: 'audio', url: resolved }
    if (inferred === 'svg') return { kind: 'svg', url: resolved }
    if (inferred === 'image') return { kind: 'image', url: resolved }
    return { kind: 'iframe', url: resolved }
  }

  return null
}
