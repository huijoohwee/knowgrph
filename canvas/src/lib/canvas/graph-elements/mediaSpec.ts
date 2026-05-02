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
import { RICH_MEDIA_CONNECTED_RENDER_PATHS_KEY } from '@/lib/render/effectiveMediaNode'

export const NODE_MEDIA_KINDS = ['image', 'svg', 'video', 'iframe'] as const
export type NodeMediaKind = typeof NODE_MEDIA_KINDS[number]
export const DEFAULT_NODE_MEDIA_KIND: NodeMediaKind = NODE_MEDIA_KINDS[0]

export function patchNodeMediaProperties(args: {
  properties?: Record<string, unknown> | null | undefined
  kind?: unknown
  url?: unknown
  interactive?: unknown
}): Record<string, unknown> {
  const next = { ...(args.properties || {}) }
  const normalizedUrl = coerceMediaUrl(args.url)
  if (!normalizedUrl) {
    delete next.media_url
    delete next.media_kind
    delete next.media_interactive
    return next
  }
  const kindRaw = String(args.kind || '').trim().toLowerCase()
  const normalizedKind = NODE_MEDIA_KINDS.includes(kindRaw as NodeMediaKind)
    ? (kindRaw as NodeMediaKind)
    : DEFAULT_NODE_MEDIA_KIND
  next.media_url = normalizedUrl
  next.media_kind = normalizedKind
  if (args.interactive === true) next.media_interactive = true
  else delete next.media_interactive
  return next
}

export type NodeMediaSpec = {
  kind: NodeMediaKind
  url: string
  srcDoc?: string
  interactive: boolean
}

export type NodeMediaInventoryRow = {
  id: string
  label: string
  type: string
  media: NodeMediaSpec
}

export type NodeMediaInventory = {
  rows: ReadonlyArray<NodeMediaInventoryRow>
  totalCount: number
  imageCount: number
  imageLikeCount: number
  videoCount: number
  iframeCount: number
  svgCount: number
}

const mediaSpecCache = new WeakMap<GraphNode, { cacheKey: string; spec: NodeMediaSpec | null }>()
const RICH_MEDIA_PANEL_TEXT_FALLBACK_TITLE = 'Rich Media Panel'

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

function isImagePreviewKind(kind: NodeMediaKind | null | undefined): boolean {
  return kind === 'image' || kind === 'svg'
}

function pushUniqueImagePreviewUrl(
  value: unknown,
  out: string[],
  seen: Set<string>,
): void {
  const url = coerceMediaUrl(value)
  if (!url) return
  if (seen.has(url)) return
  seen.add(url)
  out.push(url)
}

function appendMarkdownImagePreviewUrls(
  value: unknown,
  out: string[],
  seen: Set<string>,
  limit: number,
): void {
  const raw = typeof value === 'string' ? value : ''
  if (!raw.trim() || out.length >= limit) return
  const normalized = fixBrokenMarkdownImageSyntax(raw).text
  const refs = extractMarkdownInlineRefs(normalized)
  for (const ref of refs.images) {
    const altNorm = String(ref.alt || '').trim().toLowerCase()
    if (altNorm.startsWith('iframe') || altNorm.startsWith('video') || altNorm.startsWith('audio')) continue
    pushUniqueImagePreviewUrl(normalizeExternalUrl(ref.url), out, seen)
    if (out.length >= limit) return
  }
}

function appendRecordImagePreviewUrls(
  record: Record<string, unknown> | null | undefined,
  out: string[],
  seen: Set<string>,
  limit: number,
): void {
  if (!record || out.length >= limit) return

  pushUniqueImagePreviewUrl(record.image, out, seen)
  if (out.length >= limit) return
  pushUniqueImagePreviewUrl(record.imageUrl, out, seen)
  if (out.length >= limit) return

  const kindRaw =
    typeof record.media_kind === 'string'
      ? record.media_kind.trim().toLowerCase()
      : typeof record.mediaKind === 'string'
        ? record.mediaKind.trim().toLowerCase()
        : ''
  const genericCandidates = [record.media_url, record.mediaUrl, record.media]
  for (const candidate of genericCandidates) {
    const url = coerceMediaUrl(candidate)
    if (!url) continue
    const inferredKind = inferMediaKindFromResourceUrl(url) || inferMediaKindFromUrl(url)
    if (!isImagePreviewKind(kindRaw as NodeMediaKind) && !isImagePreviewKind(inferredKind as NodeMediaKind)) continue
    pushUniqueImagePreviewUrl(url, out, seen)
    if (out.length >= limit) return
  }

  const markdownCandidates = [
    record.text,
    record.markdown,
    record.output,
    record.description,
    record.summary,
    record.mdSectionMarkdown,
    record.sectionMarkdown,
  ]
  for (const candidate of markdownCandidates) {
    appendMarkdownImagePreviewUrls(candidate, out, seen, limit)
    if (out.length >= limit) return
  }
}

function isRichMediaPanelNode(node: GraphNode): boolean {
  return String(node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
}

function buildRichMediaPanelTextualIframeSpec(args: {
  node: GraphNode
  outputText: string
  outputSrcDoc: string
}): NodeMediaSpec {
  if (args.outputSrcDoc) {
    return { kind: 'iframe', url: '', srcDoc: args.outputSrcDoc, interactive: false }
  }
  const trimmed = args.outputText.trim()
  if (trimmed) {
    return {
      kind: 'iframe',
      url: '',
      srcDoc: buildTextWidgetOutputSrcDoc({
        title: String(args.node.label || args.node.id || '').trim() || RICH_MEDIA_PANEL_TEXT_FALLBACK_TITLE,
        text: args.outputText,
      }),
      interactive: false,
    }
  }
  return { kind: 'iframe', url: '', interactive: false }
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
    props.image,
    props.imageUrl,
    props.video,
    props.videoUrl,
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
    props[RICH_MEDIA_CONNECTED_RENDER_PATHS_KEY],
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
  const mediaUrl = coerceMediaUrl((props as Record<string, unknown>).media_url)
  const mediaUrlCamel = coerceMediaUrl((props as Record<string, unknown>).mediaUrl)
  const imageUrl = coerceMediaUrl((props as Record<string, unknown>).image)
  const imageUrlCamel = coerceMediaUrl((props as Record<string, unknown>).imageUrl)
  const videoUrl = coerceMediaUrl((props as Record<string, unknown>).video)
  const videoUrlCamel = coerceMediaUrl((props as Record<string, unknown>).videoUrl)
  const generic = coerceMediaUrl((props as Record<string, unknown>).media)
  const srcUrl = coerceMediaUrl((props as Record<string, unknown>).src)
  const linkUrl = coerceMediaUrl((props as Record<string, unknown>).url)
  const linkLabel = String((props as Record<string, unknown>).label || node.label || '').trim()

  const outputText = (() => {
    const s = (props as Record<string, unknown>).output
    return typeof s === 'string' ? s : ''
  })()

  const isRichMediaPanel = isRichMediaPanelNode(node)
  const connectedRenderPathSig = isRichMediaPanel
    ? String((props as Record<string, unknown>)[RICH_MEDIA_CONNECTED_RENDER_PATHS_KEY] || '').trim()
    : ''
  const connectedRenderPathSet = connectedRenderPathSig
    ? new Set(connectedRenderPathSig.split('|').map(path => path.trim()).filter(Boolean))
    : null
  const richMediaActiveTab = (() => {
    if (!isRichMediaPanel) return ''
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
    || mediaUrl
    || mediaUrlCamel
    || imageUrl
    || imageUrlCamel
    || videoUrl
    || videoUrlCamel
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

  if (isRichMediaPanel) {
    const selected = richMediaActiveTab === 'video' || richMediaActiveTab === 'image' || richMediaActiveTab === 'text' || richMediaActiveTab === 'poi'
      ? richMediaActiveTab
      : ''
    if (!selected && connectedRenderPathSet?.has('properties.videoUrl')) {
      const chosen = videoUrl || videoUrlCamel
      if (chosen) return { kind: 'video', url: chosen, interactive: explicitInteractive != null ? explicitInteractive : true }
    }
    if (!selected && connectedRenderPathSet?.has('properties.imageUrl')) {
      const chosen = imageUrl || imageUrlCamel
      if (chosen) return { kind: 'image', url: chosen, interactive: explicitInteractive != null ? explicitInteractive : false }
    }
    if (selected === 'video') {
      const chosen = videoUrl || videoUrlCamel
      if (chosen) return { kind: 'video', url: chosen, interactive: explicitInteractive != null ? explicitInteractive : true }
    }
    if (selected === 'image') {
      const chosen = imageUrl || imageUrlCamel
      if (chosen) return { kind: 'image', url: chosen, interactive: explicitInteractive != null ? explicitInteractive : false }
    }
    if (selected === 'text' || selected === 'poi') {
      return buildRichMediaPanelTextualIframeSpec({ node, outputText, outputSrcDoc })
    }
    if (
      !selected
      && connectedRenderPathSet?.has('properties.output')
      && !(connectedRenderPathSet.has('properties.videoUrl') || connectedRenderPathSet.has('properties.imageUrl'))
    ) {
      return buildRichMediaPanelTextualIframeSpec({ node, outputText, outputSrcDoc })
    }
    if (!selected && (outputSrcDoc || outputText.trim()) && !(videoUrl || videoUrlCamel || imageUrl || imageUrlCamel || getMarkdownMediaOnce()?.url)) {
      return buildRichMediaPanelTextualIframeSpec({ node, outputText, outputSrcDoc })
    }
    if (selected === 'video') return { kind: 'video', url: '', interactive: explicitInteractive != null ? explicitInteractive : false }
    if (selected === 'image') return { kind: 'image', url: '', interactive: explicitInteractive != null ? explicitInteractive : false }
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
    if (isRichMediaPanel) return buildRichMediaPanelTextualIframeSpec({ node, outputText, outputSrcDoc })
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
      ? 'iframe'
      : (videoUrl || videoUrlCamel)
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

export function getNodeImagePreviewUrls(node: GraphNode, limit = 8): string[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 8
  const out: string[] = []
  const seen = new Set<string>()
  const spec = getNodeMediaSpec(node)
  if (spec && isImagePreviewKind(spec.kind)) {
    pushUniqueImagePreviewUrl(spec.url, out, seen)
  }
  appendRecordImagePreviewUrls((node.properties || {}) as Record<string, unknown>, out, seen, safeLimit)
  if (out.length < safeLimit) {
    appendRecordImagePreviewUrls((node.metadata || {}) as Record<string, unknown>, out, seen, safeLimit)
  }
  return out.slice(0, safeLimit)
}

export function buildNodeMediaInventory(
  nodes: ReadonlyArray<GraphNode> | null | undefined,
  options?: { maxRows?: number; limitStatsToRows?: boolean },
): NodeMediaInventory {
  if (!Array.isArray(nodes) || nodes.length <= 0) {
    return {
      rows: [],
      totalCount: 0,
      imageCount: 0,
      imageLikeCount: 0,
      videoCount: 0,
      iframeCount: 0,
      svgCount: 0,
    }
  }

  const maxRowsRaw = options?.maxRows
  const maxRows =
    typeof maxRowsRaw === 'number' && Number.isFinite(maxRowsRaw)
      ? Math.max(0, Math.floor(maxRowsRaw))
      : Number.POSITIVE_INFINITY
  const limitStatsToRows = options?.limitStatsToRows === true
  const rows: NodeMediaInventoryRow[] = []
  let totalCount = 0
  let imageCount = 0
  let imageLikeCount = 0
  let videoCount = 0
  let iframeCount = 0
  let svgCount = 0

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!node) continue
    const spec = getNodeMediaSpec(node)
    if (!spec) continue

    const shouldList = rows.length < maxRows
    if (shouldList) {
      rows.push({
        id: String(node.id),
        label: String(node.label || node.id || ''),
        type: String(node.type || ''),
        media: spec,
      })
    }
    if (limitStatsToRows && !shouldList) continue

    totalCount += 1
    if (spec.kind === 'iframe') {
      iframeCount += 1
      continue
    }
    if (spec.kind === 'video') {
      videoCount += 1
      continue
    }
    if (spec.kind === 'svg') {
      svgCount += 1
      imageLikeCount += 1
      continue
    }
    if (spec.kind === 'image') {
      imageCount += 1
      imageLikeCount += 1
    }
  }

  return {
    rows,
    totalCount,
    imageCount,
    imageLikeCount,
    videoCount,
    iframeCount,
    svgCount,
  }
}
