import React from 'react'
import { LS_KEYS } from '@/lib/config'
import PreviewGallery from '@/features/panels/views/preview-panel/ui/PreviewGallery'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import { splitMarkdownLines } from '@/lib/markdown'
import { lexMarkdownContent, type TokenWithLines } from './markdownPreviewLex'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import type { MarkdownFragmentConfig } from './markdownPreviewFragments'
import { parseMermaidConfigFromFrontmatter } from '@/features/panels/views/preview-panel/ui/mermaidConfig'

type MarkdownPreviewPresentationProps = {
  rootRef: (el: HTMLDivElement | null) => void
  onRegisterFullscreenHandler?: (fn: (() => void) | null) => void
  headMeta: Record<string, unknown>
  slides: Array<{
    text: string
    startLine: number
    endLine: number
    meta?: Record<string, unknown>
  }>
  activeSlideId: number
  orderedSlideIndices: number[]
  activeSlideIndex: number
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
  const containerRef = React.useRef<HTMLDivElement | null>(null)

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

  const slideTokens = React.useMemo(() => {
    const currentSlide = slides[activeSlideId]
    if (!currentSlide) return null
    const out = lexMarkdownContent(
      currentSlide.text || '',
      Math.max(0, (currentSlide.startLine || 1) - 1),
    )
    return out.tokens
  }, [activeSlideId, slides])

  const twoColumnTokens = React.useMemo(() => {
    const currentSlide = slides[activeSlideId]
    if (!currentSlide) return null
    const slideMeta = (currentSlide.meta || {}) as Record<string, unknown>
    const headMetaRecord = headMeta as Record<string, unknown>
    const layoutRaw = String(slideMeta.layout || headMetaRecord.layout || '').trim().toLowerCase()
    if (layoutRaw !== 'two-cols') return null
    const rawText = currentSlide.text || ''
    const lines = splitMarkdownLines(rawText)
    let splitIndex = -1
    for (let i = 0; i < lines.length; i += 1) {
      if ((lines[i] || '').trim() === '::right::') {
        splitIndex = i
        break
      }
    }
    if (splitIndex < 0) {
      const baseOffset = Math.max(0, (currentSlide.startLine || 1) - 1)
      const { tokens: leftTokens } = lexMarkdownContent(rawText, baseOffset)
      return { left: leftTokens, right: [] as TokenWithLines[] }
    }
    const leftLines = lines.slice(0, splitIndex)
    const rightLines = lines.slice(splitIndex + 1)
    const leftText = leftLines.join('\n')
    const rightText = rightLines.join('\n')
    const baseOffset = Math.max(0, (currentSlide.startLine || 1) - 1)
    const leftOffset = baseOffset
    const rightOffset = baseOffset + splitIndex + 1
    const { tokens: leftTokens } = lexMarkdownContent(leftText, leftOffset)
    const { tokens: rightTokens } = lexMarkdownContent(rightText, rightOffset)
    return { left: leftTokens, right: rightTokens }
  }, [activeSlideId, headMeta, slides])

  const slideBody = React.useMemo(() => {
    const currentSlide = slides[activeSlideId]
    if (!currentSlide) return null
    const slideMeta = (currentSlide.meta || {}) as Record<string, unknown>
    const headMetaRecord = headMeta as Record<string, unknown>
    const layoutRaw = String(slideMeta.layout || headMetaRecord.layout || '').trim().toLowerCase()
    if (layoutRaw === 'two-cols' && twoColumnTokens) {
      const leftHighlights = buildAlwaysOnTokenHighlights(twoColumnTokens.left)
      const rightHighlights = buildAlwaysOnTokenHighlights(twoColumnTokens.right)
      const slideMermaidConfig = parseMermaidConfigFromFrontmatter(currentSlide.meta || {})
      return (
        <div className="w-full h-full grid grid-cols-2 gap-8">
          <div className="w-full h-full px-8 py-8 overflow-auto">
            <MarkdownTokenRenderer
              tokens={twoColumnTokens.left}
              activeDocumentPath={activeDocumentPath}
              highlightedLineRange={highlightedLineRange}
              markdownWordWrap={markdownWordWrap}
              markdownPresentationMode={true}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
              mermaidFrontmatterConfig={slideMermaidConfig || mermaidFrontmatterConfig}
              rootThemeMode={rootThemeMode}
              previewOverlayScope={previewOverlayScope}
              previewOverlayPortalTarget={previewOverlayPortalTarget}
              alwaysOnHighlightMode={alwaysOnHighlightMode}
              alwaysOnTokenHighlights={leftHighlights}
              markdownTextHighlight={markdownTextHighlight}
              selectionKind={selectionKind}
              highlightBackgroundColor={effectiveHighlightBackgroundColor}
              highlightUnderlineColor={effectiveHighlightUnderlineColor}
            />
          </div>
          <div className="w-full h-full px-8 py-8 overflow-auto">
            <MarkdownTokenRenderer
              tokens={twoColumnTokens.right}
              activeDocumentPath={activeDocumentPath}
              highlightedLineRange={highlightedLineRange}
              markdownWordWrap={markdownWordWrap}
              markdownPresentationMode={true}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
              mermaidFrontmatterConfig={slideMermaidConfig || mermaidFrontmatterConfig}
              rootThemeMode={rootThemeMode}
              previewOverlayScope={previewOverlayScope}
              previewOverlayPortalTarget={previewOverlayPortalTarget}
              alwaysOnHighlightMode={alwaysOnHighlightMode}
              alwaysOnTokenHighlights={rightHighlights}
              markdownTextHighlight={markdownTextHighlight}
              selectionKind={selectionKind}
              highlightBackgroundColor={effectiveHighlightBackgroundColor}
              highlightUnderlineColor={effectiveHighlightUnderlineColor}
            />
          </div>
        </div>
      )
    }
    if (!slideTokens) return null
    const slideMermaidConfig = parseMermaidConfigFromFrontmatter(currentSlide?.meta || {})
    return (
      <MarkdownTokenRenderer
        tokens={slideTokens}
        activeDocumentPath={activeDocumentPath}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={true}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        mermaidFrontmatterConfig={slideMermaidConfig || mermaidFrontmatterConfig}
        rootThemeMode={rootThemeMode}
        previewOverlayScope={previewOverlayScope}
        previewOverlayPortalTarget={previewOverlayPortalTarget}
        alwaysOnHighlightMode={alwaysOnHighlightMode}
        alwaysOnTokenHighlights={buildAlwaysOnTokenHighlights(slideTokens)}
        markdownTextHighlight={markdownTextHighlight}
        selectionKind={selectionKind}
        highlightBackgroundColor={effectiveHighlightBackgroundColor}
        highlightUnderlineColor={effectiveHighlightUnderlineColor}
        fragmentsEnabled={activeFragmentConfig.enabled}
        fragmentStep={activeFragmentStep}
        fragmentClassNames={activeFragmentConfig.classNames}
        fragmentTags={activeFragmentConfig.tags}
      />
    )
  }, [
    activeDocumentPath,
    activeFragmentConfig.classNames,
    activeFragmentConfig.enabled,
    activeFragmentConfig.tags,
    activeFragmentStep,
    activeSlideId,
    alwaysOnHighlightMode,
    buildAlwaysOnTokenHighlights,
    effectiveHighlightBackgroundColor,
    effectiveHighlightUnderlineColor,
    headMeta,
    highlightedLineRange,
    markdownTextHighlight,
    markdownWordWrap,
    mermaidFrontmatterConfig,
    previewOverlayPortalTarget,
    previewOverlayScope,
    rootThemeMode,
    selectionKind,
    slideTokens,
    slides,
    twoColumnTokens,
    uiPanelMonospaceTextClass,
    uiPanelTextFontClass,
  ])

  const slideMeta = (slides[activeSlideId]?.meta || {}) as Record<string, unknown>
  const headMetaRecord = headMeta as Record<string, unknown>
  const slideClass = String(slideMeta.class || headMetaRecord.class || '').trim()
  const layoutRaw = String(slideMeta.layout || headMetaRecord.layout || '').trim().toLowerCase()
  const backgroundRaw = String(slideMeta.background || headMetaRecord.background || '').trim()
  const backgroundSize = String(slideMeta.backgroundSize || headMetaRecord.backgroundSize || '').trim() || 'cover'
  const backgroundPosition =
    String(slideMeta.backgroundPosition || headMetaRecord.backgroundPosition || '').trim() || 'center'
  const slideStyle: React.CSSProperties = {}
  if (backgroundRaw) {
    if (
      backgroundRaw.startsWith('#') ||
      backgroundRaw.toLowerCase().startsWith('rgb') ||
      backgroundRaw.toLowerCase().startsWith('hsl') ||
      backgroundRaw.toLowerCase().includes('gradient(')
    ) {
      slideStyle.background = backgroundRaw
    } else {
      slideStyle.backgroundImage = `url(${backgroundRaw})`
      slideStyle.backgroundSize = backgroundSize
      slideStyle.backgroundPosition = backgroundPosition
    }
  }
  const layout = layoutRaw
  const slideOuterClass =
    layout === 'center'
      ? 'w-full h-full flex items-center justify-center'
      : 'w-full h-full flex'
  const slideContentClass =
    layout === 'center'
      ? 'max-w-4xl max-h-full px-12 py-10 overflow-auto mx-auto flex items-center justify-center'
      : 'w-full h-full px-12 py-10 overflow-auto'
  const slideContent = slideBody

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
              <div
                className={[
                  'w-full h-full rounded border border-gray-200 shadow bg-white overflow-hidden',
                  slideClass,
                ].filter(Boolean).join(' ')}
                style={slideStyle}
                onDoubleClick={() => setIsSlidesFullscreenOpen(true)}
              >
                <div className={slideOuterClass}>
                  <div className={slideContentClass}>
                    {slideContent}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PreviewOverlay
        open={isSlidesFullscreenOpen}
        onClose={() => setIsSlidesFullscreenOpen(false)}
        scope={previewOverlayScope}
        portalTarget={previewOverlayPortalTarget}
      >
        <div className="w-full h-full flex">
          <div className="w-60 shrink-0 border-r border-gray-200 bg-white overflow-auto">
            <PreviewGallery
              items={orderedSlideIndices.map((slideIdx, i) => ({ id: String(slideIdx), label: `Slide ${i + 1}` }))}
              activeId={String(activeSlideId)}
              onSelect={(id) => {
                const idx = Number.parseInt(id, 10)
                if (!Number.isFinite(idx)) return
                const pos = orderedSlideIndices.indexOf(idx)
                if (pos < 0) return
                setActiveSlideIndex(pos)
              }}
              onReorder={(nextIds) => {
                const next = nextIds.map(x => Number.parseInt(x, 10)).filter(n => Number.isFinite(n))
                const nextOrder = next.length ? next : slideOrder
                setSlideOrder(nextOrder)
                const nextPos = nextOrder.indexOf(activeSlideId)
                if (nextPos >= 0) setActiveSlideIndex(nextPos)
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <ZoomPanViewport
              open={isSlidesFullscreenOpen}
              storageKey={LS_KEYS.previewZoomPanSlides}
              getContentSize={() => ({ w: baseSlideSize.w, h: baseSlideSize.h })}
              fitOnOpen
            >
              <div style={{ width: `${baseSlideSize.w}px`, height: `${baseSlideSize.h}px` }}>
                <div
                  className={[
                    'w-full h-full rounded border border-gray-200 shadow bg-white overflow-hidden',
                    slideClass,
                  ].filter(Boolean).join(' ')}
                  style={slideStyle}
                >
                  <div className={slideOuterClass}>
                    <div className={slideContentClass}>
                      {slideContent}
                    </div>
                  </div>
                </div>
              </div>
            </ZoomPanViewport>
          </div>
        </div>
      </PreviewOverlay>
    </>
  )
}
