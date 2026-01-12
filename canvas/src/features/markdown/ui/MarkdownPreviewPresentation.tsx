import React from 'react'
import { LS_KEYS } from '@/lib/config'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import { splitMarkdownLines } from '@/lib/markdown'
import { lexMarkdownContent, type TokenWithLines } from './markdownPreviewLex'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import type { MarkdownFragmentConfig } from './markdownPreviewFragments'
import { lsBool, lsSetBool } from '@/lib/persistence'
import MarkdownTokenRenderer from './MarkdownTokenRenderer'
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
import { SlidesSidebar } from './SlidesSidebar'

type MarkdownPreviewPresentationProps = {
  rootRef: (el: HTMLDivElement | null) => void
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
}

export function MarkdownPreviewPresentation(props: MarkdownPreviewPresentationProps) {
  const {
    rootRef,
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
  } = props

  const [presentationViewport, setPresentationViewport] = React.useState<{ w: number; h: number }>({ w: 1, h: 1 })
  const [isSlidesFullscreenOpen, setIsSlidesFullscreenOpen] = React.useState(false)
  const [showSlideThumbnails, setShowSlideThumbnails] = React.useState<boolean>(() =>
    lsBool(LS_KEYS.previewSlidesShowThumbnails, true),
  )
  const [showSpeakerNotes, setShowSpeakerNotes] = React.useState<boolean>(() =>
    lsBool(LS_KEYS.previewSlidesShowNotes, false),
  )
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [slideTransitionPhase, setSlideTransitionPhase] = React.useState<'from' | 'to'>('to')

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      setPresentationViewport(prev => (prev.w === w && prev.h === h ? prev : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const activeTransitionKey = React.useMemo(() => {
    const currentSlide = slides[activeSlideId]
    if (!currentSlide) return ''
    const slideMeta = (currentSlide.meta || {}) as Record<string, unknown>
    const headMetaRecord = headMeta as Record<string, unknown>
    const raw = String(slideMeta.transition || headMetaRecord.transition || '').trim().toLowerCase()
    return raw
  }, [activeSlideId, headMeta, slides])

  React.useEffect(() => {
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
  }, [activeTransitionKey])

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
    let width = 1280
    let height = 720
    if (raw) {
      const m = /^(\d+)\s*\/\s*(\d+)$/.exec(raw)
      if (m) {
        const w = Number.parseInt(m[1], 10)
        const h = Number.parseInt(m[2], 10)
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
          const baseHeight = 720
          height = baseHeight
          width = Math.max(1, Math.round((baseHeight * w) / h))
        }
      }
    }
    return { w: width, h: height }
  }, [headMeta])

  const slideScale = React.useMemo(() => {
    const availableW = Math.max(1, presentationViewport.w)
    const availableH = Math.max(1, presentationViewport.h)
    return Math.max(0.05, Math.min(availableW / baseSlideSize.w, availableH / baseSlideSize.h))
  }, [baseSlideSize.h, baseSlideSize.w, presentationViewport.h, presentationViewport.w])
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
    if (!hasSlides) return null
    const currentSlide = slides[safeActiveSlideId]
    if (!currentSlide) return null
    const { text, body } = getSlideTextBodyAndNotes(currentSlide)
    if (!body) return null
    const out = lexMarkdownContent(
      text,
      Math.max(0, (currentSlide.startLine || 1) - 1),
    )
    return out.tokens
  }, [hasSlides, safeActiveSlideId, slides])

  const twoColumnTokens = React.useMemo(() => {
    if (!hasSlides) return null
    const currentSlide = slides[safeActiveSlideId]
    if (!currentSlide) return null
    return buildTwoColumnTokens({
      slide: currentSlide as never,
      headMeta,
    }) as { left: TokenWithLines[]; right: TokenWithLines[] } | null
  }, [hasSlides, headMeta, safeActiveSlideId, slides])

  const slideBody = React.useMemo(
    () =>
      buildSlideBody({
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
      }),
    [
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
  } = getSlideVisualMeta(slideMeta, headMetaRecord)
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
  let baseFrameClass = 'rounded border border-gray-200 shadow bg-white'
  if (isAcademicTheme && !frameVariantRaw) {
    baseFrameClass = 'rounded bg-white'
  }
  if (frameVariant === 'borderless') {
    baseFrameClass = 'rounded bg-white'
  } else if (frameVariant === 'minimal') {
    baseFrameClass = 'rounded border border-gray-200 bg-white'
  } else if (frameVariant === 'dark') {
    baseFrameClass = 'rounded border border-gray-700 shadow bg-gray-900'
  } else if (frameVariant === 'auto') {
    if (rootThemeMode === 'dark') {
      baseFrameClass = 'rounded border border-gray-700 shadow bg-gray-900'
    } else {
      baseFrameClass = 'rounded border border-gray-200 shadow bg-white'
    }
  }

  React.useEffect(() => {
    lsSetBool(LS_KEYS.previewSlidesShowThumbnails, showSlideThumbnails)
  }, [showSlideThumbnails])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.previewSlidesShowNotes, showSpeakerNotes)
  }, [showSpeakerNotes])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return
      e.preventDefault()
      setShowSpeakerNotes(prev => !prev)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const [sidebarFocusSlideId, setSidebarFocusSlideId] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!isSlidesFullscreenOpen) {
      setSidebarFocusSlideId(null)
    }
  }, [isSlidesFullscreenOpen])

  const slideCount = orderedSlideIndices.length

  const focusSlideId = sidebarFocusSlideId ?? activeSlideId

  const notesTokens = React.useMemo(() => {
    if (!showSpeakerNotes) return null
    const slide = slides[safeActiveSlideId]
    if (!slide || !slide.notes) return null
    const raw = String(slide.notes || '').trim()
    if (!raw) return null
    const cleaned = raw.replace(/<!--/g, '').replace(/-->/g, '').trim()
    if (!cleaned) return null
    return lexMarkdownContent(cleaned, 0).tokens
  }, [safeActiveSlideId, showSpeakerNotes, slides])

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
    ],
  )

  return (
    <>
      <div
        ref={(el) => {
          containerRef.current = el
          rootRef(el)
        }}
        tabIndex={0}
        className={[
          'relative flex-1 min-h-0 w-full overflow-hidden bg-gray-100 outline-none flex flex-col',
          uiPanelTextFontClass,
        ].join(' ')}
        data-testid="markdown-presentation-root"
      >
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <div
            className="flex items-center justify-center"
            style={{
              width: `${Math.max(1, baseSlideSize.w * slideScale)}px`,
              height: `${Math.max(1, baseSlideSize.h * slideScale)}px`,
            }}
          >
            <div
              className="origin-top-left"
              style={{
                width: `${baseSlideSize.w}px`,
                height: `${baseSlideSize.h}px`,
                transform: `scale(${slideScale})`,
              }}
            >
              <SlideFrame
                frameClassName={[
                  'w-full h-full overflow-hidden',
                  baseFrameClass,
                  slideClass,
                ].filter(Boolean).join(' ')}
                slideStyle={slideStyle}
                slideTransitionStyle={slideTransitionStyle}
                slideOuterClass={slideOuterClass}
                slideContentClass={slideContentClass}
                onDoubleClick={() => setIsSlidesFullscreenOpen(true)}
              >
                {slideContent}
              </SlideFrame>
            </div>
          </div>
        </div>
        {notesTokens && notesTokens.length > 0 && (
          <div
            data-testid="markdown-presentation-notes"
            className="w-full max-h-48 overflow-auto border-t border-gray-200 bg-white"
          >
            <div className={['px-4 py-3 text-xs text-gray-800', uiPanelTextFontClass].filter(Boolean).join(' ')}>
              <MarkdownTokenRenderer
                tokens={notesTokens}
                activeDocumentPath={activeDocumentPath}
                highlightedLineRange={null}
                markdownWordWrap={true}
                markdownPresentationMode={false}
                uiPanelTextFontClass={uiPanelTextFontClass}
                uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                mermaidFrontmatterConfig={mermaidFrontmatterConfig}
                rootThemeMode={rootThemeMode}
                previewOverlayScope={previewOverlayScope}
                previewOverlayPortalTarget={previewOverlayPortalTarget}
                alwaysOnHighlightMode={false}
                alwaysOnTokenHighlights={null}
                markdownTextHighlight={false}
                selectionKind={null}
              />
            </div>
          </div>
        )}
      </div>
      <PreviewOverlay
        open={isSlidesFullscreenOpen}
        onClose={() => setIsSlidesFullscreenOpen(false)}
        scope={previewOverlayScope}
        portalTarget={previewOverlayPortalTarget}
      >
        <div className="w-full h-full flex">
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
          />
          <div className="flex-1 min-w-0 flex flex-col">
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
                >
                  {slideContent}
                </SlideFrame>
              </div>
            </ZoomPanViewport>
            {notesTokens && notesTokens.length > 0 && (
              <div className="w-full max-h-56 overflow-auto border-t border-gray-200 bg-white">
                <div className={['px-4 py-3 text-xs text-gray-800', uiPanelTextFontClass].filter(Boolean).join(' ')}>
                  <MarkdownTokenRenderer
                    tokens={notesTokens}
                    activeDocumentPath={activeDocumentPath}
                    highlightedLineRange={null}
                    markdownWordWrap={true}
                    markdownPresentationMode={false}
                    uiPanelTextFontClass={uiPanelTextFontClass}
                    uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                    mermaidFrontmatterConfig={mermaidFrontmatterConfig}
                    rootThemeMode={rootThemeMode}
                    previewOverlayScope={previewOverlayScope}
                    previewOverlayPortalTarget={previewOverlayPortalTarget}
                    alwaysOnHighlightMode={false}
                    alwaysOnTokenHighlights={null}
                    markdownTextHighlight={false}
                    selectionKind={null}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </PreviewOverlay>
    </>
  )
}
