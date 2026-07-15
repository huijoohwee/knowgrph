import React from 'react'
import type {
  TokensParagraph,
  TokensGeneric,
  TokensLink,
  TokensCode,
  TokensHTML,
  TokensImage,
} from '@/features/markdown/ui/MarkdownTokens'
import {
  type TokenWithLines,
} from '@/features/markdown/ui/markdownPreviewLex'
import { useMarkdownPreviewLexedMarkdown } from '@/features/markdown/ui/useMarkdownPreviewTokens'
import {
  buildMarkdownPreviewMediaKey,
  extractAttr,
  isAbsoluteWebUrl,
  isSafeHref,
  isSafeMediaSrc,
  isVideoUrl,
  looksLikeSingleTagBlock,
  resolveHref,
} from '@/features/markdown/ui/markdownPreviewLinks'
import { buildTwitterEmbedUrl, buildVimeoEmbedUrl, buildYouTubeEmbedUrl } from 'grph-shared/rich-media/providers'
import { extractScriptEmbedAnchorHref, pickFirstSrcsetUrl } from 'grph-shared/markdown/mediaHtml'
import { splitMermaidIntoDiagrams } from 'grph-shared/markdown/mermaidBlocks'
import { normalizeWebpageLikeUrl } from 'grph-shared/url'
import {
  type MermaidInitConfig,
  parseMermaidConfigFromFrontmatter,
  useRootThemeMode,
} from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { splitMarkdownLines } from '@/lib/markdown'
import { canonicalMediaDedupUrl, listMediaOverlayNodes, type RichMediaPanelOverlayState } from '@/lib/render/mediaOverlayPool'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/storyboardWidget/flowDataflow'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { applyConnectedValuesToNodeForRender } from '@/lib/render/effectiveMediaNode'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { buildRenderableMediaThumbnailUrl } from '@/lib/graph/mediaUrlKind'
import { applyImageLikeProxySrc } from '@/lib/url'

const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []

export type CommandMenuRichMediaKind = 'mermaid' | 'image' | 'video' | 'audio' | 'model' | 'iframe' | 'youtube' | 'vimeo' | 'webpage' | 'tweet'
export type CommandMenuRichMediaSource = 'markdown' | 'graph'

export type CommandMenuRichMediaItem = {
  key: string
  kind: CommandMenuRichMediaKind
  source: CommandMenuRichMediaSource
  startLine: number
  label: string
  panelTitle?: string
  nodeId?: string
  code?: string
  mermaidConfig?: MermaidInitConfig | null
  src?: string
  srcDoc?: string
  openUrl?: string
  alt?: string
  panel?: RichMediaPanelOverlayState
  thumbnailUrl?: string
  renameOwner?: CommandMenuRichMediaRenameOwner
}

export type CommandMenuRichMediaRenameOwner =
  | { type: 'graphNodeLabel'; nodeId: string }
  | { type: 'markdownLine'; startLine: number; href: string; syntax: 'standaloneUrl' | 'link' | 'image' }

function escapeMarkdownLabel(value: string): string {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\]/g, '\\]')
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceMarkdownLineMediaName(line: string, owner: Extract<CommandMenuRichMediaRenameOwner, { type: 'markdownLine' }>, nextName: string): string {
  const label = escapeMarkdownLabel(nextName)
  const href = String(owner.href || '').trim()
  if (!href) return line
  if (owner.syntax === 'standaloneUrl') {
    return `[${label}](${href})`
  }
  const hrefPattern = escapeRegex(href)
  if (owner.syntax === 'image') {
    const imagePattern = new RegExp(`!\\[[^\\]]*\\]\\(\\s*${hrefPattern}\\s*\\)`)
    return line.replace(imagePattern, `![${label}](${href})`)
  }
  const linkPattern = new RegExp(`(^|[^!])\\[[^\\]]*\\]\\(\\s*${hrefPattern}\\s*\\)`)
  return line.replace(linkPattern, (_match, prefix: string) => `${prefix}[${label}](${href})`)
}

function replaceMarkdownLineMediaNameByHref(line: string, href: string, nextName: string): string {
  const normalizedHref = String(href || '').trim()
  if (!normalizedHref) return line
  const ownerBase = { type: 'markdownLine', startLine: 1, href: normalizedHref } as const
  let nextLine = replaceMarkdownLineMediaName(line, { ...ownerBase, syntax: 'image' }, nextName)
  nextLine = replaceMarkdownLineMediaName(nextLine, { ...ownerBase, syntax: 'link' }, nextName)
  const trimmed = nextLine.trim()
  if (trimmed === normalizedHref || trimmed === `<${normalizedHref}>`) {
    return replaceMarkdownLineMediaName(nextLine, { ...ownerBase, syntax: 'standaloneUrl' }, nextName)
  }
  return nextLine
}

export function renameCommandMenuRichMediaMarkdownLine(args: {
  markdownText: string
  item: CommandMenuRichMediaItem
  nextName: string
}): string {
  const owner = args.item.renameOwner
  if (!owner || owner.type !== 'markdownLine') return args.markdownText
  const nextName = String(args.nextName || '').trim()
  if (!nextName) return args.markdownText
  const lineIndex = Math.max(0, Math.floor(owner.startLine || 1) - 1)
  const lines = splitMarkdownLines(args.markdownText)
  if (lineIndex >= lines.length) return args.markdownText
  const current = lines[lineIndex] || ''
  const nextLine = replaceMarkdownLineMediaName(current, owner, nextName)
  if (nextLine === current) return args.markdownText
  lines[lineIndex] = nextLine
  return lines.join('\n')
}

export function renameCommandMenuRichMediaMarkdownHref(args: {
  markdownText: string
  item: CommandMenuRichMediaItem
  nextName: string
}): string {
  const owner = args.item.renameOwner
  if (!owner || owner.type !== 'markdownLine') return args.markdownText
  const nextName = String(args.nextName || '').trim()
  const href = String(owner.href || '').trim()
  if (!nextName || !href) return args.markdownText
  const lines = splitMarkdownLines(args.markdownText)
  let changed = false
  const nextLines = lines.map(line => {
    const nextLine = replaceMarkdownLineMediaNameByHref(line, href, nextName)
    if (nextLine !== line) changed = true
    return nextLine
  })
  return changed ? nextLines.join('\n') : args.markdownText
}

function readInlineTokenText(tokens: readonly unknown[] | undefined): string {
  if (!Array.isArray(tokens)) return ''
  return tokens.map(token => {
    const record = token as { text?: unknown; tokens?: unknown[] }
    const text = String(record?.text || '').trim()
    if (text) return text
    return readInlineTokenText(record?.tokens)
  }).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

function readStandaloneLinkParagraph(token: TokenWithLines): { href: string; label: string } | null {
  const paragraph = token as unknown as TokensParagraph
  const inner = Array.isArray(paragraph.tokens) ? paragraph.tokens : []
  if (inner.length !== 1) return null
  const only = inner[0] as unknown as TokensGeneric
  if (only.type !== 'link') return null
  const link = only as unknown as TokensLink
  const href = String(link.href || '').trim()
  if (!href) return null
  const label = readInlineTokenText(link.tokens)
  return { href, label }
}

function isStandaloneTextUrlParagraph(token: TokenWithLines): string | null {
  const paragraph = token as unknown as TokensParagraph
  const inner = Array.isArray(paragraph.tokens) ? paragraph.tokens : []
  if (inner.length !== 1) return null
  const only = inner[0] as unknown as TokensGeneric
  if (only.type !== 'text') return null
  const rawText = String((only as unknown as { text?: unknown }).text || '').trim()
  if (!rawText) return null
  const cleaned = rawText.replace(/^<|>$/g, '').trim()
  if (!/^https?:\/\//i.test(cleaned)) return null
  return cleaned
}

function readYoutubeVideoId(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || ''
    if (host.includes('youtube.')) return parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).at(-1) || ''
  } catch {
    return ''
  }
  return ''
}

export function resolveRichMediaThumbnailUrl(item: Pick<CommandMenuRichMediaItem, 'kind' | 'src' | 'openUrl'>): string | undefined {
  const mediaUrl = String(item.src || item.openUrl || '').trim()
  if (!mediaUrl) return undefined
  const providerThumbnail = buildRenderableMediaThumbnailUrl(mediaUrl)
  if (providerThumbnail) return applyImageLikeProxySrc(providerThumbnail) || providerThumbnail
  const youtubeId = readYoutubeVideoId(item.openUrl || item.src || '')
  if (youtubeId) return applyImageLikeProxySrc(`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`)
  if (item.kind === 'image') return applyImageLikeProxySrc(mediaUrl) || mediaUrl
  return undefined
}

function getRichMediaItemDedupKey(item: CommandMenuRichMediaItem): string {
  if (item.kind === 'mermaid') return ''
  const url = canonicalMediaDedupUrl(item.openUrl || item.src || '')
  if (url) return `${item.kind}:url:${url}`
  const srcDoc = String(item.srcDoc || '').trim()
  return srcDoc ? `${item.kind}:srcdoc:${srcDoc}` : ''
}

function scoreRichMediaItemForDedup(item: CommandMenuRichMediaItem): number {
  let score = item.source === 'graph' ? 100 : 0
  if (item.renameOwner?.type === 'markdownLine') score += 20
  if (item.panel) score += 50
  if (String(item.thumbnailUrl || '').trim()) score += 10
  if (String(item.openUrl || '').trim()) score += 6
  if (String(item.src || '').trim()) score += 4
  if (String(item.srcDoc || '').trim()) score += 3
  if (String(item.panelTitle || '').trim()) score += 2
  return score
}

export function dedupeCommandMenuRichMediaItems(items: CommandMenuRichMediaItem[]): CommandMenuRichMediaItem[] {
  const unique: CommandMenuRichMediaItem[] = []
  const indexByKey = new Map<string, number>()
  const graphUrlKeys = new Set(
    items
      .filter(item => item.source === 'graph')
      .map(item => canonicalMediaDedupUrl(item.openUrl || item.src || ''))
      .filter(Boolean),
  )
  for (const item of items) {
    if (item.source !== 'graph') {
      const url = canonicalMediaDedupUrl(item.openUrl || item.src || '')
      if (url && graphUrlKeys.has(url)) continue
    }
    const dedupKey = getRichMediaItemDedupKey(item)
    if (!dedupKey) {
      unique.push(item)
      continue
    }
    const previousIndex = indexByKey.get(dedupKey)
    if (previousIndex == null) {
      indexByKey.set(dedupKey, unique.length)
      unique.push(item)
      continue
    }
    const previous = unique[previousIndex]
    if (!previous || scoreRichMediaItemForDedup(item) > scoreRichMediaItemForDedup(previous)) {
      unique[previousIndex] = item
    }
  }
  return unique
}

export function useCommandMenuRichMediaInventory(): {
  items: CommandMenuRichMediaItem[]
  mermaidFrontmatterConfig: MermaidInitConfig | null
  frontmatterMermaidCode: string
  frontmatterMermaidDiagrams: string[]
} {
  const markdownText = useGraphStore(s => s.markdownDocumentText || '')
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName || '')
  const graphData = useActiveGraphRenderData()
  const graphDataRevision = useGraphStore(s => s.graphDataRevision || 0)
  const widgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const rootThemeMode = useRootThemeMode()
  const { tokens, meta } = useMarkdownPreviewLexedMarkdown(
    markdownText || '',
    undefined,
    markdownDocumentName || '',
    false,
  )

  const mermaidFrontmatterConfig = React.useMemo(
    () => parseMermaidConfigFromFrontmatter(meta),
    [meta],
  )
  const frontmatterMermaidCode = React.useMemo(
    () => String((meta as Record<string, unknown>).mermaid || '').trim(),
    [meta],
  )
  const frontmatterMermaidDiagrams = React.useMemo(
    () => (frontmatterMermaidCode ? splitMermaidIntoDiagrams(frontmatterMermaidCode) : []),
    [frontmatterMermaidCode],
  )
  const graphSemanticKey = React.useMemo(
    () => buildScopedGraphSemanticKey('command-menu-rich-media', { graphData, graphRevision: graphDataRevision }),
    [graphData, graphDataRevision],
  )
  const graphLookup = React.useMemo(
    () => getCachedGraphLookup({
      cacheScope: 'command-menu-rich-media',
      graphData,
      graphRevision: graphDataRevision,
      graphSemanticKey,
      preferCurrentGraphDataRefs: true,
    }),
    [graphData, graphDataRevision, graphSemanticKey],
  )

  const items = React.useMemo(() => {
    const list: CommandMenuRichMediaItem[] = []
    const docPath = markdownDocumentName || ''
    const looksImageUrl = (href: string) =>
      /^data:image\//i.test(href) || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(href)
    const looksAudioUrl = (href: string) =>
      /\.(mp3|wav|m4a|aac|flac|ogg)(\?|#|$)/i.test(href)
    const pushHtmlMediaItem = (kind: 'iframe' | 'video' | 'audio', srcRaw: string | null, startLine: number) => {
      if (!srcRaw || !isSafeHref(srcRaw) || !isSafeMediaSrc(srcRaw)) return
      const src = resolveHref(srcRaw, docPath)
      const item: CommandMenuRichMediaItem = {
        key: buildMarkdownPreviewMediaKey(kind, startLine, srcRaw),
        kind,
        source: 'markdown',
        startLine,
        label: `${kind === 'iframe' ? 'Embedded content' : kind === 'video' ? 'Video' : 'Audio'} ${list.length + 1}`,
        src,
        openUrl: src,
      }
      item.thumbnailUrl = resolveRichMediaThumbnailUrl(item)
      list.push(item)
    }

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]
      const tokenGeneric = token as unknown as TokensGeneric
      if (tokenGeneric.type === 'code') {
        const codeToken = token as unknown as TokensCode
        const lang = String((codeToken as unknown as { lang?: unknown }).lang || '').trim().toLowerCase()
        if (lang !== 'mermaid' && lang !== 'mmd') continue
        const diagrams = splitMermaidIntoDiagrams(String(codeToken.text || ''))
        for (let j = 0; j < diagrams.length; j += 1) {
          const code = diagrams[j]
          list.push({
            key: buildMarkdownPreviewMediaKey('mermaid', token.startLine, `${j}:${code}`),
            kind: 'mermaid',
            source: 'markdown',
            startLine: token.startLine,
            label: `Mermaid diagram ${list.length + 1}`,
            code,
            mermaidConfig: mermaidFrontmatterConfig,
          })
        }
        continue
      }

      if (tokenGeneric.type === 'html') {
        const html = String((token as unknown as TokensHTML).text || '').trim()
        if (looksLikeSingleTagBlock(html, 'iframe') || looksLikeSingleTagBlock(html, 'embed') || looksLikeSingleTagBlock(html, 'object')) {
          const srcRaw = looksLikeSingleTagBlock(html, 'iframe')
            ? extractAttr(html, 'src') || extractAttr(html, 'data-src')
            : extractAttr(html, 'src') || extractAttr(html, 'data') || extractAttr(html, 'data-src')
          pushHtmlMediaItem('iframe', srcRaw, token.startLine)
          continue
        }
        if (looksLikeSingleTagBlock(html, 'video') || looksLikeSingleTagBlock(html, 'audio')) {
          const kind = looksLikeSingleTagBlock(html, 'video') ? 'video' : 'audio'
          pushHtmlMediaItem(kind, extractAttr(html, 'src') || extractAttr(html, 'data-src'), token.startLine)
          continue
        }
        if (looksLikeSingleTagBlock(html, 'img')) {
          const srcCandidate = extractAttr(html, 'src') || extractAttr(html, 'data-src') || pickFirstSrcsetUrl(extractAttr(html, 'srcset') || extractAttr(html, 'data-srcset'))
          if (!srcCandidate || !isSafeHref(srcCandidate) || !isSafeMediaSrc(srcCandidate)) continue
          const src = resolveHref(srcCandidate, docPath)
          const alt = extractAttr(html, 'alt')
          const item: CommandMenuRichMediaItem = {
            key: buildMarkdownPreviewMediaKey('image', token.startLine, srcCandidate),
            kind: 'image',
            source: 'markdown',
            startLine: token.startLine,
            label: alt || `Image ${list.length + 1}`,
            src,
            openUrl: src,
            alt,
          }
          item.thumbnailUrl = resolveRichMediaThumbnailUrl(item)
          list.push(item)
          continue
        }
        const scriptEmbedHref = extractScriptEmbedAnchorHref(html)
        if (!scriptEmbedHref || !isSafeHref(scriptEmbedHref) || !isSafeMediaSrc(scriptEmbedHref)) continue
        const src = resolveHref(scriptEmbedHref, docPath)
        list.push({
          key: buildMarkdownPreviewMediaKey('webpage', token.startLine, scriptEmbedHref),
          kind: 'webpage',
          source: 'markdown',
          startLine: token.startLine,
          label: `Webpage ${list.length + 1}`,
          src,
          openUrl: src,
        })
        continue
      }

      if (tokenGeneric.type !== 'paragraph') continue
      const standaloneLink = readStandaloneLinkParagraph(token)
      const standaloneTextUrl = standaloneLink ? null : isStandaloneTextUrlParagraph(token)
      const href = standaloneLink?.href || standaloneTextUrl
      if (href && isSafeHref(href) && isAbsoluteWebUrl(href)) {
        const youtube = buildYouTubeEmbedUrl(href, { noCookie: true, includeOrigin: false })
        const vimeo = buildVimeoEmbedUrl(href)
        const normalizedHref = normalizeWebpageLikeUrl(href)
        const tweet = youtube || vimeo ? '' : buildTwitterEmbedUrl(normalizedHref)
        const kind: CommandMenuRichMediaKind = youtube ? 'youtube' : vimeo ? 'vimeo' : isVideoUrl(href) ? 'video' : tweet ? 'tweet' : 'webpage'
        const theme = String(rootThemeMode || '').toLowerCase() === 'dark' ? 'dark' : 'light'
        const src = youtube || vimeo || (tweet ? `${tweet}&theme=${theme}` : resolveHref(kind === 'video' ? href : normalizedHref, docPath))
        const item: CommandMenuRichMediaItem = {
          key: buildMarkdownPreviewMediaKey(kind, token.startLine, href),
          kind,
          source: 'markdown',
          startLine: token.startLine,
          label: standaloneLink?.label || (kind === 'youtube' ? `YouTube ${list.length + 1}` : kind === 'vimeo' ? `Vimeo ${list.length + 1}` : kind === 'tweet' ? `X ${list.length + 1}` : kind === 'video' ? `Video ${list.length + 1}` : `Webpage ${list.length + 1}`),
          src,
          openUrl: href,
          renameOwner: {
            type: 'markdownLine',
            startLine: token.startLine,
            href,
            syntax: standaloneLink ? 'link' : 'standaloneUrl',
          },
        }
        item.thumbnailUrl = resolveRichMediaThumbnailUrl(item)
        list.push(item)
        continue
      }

      const paragraph = token as unknown as TokensParagraph
      const inner = Array.isArray(paragraph.tokens) ? paragraph.tokens : []
      for (let j = 0; j < inner.length; j += 1) {
        const inlineToken = inner[j] as unknown as TokensGeneric
        if (inlineToken.type !== 'image') continue
        const imageToken = inlineToken as unknown as TokensImage
        const hrefRaw = String(imageToken.href || '').trim()
        if (!hrefRaw || !isSafeHref(hrefRaw) || !isSafeMediaSrc(hrefRaw)) continue
        const alt = imageToken.text
        const altNorm = String(alt || '').trim().toLowerCase()
        const normalizedHref = normalizeWebpageLikeUrl(hrefRaw)
        const treatAsWebpage =
          /^https?:\/\//i.test(hrefRaw) &&
          !altNorm.startsWith('iframe') &&
          !altNorm.startsWith('video') &&
          !altNorm.startsWith('audio') &&
          !looksImageUrl(hrefRaw) &&
          !isVideoUrl(hrefRaw) &&
          !looksAudioUrl(hrefRaw)
        const kind: CommandMenuRichMediaKind = treatAsWebpage
          ? 'webpage'
          : altNorm.startsWith('audio') || looksAudioUrl(hrefRaw)
            ? 'audio'
            : 'image'
        const src = resolveHref(treatAsWebpage ? normalizedHref : hrefRaw, docPath)
        const item: CommandMenuRichMediaItem = {
          key: buildMarkdownPreviewMediaKey(kind, token.startLine, `${hrefRaw}#${j}`),
          kind,
          source: 'markdown',
          startLine: token.startLine,
          label: alt || (kind === 'audio' ? `Audio ${list.length + 1}` : treatAsWebpage ? `Webpage ${list.length + 1}` : `Image ${list.length + 1}`),
          src,
          openUrl: hrefRaw,
          alt,
          renameOwner: {
            type: 'markdownLine',
            startLine: token.startLine,
            href: hrefRaw,
            syntax: 'image',
          },
        }
        item.thumbnailUrl = resolveRichMediaThumbnailUrl(item)
        list.push(item)
      }
    }

    if (frontmatterMermaidCode) {
      for (let i = 0; i < frontmatterMermaidDiagrams.length; i += 1) {
        const code = frontmatterMermaidDiagrams[i]
        list.unshift({
          key: `frontmatter-mermaid:${i}`,
          kind: 'mermaid',
          source: 'markdown',
          startLine: 1,
          label: frontmatterMermaidDiagrams.length > 1 ? `Mermaid diagram from frontmatter (${i + 1}/${frontmatterMermaidDiagrams.length})` : 'Mermaid diagram from frontmatter',
          code,
          mermaidConfig: mermaidFrontmatterConfig,
        })
      }
    }

    if (graphData && Array.isArray(graphData.nodes) && graphData.nodes.length > 0) {
      const connectedValuesByNodeId = computeFlowConnectedValuesBySchemaPath({
        graphData,
        registry: widgetRegistry,
        graphRevision: graphDataRevision,
        graphSemanticKey,
      })
      const effectiveNodes = graphData.nodes.map(node => {
        const nodeId = String(node?.id || '').trim()
        return applyConnectedValuesToNodeForRender({
          node,
          connectedValuesBySchemaPath: nodeId ? connectedValuesByNodeId.get(nodeId) || undefined : undefined,
        })
      })
      const canonicalGraphMedia = listMediaOverlayNodes({
        enabled: true,
        nodes: effectiveNodes,
        poolMax: effectiveNodes.length,
        connectedValuesByNodeId,
        nodeById: graphLookup?.nodeById || undefined,
      })
      for (const media of canonicalGraphMedia) {
        const nodeId = String(media?.id || '').trim()
        if (!nodeId) continue
        const src = String(media.url || '').trim()
        const srcDoc = String(media.srcDoc || '').trim()
        if (!src && !srcDoc) continue
        const node = graphLookup?.nodeById.get(nodeId) || null
        const baseLabel = String(node?.label || nodeId).trim()
        const panelTitle = String(media.title || '').trim() || (baseLabel ? `Node media: ${baseLabel}` : 'Node media')
        const kind: CommandMenuRichMediaKind = media.kind === 'svg'
          ? 'image'
          : media.kind === 'video' || media.kind === 'audio' || media.kind === 'model' || media.kind === 'iframe'
            ? media.kind
            : 'image'
        const openUrl = String(media.openUrl || media.url || '').trim()
        const item: CommandMenuRichMediaItem = {
          key: `graph-node-media:${nodeId}:${kind}:${openUrl || src || 'srcdoc'}`,
          kind,
          source: 'graph',
          startLine: 0,
          label: `Node media: ${panelTitle}`,
          panelTitle,
          src,
          srcDoc: srcDoc || undefined,
          openUrl: openUrl || undefined,
          alt: baseLabel || undefined,
          nodeId,
          panel: media.panel,
          renameOwner: { type: 'graphNodeLabel', nodeId },
        }
        item.thumbnailUrl = resolveRichMediaThumbnailUrl(item)
        list.push(item)
      }
    }

    return dedupeCommandMenuRichMediaItems(list)
  }, [
    frontmatterMermaidCode,
    frontmatterMermaidDiagrams,
    graphData,
    graphDataRevision,
    graphLookup,
    graphSemanticKey,
    markdownDocumentName,
    mermaidFrontmatterConfig,
    rootThemeMode,
    tokens,
    widgetRegistry,
  ])

  return {
    items,
    mermaidFrontmatterConfig,
    frontmatterMermaidCode,
    frontmatterMermaidDiagrams,
  }
}
