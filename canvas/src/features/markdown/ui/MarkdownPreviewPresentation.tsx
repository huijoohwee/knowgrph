import React from 'react'
import { LayoutList, LayoutPanelTop } from 'lucide-react'
import PreviewGallery from '@/features/panels/views/preview-panel/ui/PreviewGallery'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { splitMarkdownLines } from '@/lib/markdown'
import { lexMarkdownContent, type TokenWithLines } from './markdownPreviewLex'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import type { MarkdownFragmentConfig } from './markdownPreviewFragments'
import { lsBool, lsSetBool } from '@/lib/persistence'
import {
  buildBackgroundStyle,
  buildSlideBody,
  buildSlidePreview,
  buildSlideTransitionStyle,
  buildTwoColumnTokens,
  getSlideTextBodyAndNotes,
  getSlideVisualMeta,
} from './markdownPresentationSlides'
import { SlideFrame } from './SlideFrame'
import { findLineRangeFromTarget } from '@/features/markdown/ui/markdownPreviewContextMenuUtils'
import { PresentationNotes } from './PresentationNotes'

type SlidesSidebarProps = {
  as?: 'aside' | 'section'
  embedded?: boolean
  orderedSlideIndices: number[]
  activeSlideId: number
  slideOrder: number[]
  slideCount: number
  activeSlideHeading: string
  showSlideThumbnails: boolean
  onToggleShowSlideThumbnails: () => void
  onSidebarFocusSlideIdChange: (id: number | null) => void
  onActiveSlideIndexChange: (index: number) => void
  onSlideOrderChange: (nextOrder: number[]) => void
  renderSlidePreview: (slideIdx: number) => React.ReactNode
  onSlideDoubleClick?: (slideIdx: number) => void
  onSlideContextMenu?: (slideIdx: number, e: React.MouseEvent) => void
  width?: string
  layout?: 'list' | 'grid'
}

function SlidesSidebar(props: SlidesSidebarProps) {
  const {
    as: Tag = 'aside',
    embedded = false,
    orderedSlideIndices,
    activeSlideId,
    slideOrder,
    slideCount,
    activeSlideHeading,
    showSlideThumbnails,
    onToggleShowSlideThumbnails,
    onSidebarFocusSlideIdChange,
    onActiveSlideIndexChange,
    onSlideOrderChange,
    renderSlidePreview,
    onSlideDoubleClick,
    onSlideContextMenu,
    width = 'w-64',
    layout = 'list',
  } = props

  const [selectedSlideIds, setSelectedSlideIds] = React.useState<string[]>([])

  React.useEffect(() => {
    if (!selectedSlideIds.length) return
    const idSet = new Set(orderedSlideIndices.map(id => String(id)))
    setSelectedSlideIds((prev) => {
      if (!prev.length) return prev
      const next = prev.filter(id => idSet.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [orderedSlideIndices, selectedSlideIds.length])

  const items = React.useMemo(
    () =>
      orderedSlideIndices.map((slideIdx, i) => ({
        id: String(slideIdx),
        label: UI_COPY.markdownSlideIndexLabel(i + 1),
        preview: renderSlidePreview(slideIdx),
      })),
    [orderedSlideIndices, renderSlidePreview],
  )

  const containerClassName =
    layout === 'grid'
      ? `${width} border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} flex flex-col rounded`
      : `${width} shrink-0 border-r ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} flex flex-col`

  const content = (
    <>
      <header
        className={`h-auto py-2 border-b px-2 flex items-center justify-between gap-2 shrink-0 ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.panel.headerBg}`}
      >
        <div className="min-w-0">
          <div className={`text-xs font-medium ${UI_THEME_TOKENS.text.primary}`}>
            {UI_COPY.markdownSlidesSidebarViewTitle}
          </div>
          <div className={`mt-1 text-[11px] ${UI_THEME_TOKENS.text.secondary} truncate`}>
            {slideCount} {UI_COPY.markdownSlidesSidebarSlidesSuffix}
            {activeSlideHeading ? ` · ${activeSlideHeading}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedSlideIds.length > 0 ? (
            <button
              type="button"
              className={`text-[11px] ${UI_THEME_TOKENS.text.tertiary} hover:text-gray-900 dark:hover:text-gray-100`}
              onClick={() => setSelectedSlideIds([])}
            >
              {UI_COPY.markdownSlidesSidebarClearSelectionLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={[
              'App-toolbar__btn flex items-center justify-center rounded border',
              showSlideThumbnails
                ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText} border-transparent`
                : `${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
            ].join(' ')}
            onClick={onToggleShowSlideThumbnails}
          >
            {showSlideThumbnails ? (
              <LayoutPanelTop className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden={true} />
            ) : (
              <LayoutList className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden={true} />
            )}
          </button>
        </div>
      </header>
      <nav className="flex-1 min-h-0 overflow-auto">
        <PreviewGallery
          items={items}
          activeId={String(activeSlideId)}
          selectedIds={selectedSlideIds}
          onSelectedIdsChange={setSelectedSlideIds}
          showPreview={showSlideThumbnails}
          onHighlightChange={(id) => {
            if (id === null) {
              onSidebarFocusSlideIdChange(null)
              return
            }
            const idx = Number.parseInt(id, 10)
            if (!Number.isFinite(idx)) return
            onSidebarFocusSlideIdChange(idx)
          }}
          onSelect={(id) => {
            const idx = Number.parseInt(id, 10)
            if (!Number.isFinite(idx)) return
            const pos = orderedSlideIndices.indexOf(idx)
            if (pos < 0) return
            onActiveSlideIndexChange(pos)
          }}
          onReorder={(nextIds) => {
            const next = nextIds.map(x => Number.parseInt(x, 10)).filter(n => Number.isFinite(n))
            const nextOrder = next.length ? next : slideOrder
            onSlideOrderChange(nextOrder)
            const nextPos = nextOrder.indexOf(activeSlideId)
            if (nextPos >= 0) onActiveSlideIndexChange(nextPos)
          }}
          onDoubleClick={(id) => {
            const idx = Number.parseInt(id, 10)
            if (!Number.isFinite(idx)) return
            if (onSlideDoubleClick) onSlideDoubleClick(idx)
          }}
          onContextMenu={(id, e) => {
            const idx = Number.parseInt(id, 10)
            if (!Number.isFinite(idx)) return
            if (onSlideContextMenu) onSlideContextMenu(idx, e)
          }}
        />
      </nav>
    </>
  )

  if (embedded) return content

  return <Tag className={containerClassName}>{content}</Tag>
}

type MarkdownPreviewPresentationProps = {
  rootRef: (el: HTMLDivElement | null) => void
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void
  onRegisterFullscreenHandler?: (fn: (() => void) | null) => void
  headMeta: Record<string, unknown>
  slides: Array<{
    index: number
    text: string
    startLine: number
    endLine: number
    notes: string | null
    meta?: Record<string, unknown>
  }>
  activeSlideId: number
  orderedSlideIndices: number[]
  setActiveSlideIndex: (index: number) => void
  slideOrder: number[]
  setSlideOrder: (order: number[]) => void
  activeFragmentConfig: MarkdownFragmentConfig
  activeFragmentStep: number
  markdownWordWrap: boolean
  markdownTextHighlight: boolean
  selectionKind: 'node' | 'edge' | null
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget: HTMLElement | null
  alwaysOnHighlightMode: boolean
  buildAlwaysOnTokenHighlights: (tokens: TokenWithLines[] | null) => Array<{
    textColor: string | null
    underlineColor: string | null
    backgroundColor: string | null
  }> | null
  highlightedLineRange: HighlightedLineRange
  activeDocumentPath: string
  mermaidFrontmatterConfig: Record<string, unknown> | null
  rootThemeMode: 'light' | 'dark'
  effectiveHighlightBackgroundColor: string | null
  effectiveHighlightUnderlineColor: string | null
  onPreviewClick?: (line: number) => void
  onShowInEditor?: (line: number) => void
  onMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void
  selectionToolbar?: React.ReactNode
  onSlideContextMenu?: (slideIdx: number, e: React.MouseEvent) => void
  fullDocTokens?: TokenWithLines[]
}

export function MarkdownPreviewPresentation(props: MarkdownPreviewPresentationProps) {
  const {
    rootRef,
    onClick,
    onContextMenu,
    onRegisterFullscreenHandler,
    headMeta,
    slides,
    activeSlideId,
    orderedSlideIndices,
    setActiveSlideIndex,
    slideOrder,
    setSlideOrder,
    activeFragmentConfig,
    activeFragmentStep,
    markdownWordWrap,
    markdownTextHighlight,
    selectionKind,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    previewOverlayScope,
    previewOverlayPortalTarget,
    alwaysOnHighlightMode,
    buildAlwaysOnTokenHighlights,
    highlightedLineRange,
    activeDocumentPath,
    mermaidFrontmatterConfig,
    rootThemeMode,
    effectiveHighlightBackgroundColor,
    effectiveHighlightUnderlineColor,
    onPreviewClick,
    onShowInEditor,
    onMouseUp,
    selectionToolbar,
    onSlideContextMenu,
  } = props

  const [isSlidesFullscreenOpen, setIsSlidesFullscreenOpen] = React.useState(false)
  const [showSlideThumbnails, setShowSlideThumbnails] = React.useState<boolean>(() =>
    lsBool(LS_KEYS.previewSlidesShowThumbnails, false),
  )
  const [showSpeakerNotes, setShowSpeakerNotes] = React.useState<boolean>(() =>
    lsBool(LS_KEYS.previewSlidesShowNotes, false),
  )
  const [slideTransitionPhase, setSlideTransitionPhase] = React.useState<'from' | 'to'>('to')

  const activeTransitionKey = React.useMemo(() => {
    const currentSlide = slides[activeSlideId]
    if (!currentSlide) return ''
    const slideMeta = (currentSlide.meta || {}) as Record<string, unknown>
    const headMetaRecord = headMeta as Record<string, unknown>
    const raw = String(slideMeta.transition || headMetaRecord.transition || '').trim().toLowerCase()
    return raw
  }, [activeSlideId, headMeta, slides])

  React.useEffect(() => {
    if (!isSlidesFullscreenOpen) return
    if (!activeTransitionKey || activeTransitionKey === 'none') {
      setSlideTransitionPhase('to')
      return
    }
    setSlideTransitionPhase('from')
    if (typeof window === 'undefined') {
      setSlideTransitionPhase('to')
      return
    }
    let frame = 0
    frame = window.requestAnimationFrame(() => {
      setSlideTransitionPhase('to')
    })
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [activeTransitionKey, isSlidesFullscreenOpen])

  React.useEffect(() => {
    if (!onRegisterFullscreenHandler) return
    onRegisterFullscreenHandler(() => {
      setIsSlidesFullscreenOpen(true)
    })
    return () => {
      onRegisterFullscreenHandler(null)
    }
  }, [onRegisterFullscreenHandler])

  const baseSlideSize = React.useMemo(() => {
    const meta = headMeta
    const raw = String(meta.aspectRatio || '').trim()
    let width = 1920
    let height = 1080
    if (raw) {
      const m = /^(\d+)\s*\/\s*(\d+)$/.exec(raw)
      if (m) {
        const w = Number.parseInt(m[1], 10)
        const h = Number.parseInt(m[2], 10)
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
          const baseHeight = 1080
          height = baseHeight
          width = Math.max(1, Math.round((baseHeight * w) / h))
        }
      }
    }
    return { w: width, h: height }
  }, [headMeta])

  const hasSlides = React.useMemo(
    () => slides.length > 0,
    [slides.length],
  )

  const safeActiveSlideId = React.useMemo(() => {
    if (!hasSlides) return 0
    if (activeSlideId >= 0 && activeSlideId < slides.length) return activeSlideId
    return 0
  }, [activeSlideId, hasSlides, slides.length])

  const slideTokens = React.useMemo(() => {
    if (!isSlidesFullscreenOpen) return null
    if (!hasSlides) return null
    const currentSlide = slides[safeActiveSlideId]
    if (!currentSlide) return null

    // Optimization: Use shared tokens if available
    if (props.fullDocTokens) {
      const start = currentSlide.startLine
      const end = currentSlide.endLine
      const filtered = props.fullDocTokens.filter(t => {
        const startLine = typeof t.startLine === 'number' ? t.startLine : 0
        const endLine = typeof t.endLine === 'number' ? t.endLine : startLine
        return startLine >= start && endLine <= end
      })
      // If we have tokens, return them.
      // If filtered is empty but the slide has text, it means line numbers might be misaligned or tokens are missing.
      // In that case, fall back to on-the-fly lexing.
      if (filtered.length > 0) return filtered
      const { body } = getSlideTextBodyAndNotes(currentSlide)
      if (!body) return []
      // Fallthrough to lexing below
    }

    const { text, body } = getSlideTextBodyAndNotes(currentSlide)
    if (!body) return null
    const out = lexMarkdownContent(
      text,
      Math.max(0, (currentSlide.startLine || 1) - 1),
    )
    return out.tokens
  }, [hasSlides, isSlidesFullscreenOpen, safeActiveSlideId, slides, props.fullDocTokens])

  const twoColumnTokens = React.useMemo(() => {
    if (!isSlidesFullscreenOpen) return null
    if (!hasSlides) return null
    const currentSlide = slides[safeActiveSlideId]
    if (!currentSlide) return null
    return buildTwoColumnTokens({
      slide: currentSlide as never,
      headMeta,
      fullDocTokens: props.fullDocTokens,
    }) as { left: TokenWithLines[]; right: TokenWithLines[] } | null
  }, [hasSlides, headMeta, isSlidesFullscreenOpen, safeActiveSlideId, slides, props.fullDocTokens])

  const slideBody = React.useMemo(
    () =>
      isSlidesFullscreenOpen
        ? buildSlideBody({
        hasSlides,
        slides,
        safeActiveSlideId,
        twoColumnTokens,
        slideTokens,
        headMeta,
        activeDocumentPath,
        highlightedLineRange,
        markdownWordWrap,
        markdownTextHighlight,
        selectionKind,
        uiPanelTextFontClass,
        uiPanelMonospaceTextClass,
        previewOverlayScope,
        previewOverlayPortalTarget,
        alwaysOnHighlightMode,
        buildAlwaysOnTokenHighlights,
        activeFragmentConfig,
        activeFragmentStep,
        mermaidFrontmatterConfig,
        rootThemeMode,
        effectiveHighlightBackgroundColor,
        effectiveHighlightUnderlineColor,
        })
        : null,
    [
      hasSlides,
      isSlidesFullscreenOpen,
      slides,
      safeActiveSlideId,
      twoColumnTokens,
      slideTokens,
      headMeta,
      activeDocumentPath,
      highlightedLineRange,
      markdownWordWrap,
      markdownTextHighlight,
      selectionKind,
      uiPanelTextFontClass,
      uiPanelMonospaceTextClass,
      previewOverlayScope,
      previewOverlayPortalTarget,
      alwaysOnHighlightMode,
      buildAlwaysOnTokenHighlights,
      activeFragmentConfig,
      activeFragmentStep,
      mermaidFrontmatterConfig,
      rootThemeMode,
      effectiveHighlightBackgroundColor,
      effectiveHighlightUnderlineColor,
    ],
  )

  const slideMeta = (slides[safeActiveSlideId]?.meta || {}) as Record<string, unknown>
  const headMetaRecord = headMeta as Record<string, unknown>
  const {
    slideClass,
    layout: layoutRaw,
    backgroundRaw,
    backgroundSize,
    backgroundPosition,
    themeStyle,
  } = getSlideVisualMeta(slideMeta, headMetaRecord, uiPanelTextFontClass)
  const frameVariantRaw = String(slideMeta.frame || headMetaRecord.frame || '').trim().toLowerCase()
  const framePaddingRaw = slideMeta.framePadding ?? headMetaRecord.framePadding
  const slideStyle = buildBackgroundStyle(backgroundRaw, backgroundSize, backgroundPosition)

  const slideTransitionStyle: React.CSSProperties = React.useMemo(
    () => buildSlideTransitionStyle(activeTransitionKey, slideTransitionPhase),
    [activeTransitionKey, slideTransitionPhase],
  )
  const layout = layoutRaw
  const isAcademicTheme = themeStyle === 'academic'
  const slideOuterClass =
    layout === 'center'
      ? 'w-full h-full flex items-center justify-center'
      : 'w-full h-full flex'
  const slideContentClass =
    layout === 'center'
      ? [
          'max-h-full overflow-auto mx-auto flex items-center justify-center',
          isAcademicTheme ? 'max-w-5xl px-16 py-14' : 'max-w-4xl px-12 py-10',
        ].join(' ')
      : [
          'w-full h-full overflow-auto',
          isAcademicTheme ? 'px-16 py-14' : 'px-12 py-10',
        ].join(' ')
  const slideContent = slideBody

  let slideFramePaddingPx: number | undefined
  if (typeof framePaddingRaw === 'number' && Number.isFinite(framePaddingRaw)) {
    slideFramePaddingPx = framePaddingRaw
  } else if (typeof framePaddingRaw === 'string') {
    const trimmed = framePaddingRaw.trim()
    if (trimmed) {
      const parsed = Number.parseFloat(trimmed)
      if (Number.isFinite(parsed)) {
        slideFramePaddingPx = parsed
      }
    }
  }

  const frameVariant = frameVariantRaw || 'default'
  let baseFrameClass = `rounded border ${UI_THEME_TOKENS.panel.border} shadow ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  if (isAcademicTheme && !frameVariantRaw) {
    baseFrameClass = `rounded ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  }
  if (frameVariant === 'borderless') {
    baseFrameClass = `rounded ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  } else if (frameVariant === 'minimal') {
    baseFrameClass = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  } else if (frameVariant === 'dark') {
    baseFrameClass = 'rounded border border-gray-700 shadow bg-gray-900 text-gray-100'
  } else if (frameVariant === 'auto') {
    baseFrameClass = `rounded border ${UI_THEME_TOKENS.panel.border} shadow ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  }

  React.useEffect(() => {
    lsSetBool(LS_KEYS.previewSlidesShowThumbnails, showSlideThumbnails)
  }, [showSlideThumbnails])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.previewSlidesShowNotes, showSpeakerNotes)
  }, [showSpeakerNotes])

  React.useEffect(() => {
    if (!isSlidesFullscreenOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return
      e.preventDefault()
      setShowSpeakerNotes(prev => !prev)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSlidesFullscreenOpen])

  const [sidebarFocusSlideId, setSidebarFocusSlideId] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!isSlidesFullscreenOpen) {
      setSidebarFocusSlideId(null)
    }
  }, [isSlidesFullscreenOpen])

  const slideCount = orderedSlideIndices.length

  const focusSlideId = sidebarFocusSlideId ?? activeSlideId

  const notesTokens = React.useMemo(() => {
    if (!isSlidesFullscreenOpen) return null
    if (!showSpeakerNotes) return null
    const slide = slides[safeActiveSlideId]
    if (!slide || !slide.notes) return null
    const raw = String(slide.notes || '').trim()
    if (!raw) return null
    const cleaned = raw.replace(/<!--/g, '').replace(/-->/g, '').trim()
    if (!cleaned) return null
    return lexMarkdownContent(cleaned, 0).tokens
  }, [isSlidesFullscreenOpen, safeActiveSlideId, showSpeakerNotes, slides])

  const activeSlideHeading = React.useMemo(() => {
    const slide = slides[focusSlideId]
    if (!slide || !slide.text) return ''
    const lines = splitMarkdownLines(slide.text)
    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i] || ''
      const trimmed = raw.trim()
      if (!trimmed.startsWith('#')) continue
      const heading = trimmed.replace(/^#+\s*/, '').trim()
      if (!heading) continue
      if (heading.length <= 60) return heading
      return `${heading.slice(0, 57)}...`
    }
    return ''
  }, [focusSlideId, slides])

  const renderSlidePreview = React.useCallback(
    (slideIdx: number) =>
      buildSlidePreview({
        slideIdx,
        slides,
        headMeta,
        activeDocumentPath,
        uiPanelTextFontClass,
        uiPanelMonospaceTextClass,
        mermaidFrontmatterConfig,
        rootThemeMode,
        previewOverlayScope,
        previewOverlayPortalTarget,
        fullDocTokens: props.fullDocTokens,
      }),
    [
      slides,
      headMeta,
      activeDocumentPath,
      uiPanelTextFontClass,
      uiPanelMonospaceTextClass,
      mermaidFrontmatterConfig,
      rootThemeMode,
      previewOverlayScope,
      previewOverlayPortalTarget,
      props.fullDocTokens,
    ],
  )

  const handleDoubleClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (onShowInEditor) {
        const range = findLineRangeFromTarget(e.currentTarget as unknown as HTMLDivElement, e.target)
        if (range) {
          onShowInEditor(range.startLine)
          return
        }
        const currentSlide = slides[safeActiveSlideId]
        if (currentSlide) {
          onShowInEditor(currentSlide.startLine)
          return
        }
      }
      if (onPreviewClick) {
        const range = findLineRangeFromTarget(e.currentTarget as unknown as HTMLDivElement, e.target)
        if (range) {
          onPreviewClick(range.startLine)
          return
        }
        // Fallback to active slide start if clicking on slide background
        const currentSlide = slides[safeActiveSlideId]
        if (currentSlide) {
          onPreviewClick(currentSlide.startLine)
          return
        }
      }
      setIsSlidesFullscreenOpen(true)
    },
    [onShowInEditor, onPreviewClick, slides, safeActiveSlideId],
  )

  return (
    <>
      <section
        ref={rootRef}
        tabIndex={0}
        onClick={onClick}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        className={[
          'relative flex-1 min-h-0 w-full overflow-hidden outline-none flex flex-col border border-gray-200 bg-white rounded font-sans',
          uiPanelTextFontClass,
        ].join(' ')}
        data-testid="markdown-presentation-root"
      >
        <SlidesSidebar
          embedded
          orderedSlideIndices={orderedSlideIndices}
          activeSlideId={activeSlideId}
          slideOrder={slideOrder}
          slideCount={slideCount}
          activeSlideHeading={activeSlideHeading}
          showSlideThumbnails={showSlideThumbnails}
          onToggleShowSlideThumbnails={() => setShowSlideThumbnails(v => !v)}
          onSidebarFocusSlideIdChange={setSidebarFocusSlideId}
          onActiveSlideIndexChange={setActiveSlideIndex}
          onSlideOrderChange={setSlideOrder}
          renderSlidePreview={renderSlidePreview}
          onSlideDoubleClick={(idx) => {
            const pos = orderedSlideIndices.indexOf(idx)
            if (pos >= 0) setActiveSlideIndex(pos)
            setIsSlidesFullscreenOpen(true)
          }}
          onSlideContextMenu={onSlideContextMenu}
          width="w-full"
          layout="grid"
        />
        {selectionToolbar}
      </section>
      <PreviewOverlay
        open={isSlidesFullscreenOpen}
        onClose={() => setIsSlidesFullscreenOpen(false)}
        scope={previewOverlayScope}
        portalTarget={previewOverlayPortalTarget}
      >
        <section className="w-full h-full flex" onContextMenu={onContextMenu}>
          <SlidesSidebar
            orderedSlideIndices={orderedSlideIndices}
            activeSlideId={activeSlideId}
            slideOrder={slideOrder}
            slideCount={slideCount}
            activeSlideHeading={activeSlideHeading}
            showSlideThumbnails={showSlideThumbnails}
            onToggleShowSlideThumbnails={() => setShowSlideThumbnails(v => !v)}
            onSidebarFocusSlideIdChange={setSidebarFocusSlideId}
            onActiveSlideIndexChange={setActiveSlideIndex}
            onSlideOrderChange={setSlideOrder}
            renderSlidePreview={renderSlidePreview}
            onSlideContextMenu={onSlideContextMenu}
          />
          <main className="flex-1 min-w-0 flex flex-col">
            <ZoomPanViewport
              open={isSlidesFullscreenOpen}
              storageKey={LS_KEYS.previewZoomPanSlides}
              getContentSize={() => ({ w: baseSlideSize.w, h: baseSlideSize.h })}
              fitOnOpen
              frameAspectRatio={baseSlideSize.w / baseSlideSize.h}
              showControls={false}
              showZoomIndicator={true}
              framePaddingPx={slideFramePaddingPx}
              disablePan
              frameClassName={[
                baseFrameClass,
                slideClass,
              ].filter(Boolean).join(' ')}
            >
              <div style={{ width: `${baseSlideSize.w}px`, height: `${baseSlideSize.h}px` }}>
                <SlideFrame
                  frameClassName={slideOuterClass}
                  slideStyle={slideStyle}
                  slideTransitionStyle={slideTransitionStyle}
                  slideOuterClass={slideContentClass}
                  slideContentClass=""
                  onDoubleClick={handleDoubleClick}
                >
                  {slideContent}
                </SlideFrame>
              </div>
            </ZoomPanViewport>
            {showSpeakerNotes && notesTokens && notesTokens.length > 0 ? (
              <PresentationNotes
                notesTokens={notesTokens}
                activeDocumentPath={activeDocumentPath}
                uiPanelTextFontClass={uiPanelTextFontClass}
                uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                mermaidFrontmatterConfig={mermaidFrontmatterConfig}
                rootThemeMode={rootThemeMode}
                previewOverlayScope={previewOverlayScope}
                previewOverlayPortalTarget={previewOverlayPortalTarget}
                className="w-full max-h-56 overflow-auto border-t border-gray-200 bg-white"
              />
            ) : null}
          </main>
          {selectionToolbar}
        </section>
      </PreviewOverlay>
    </>
  )
}
