import React from 'react'
import type { Tokens } from 'marked'
import { useGraphStore } from '@/hooks/useGraphStore'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import {
  lexMarkdown,
  type TokenWithLines,
} from '@/features/markdown/ui/markdownPreviewLex'
import {
  buildMarkdownPreviewMediaKey,
  extractAttr,
  getVimeoId,
  getYouTubeId,
  isAbsoluteWebUrl,
  isSafeHref,
  isSafeMediaSrc,
  isVideoUrl,
  looksLikeSingleTagBlock,
  resolveHref,
} from '@/features/markdown/ui/markdownPreviewLinks'
import {
  MermaidDiagram,
} from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import {
  type MermaidInitConfig,
  parseMermaidConfigFromFrontmatter,
  useRootThemeMode,
} from '@/features/panels/views/preview-panel/ui/mermaidConfig'

export default function PreviewPanelView() {
  const markdownText = useGraphStore(s => s.markdownDocumentText || '')
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName || '')
  const mermaidFocusCode = useGraphStore(s => s.markdownPreviewMermaidFocusCode || '')
  const mermaidFocusConfig = useGraphStore(s => s.markdownPreviewMermaidFocusConfig || null)
  const setMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const activeMediaKey = useGraphStore(s => s.markdownPreviewActiveMediaKey || null)
  const setActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const rootThemeMode = useRootThemeMode()

  const hasMarkdown = !!(markdownText && markdownText.trim())
  const [overlayPortalTarget, setOverlayPortalTarget] = React.useState<HTMLDivElement | null>(null)
  const setOverlayPortalRef = React.useCallback((el: HTMLDivElement | null) => {
    setOverlayPortalTarget(prev => (prev === el ? prev : el))
  }, [])

  React.useEffect(() => {
    return () => {
      setMermaidFocus(null)
      setActiveMediaKey(null)
    }
  }, [setActiveMediaKey, setMermaidFocus])

  const { tokens, meta } = React.useMemo(() => lexMarkdown(markdownText || ''), [markdownText])
  const mermaidFrontmatterConfig = React.useMemo(
    () => parseMermaidConfigFromFrontmatter(meta),
    [meta],
  )

  const isStandaloneLinkParagraph = (token: TokenWithLines): string | null => {
    const p = token as unknown as Tokens.Paragraph
    const inner = Array.isArray(p.tokens) ? p.tokens : []
    if (inner.length !== 1) return null
    const only = inner[0] as unknown as Tokens.Generic
    if (only.type !== 'link') return null
    const link = only as unknown as Tokens.Link
    const href = String(link.href || '').trim()
    return href || null
  }

  type MediaKind = 'mermaid' | 'image' | 'video' | 'iframe' | 'youtube' | 'vimeo'

  type MediaItem = {
    key: string
    kind: MediaKind
    startLine: number
    label: string
    code?: string
    mermaidConfig?: MermaidInitConfig | null
    src?: string
    alt?: string
  }

  const mediaItems: MediaItem[] = React.useMemo(() => {
    if (!hasMarkdown) return []
    const list: MediaItem[] = []
    const docPath = markdownDocumentName || ''
    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i]
      const tt = t as unknown as Tokens.Generic

      if (tt.type === 'code') {
        const c = t as unknown as Tokens.Code
        const lang = String((c as unknown as { lang?: unknown }).lang || '').trim().toLowerCase()
        if (lang === 'mermaid' || lang === 'mmd') {
          const code = String(c.text || '')
          const key = buildMarkdownPreviewMediaKey('mermaid', t.startLine, code)
          list.push({
            key,
            kind: 'mermaid',
            startLine: t.startLine,
            label: `Mermaid diagram ${list.length + 1}`,
            code,
            mermaidConfig: mermaidFrontmatterConfig,
          })
        }
        continue
      }

      if (tt.type === 'html') {
        const html = String((t as unknown as Tokens.HTML).text || '').trim()

        if (looksLikeSingleTagBlock(html, 'iframe')) {
          const srcRaw = extractAttr(html, 'src')
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, docPath)
            const key = buildMarkdownPreviewMediaKey('iframe', t.startLine, srcRaw)
            list.push({
              key,
              kind: 'iframe',
              startLine: t.startLine,
              label: `Embedded content ${list.length + 1}`,
              src,
            })
            continue
          }
        }

        if (looksLikeSingleTagBlock(html, 'video')) {
          const srcRaw = extractAttr(html, 'src')
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, docPath)
            const key = buildMarkdownPreviewMediaKey('video', t.startLine, srcRaw)
            list.push({
              key,
              kind: 'video',
              startLine: t.startLine,
              label: `Video ${list.length + 1}`,
              src,
            })
            continue
          }
        }

        if (looksLikeSingleTagBlock(html, 'img')) {
          const srcRaw = extractAttr(html, 'src')
          if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
            const src = resolveHref(srcRaw, docPath)
            const alt = extractAttr(html, 'alt')
            const key = buildMarkdownPreviewMediaKey('image', t.startLine, srcRaw)
            list.push({
              key,
              kind: 'image',
              startLine: t.startLine,
              label: alt || `Image ${list.length + 1}`,
              src,
              alt,
            })
            continue
          }
        }

        continue
      }

      if (tt.type === 'paragraph') {
        const href = isStandaloneLinkParagraph(t)
        if (href && isSafeHref(href) && isAbsoluteWebUrl(href)) {
          const yt = getYouTubeId(href)
          if (yt) {
            const src = `https://www.youtube-nocookie.com/embed/${yt}`
            const key = buildMarkdownPreviewMediaKey('youtube', t.startLine, href)
            list.push({
              key,
              kind: 'youtube',
              startLine: t.startLine,
              label: `YouTube ${list.length + 1}`,
              src,
            })
            continue
          }
          const vimeo = getVimeoId(href)
          if (vimeo) {
            const src = `https://player.vimeo.com/video/${vimeo}`
            const key = buildMarkdownPreviewMediaKey('vimeo', t.startLine, href)
            list.push({
              key,
              kind: 'vimeo',
              startLine: t.startLine,
              label: `Vimeo ${list.length + 1}`,
              src,
            })
            continue
          }
          if (isVideoUrl(href)) {
            const src = resolveHref(href, docPath)
            const key = buildMarkdownPreviewMediaKey('video', t.startLine, href)
            list.push({
              key,
              kind: 'video',
              startLine: t.startLine,
              label: `Video ${list.length + 1}`,
              src,
            })
            continue
          }
        }
      }
    }
    return list
  }, [hasMarkdown, markdownDocumentName, mermaidFrontmatterConfig, tokens])

  const hasMermaidFocus = !!mermaidFocusCode

  const activeMediaFromKey = React.useMemo(
    () => (activeMediaKey ? mediaItems.find(m => m.key === activeMediaKey) || null : null),
    [activeMediaKey, mediaItems],
  )

  const activeMedia = hasMermaidFocus ? null : activeMediaFromKey || mediaItems[0] || null

  const handleSelectMedia = (item: MediaItem) => {
    if (item.kind === 'mermaid') {
      setActiveMediaKey(null)
      setMermaidFocus({
        code: item.code || '',
        frontmatterConfig: item.mermaidConfig || mermaidFrontmatterConfig,
      })
      return
    }
    setMermaidFocus(null)
    setActiveMediaKey(item.key)
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

    if (activeMedia.kind === 'image') {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="aspect-video w-full max-w-4xl bg-black/5 rounded border border-gray-200 overflow-hidden flex items-center justify-center">
            <img
              src={activeMedia.src}
              alt={activeMedia.alt || activeMedia.label}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )
    }

    if (activeMedia.kind === 'video') {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="aspect-video w-full max-w-4xl bg-black rounded border border-gray-800 overflow-hidden">
            <video controls className="w-full h-full">
              <source src={activeMedia.src} />
            </video>
          </div>
        </div>
      )
    }

    if (
      activeMedia.kind === 'iframe' ||
      activeMedia.kind === 'youtube' ||
      activeMedia.kind === 'vimeo'
    ) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="aspect-video w-full max-w-4xl bg-black/5 rounded border border-gray-200 overflow-hidden">
            <iframe
              src={activeMedia.src}
              title={activeMedia.label}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              className="w-full h-full"
            />
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <MainPanelBody header={<div />} scrollable={false}>
      <div ref={setOverlayPortalRef} className="h-full min-h-0 flex flex-col overflow-hidden relative">
        {!hasMarkdown ? (
          <div className={['px-2 py-2 text-sm text-gray-600', uiPanelTextFontClass].join(' ')}>
            No markdown loaded.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="shrink-0 border-b border-gray-200 bg-white/60">
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
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-gray-200 bg-white hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <div className="absolute left-1 top-1 rounded bg-black/60 text-white px-1 py-0.5 text-[10px]">
                            {item.kind}
                          </div>
                          <div className="flex-1 w-full mb-1">
                            {renderMiniPreview(item)}
                          </div>
                          <div className="mt-1 mx-1 line-clamp-2 text-gray-800">
                            {item.label}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex-1 min-h-0 bg-gray-50/80">
              {hasMermaidFocus ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="aspect-video w-full max-w-4xl">
                    <div className="w-full h-full overflow-auto">
                      <MermaidDiagram
                        code={mermaidFocusCode}
                        highlightClass=""
                        frontmatterConfig={
                          (mermaidFocusConfig as MermaidInitConfig | null) || mermaidFrontmatterConfig
                        }
                        rootThemeMode={rootThemeMode}
                        overlayScope="container"
                        overlayPortalTarget={overlayPortalTarget}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                renderActiveMedia()
              )}
            </div>
          </div>
        )}
      </div>
    </MainPanelBody>
  )
}
