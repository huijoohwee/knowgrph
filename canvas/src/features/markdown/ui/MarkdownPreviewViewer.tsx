import React from 'react'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import type { TokenWithLines } from './markdownPreviewLex'
import { MarkdownPanelLayout } from './MarkdownPanelLayout'
import { getDefaultStickyHeadingTopPx, getMarkdownViewerWidthWrapperClassName } from './markdownSectionUtils'
import { slugify } from '@/features/parsers/markdownJsonLd'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
  stickyHeadingTopClass?: string
  stickyHeadingTopPx?: number
  mermaidFrontmatterConfig: Record<string, unknown> | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget: HTMLElement | null
  effectiveHighlightBackgroundColor: string | null
  effectiveHighlightUnderlineColor: string | null
  scrollClass: string
  hasFrontmatterMermaid: boolean
  frontmatterMermaidCode?: string
  codeAnnotations?: Record<string, string> | null
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
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void
  annotateDisplayMode?: 'inline' | 'beside'
  flashLine?: number | null
  contentClassName?: string
  markdownViewerWidthMode?: 'standard' | 'wide'
}

export function MarkdownPreviewViewer(props: MarkdownPreviewViewerProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
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
    stickyHeadingTopClass,
    stickyHeadingTopPx,
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    effectiveHighlightBackgroundColor,
    effectiveHighlightUnderlineColor,
    scrollClass,
    hasFrontmatterMermaid,
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
    frontmatterMermaidCode,
    onDoubleClick,
    codeAnnotations,
    annotateDisplayMode,
    flashLine,
    contentClassName,
    markdownViewerWidthMode,
  } = props

  const scrollRootRef = React.useRef<HTMLDivElement | null>(null)
  const handleScrollRootRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      scrollRootRef.current = el
      rootRef(el)
    },
    [rootRef],
  )

  const [localShowSidebar, setLocalShowSidebar] = React.useState(true)
  const effectiveShowSidebar = showSidebar ?? localShowSidebar
  const [localCollapsedIds, setLocalCollapsedIds] = React.useState<Set<string>>(() => new Set())
  const effectiveCollapsedIds = collapsedIds ?? localCollapsedIds

  React.useEffect(() => {
    if (showSidebar === undefined) {
      try {
        const stored = localStorage.getItem('markdownPreviewSidebarOpen')
        if (stored !== null) {
          setLocalShowSidebar(stored === 'true')
        }
      } catch {
        void 0
      }
    }
  }, [showSidebar])

  React.useEffect(() => {
    if (collapsedIds !== undefined) return
    try {
      const raw = localStorage.getItem('markdownPreviewCollapsedIds')
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const next = new Set<string>()
      parsed.forEach(v => {
        if (typeof v === 'string' && v.trim()) next.add(v)
      })
      setLocalCollapsedIds(next)
    } catch {
      void 0
    }
  }, [collapsedIds])

  const handleToggleSidebar = React.useCallback(
    (show: boolean) => {
      if (onToggleSidebar) {
        onToggleSidebar(show)
      } else {
        setLocalShowSidebar(show)
        try {
          localStorage.setItem('markdownPreviewSidebarOpen', String(show))
        } catch {
          void 0
        }
      }
    },
    [onToggleSidebar],
  )

  const handleToggleCollapse = React.useCallback(
    (id: string) => {
      if (onToggleCollapse) {
        onToggleCollapse(id)
        return
      }
      setLocalCollapsedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        try {
          localStorage.setItem('markdownPreviewCollapsedIds', JSON.stringify(Array.from(next)))
        } catch {
          void 0
        }
        return next
      })
    },
    [onToggleCollapse],
  )

  const allHeadingIds = React.useMemo(() => {
    const out = new Set<string>()
    for (const t of tokens) {
      if (t.type !== 'heading') continue
      const id = t.id || slugify(t.text || '')
      if (id) out.add(id)
    }
    return out
  }, [tokens])

  const handleExpandAll = React.useCallback(() => {
    if (onExpandAll) {
      onExpandAll()
      return
    }
    setLocalCollapsedIds(new Set())
    try {
      localStorage.setItem('markdownPreviewCollapsedIds', JSON.stringify([]))
    } catch {
      void 0
    }
  }, [onExpandAll])

  const handleCollapseAll = React.useCallback(() => {
    if (onCollapseAll) {
      onCollapseAll()
      return
    }
    setLocalCollapsedIds(allHeadingIds)
    try {
      localStorage.setItem('markdownPreviewCollapsedIds', JSON.stringify(Array.from(allHeadingIds)))
    } catch {
      void 0
    }
  }, [allHeadingIds, onCollapseAll])

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

  const visibleTokens = React.useMemo(() => {
    if (!effectiveCollapsedIds || effectiveCollapsedIds.size === 0) {
      return tokens
    }

    const result: TokenWithLines[] = []
    let skipUntilDepth: number | null = null

    for (const t of tokens) {
      if (t.type === 'heading') {
        const depth = t.depth || 1
        const id = t.id || slugify(t.text || '')

        if (skipUntilDepth !== null && depth <= skipUntilDepth) {
          skipUntilDepth = null
        }

        if (skipUntilDepth === null) {
          result.push(t)
          if (effectiveCollapsedIds.has(id)) {
            skipUntilDepth = depth
          }
        }
      } else {
        if (skipUntilDepth === null) {
          result.push(t)
        }
      }
    }
    return result
  }, [tokens, effectiveCollapsedIds])

  const providedStickyHeadingTopPx = React.useMemo(
    () => getDefaultStickyHeadingTopPx(stickyHeadingTopPx),
    [stickyHeadingTopPx],
  )

  const effectiveStickyHeadingTopPx = providedStickyHeadingTopPx

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
        annotateDisplayMode={annotateDisplayMode}
        selectionKind={selectionKind}
        highlightBackgroundColor={effectiveHighlightBackgroundColor}
        highlightUnderlineColor={effectiveHighlightUnderlineColor}
        collapsedIds={effectiveCollapsedIds}
        onToggleCollapse={handleToggleCollapse}
        flashLine={flashLine}
      />
    ),
    [
      activeDocumentPath,
      effectiveHighlightBackgroundColor,
      effectiveHighlightUnderlineColor,
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
      effectiveCollapsedIds,
      handleToggleCollapse,
      flashLine,
    ],
  )

  return (
    <MarkdownPanelLayout
      tokens={tokens}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      showSidebar={effectiveShowSidebar}
      setShowSidebar={handleToggleSidebar}
      onTocSelect={handleTocSelect}
      onTocDoubleClick={onTocDoubleClick}
      onTocReorder={onTocReorder}
      collapsedIds={effectiveCollapsedIds}
      onToggleCollapse={handleToggleCollapse}
      onExpandAll={onExpandAll ?? handleExpandAll}
      onCollapseAll={onCollapseAll ?? handleCollapseAll}
    >
      <section
        ref={handleScrollRootRef}
        onScroll={onScroll}
        onContextMenu={onContextMenu}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onMouseUp={onMouseUp}
        className={[
          'relative flex-1 min-h-0 px-8', // Removed py-2 to ensure sticky headers snap perfectly to top
          scrollClass,
          uiPanelTextFontClass,
        ].join(' ')}
        data-testid="markdown-preview-root"
        aria-label="Markdown Preview Content"
      >
        {hasFrontmatterMermaid && frontmatterMermaidCode && (
          <figure
            className={[
              'mb-8 p-4 border rounded overflow-auto',
              UI_THEME_TOKENS.panel.bg,
              UI_THEME_TOKENS.panel.border,
              UI_THEME_TOKENS.text.primary,
            ].join(' ')}
          >
            <MermaidDiagram
              code={frontmatterMermaidCode}
              highlightClass=""
              frontmatterConfig={mermaidFrontmatterConfig}
              rootThemeMode={rootThemeMode}
              overlayScope={previewOverlayScope}
              overlayPortalTarget={previewOverlayPortalTarget}
            />
          </figure>
        )}
        <article
          className={
            contentClassName ||
            getMarkdownViewerWidthWrapperClassName(markdownViewerWidthMode || 'standard')
          }
        >
           {body}
        </article>
        {selectionToolbar}
      </section>
    </MarkdownPanelLayout>
  )
}
