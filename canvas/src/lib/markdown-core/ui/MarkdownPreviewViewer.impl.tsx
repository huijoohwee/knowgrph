import React from 'react'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import type { HighlightedLineRange, MarkdownGeoDatasetIntegration, RenderOpts } from '@/features/markdown/ui/MarkdownRendererTypes'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { MarkdownPanelLayout } from '@/features/markdown/ui/MarkdownPanelLayout'
import {
  computeStickyHeadingScrollPaddingTopPx,
  filterVisibleMarkdownTokensByCollapsedHeadings,
  getDefaultStickyHeadingTopPx,
  getMarkdownViewerWidthWrapperClassName,
} from '@/features/markdown/ui/markdownSectionUtils'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY } from '@/lib/config'
import {
  normalizeLooseKey,
  parseMarkdownWikiHref,
} from 'grph-shared/markdown/wikiLinks'
import type { MarkdownSourceFilesPanelIntegration } from '@/features/markdown/ui/markdownSourceFilesPanelTypes'
import { useMarkdownExplorerControls } from '@/features/markdown/ui/useMarkdownExplorerControls'
import { encodeUtf8ToBase64 } from '@/features/markdown/markdownRoundTrip'
import { subscribeHashChange } from '@/lib/browser/hashChangeEvents'
import {
  buildMarkdownVariableSsotAnchorId,
  collectMarkdownVariableSsotEntries,
} from '@/features/markdown/ui/markdownVariableReferences'
import { resetGlobalUserSelectLock } from '@/lib/canvas/interaction-user-select'
import { useMarkdownTocTreeState } from '@/features/markdown/ui/useMarkdownTocTreeState'
import {
  buildMarkdownFrontmatterPreviewRenderOpts,
} from '@/features/markdown/ui/markdownFrontmatterPreview'
import { MarkdownFrontmatterPreviewBlocks } from '@/features/markdown/ui/MarkdownFrontmatterPreviewBlocks'

export type MarkdownPreviewViewerProps = {
  rootRef: (el: HTMLDivElement | null) => void
  tokens: TokenWithLines[]
  activeDocumentPath: string
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  markdownTextHighlight: boolean
  selectionKind: 'node' | 'edge' | null
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  sidebarPosition?: 'left' | 'right'
  stickyHeadingTopClass?: string
  stickyHeadingTopPx?: number
  mermaidFrontmatterConfig: Record<string, unknown> | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget: HTMLElement | null
  effectiveHighlightBackgroundColor: string | null
  effectiveHighlightUnderlineColor: string | null
  scrollClass: string
  frontmatterMermaidCode?: string
  frontmatterRawText?: string
  frontmatterMeta?: Record<string, unknown> | null
  codeAnnotations?: Record<string, string> | null
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void
  onMouseUp?: (event: React.MouseEvent<HTMLDivElement>) => void
  selectionToolbar?: React.ReactNode
  showSidebar?: boolean
  onToggleSidebar?: (show: boolean) => void
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  onTocSelect?: (id: string) => void
  onTocDoubleClick?: (id: string) => void
  onTocReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
  onInsertLineAfter?: (afterLine: number) => void
  onReorderLineBlock?: (
    source: { startLine: number; endLine: number },
    target: { startLine: number; endLine: number },
    position: 'before' | 'after',
  ) => void
  onReplaceLineRange?: (args: { startLine: number; endLine: number; replacementLines: string[] }) => void
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void
  annotateDisplayMode?: 'inline' | 'beside' | 'render'
  flashLine?: number | null
  contentClassName?: string
  markdownViewerWidthMode?: 'standard' | 'wide'
  sourceFiles?: Array<{ id: string; name: string; text?: string | null; active?: boolean }>
  onSourceFileSelect?: (id: string) => void
  onShowInEditor?: (line: number) => void
  sourceFilesPanelIntegration?: MarkdownSourceFilesPanelIntegration
  webpageLayoutWireframeAscii?: string | null
  sourceMarkdownText?: string
  markdownForcePlainTables?: boolean
  forbidCopy?: boolean
  onInlineEditStateChange?: (active: boolean) => void
}

export function MarkdownPreviewViewer(props: MarkdownPreviewViewerProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-[10px]')
  const {
    rootRef,
    tokens,
    activeDocumentPath,
    highlightedLineRange,
    markdownWordWrap,
    markdownTextHighlight,
    selectionKind,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    sidebarPosition,
    stickyHeadingTopClass,
    stickyHeadingTopPx,
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    effectiveHighlightBackgroundColor,
    effectiveHighlightUnderlineColor,
    scrollClass,
    onScroll,
    onContextMenu,
    onClick,
    onMouseUp,
    selectionToolbar,
    showSidebar,
    onToggleSidebar,
    collapsedIds,
    onToggleCollapse,
    onExpandAll,
    onCollapseAll,
    onTocSelect,
    onTocDoubleClick,
    onTocReorder,
    onInsertLineAfter,
    onReorderLineBlock,
    onReplaceLineRange,
    frontmatterMermaidCode,
    frontmatterRawText,
    frontmatterMeta: frontmatterMetaProp,
    onDoubleClick,
    codeAnnotations,
    geoDatasetIntegration,
    annotateDisplayMode,
    flashLine,
    contentClassName,
    markdownViewerWidthMode,
    sourceFiles,
    onSourceFileSelect,
    onShowInEditor,
    sourceFilesPanelIntegration,
    webpageLayoutWireframeAscii,
    sourceMarkdownText,
    markdownForcePlainTables,
    forbidCopy = false,
    onInlineEditStateChange,
  } = props
  const blockCopy = React.useCallback((event: React.ClipboardEvent<HTMLElement>) => {
    if (!forbidCopy) return
    event.preventDefault()
  }, [forbidCopy])
  const blockCopyKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!forbidCopy) return
    const key = String(event.key || '').toLowerCase()
    const mod = event.metaKey || event.ctrlKey
    if (!mod) return
    if (key !== 'c' && key !== 'x') return
    event.preventDefault()
  }, [forbidCopy])

  const resetUserSelectLockIfNeeded = React.useCallback(() => {
    try {
      resetGlobalUserSelectLock()
    } catch {
      void 0
    }
  }, [])

  const embeddedMarkdownBase64 = React.useMemo(() => {
    const src = typeof sourceMarkdownText === 'string' ? sourceMarkdownText : ''
    if (!src) return ''
    try {
      return encodeUtf8ToBase64(src)
    } catch {
      return ''
    }
  }, [sourceMarkdownText])
  const markdownSourceLines = React.useMemo(() => {
    if (typeof sourceMarkdownText !== 'string' || !sourceMarkdownText) return []
    return sourceMarkdownText.split(/\r?\n/)
  }, [sourceMarkdownText])
  const variableSsotEntries = React.useMemo(() => {
    if (typeof sourceMarkdownText !== 'string' || !sourceMarkdownText) return []
    return collectMarkdownVariableSsotEntries(sourceMarkdownText)
  }, [sourceMarkdownText])
  const frontmatterMeta = React.useMemo(() => {
    if (!frontmatterMetaProp || typeof frontmatterMetaProp !== 'object' || Array.isArray(frontmatterMetaProp)) {
      return {} as Record<string, unknown>
    }
    return frontmatterMetaProp
  }, [frontmatterMetaProp])
  const variableSsotByKey = React.useMemo(() => {
    const out = new Map<string, { line: number; source: 'frontmatter' | 'inline'; key: string }>()
    for (let i = 0; i < variableSsotEntries.length; i += 1) {
      const entry = variableSsotEntries[i]
      if (!entry) continue
      out.set(entry.key.toLowerCase(), { line: entry.line, source: entry.source, key: entry.key })
    }
    return out
  }, [variableSsotEntries])

  const isRenderMode = annotateDisplayMode === 'render'
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled || false)

  const scrollRootRef = React.useRef<HTMLDivElement | null>(null)
  const articleRef = React.useRef<HTMLElement | null>(null)
  const handleScrollRootRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      scrollRootRef.current = el
      if (el) {
        try {
          el.style.setProperty('--kg-viewer-article-width', '80%')
          el.style.setProperty('--kg-scrollbar-width', '0px')
        } catch {
          void 0
        }
      }
      rootRef(el)
    },
    [rootRef],
  )

  const handleArticleRef = React.useCallback((el: HTMLElement | null) => {
    articleRef.current = el
    if (!el) return
    if (contentClassName) return
  }, [contentClassName])

  React.useEffect(() => {
    const root = scrollRootRef.current
    if (!root) return
    let raf = 0
    const update = () => {
      try {
        const w = root.offsetWidth - root.clientWidth
        const safe = Number.isFinite(w) ? Math.max(0, Math.floor(w)) : 0
        root.style.setProperty('--kg-scrollbar-width', `${safe}px`)
        const rect = root.getBoundingClientRect()
        const widthPx = Number.isFinite(rect.width) ? Math.max(0, Math.floor(rect.width * 0.8)) : 0
        root.style.setProperty('--kg-viewer-article-width', widthPx ? `${widthPx}px` : '80%')
        try {
          ;(window as unknown as { __kgMarkdownViewerWidthPx?: number }).__kgMarkdownViewerWidthPx = widthPx || Math.max(0, Math.floor(rect.width || 0))
        } catch {
          void 0
        }
      } catch {
        void 0
      }
    }
    update()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        update()
      })
    }) : null
    try {
      ro?.observe(root)
    } catch {
      void 0
    }
    return () => {
      if (raf) {
        try {
          window.cancelAnimationFrame(raf)
        } catch {
          void 0
        }
        raf = 0
      }
      try {
        ro?.disconnect()
      } catch {
        void 0
      }
    }
  }, [])

  React.useEffect(() => {
    const tryScrollToHash = () => {
      const hash = typeof window !== 'undefined' && (window as unknown as { location?: Location }).location
        ? String(((window as unknown as { location?: Location }).location as Location).hash || '')
        : ''
      if (!hash || !hash.startsWith('#')) return
      const id = (() => {
        const raw = hash.slice(1)
        try {
          return decodeURIComponent(raw)
        } catch {
          return raw
        }
      })()
      if (!id) return
      const el = document.getElementById(id)
      const root = scrollRootRef.current
      if (!el || !root) return
      if (!root.contains(el)) return
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch {
        try {
          el.scrollIntoView()
        } catch {
          void 0
        }
      }
    }

    tryScrollToHash()

    return subscribeHashChange(() => {
      tryScrollToHash()
    })
  }, [activeDocumentPath])

  React.useEffect(() => {
    const root = scrollRootRef.current
    if (!root) return
    const hash = typeof window !== 'undefined' && (window as unknown as { location?: Location }).location
      ? String(((window as unknown as { location?: Location }).location as Location).hash || '')
      : ''
    if (hash && hash.startsWith('#')) return
    try {
      root.scrollTop = 0
    } catch {
      void 0
    }
  }, [activeDocumentPath])

  const explorerControls = useMarkdownExplorerControls({
    tokens,
    storageScopeKey: activeDocumentPath,
    showSidebar,
    onToggleSidebar,
    collapsedHeadingIds: collapsedIds,
    onToggleCollapse,
    onExpandAll,
    onCollapseAll,
  })

  const handleTocSelect = React.useCallback((id: string) => {
    if (onTocSelect) {
      onTocSelect(id)
      return
    }
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [onTocSelect])

  const handleWikiLinkNavigate = React.useCallback(
    (href: string): boolean => {
      const parsed = parseMarkdownWikiHref(href)
      if (!parsed) return false
      const list = Array.isArray(sourceFiles) ? sourceFiles : []
      if (!list.length || typeof onSourceFileSelect !== 'function') return false

      const docKeyNorm = normalizeLooseKey(parsed.docKey)
      if (!docKeyNorm) return false

      const findMatch = (): { id: string; name: string } | null => {
        for (const f of list) {
          const name = String(f?.name || '')
          const base = name.replace(/\\/g, '/').split('/').pop() || name
          const baseNoExt = base.replace(/\.(md|markdown)$/i, '')
          const candidates = [
            normalizeLooseKey(baseNoExt),
            normalizeLooseKey(base),
            normalizeLooseKey(name.replace(/\.(md|markdown)$/i, '')),
          ]
          if (candidates.some(c => c && c === docKeyNorm)) {
            const id = String(f?.id || '')
            if (!id) continue
            return { id, name }
          }
        }
        return null
      }

      const match = findMatch()
      if (!match) return false

      try {
        onSourceFileSelect(match.id)
      } catch {
        return false
      }

      const anchorId = parsed.anchorId
      if (anchorId && typeof window !== 'undefined') {
        try {
          window.location.hash = `#${encodeURIComponent(anchorId)}`
        } catch {
          void 0
        }
      }

      return true
    },
    [onSourceFileSelect, sourceFiles],
  )

  const handleClickWithWikiLinks = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      try {
        const target = event.target as Element | null
        const variableRef = target ? target.closest('[data-kg-var-key]') as HTMLElement | null : null
        const variableKey = String(variableRef?.getAttribute('data-kg-var-key') || '').trim()
        if (variableKey) {
          const ssot = variableSsotByKey.get(variableKey.toLowerCase())
          if (ssot && typeof onShowInEditor === 'function') {
            event.preventDefault()
            event.stopPropagation()
            onShowInEditor(ssot.line)
            return
          }
        }
        const anchor = target ? target.closest('a') : null
        const href = anchor?.getAttribute('href') || ''
        if (href && href.startsWith('#') && handleWikiLinkNavigate(href)) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
      } catch {
        void 0
      }
      onClick(event)
    },
    [handleWikiLinkNavigate, onClick, onShowInEditor, variableSsotByKey],
  )

  const visibleTokens = React.useMemo(() => {
    return filterVisibleMarkdownTokensByCollapsedHeadings({
      tokens,
      collapsedHeadingIds: explorerControls.collapsedHeadingIds,
    })
  }, [tokens, explorerControls.collapsedHeadingIds])
  const {
    onMoveItem: handleMoveHeadingSection,
    onReorderByIds: handleReorderHeadingSection,
  } = useMarkdownTocTreeState({
    tokens,
    onReorder: onTocReorder,
  })

  const providedStickyHeadingTopPx = React.useMemo(
    () => getDefaultStickyHeadingTopPx(stickyHeadingTopPx),
    [stickyHeadingTopPx],
  )

  const effectiveStickyHeadingTopPx = providedStickyHeadingTopPx

  const stickyHeadingScrollPaddingTopPx = React.useMemo(() => {
    return computeStickyHeadingScrollPaddingTopPx({
      tokens,
      baseTopPx: effectiveStickyHeadingTopPx,
      markdownPresentationMode: false,
    })
  }, [effectiveStickyHeadingTopPx, tokens])

  const body = React.useMemo(
    () => (
      <MarkdownTokenRenderer
        tokens={visibleTokens}
        activeDocumentPath={activeDocumentPath}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={false}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        stickyHeadingTopClass={stickyHeadingTopClass}
        stickyHeadingTopPx={effectiveStickyHeadingTopPx}
        mermaidFrontmatterConfig={mermaidFrontmatterConfig}
        rootThemeMode={rootThemeMode}
        previewOverlayScope={previewOverlayScope}
        previewOverlayPortalTarget={previewOverlayPortalTarget}
        markdownTextHighlight={markdownTextHighlight}
        codeAnnotations={codeAnnotations}
        geoDatasetIntegration={geoDatasetIntegration}
        annotateDisplayMode={annotateDisplayMode}
        selectionKind={selectionKind}
        highlightBackgroundColor={effectiveHighlightBackgroundColor}
        highlightUnderlineColor={effectiveHighlightUnderlineColor}
        collapsedIds={explorerControls.collapsedHeadingIds}
        onToggleCollapse={explorerControls.onToggleCollapse}
        viewerBlockEditingEnabled={!!onTocReorder || !!onInsertLineAfter || !!onReorderLineBlock || !!onReplaceLineRange}
        onMoveHeadingSection={handleMoveHeadingSection}
        onReorderHeadingSection={handleReorderHeadingSection}
        onInsertLineAfter={onInsertLineAfter}
        onReorderLineBlock={onReorderLineBlock}
        onReplaceLineRange={onReplaceLineRange}
        flashLine={flashLine}
        webpageLayoutWireframeAscii={webpageLayoutWireframeAscii}
        markdownForcePlainTables={markdownForcePlainTables}
        markdownSourceLines={markdownSourceLines}
        forbidCopy={forbidCopy}
        onInlineEditStateChange={onInlineEditStateChange}
      />
    ),
    [
      activeDocumentPath,
      effectiveHighlightBackgroundColor,
      effectiveHighlightUnderlineColor,
      geoDatasetIntegration,
      highlightedLineRange,
      markdownTextHighlight,
      markdownWordWrap,
      annotateDisplayMode,
      mermaidFrontmatterConfig,
      previewOverlayPortalTarget,
      previewOverlayScope,
      rootThemeMode,
      codeAnnotations,
      stickyHeadingTopClass,
      effectiveStickyHeadingTopPx,
      selectionKind,
      visibleTokens,
      uiPanelMonospaceTextClass,
      uiPanelTextFontClass,
      explorerControls.collapsedHeadingIds,
      explorerControls.onToggleCollapse,
      handleMoveHeadingSection,
      handleReorderHeadingSection,
      onInsertLineAfter,
      onReorderLineBlock,
      onReplaceLineRange,
      onTocReorder,
      markdownForcePlainTables,
      flashLine,
      markdownSourceLines,
      webpageLayoutWireframeAscii,
      forbidCopy,
      onInlineEditStateChange,
    ],
  )

  const frontmatterPreviewOpts = React.useMemo(() => {
    if (!frontmatterModeEnabled) return null
    return buildMarkdownFrontmatterPreviewRenderOpts({
      activeDocumentPath,
      highlightedLineRange,
      markdownWordWrap,
      uiPanelTextFontClass,
      uiPanelMonospaceTextClass,
      stickyHeadingTopClass,
      stickyHeadingTopPx: effectiveStickyHeadingTopPx,
      mermaidFrontmatterConfig: mermaidFrontmatterConfig as never,
      rootThemeMode,
      previewOverlayScope,
      previewOverlayPortalTarget,
      codeAnnotations,
      collapsedIds: explorerControls.collapsedHeadingIds,
      onToggleCollapse: explorerControls.onToggleCollapse,
      geoDatasetIntegration,
      forbidCopy,
    })
  }, [
    activeDocumentPath,
    codeAnnotations,
    forbidCopy,
    explorerControls.collapsedHeadingIds,
    effectiveStickyHeadingTopPx,
    frontmatterModeEnabled,
    geoDatasetIntegration,
    explorerControls.onToggleCollapse,
    highlightedLineRange,
    markdownWordWrap,
    mermaidFrontmatterConfig,
    previewOverlayPortalTarget,
    previewOverlayScope,
    rootThemeMode,
    stickyHeadingTopClass,
    uiPanelMonospaceTextClass,
    uiPanelTextFontClass,
  ])

  return (
    <MarkdownPanelLayout
      tokens={tokens}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
      showSidebar={explorerControls.showSidebar}
      onTocSelect={handleTocSelect}
      onTocDoubleClick={onTocDoubleClick}
      onTocReorder={onTocReorder}
      collapsedIds={explorerControls.collapsedHeadingIds}
      onToggleCollapse={explorerControls.onToggleCollapse}
      onExpandAll={explorerControls.onExpandAll}
      onCollapseAll={explorerControls.onCollapseAll}
      allCollapsed={explorerControls.allCollapsed}
      sourceFiles={sourceFiles}
      onSourceFileSelect={onSourceFileSelect}
      sourceFilesPanelIntegration={sourceFilesPanelIntegration}
      sidebarPosition={sidebarPosition}
    >
      <section
        ref={handleScrollRootRef}
        onPointerDownCapture={resetUserSelectLockIfNeeded}
        onMouseDownCapture={resetUserSelectLockIfNeeded}
        onMouseUpCapture={resetUserSelectLockIfNeeded}
        onDoubleClickCapture={resetUserSelectLockIfNeeded}
        onScroll={onScroll}
        onContextMenu={onContextMenu}
        onClick={handleClickWithWikiLinks}
        onDoubleClick={onDoubleClick}
        onMouseUp={onMouseUp}
        onCopy={blockCopy}
        onCut={blockCopy}
        onKeyDown={blockCopyKeyDown}
        style={
          (
            scrollClass === 'overflow-auto'
              ? ({
                  scrollbarGutter: 'stable',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  ...(stickyHeadingScrollPaddingTopPx > 0 ? { scrollPaddingTop: `${stickyHeadingScrollPaddingTopPx}px` } : null),
                } as React.CSSProperties)
              : ({
                  scrollbarGutter: 'stable',
                  ...(stickyHeadingScrollPaddingTopPx > 0 ? { scrollPaddingTop: `${stickyHeadingScrollPaddingTopPx}px` } : null),
                } as React.CSSProperties)
          )
        }
        className={[
          'relative flex-1 min-h-0', // Removed py-2 to ensure sticky headers snap perfectly to top
          scrollClass,
          uiPanelTextFontClass,
          UI_THEME_TOKENS.text.primary,
        ].join(' ')}
        data-testid="markdown-preview-root"
        aria-label="Markdown Preview Content"
      >
        {embeddedMarkdownBase64 ? (
          <script type="application/x-kg-markdown" data-kg-markdown-source="1" data-kg-encoding="base64">
            {embeddedMarkdownBase64}
          </script>
        ) : null}
        {variableSsotEntries.length > 0 ? (
          <section aria-hidden className="sr-only">
            {variableSsotEntries.map(entry => (
              <span
                key={`var-ssot:${entry.key}`}
                id={buildMarkdownVariableSsotAnchorId(entry.key)}
                data-kg-var-ssot-key={entry.key}
                data-kg-var-ssot-line={entry.line}
              />
            ))}
          </section>
        ) : null}
        {frontmatterPreviewOpts ? (
          <MarkdownFrontmatterPreviewBlocks
            yaml={frontmatterRawText}
            mermaid={frontmatterMermaidCode}
            frontmatterMeta={frontmatterMeta}
            variableSsotEntries={variableSsotEntries}
            onShowInEditor={onShowInEditor}
            annotateDisplayMode={annotateDisplayMode}
            opts={frontmatterPreviewOpts}
            markdownWordWrap={markdownWordWrap}
            contentClassName={contentClassName}
            markdownViewerWidthMode={markdownViewerWidthMode}
          />
        ) : null}
        <article
          ref={handleArticleRef}
          className={
            contentClassName ||
            getMarkdownViewerWidthWrapperClassName(markdownViewerWidthMode || 'standard')
          }
        >
           {body}
        </article>
        {selectionToolbar ? (
          <section className={getMarkdownViewerWidthWrapperClassName(markdownViewerWidthMode || 'standard')}>
            {selectionToolbar}
          </section>
        ) : null}
      </section>
    </MarkdownPanelLayout>
  )
}
