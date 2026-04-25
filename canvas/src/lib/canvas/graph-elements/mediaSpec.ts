import type { GraphNode } from '@/lib/graph/types'
import { IFRAME_ALLOWED_HOSTS } from '@/lib/config'
import { coerceMediaUrl } from '@/lib/url'
import { inferMediaKindFromResourceUrl, prefersIframeFromLinkContext } from '@/lib/graph/mediaUrlKind'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { inferMediaKindFromUrl } from 'grph-shared/rich-media/mediaKind'
import { isSafeIframeUrl, normalizeIframeUrl, resolveIframeEmbed } from 'grph-shared/rich-media/iframe'
import { buildBilibiliEmbedUrl, buildTwitterEmbedUrl, buildVimeoEmbedUrl, buildYouTubeEmbedUrl } from 'grph-shared/rich-media/providers'
import { coerceMarkdownParenUrl, extractMarkdownInlineRefs } from '@/features/parsers/markdownJsonLdUtils'
import { fixBrokenMarkdownImageSyntax } from '@/lib/markdown/sanitizeImportedMarkdown'
import { buildTextWidgetOutputSrcDoc } from '@/lib/render/widgetOutputSrcDoc'

export type NodeMediaKind = 'image' | 'svg' | 'video' | 'iframe'

export type NodeMediaSpec = {
  kind: NodeMediaKind
  url: string
  srcDoc?: string
  interactive: boolean
}

const mediaSpecCache = new WeakMap<GraphNode, { cacheKey: string; spec: NodeMediaSpec | null }>()

function normalizeExternalUrl(u: string): string {
  const trimmed = String(u || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed
}

function extractMarkdownMediaUrl(text: string): { kind: NodeMediaKind; url: string } | null {
  const raw = String(text || '')
  if (!raw.trim()) return null
  const normalized = fixBrokenMarkdownImageSyntax(raw).text
  const trimmed = normalized.trim()

  const iframeMatch = trimmed.match(/<iframe\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
  if (iframeMatch) {
    const u = String(iframeMatch[1] || iframeMatch[2] || iframeMatch[3] || '').trim()
    const resolved = normalizeExternalUrl(u)
    if (resolved) return { kind: 'iframe', url: resolved }
  }

  const videoMatch = trimmed.match(/<video\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
  if (videoMatch) {
    const u = String(videoMatch[1] || videoMatch[2] || videoMatch[3] || '').trim()
    const resolved = normalizeExternalUrl(u)
    if (resolved) return { kind: 'video', url: resolved }
  }

  const imgStandalone = trimmed.match(/^!\[[^\]]*\]\(([^)]+)\)\s*$/)
  if (imgStandalone && imgStandalone[1]) {
    const u = coerceMarkdownParenUrl(imgStandalone[1])
    const resolved = normalizeExternalUrl(u)
    if (resolved) return { kind: 'image', url: resolved }
  }

  const linkStandalone = trimmed.match(/^\[[^\]]+\]\(([^)]+)\)\s*$/)
  if (linkStandalone && linkStandalone[1]) {
    const u = coerceMarkdownParenUrl(linkStandalone[1])
    const resolved = normalizeExternalUrl(u)
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
    if (inferred === 'svg') return { kind: 'svg', url: resolved }
    if (inferred === 'image') return { kind: 'image', url: resolved }
    return { kind: 'iframe', url: resolved }
  }

  return null
}

function getCacheKey(node: GraphNode, props: Record<string, unknown>): string {
  return [
    node.id,
    node.type,
    node.label,
    props.media_kind,
    props.mediaKind,
    props.media_url,
    props.mediaUrl,
    props.iframe_url,
    props.iframeUrl,
    props.image,
    props.imageUrl,
    props.image_url,
    props.video,
    props.videoUrl,
    props.video_url,
    props.media,
    props.url,
    props.src,
    props.label,
    props['dom:tag'],
    props['dom:attrs:src'],
    props['dom:attrs:srcdoc'],
    props.media_interactive,
    props.outputSrcDoc,
    props.output,
    props.text,
    props.markdown,
    props.richMediaActiveTab,
    props.freezeConnectedOutput,
  ]
    .map(v => String(v ?? ''))
    .join('\n')
}

function computeNodeMediaSpec(node: GraphNode): NodeMediaSpec | null {
  const props = node.properties || {}
  const kindRaw = typeof props.media_kind === 'string'
    ? props.media_kind.trim().toLowerCase()
    : typeof props.mediaKind === 'string'
      ? props.mediaKind.trim().toLowerCase()
      : ''
  const kindForced: NodeMediaKind | null =
    kindRaw === 'iframe' || kindRaw === 'video' || kindRaw === 'image' || kindRaw === 'svg' ? (kindRaw as NodeMediaKind) : null

  const iframeUrl = coerceMediaUrl((props as Record<string, unknown>).iframe_url)
  const iframeUrlCamel = coerceMediaUrl((props as Record<string, unknown>).iframeUrl)
  const mediaUrl = coerceMediaUrl((props as Record<string, unknown>).media_url)
  const mediaUrlCamel = coerceMediaUrl((props as Record<string, unknown>).mediaUrl)
  const imageUrl = coerceMediaUrl((props as Record<string, unknown>).image)
  const imageUrlCamel = coerceMediaUrl((props as Record<string, unknown>).imageUrl)
  const imageUrlLegacy = coerceMediaUrl((props as Record<string, unknown>).image_url)
  const videoUrl = coerceMediaUrl((props as Record<string, unknown>).video)
  const videoUrlCamel = coerceMediaUrl((props as Record<string, unknown>).videoUrl)
  const videoUrlLegacy = coerceMediaUrl((props as Record<string, unknown>).video_url)
  const generic = coerceMediaUrl((props as Record<string, unknown>).media)
  const srcUrl = coerceMediaUrl((props as Record<string, unknown>).src)
  const linkUrl = coerceMediaUrl((props as Record<string, unknown>).url)
  const linkLabel = String((props as Record<string, unknown>).label || node.label || '').trim()

  const outputText = (() => {
    const s = (props as Record<string, unknown>).output
    return typeof s === 'string' ? s : ''
  })()

  const richMediaActiveTab = (() => {
    if (String(node.type || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return ''
    return String((props as Record<string, unknown>).richMediaActiveTab || '').trim().toLowerCase()
  })()
  let markdownMedia: { kind: NodeMediaKind; url: string } | null = null
  const getMarkdownMediaOnce = () => {
    if (markdownMedia !== null) return markdownMedia
    const t = (props as Record<string, unknown>).text
    const m = (props as Record<string, unknown>).markdown
    const rawText =
      typeof t === 'string'
        ? t
        : typeof m === 'string'
          ? m
          : outputText
    const extracted = extractMarkdownMediaUrl(rawText)
    if (!extracted) {
      markdownMedia = null
      return null
    }
    const coerced = coerceMediaUrl(extracted.url)
    if (!coerced) {
      markdownMedia = null
      return null
    }
    markdownMedia = { kind: extracted.kind, url: coerced }
    return markdownMedia
  }

  const inferredLinkKind = inferMediaKindFromResourceUrl(linkUrl || '')
  const inferLinkAsIframe = inferredLinkKind == null && prefersIframeFromLinkContext({ label: linkLabel, url: linkUrl || undefined })
  let url =
    iframeUrl
    || iframeUrlCamel
    || mediaUrl
    || mediaUrlCamel
    || imageUrl
    || imageUrlCamel
    || imageUrlLegacy
    || videoUrl
    || videoUrlCamel
    || videoUrlLegacy
    || generic
    || srcUrl
    || (inferredLinkKind || inferLinkAsIframe ? linkUrl : null)

  if (!url) url = getMarkdownMediaOnce()?.url || null

  const domTag = (() => {
    const t = (props as Record<string, unknown>)['dom:tag']
    return typeof t === 'string' ? t.trim().toUpperCase() : ''
  })()
  const domSrc = (() => {
    const s = (props as Record<string, unknown>)['dom:attrs:src']
    const raw = typeof s === 'string' ? s.trim() : ''
    if (!raw) return ''
    if (raw.startsWith('//')) return `https:${raw}`
    return raw
  })()
  const domSrcDoc = (() => {
    const s = (props as Record<string, unknown>)['dom:attrs:srcdoc']
    return typeof s === 'string' ? s.trim() : ''
  })()
  const outputSrcDoc = (() => {
    const s = (props as Record<string, unknown>).outputSrcDoc
    return typeof s === 'string' ? s.trim() : ''
  })()

  const rawInteractive = (props as Record<string, unknown>).media_interactive
  const explicitInteractive = rawInteractive === true ? true : rawInteractive === false ? false : null

  if (String(node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
    const selected = richMediaActiveTab === 'video' || richMediaActiveTab === 'image' || richMediaActiveTab === 'text' || richMediaActiveTab === 'poi'
      ? richMediaActiveTab
      : ''
    if (selected === 'video') {
      const chosen = videoUrl || videoUrlCamel || videoUrlLegacy
      if (chosen) return { kind: 'video', url: chosen, interactive: explicitInteractive != null ? explicitInteractive : true }
    }
    if (selected === 'image') {
      const chosen = imageUrl || imageUrlCamel || imageUrlLegacy
      if (chosen) return { kind: 'image', url: chosen, interactive: explicitInteractive != null ? explicitInteractive : false }
    }
    if (selected === 'text' || selected === 'poi') {
      if (outputSrcDoc) return { kind: 'iframe', url: '', srcDoc: outputSrcDoc, interactive: false }
      const trimmed = outputText.trim()
      if (trimmed) {
        return {
          kind: 'iframe',
          url: '',
          srcDoc: buildTextWidgetOutputSrcDoc({
            title: String(node.label || node.id || '').trim() || 'Rich Media Panel',
            text: outputText,
          }),
          interactive: false,
        }
      }
    }
  }
  const domMediaUrl = (() => {
    if (!domTag) return ''
    if (domTag === 'IMG' || domTag === 'VIDEO' || domTag === 'IFRAME' || domTag === 'SVG') return domSrc
    return ''
  })()

  const domKindForced: NodeMediaKind | null =
    domTag === 'IFRAME'
      ? 'iframe'
      : domTag === 'VIDEO'
        ? 'video'
        : domTag === 'SVG'
          ? 'svg'
          : domTag === 'IMG'
            ? 'image'
            : null

  const resolvedUrl = url || (domMediaUrl ? coerceMediaUrl(domMediaUrl) : null)
  if (!resolvedUrl) {
    if (outputSrcDoc && String(node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
      return { kind: 'iframe', url: '', srcDoc: outputSrcDoc, interactive: false }
    }
    if (outputText.trim() && String(node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
      return {
        kind: 'iframe',
        url: '',
        srcDoc: buildTextWidgetOutputSrcDoc({
          title: String(node.label || node.id || '').trim() || 'Rich Media Panel',
          text: outputText,
        }),
        interactive: false,
      }
    }
    if (String(node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
      return { kind: 'iframe', url: '', interactive: false }
    }
    if (domTag === 'IFRAME' && domSrcDoc) {
      if (/<\s*script\b/i.test(domSrcDoc)) return null
      if (/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(domSrcDoc)) return null
      if (/\bjavascript\s*:/i.test(domSrcDoc)) return null
      return { kind: 'iframe', url: '', srcDoc: domSrcDoc, interactive: true }
    }
    return null
  }

  const kind: NodeMediaKind = kindForced
    ? kindForced
    : iframeUrl
      || iframeUrlCamel
      ? 'iframe'
      : (videoUrl || videoUrlCamel || videoUrlLegacy)
        ? 'video'
        : domKindForced
          ? domKindForced
          : inferredLinkKind
            ? inferredLinkKind
            : inferLinkAsIframe
              ? 'iframe'
              : (getMarkdownMediaOnce()?.kind || ((inferMediaKindFromUrl(resolvedUrl) || 'image') as NodeMediaKind))

  const interactive = explicitInteractive != null ? explicitInteractive : kind === 'video' || kind === 'iframe'

  if (kind === 'iframe') {
    const normalized = normalizeIframeUrl(resolvedUrl)
    const embed = resolveIframeEmbed({ url: normalized })
    const enforceAllowedHosts = embed.direct
    if (!isSafeIframeUrl(embed.iframeSrc, {
      allowedHostsCsv: enforceAllowedHosts ? IFRAME_ALLOWED_HOSTS : '',
      allowYouTube: true,
      allowInternalPaths: true,
    })) return null
    return { kind, url: normalized, interactive }
  }

  return { kind, url: resolvedUrl, interactive }
}

export function getNodeMediaSpec(node: GraphNode): NodeMediaSpec | null {
  const props = (node.properties || {}) as Record<string, unknown>
  const cacheKey = getCacheKey(node, props)
  const cached = mediaSpecCache.get(node)
  if (cached && cached.cacheKey === cacheKey) return cached.spec
  const spec = computeNodeMediaSpec(node)
  mediaSpecCache.set(node, { cacheKey, spec })
  return spec
}

export function hasNodeMedia(node: GraphNode): boolean {
  return getNodeMediaSpec(node) != null
}
