import React from 'react'
import type {
  TokensParagraph,
  TokensGeneric,
  TokensLink,
  TokensCode,
  TokensHTML,
  TokensImage,
} from '@/features/markdown/ui/MarkdownTokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
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
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY } from '@/lib/config'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import RichMediaPanel from '@/components/RichMediaPanel'
import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { applyConnectedValuesToNodeForRender } from '@/lib/render/effectiveMediaNode'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []

const MermaidDiagramLazy = React.lazy(() =>
  import('@/features/panels/views/preview-panel/ui/MermaidDiagram').then(mod => ({ default: mod.MermaidDiagram })),
)

export default function PreviewPanelView() {
  const markdownText = useGraphStore(s => s.markdownDocumentText || '')
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName || '')
  const mermaidFocusCode = useGraphStore(s => s.markdownPreviewMermaidFocusCode || '')
  const mermaidFocusConfig = useGraphStore(s => s.markdownPreviewMermaidFocusConfig || null)
  const setMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const activeMediaKey = useGraphStore(s => s.markdownPreviewActiveMediaKey || null)
  const setActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)
  const selectNode = useGraphStore(s => s.selectNode)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const setWorkspaceViewMode = useGraphStore(s => s.setWorkspaceViewMode)
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const graphData = useActiveGraphRenderData()
  const graphDataRevision = useGraphStore(s => s.graphDataRevision || 0)
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled || false)
  const widgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const baseWidgetRegistry = useGraphStore(s => s.widgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const documentWidgetRegistry = useGraphStore(s => s.documentWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const rootThemeMode = useRootThemeMode()

  const hasMarkdown = !!(markdownText && markdownText.trim())
  const [overlayPortalTarget, setOverlayPortalTarget] = React.useState<HTMLDivElement | null>(null)
  const [loadedEmbedKey, setLoadedEmbedKey] = React.useState<string>('')
  const setOverlayPortalRef = React.useCallback((el: HTMLDivElement | null) => {
    setOverlayPortalTarget(prev => (prev === el ? prev : el))
  }, [])

  React.useEffect(() => {
    return () => {
      setMermaidFocus(null)
      setActiveMediaKey(null)
    }
  }, [setActiveMediaKey, setMermaidFocus])

  React.useEffect(() => {
    setLoadedEmbedKey(prev => (activeMediaKey ? (prev === activeMediaKey ? prev : '') : ''))
  }, [activeMediaKey])

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

  React.useEffect(() => {
    if (!frontmatterModeEnabled) return
    if (!frontmatterMermaidCode) return
    const current = String(mermaidFocusCode || '').trim()
    const next = String(frontmatterMermaidDiagrams[0] || '').trim()
    if (!next) return
    if (current === next) return
    setActiveMediaKey(null)
    setMermaidFocus({
      code: next,
      frontmatterConfig: mermaidFrontmatterConfig,
    })
  }, [
    frontmatterModeEnabled,
    frontmatterMermaidCode,
    frontmatterMermaidDiagrams,
    mermaidFocusCode,
    mermaidFrontmatterConfig,
    setActiveMediaKey,
    setMermaidFocus,
  ])

  const isStandaloneLinkParagraph = (token: TokenWithLines): string | null => {
    const p = token as unknown as TokensParagraph
    const inner = Array.isArray(p.tokens) ? p.tokens : []
    if (inner.length !== 1) return null
    const only = inner[0] as unknown as TokensGeneric
    if (only.type !== 'link') return null
    const link = only as unknown as TokensLink
    const href = String(link.href || '').trim()
    return href || null
  }

  const isStandaloneTextUrlParagraph = (token: TokenWithLines): string | null => {
    const p = token as unknown as TokensParagraph
    const inner = Array.isArray(p.tokens) ? p.tokens : []
    if (inner.length !== 1) return null
    const only = inner[0] as unknown as TokensGeneric
    if (only.type !== 'text') return null
    const rawText = String((only as unknown as { text?: unknown }).text || '').trim()
    if (!rawText) return null
    const cleaned = rawText.replace(/^<|>$/g, '').trim()
    if (!/^https?:\/\//i.test(cleaned)) return null
    return cleaned
  }

  type MediaKind = 'mermaid' | 'image' | 'video' | 'iframe' | 'youtube' | 'vimeo' | 'webpage' | 'tweet'

  type MediaSource = 'markdown' | 'graph'

  type MediaItem = {
    key: string
    kind: MediaKind
    source: MediaSource
    startLine: number
    label: string
    panelTitle?: string
    nodeId?: string
    code?: string
    mermaidConfig?: MermaidInitConfig | null
    src?: string
    openUrl?: string
    alt?: string
  }

  const mediaItems: MediaItem[] = React.useMemo(() => {
    const list: MediaItem[] = []
    const docPath = markdownDocumentName || ''
    const frontmatterMermaid = frontmatterMermaidCode
    const looksImageUrl = (href: string) =>
      /^data:image\//i.test(href) || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(href)
    const looksAudioUrl = (href: string) =>
      /\.(mp3|wav|m4a|aac|flac|ogg)(\?|#|$)/i.test(href)

    if (frontmatterMermaid) {
      const diagrams = frontmatterMermaidDiagrams
      for (let i = 0; i < diagrams.length; i += 1) {
        const code = diagrams[i]
        const key = `frontmatter-mermaid:${i}`
        list.push({
          key,
          kind: 'mermaid',
          source: 'markdown',
          startLine: 1,
          label: diagrams.length > 1 ? `Mermaid diagram from frontmatter (${i + 1}/${diagrams.length})` : 'Mermaid diagram from frontmatter',
          code,
          mermaidConfig: mermaidFrontmatterConfig,
        })
      }
    }

    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i]
      const tt = t as unknown as TokensGeneric

      if (tt.type === 'code') {
        const c = t as unknown as TokensCode
        const lang = String((c as unknown as { lang?: unknown }).lang || '').trim().toLowerCase()
        if (lang === 'mermaid' || lang === 'mmd') {
          const raw = String(c.text || '')
          const diagrams = splitMermaidIntoDiagrams(raw)
          for (let j = 0; j < diagrams.length; j += 1) {
            const code = diagrams[j]
            const key = buildMarkdownPreviewMediaKey('mermaid', t.startLine, `${j}:${code}`)
            list.push({
              key,
              kind: 'mermaid',
              source: 'markdown',
              startLine: t.startLine,
              label: `Mermaid diagram ${list.length + 1}`,
              code,
              mermaidConfig: mermaidFrontmatterConfig,
            })
          }
        }
        continue
      }

      if (tt.type === 'html') {
        const html = String((t as unknown as TokensHTML).text || '').trim()

        if (looksLikeSingleTagBlock(html, 'iframe')) {
          const srcRaw = extractAttr(html, 'src') || extractAttr(html, 'data-src')
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, docPath)
            const key = buildMarkdownPreviewMediaKey('iframe', t.startLine, srcRaw)
            list.push({
              key,
              kind: 'iframe',
              source: 'markdown',
              startLine: t.startLine,
              label: `Embedded content ${list.length + 1}`,
              src,
              openUrl: src,
            })
          }
          continue
        }

        if (looksLikeSingleTagBlock(html, 'embed') || looksLikeSingleTagBlock(html, 'object')) {
          const srcRaw =
            extractAttr(html, 'src') || extractAttr(html, 'data') || extractAttr(html, 'data-src')
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, docPath)
            const key = buildMarkdownPreviewMediaKey('iframe', t.startLine, srcRaw)
            list.push({
              key,
              kind: 'iframe',
              source: 'markdown',
              startLine: t.startLine,
              label: `Embedded content ${list.length + 1}`,
              src,
              openUrl: src,
            })
          }
          continue
        }

        if (looksLikeSingleTagBlock(html, 'video')) {
          const srcRaw = extractAttr(html, 'src') || extractAttr(html, 'data-src')
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, docPath)
            const key = buildMarkdownPreviewMediaKey('video', t.startLine, srcRaw)
            list.push({
              key,
              kind: 'video',
              source: 'markdown',
              startLine: t.startLine,
              label: `Video ${list.length + 1}`,
              src,
              openUrl: src,
            })
          }
          continue
        }

        if (looksLikeSingleTagBlock(html, 'img')) {
          const srcRaw = extractAttr(html, 'src') || extractAttr(html, 'data-src')
          const srcsetRaw = extractAttr(html, 'srcset') || extractAttr(html, 'data-srcset')
          const srcCandidate = srcRaw || pickFirstSrcsetUrl(srcsetRaw)
          if (srcCandidate && isSafeHref(srcCandidate) && isSafeMediaSrc(srcCandidate)) {
            const src = resolveHref(srcCandidate, docPath)
            const alt = extractAttr(html, 'alt')
            const key = buildMarkdownPreviewMediaKey('image', t.startLine, srcCandidate)
            list.push({
              key,
              kind: 'image',
              source: 'markdown',
              startLine: t.startLine,
              label: alt || `Image ${list.length + 1}`,
              src,
              openUrl: src,
              alt,
            })
          }
          continue
        }

        const scriptEmbedHref = extractScriptEmbedAnchorHref(html)
        if (scriptEmbedHref && isSafeHref(scriptEmbedHref) && isSafeMediaSrc(scriptEmbedHref)) {
          const src = resolveHref(scriptEmbedHref, docPath)
          const key = buildMarkdownPreviewMediaKey('webpage', t.startLine, scriptEmbedHref)
          list.push({
            key,
            kind: 'webpage',
            source: 'markdown',
            startLine: t.startLine,
            label: `Webpage ${list.length + 1}`,
            src,
            openUrl: src,
          })
          continue
        }

        continue
      }

      if (tt.type === 'paragraph') {
        const href = isStandaloneLinkParagraph(t) || isStandaloneTextUrlParagraph(t)
        if (href && isSafeHref(href) && isAbsoluteWebUrl(href)) {
          const youtube = buildYouTubeEmbedUrl(href, { noCookie: true, includeOrigin: false })
          if (youtube) {
            const src = youtube
            const key = buildMarkdownPreviewMediaKey('youtube', t.startLine, href)
            list.push({
              key,
              kind: 'youtube',
              source: 'markdown',
              startLine: t.startLine,
              label: `YouTube ${list.length + 1}`,
              src,
              openUrl: href,
            })
            continue
          }
          const vimeo = buildVimeoEmbedUrl(href)
          if (vimeo) {
            const src = vimeo
            const key = buildMarkdownPreviewMediaKey('vimeo', t.startLine, href)
            list.push({
              key,
              kind: 'vimeo',
              source: 'markdown',
              startLine: t.startLine,
              label: `Vimeo ${list.length + 1}`,
              src,
              openUrl: href,
            })
            continue
          }
          if (isVideoUrl(href)) {
            const src = resolveHref(href, docPath)
            const key = buildMarkdownPreviewMediaKey('video', t.startLine, href)
            list.push({
              key,
              kind: 'video',
              source: 'markdown',
              startLine: t.startLine,
              label: `Video ${list.length + 1}`,
              src,
              openUrl: href,
            })
            continue
          }

          const normalizedHref = normalizeWebpageLikeUrl(href)
          const tweet = buildTwitterEmbedUrl(normalizedHref)
          if (tweet) {
            const theme = String(rootThemeMode || '').toLowerCase() === 'dark' ? 'dark' : 'light'
            const src = `${tweet}&theme=${theme}`
            const key = buildMarkdownPreviewMediaKey('tweet', t.startLine, href)
            list.push({
              key,
              kind: 'tweet',
              source: 'markdown',
              startLine: t.startLine,
              label: `X ${list.length + 1}`,
              src,
              openUrl: href,
            })
            continue
          }

          const src = resolveHref(normalizedHref, docPath)
          const key = buildMarkdownPreviewMediaKey('webpage', t.startLine, href)
          list.push({
            key,
            kind: 'webpage',
            source: 'markdown',
            startLine: t.startLine,
            label: `Webpage ${list.length + 1}`,
            src,
            openUrl: href,
          })
          continue
        }

        const p = t as unknown as TokensParagraph
        const inner = Array.isArray(p.tokens) ? p.tokens : []
        for (let j = 0; j < inner.length; j += 1) {
          const it = inner[j] as unknown as TokensGeneric
          if (it.type !== 'image') continue
          const img = it as unknown as TokensImage
          const hrefRaw = String(img.href || '').trim()
          if (!hrefRaw) continue
          if (!isSafeHref(hrefRaw) || !isSafeMediaSrc(hrefRaw)) continue
          const alt = img.text
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
          const src = resolveHref(treatAsWebpage ? normalizedHref : hrefRaw, docPath)
          const idHint = `${hrefRaw}#${j}`
          const kind: MediaKind = treatAsWebpage ? 'webpage' : 'image'
          const key = buildMarkdownPreviewMediaKey(kind, t.startLine, idHint)
          list.push({
            key,
            kind,
            source: 'markdown',
            startLine: t.startLine,
            label: alt || (treatAsWebpage ? `Webpage ${list.length + 1}` : `Image ${list.length + 1}`),
            src,
            openUrl: hrefRaw,
            alt,
          })
        }
      }
    }

    if (graphData && Array.isArray(graphData.nodes) && graphData.nodes.length > 0) {
      const dataflowRegistry =
        buildDataflowWidgetRegistry({
          documentWidgetRegistry,
          effectiveWidgetRegistry: widgetRegistry,
          widgetRegistry: baseWidgetRegistry,
        })
      const connectedValuesByNodeId = computeFlowConnectedValuesBySchemaPath({
        graphData,
        registry: dataflowRegistry,
        graphRevision: graphDataRevision,
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
      })
      const effectiveNodeById = new Map(
        effectiveNodes.map(node => [String(node?.id || '').trim(), node] as const).filter(([nodeId]) => !!nodeId),
      )

      for (let i = 0; i < canonicalGraphMedia.length; i += 1) {
        const item = canonicalGraphMedia[i]
        if (!item) continue
        const nodeId = String(item.id || '').trim()
        if (!nodeId) continue
        const src = String(item.url || '').trim()
        if (!src && !String(item.srcDoc || '').trim()) continue
        const node = effectiveNodeById.get(nodeId) || null
        const baseLabel = String(node?.label || nodeId).trim()
        const label = String(item.title || '').trim() || (baseLabel ? `Node media: ${baseLabel}` : 'Node media')
        const kind: MediaKind =
          item.kind === 'svg' ? 'image' : item.kind === 'video' ? 'video' : item.kind === 'iframe' ? 'iframe' : 'image'
        const openUrl = String(item.openUrl || item.url || '').trim()
        const key = `graph-node-media:${nodeId}:${kind}:${openUrl || src || 'srcdoc'}`
        list.push({
          key,
          kind,
          source: 'graph',
          startLine: 0,
          label: `Node media: ${label}`,
          panelTitle: label,
          src,
          openUrl: openUrl || undefined,
          alt: baseLabel || undefined,
          nodeId,
        })
      }
    }

    return list
  }, [
    baseWidgetRegistry,
    documentWidgetRegistry,
    frontmatterMermaidCode,
    frontmatterMermaidDiagrams,
    graphData,
    graphDataRevision,
    markdownDocumentName,
    mermaidFrontmatterConfig,
    rootThemeMode,
    tokens,
    widgetRegistry,
  ])

  const hasMermaidFocus = !!mermaidFocusCode

  const activeMediaFromKey = React.useMemo(
    () => (activeMediaKey ? mediaItems.find(m => m.key === activeMediaKey) || null : null),
    [activeMediaKey, mediaItems],
  )

  const activeMedia = hasMermaidFocus || frontmatterModeEnabled ? null : activeMediaFromKey || mediaItems[0] || null

  const handleSelectMedia = (item: MediaItem) => {
    if (item.kind === 'mermaid') {
      setActiveMediaKey(null)
      setMermaidFocus({
        code: item.code || '',
        frontmatterConfig: item.mermaidConfig || mermaidFrontmatterConfig,
      })
    } else {
      setMermaidFocus(null)
      setActiveMediaKey(item.key)
    }
    if (item.source === 'graph' && item.nodeId) {
      try {
        setSelectionSource('toolbar')
        selectNode(item.nodeId)
        setWorkspaceViewMode('editor')
      } catch {
        void 0
      }
    }
  }

  const renderMiniPreview = (item: MediaItem) => {
    if (item.kind === 'image' && item.src) {
      return (
        <div className="flex-1 w-full flex items-center justify-center overflow-hidden rounded bg-black/5">
          <img
            src={item.src}
            alt={item.alt || item.label}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )
    }

    if (item.kind === 'mermaid') {
      const code = String(item.code || '').trim()
      if (!code) {
        return (
          <div className="flex-1 w-full flex items-center justify-center rounded bg-slate-900 text-[10px] text-slate-50 px-2">
            Mermaid
          </div>
        )
      }
      const lines = code
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
      const first = lines[0] || ''
      const text = first.length > 60 ? `${first.slice(0, 57)}…` : first
      return (
        <div className="flex-1 w-full flex items-center justify-center rounded bg-slate-900 text-[10px] text-slate-50 px-2 text-center">
          <span className="font-mono truncate w-full">{text || 'Mermaid'}</span>
        </div>
      )
    }

    return (
      <div className="flex-1 w-full flex items-center justify-center rounded bg-gray-100 text-[10px] text-gray-600 px-2 text-center">
        <span className="truncate w-full">{item.label}</span>
      </div>
    )
  }

  const renderActiveMedia = () => {
    if (!activeMedia) {
      return (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
          Select a Mermaid diagram or rich media item.
        </div>
      )
    }

    if (!activeMedia.src && activeMedia.kind !== 'mermaid') {
      return (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
          Selected media has no preview source.
        </div>
      )
    }

    const isRichMediaPanelKind =
      activeMedia.kind === 'image'
      || activeMedia.kind === 'video'
      || activeMedia.kind === 'iframe'
      || activeMedia.kind === 'youtube'
      || activeMedia.kind === 'vimeo'
      || activeMedia.kind === 'webpage'
      || activeMedia.kind === 'tweet'

    if (isRichMediaPanelKind) {
      const richMediaKind = activeMedia.kind === 'image'
        ? 'image'
        : activeMedia.kind === 'video'
          ? 'video'
          : 'iframe'
      const richMediaTitle = activeMedia.panelTitle || activeMedia.alt || activeMedia.label
      const richMediaOpenUrl = activeMedia.openUrl || activeMedia.src
      const richMediaNeedsExplicitLoad = richMediaKind === 'iframe'
      const richMediaLoaded = !richMediaNeedsExplicitLoad || loadedEmbedKey === activeMedia.key
      const frameClass = richMediaKind === 'iframe'
        ? `aspect-video w-full max-w-4xl bg-black/5 rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden`
        : `aspect-video w-full max-w-4xl rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden`
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className={frameClass}>
            {richMediaLoaded ? (
              <RichMediaPanel
                title={richMediaTitle}
                url={activeMedia.src}
                openUrl={richMediaOpenUrl}
                kind={richMediaKind}
                interactive={richMediaKind !== 'image'}
                iframeMode="srcdoc-when-needed"
                showHeader={true}
                style={{ width: '100%', height: '100%', boxShadow: 'none' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`text-xs px-3 py-2 rounded border ${UI_THEME_TOKENS.panel.border} bg-white hover:bg-black/5`}
                    onClick={() => setLoadedEmbedKey(activeMedia.key)}
                  >
                    {UI_COPY.markdownMediaLoadEmbedLabel}
                  </button>
                  <a className="text-xs underline" href={richMediaOpenUrl} target="_blank" rel="noreferrer">
                    {UI_COPY.markdownMediaOpenInNewTabLabel}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <MainPanelBody header={<header />} scrollable={false}>
      <section ref={setOverlayPortalRef} className="h-full min-h-0 flex flex-col overflow-hidden relative">
        {!hasMarkdown && mediaItems.length === 0 ? (
          <div className={['px-2 py-2 text-sm text-gray-600', uiPanelTextFontClass].join(' ')}>
            No markdown loaded.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <header className="shrink-0 border-b border-gray-200 bg-white/60">
              <div className="px-3 py-2 flex items-center justify-between">
                <div className={['text-xs font-medium text-gray-700', uiPanelTextFontClass].join(' ')}>
                  Preview: Mermaid diagrams and rich media
                </div>
                <div className="text-[11px] text-gray-500">
                  {mediaItems.length ? `${mediaItems.length} item${mediaItems.length === 1 ? '' : 's'}` : 'No media items'}
                </div>
              </div>
              {mediaItems.length > 0 ? (
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {mediaItems.map(item => {
                      const isActiveMermaid =
                        hasMermaidFocus &&
                        item.kind === 'mermaid' &&
                        item.code &&
                        item.code === mermaidFocusCode
                      const isActiveGallery =
                        !hasMermaidFocus && activeMedia && activeMedia.key === item.key
                      const isActive = isActiveMermaid || isActiveGallery
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleSelectMedia(item)}
                          className={[
                            'relative flex flex-col items-stretch justify-between rounded border text-left text-[11px] px-2 py-2 transition-colors',
                            'aspect-video',
                            isActive
                              ? UI_THEME_TOKENS.table.rowSelected
                              : `${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.table.rowHover}`,
                          ].join(' ')}
                        >
                          <div className="absolute left-1 top-1 rounded bg-black/60 text-white px-1 py-0.5 text-[10px]">
                            {item.kind}
                          </div>
                          <div className={`absolute right-1 top-1 rounded bg-white/80 dark:bg-black/80 text-gray-800 dark:text-gray-200 px-1 py-0.5 text-[9px] border ${UI_THEME_TOKENS.panel.border}`}>
                            {item.source === 'markdown' ? 'Markdown' : 'Graph'}
                          </div>
                          <div className="flex-1 w-full mb-1">
                            {renderMiniPreview(item)}
                          </div>
                          <div className={`mt-1 mx-1 line-clamp-2 ${UI_THEME_TOKENS.text.primary}`}>
                            {item.label}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </header>
            <div className={`flex-1 min-h-0 ${UI_THEME_TOKENS.panel.bg}`}>
              {hasMermaidFocus ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="aspect-video w-full max-w-4xl">
                    <div className="w-full h-full overflow-auto">
                      {splitMermaidIntoDiagrams(mermaidFocusCode).map((code, i) => (
                        <React.Suspense key={i} fallback={null}>
                          <MermaidDiagramLazy
                            code={code}
                            highlightClass=""
                            frontmatterConfig={
                              (mermaidFocusConfig as MermaidInitConfig | null) || mermaidFrontmatterConfig
                            }
                            rootThemeMode={rootThemeMode}
                            overlayScope="container"
                            overlayPortalTarget={overlayPortalTarget}
                          />
                        </React.Suspense>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                renderActiveMedia()
              )}
            </div>
          </div>
        )}
      </section>
    </MainPanelBody>
  )
}
