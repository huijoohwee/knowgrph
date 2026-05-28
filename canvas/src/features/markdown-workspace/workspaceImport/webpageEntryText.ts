import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'
import type { CanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'
import { upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { normalizeWebpageCardAndListBlocks } from './htmlTextFallback'
import { yamlBlockScalar, yamlQuote } from './yaml'

type WebsiteImportMeta = {
  importId: string
  nodeId: string
  outputDirRel?: string
  rawHtmlRelPath?: string
  markdownRelPath?: string
  conversionJsonRelPath?: string
  rawHtmlSha256?: string
  markdownSha256?: string
  conversionJsonSha256?: string
}

function pushWebsiteImportMetaLines(fmLines: string[], meta: WebsiteImportMeta | null | undefined): void {
  const importId = String(meta?.importId || '').trim()
  const nodeId = String(meta?.nodeId || '').trim()
  const outputDirRel = String(meta?.outputDirRel || '').trim()
  if (importId) fmLines.push(`kgWebsiteImportId: ${yamlQuote(importId)}`)
  if (nodeId) fmLines.push(`kgWebsiteNodeId: ${yamlQuote(nodeId)}`)
  if (outputDirRel) fmLines.push(`kgWebsiteOutputDirRel: ${yamlQuote(outputDirRel)}`)
  const artifactPairs = [
    ['kgWebsiteRawHtmlRelPath', meta?.rawHtmlRelPath],
    ['kgWebsiteMarkdownRelPath', meta?.markdownRelPath],
    ['kgWebsiteConversionJsonRelPath', meta?.conversionJsonRelPath],
    ['kgWebsiteRawHtmlSha256', meta?.rawHtmlSha256],
    ['kgWebsiteMarkdownSha256', meta?.markdownSha256],
    ['kgWebsiteConversionJsonSha256', meta?.conversionJsonSha256],
  ] as const
  for (const [key, value] of artifactPairs) {
    const text = String(value || '').trim()
    if (text) fmLines.push(`${key}: ${yamlQuote(text)}`)
  }
}

function buildCanvasPresetLines(preset: CanvasWorkspaceFrontmatterPreset | null | undefined): string[] {
  if (!preset) return []
  const lines: string[] = []
  if (preset.canvasSurfaceMode) lines.push(`kgCanvasSurfaceMode: ${yamlQuote(preset.canvasSurfaceMode)}`)
  if (preset.canvasRenderMode) lines.push(`kgCanvasRenderMode: ${yamlQuote(preset.canvasRenderMode)}`)
  if (preset.canvas3dMode) lines.push(`kgCanvas3dMode: ${yamlQuote(preset.canvas3dMode)}`)
  if (preset.canvas2dRenderer) lines.push(`kgCanvas2dRenderer: ${yamlQuote(preset.canvas2dRenderer)}`)
  if (preset.documentSemanticMode) lines.push(`kgDocumentSemanticMode: ${yamlQuote(preset.documentSemanticMode)}`)
  if (preset.frontmatterModeEnabled != null) lines.push(`kgFrontmatterModeEnabled: ${yamlQuote(preset.frontmatterModeEnabled ? 'true' : 'false')}`)
  if (preset.multiDimTableModeEnabled != null) {
    lines.push(`kgMultiDimTableModeEnabled: ${yamlQuote(preset.multiDimTableModeEnabled ? 'true' : 'false')}`)
  }
  if (preset.documentStructureBaselineLock != null) {
    lines.push(`kgDocumentStructureBaselineLock: ${yamlQuote(preset.documentStructureBaselineLock ? 'true' : 'false')}`)
  }
  return lines
}

const decodeLooseHtmlEntities = (text: string): string => {
  let next = String(text || '')
  if (!next.includes('&')) return next
  const decodeCodePoint = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0 || value > 0x10ffff) return ''
    try {
      return String.fromCodePoint(value)
    } catch {
      return ''
    }
  }
  next = next.replace(/&#x\s*([0-9a-f]{1,6})\s*;?/gi, (_m, hex: string) => {
    const decoded = decodeCodePoint(Number.parseInt(String(hex || ''), 16))
    return decoded || _m
  })
  next = next.replace(/&#\s*([0-9]{1,7})\s*;?/g, (_m, dec: string) => {
    const decoded = decodeCodePoint(Number.parseInt(String(dec || ''), 10))
    return decoded || _m
  })
  next = next
    .replace(/&nbsp\s*;?/gi, ' ')
    .replace(/&amp\s*;?/gi, '&')
    .replace(/&lt\s*;?/gi, '<')
    .replace(/&gt\s*;?/gi, '>')
    .replace(/&quot\s*;?/gi, '"')
    .replace(/&apos\s*;?/gi, "'")
  return next
}

const normalizeLocalProxyUrlsInMarkdown = (text: string): string => {
  let next = String(text || '')
  if (!next) return next
  next = next.replace(/\\&/g, '&')
  next = next.replace(
    /https?:\/\/[^\s)\]]+(\/__(?:webpage_asset_path|webpage_asset_proxy|webpage_proxy|fetch_remote)[^\s)\]]*)/gi,
    '$1',
  )
  return next
}

const labelForHttpUrl = (rawUrl: string): string => {
  const uRaw = String(rawUrl || '').trim()
  if (!uRaw) return 'link'
  try {
    const u = new URL(uRaw)
    const host = u.hostname.toLowerCase()
    if (host === 'mp.weixin.qq.com' || host.endsWith('.mp.weixin.qq.com')) return 'WeChat'
    const compact = uRaw.length <= 72 ? uRaw : u.hostname
    return compact || 'link'
  } catch {
    return uRaw.length <= 72 ? uRaw : 'link'
  }
}

const normalizeUrlishTextForComparison = (text: string): string => {
  return decodeLooseHtmlEntities(String(text || ''))
    .replace(/\\([()[\]{}_])/g, '$1')
    .replace(/\s+/g, '')
    .trim()
}

const shouldCanonicalizeProxyLinkLabel = (label: string, href: string, upstreamUrl: string): boolean => {
  const normalizedLabel = normalizeLocalProxyUrlsInMarkdown(String(label || '').trim())
  if (!normalizedLabel) return true
  if (normalizedLabel === href) return true
  if (/^\/__(?:webpage_asset_path|webpage_asset_proxy|webpage_proxy|fetch_remote)\b/i.test(normalizedLabel)) return true

  const canonicalUpstream = String(upstreamUrl || '').trim()
  if (!canonicalUpstream) return false

  const labelComparable = normalizeUrlishTextForComparison(normalizedLabel)
  const upstreamComparable = normalizeUrlishTextForComparison(canonicalUpstream)
  if (!labelComparable || !upstreamComparable) return false
  if (labelComparable === upstreamComparable) return true

  const labelLooksUrlish =
    /^https?:\/\//i.test(labelComparable)
    || /^www\./i.test(labelComparable)
    || /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(labelComparable)
  if (!labelLooksUrlish) return false

  try {
    const upstreamHost = new URL(canonicalUpstream).hostname.toLowerCase()
    const labelHost = /^https?:\/\//i.test(labelComparable)
      ? new URL(labelComparable).hostname.toLowerCase()
      : /^www\./i.test(labelComparable)
        ? new URL(`https://${labelComparable}`).hostname.toLowerCase()
        : new URL(`https://${labelComparable}`).hostname.toLowerCase()
    return !!upstreamHost && upstreamHost === labelHost
  } catch {
    return false
  }
}

const extractUpstreamUrlFromProxyHref = (rawHref: string): string => {
  const href = normalizeLocalProxyUrlsInMarkdown(String(rawHref || '').trim())
  if (!href) return ''
  const decodeSafe = (value: string): string => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  const assetPath = href.match(/^\/__webpage_asset_path\/(.+)$/i)
  if (assetPath) {
    const decoded = decodeSafe(String(assetPath[1] || '').trim())
    return /^https?:\/\//i.test(decoded) ? decoded : ''
  }
  const fetchRemote = href.match(/^\/__fetch_remote\?(.*)$/i)
  if (fetchRemote) {
    const params = new URLSearchParams(String(fetchRemote[1] || ''))
    const decoded = decodeSafe(String(params.get('url') || '').trim())
    return /^https?:\/\//i.test(decoded) ? decoded : ''
  }
  const webpageProxy = href.match(/^\/__webpage_proxy\?(.*)$/i)
  if (webpageProxy) {
    const params = new URLSearchParams(String(webpageProxy[1] || ''))
    const decoded = decodeSafe(String(params.get('url') || '').trim())
    return /^https?:\/\//i.test(decoded) ? decoded : ''
  }
  return ''
}

const normalizeAutolinksToCardsInMarkdown = (text: string): string => {
  let next = String(text || '')
  if (!next) return next
  next = next.replace(
    /(^|[\s(])!\s*<\s*((?:https?:\/\/[^\s>]+)?\/__(?:webpage_asset_path|webpage_asset_proxy|webpage_proxy|fetch_remote)[^>\s]*)\s*>(?=$|[\s)])/gi,
    '$1![]($2)',
  )
  next = next.replace(
    /(^|[\s(])!\s*((?:https?:\/\/[^\s)]+)?\/__(?:webpage_asset_path|webpage_asset_proxy|webpage_proxy|fetch_remote)[^\s)]*)(?=$|[\s)])/gi,
    '$1![]($2)',
  )
  next = next.replace(/(^|[\s(])!\s*<\s*(https?:\/\/[^>\s]+)\s*>(?=$|[\s)])/g, '$1![]($2)')
  next = next.replace(/(^|[\s(])!\s*(https?:\/\/[^\s)]+)(?=$|[\s)])/g, '$1![]($2)')
  next = next.replace(/<\s*(https?:\/\/[^>\s]+)\s*>/gi, (_m, u: string) => `[${labelForHttpUrl(u)}](${u})`)
  next = next.replace(/\*\*\s*\[\]\((https?:\/\/[^)\s]+)\)/g, (_m, u: string) => `[${labelForHttpUrl(u)}](${u})`)
  next = next.replace(/\[\]\((https?:\/\/[^)\s]+)\)/g, (_m, u: string) => `[${labelForHttpUrl(u)}](${u})`)
  return next
}

const normalizeProxyMarkdownLinks = (text: string): string => {
  let next = String(text || '')
  if (!next) return next
  next = next.replace(/\[((?:https?:\/\/[^\s)\]]+)?\/__(?:webpage_asset_path|webpage_asset_proxy|webpage_proxy|fetch_remote)[^)\]\s]*)\)/gi, (_m, rawHref: string) => {
    const href = normalizeLocalProxyUrlsInMarkdown(String(rawHref || '').trim())
    const upstreamUrl = extractUpstreamUrlFromProxyHref(href)
    return `[${String(upstreamUrl || href).trim()}](${href})`
  })
  next = next.replace(/(!?)\[([^\]]*)\]\((\/__(?:webpage_asset_path|webpage_asset_proxy|webpage_proxy|fetch_remote)[^)]+)\)/gi, (_m, bang: string, rawLabel: string, rawHref: string) => {
    const href = normalizeLocalProxyUrlsInMarkdown(String(rawHref || '').trim())
    const upstreamUrl = extractUpstreamUrlFromProxyHref(href)
    const label = decodeLooseHtmlEntities(String(rawLabel || '').trim())
    const shouldReplaceLabel = shouldCanonicalizeProxyLinkLabel(label, href, upstreamUrl)
    const nextLabel = shouldReplaceLabel
      ? String(upstreamUrl || label || href).trim()
      : label
    return `${bang || ''}[${nextLabel}](${href})`
  })
  return next
}

const normalizeWorkspaceWebpageEntryBodyText = (text: string): string => {
  const decoded = decodeLooseHtmlEntities(String(text || ''))
  const proxyNormalized = normalizeLocalProxyUrlsInMarkdown(decoded)
  const autolinkNormalized = normalizeAutolinksToCardsInMarkdown(proxyNormalized)
  const proxyLinksNormalized = normalizeProxyMarkdownLinks(autolinkNormalized)
  return normalizeLocalProxyUrlsInMarkdown(proxyLinksNormalized)
}

export function buildWebpageWorkspaceEntryStubText(args: {
  url: string
  view: 'markdown' | 'json' | 'html'
  body: string
  hydrate?: boolean
  siteRootRel?: string
  scriptPolicy?: 'strip' | 'allow'
  fidelityLevel?: 1 | 2 | 3 | 4
  includeImages?: boolean
  canvasPreset?: CanvasWorkspaceFrontmatterPreset | null
}): string {
  const url = String(args.url || '').trim()
  const view = args.view === 'html' ? 'html' : args.view === 'json' ? 'json' : 'markdown'
  const body = String(args.body || '').trimEnd()
  const siteRootRel = String(args.siteRootRel || '').trim()
  const canvasPresetLines = buildCanvasPresetLines(args.canvasPreset)
  const hydrateLine = args.hydrate === false ? `kgWebpageHydrate: ${yamlQuote('false')}` : null
  const scriptPolicy = args.scriptPolicy === 'allow' ? 'allow' : args.scriptPolicy === 'strip' ? 'strip' : ''
  const fidelityLevel =
    args.fidelityLevel === 1 || args.fidelityLevel === 2 || args.fidelityLevel === 3 || args.fidelityLevel === 4
      ? args.fidelityLevel
      : 0
  const includeImages = args.includeImages === true ? true : args.includeImages === false ? false : null
  const fmLines = [
    '---',
    ...canvasPresetLines,
    `kgWebpageUrl: ${yamlQuote(url)}`,
    `kgWebpageView: ${yamlQuote(view)}`,
    scriptPolicy ? `kgWebpageScriptPolicy: ${yamlQuote(scriptPolicy)}` : null,
    fidelityLevel ? `kgWebpageFidelityLevel: ${yamlQuote(String(fidelityLevel))}` : null,
    includeImages != null ? `kgWebpageIncludeImages: ${yamlQuote(includeImages ? 'true' : 'false')}` : null,
    siteRootRel ? `kgWebpageSiteRootRel: ${yamlQuote(siteRootRel)}` : null,
    hydrateLine,
    '---',
    '',
    body,
    '',
  ]
    .filter(Boolean)
    .join('\n')
  return fmLines.trimEnd() + '\n'
}

export function buildWebpageWorkspaceEntryTextFromUpstreamMarkdown(args: {
  upstreamMarkdown: string
  url: string
  view: 'markdown' | 'json' | 'html'
  title?: string
  diag?: string
  scriptPolicy?: 'strip' | 'allow'
  fidelityLevel?: 1 | 2 | 3 | 4
  includeImages?: boolean
  websiteImportMeta?: WebsiteImportMeta | null
  canvasPreset?: CanvasWorkspaceFrontmatterPreset | null
  preserveBodyFidelity?: boolean
}): string {
  const url = String(args.url || '').trim()
  const view = args.view === 'html' ? 'html' : args.view === 'json' ? 'json' : 'markdown'
  const scriptPolicy = args.scriptPolicy === 'allow' ? 'allow' : args.scriptPolicy === 'strip' ? 'strip' : ''
  const fidelityLevel =
    args.fidelityLevel === 1 || args.fidelityLevel === 2 || args.fidelityLevel === 3 || args.fidelityLevel === 4
      ? args.fidelityLevel
      : 0
  const includeImages = args.includeImages === true ? true : args.includeImages === false ? false : null
  const upstreamSanitized = sanitizeImportedMarkdownText(String(args.upstreamMarkdown || ''), { sourceUrl: url }).text
  const strippedUpstream = (() => {
    const t = String(upstreamSanitized || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()

  const urlLine = `kgWebpageUrl: ${yamlQuote(url)}`
  const viewLine = `kgWebpageView: ${yamlQuote(view)}`
  const fmLines = ['---', ...buildCanvasPresetLines(args.canvasPreset), urlLine, viewLine]
  if (scriptPolicy) fmLines.push(`kgWebpageScriptPolicy: ${yamlQuote(scriptPolicy)}`)
  if (fidelityLevel) fmLines.push(`kgWebpageFidelityLevel: ${yamlQuote(String(fidelityLevel))}`)
  if (includeImages != null) fmLines.push(`kgWebpageIncludeImages: ${yamlQuote(includeImages ? 'true' : 'false')}`)

  pushWebsiteImportMetaLines(fmLines, args.websiteImportMeta)

  const withView = upsertWebpageFrontmatterMeta(strippedUpstream, { url, view })
  const body = (() => {
    const t = String(withView || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()
  const normalizedBody = args.preserveBodyFidelity ? body : normalizeWebpageCardAndListBlocks(body)
  const title = String(args.title || '').replace(/\s+/g, ' ').trim()
  const diag = String(args.diag || '').trim()
  const bodyText = String(normalizedBody || '').trim()
  const finalBody = normalizeWorkspaceWebpageEntryBodyText(bodyText)
  if (diag && bodyText && bodyText.length <= 140 && (!title || bodyText.replace(/\s+/g, ' ').trim() === title)) {
    fmLines.push(...yamlBlockScalar('kgWebpageDiagnostics', diag))
  }
  fmLines.push('---', '')
  return [...fmLines, finalBody].join('\n').trimEnd() + '\n'
}

export function buildWebsiteImportWebpageDocFromUpstreamMarkdown(args: {
  upstreamMarkdown: string
  url: string
  view: 'markdown' | 'json' | 'html'
  websiteImportMeta: WebsiteImportMeta
}): string {
  const url = String(args.url || '').trim()
  const view = args.view === 'html' ? 'html' : args.view === 'json' ? 'json' : 'markdown'
  const upstreamSanitized = sanitizeImportedMarkdownText(String(args.upstreamMarkdown || ''), { sourceUrl: url }).text
  const strippedUpstream = (() => {
    const t = String(upstreamSanitized || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()

  const fmLines = [
    '---',
    `kgWebpageUrl: ${yamlQuote(url)}`,
    `kgWebpageView: ${yamlQuote(view)}`,
  ]
  pushWebsiteImportMetaLines(fmLines, args.websiteImportMeta)
  fmLines.push('---', '')

  const withView = upsertWebpageFrontmatterMeta(strippedUpstream, { url, view })
  const body = (() => {
    const t = String(withView || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()
  const normalizedBody = normalizeWebpageCardAndListBlocks(body)
  const finalBody = normalizeWorkspaceWebpageEntryBodyText(String(normalizedBody || '').trim())
  return [...fmLines, finalBody].join('\n').trimEnd() + '\n'
}
