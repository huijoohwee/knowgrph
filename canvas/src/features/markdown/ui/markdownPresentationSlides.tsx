import React from 'react'
import { LayoutPanelTop } from 'lucide-react'
import { UI_COPY } from '@/lib/config'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import { splitMarkdownLines } from '@/lib/markdown'
import { lexMarkdownContent, type TokenWithLines } from './markdownPreviewLex'
import { selectTokensInLineRange } from './markdownPreviewLexUtils'
import type { HighlightedLineRange, MarkdownGeoDatasetIntegration } from './MarkdownRendererTypes'
import type { MarkdownFragmentConfig } from './markdownPreviewFragments'
import { parseMermaidConfigFromFrontmatter } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { SlideHeader, SlideFooter } from './SlideParts'
import { 
  getSlideVisualMeta, 
  buildBackgroundStyle 
} from './markdownSlideVisuals'

export { 
  getSlideVisualMeta, 
  buildBackgroundStyle, 
  normalizeThemeStyle, 
  type SlideVisualMeta 
} from './markdownSlideVisuals'

const getSlidePrimaryHeading = (slideText: string): string => {
  const lines = splitMarkdownLines(slideText)
  for (const line of lines) {
    if (line.trim().startsWith('# ')) {
      return line.trim().replace(/^#\s+/, '')
    }
  }
  return ''
}

const buildTokenRendererProps = (
  tokens: TokenWithLines[],
  common: Omit<BuildSlideBodyArgs, 'twoColumnTokens' | 'slideTokens' | 'slides' | 'safeActiveSlideId' | 'hasSlides' | 'headMeta'>,
  _highlights: unknown,
  stickyHeadingTopClass?: string,
  stickyHeadingTopPx?: number,
) => ({
  tokens,
  activeDocumentPath: common.activeDocumentPath,
  highlightedLineRange: common.highlightedLineRange,
  markdownWordWrap: common.markdownWordWrap,
  markdownPresentationMode: true,
  uiPanelTextFontClass: common.uiPanelTextFontClass,
  uiPanelMonospaceTextClass: common.uiPanelMonospaceTextClass,
  mermaidFrontmatterConfig: common.mermaidFrontmatterConfig,
  rootThemeMode: common.rootThemeMode,
  previewOverlayScope: common.previewOverlayScope,
  previewOverlayPortalTarget: common.previewOverlayPortalTarget,
  markdownTextHighlight: common.markdownTextHighlight,
  selectionKind: common.selectionKind,
  highlightBackgroundColor: common.effectiveHighlightBackgroundColor,
  highlightUnderlineColor: common.effectiveHighlightUnderlineColor,
  fragmentsEnabled: common.activeFragmentConfig.enabled,
  fragmentStep: common.activeFragmentStep,
  fragmentClassNames: common.activeFragmentConfig.classNames,
  fragmentTags: common.activeFragmentConfig.tags,
  geoDatasetIntegration: common.geoDatasetIntegration,
  stickyHeadingTopClass,
  stickyHeadingTopPx,
})

export const getSlideTextBodyAndNotes = (
  slide: { text: string; notes: string | null },
): { text: string; body: string; notes: string } => {
  const text = String(slide.text || '')
  const notes = String(slide.notes || '').trim()
  const body = text.trim()
  return { text, body, notes }
}

export const buildSlideTransitionStyle = (
  activeTransitionKey: string,
  slideTransitionPhase: 'from' | 'to',
): React.CSSProperties => {
  const key = (activeTransitionKey || '').toLowerCase()
  if (!key || key === 'none') return {}
  const phase = slideTransitionPhase
  const base: React.CSSProperties = {
    transitionProperty: 'opacity, transform',
    transitionDuration: '280ms',
    transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
  }
  if (key === 'fade') {
    return {
      ...base,
      opacity: phase === 'from' ? 0 : 1,
      transform: 'none',
    }
  }
  if (key === 'slide-left') {
    return {
      ...base,
      opacity: phase === 'from' ? 0 : 1,
      transform: phase === 'from' ? 'translateX(48px)' : 'translateX(0px)',
    }
  }
  if (key === 'slide-right') {
    return {
      ...base,
      opacity: phase === 'from' ? 0 : 1,
      transform: phase === 'from' ? 'translateX(-48px)' : 'translateX(0px)',
    }
  }
  if (key === 'slide-up') {
    return {
      ...base,
      opacity: phase === 'from' ? 0 : 1,
      transform: phase === 'from' ? 'translateY(48px)' : 'translateY(0px)',
    }
  }
  if (key === 'slide-down') {
    return {
      ...base,
      opacity: phase === 'from' ? 0 : 1,
      transform: phase === 'from' ? 'translateY(-48px)' : 'translateY(0px)',
    }
  }
  if (key === 'zoom') {
    return {
      ...base,
      opacity: phase === 'from' ? 0 : 1,
      transform: phase === 'from' ? 'scale(0.94)' : 'scale(1)',
    }
  }
  return {
    ...base,
    opacity: phase === 'from' ? 0 : 1,
    transform: 'none',
  }
}

type Slide = {
  index: number
  text: string
  startLine: number
  endLine: number
  notes: string | null
  meta?: Record<string, unknown>
}

type TwoColumnTokens = {
  left: TokenWithLines[]
  right: TokenWithLines[]
} | null

export const buildTwoColumnTokens = (args: {
  slide: Slide
  headMeta: Record<string, unknown>
  fullDocTokens?: TokenWithLines[]
}): TwoColumnTokens => {
  const { slide, headMeta, fullDocTokens } = args
  const slideMeta = (slide.meta || {}) as Record<string, unknown>
  const headMetaRecord = headMeta as Record<string, unknown>
  const layoutRaw = String(slideMeta.layout || headMetaRecord.layout || '').trim().toLowerCase()
  if (layoutRaw !== 'two-cols') return null
  const { text, body } = getSlideTextBodyAndNotes(slide)
  if (!body) return null
  const lines = splitMarkdownLines(text)
  let splitIndex = -1
  for (let i = 0; i < lines.length; i += 1) {
    if ((lines[i] || '').trim() === '::right::') {
      splitIndex = i
      break
    }
  }
  const baseOffset = Math.max(0, (slide.startLine || 1) - 1)
  
  if (fullDocTokens) {
    if (splitIndex < 0) {
      const start = slide.startLine
      const end = slide.endLine
      const left = selectTokensInLineRange(fullDocTokens, start, end)
      return { left, right: [] }
    }
    const absSplitLine = baseOffset + 1 + splitIndex
    const start = slide.startLine
    const end = slide.endLine
    const left = selectTokensInLineRange(fullDocTokens, start, absSplitLine - 1)
    const right = selectTokensInLineRange(fullDocTokens, absSplitLine + 1, end)
    return { left, right }
  }

  if (splitIndex < 0) {
    const { tokens: leftTokens } = lexMarkdownContent(text, baseOffset)
    return { left: leftTokens, right: [] as TokenWithLines[] }
  }
  const leftLines = lines.slice(0, splitIndex)
  const rightLines = lines.slice(splitIndex + 1)
  const leftText = leftLines.join('\n')
  const rightText = rightLines.join('\n')
  const leftOffset = baseOffset
  const rightOffset = baseOffset + splitIndex + 1
  const { tokens: leftTokens } = lexMarkdownContent(leftText, leftOffset)
  const { tokens: rightTokens } = lexMarkdownContent(rightText, rightOffset)
  return { left: leftTokens, right: rightTokens }
}

type BuildSlideBodyArgs = {
  hasSlides: boolean
  slides: Slide[]
  safeActiveSlideId: number
  twoColumnTokens: TwoColumnTokens
  slideTokens: TokenWithLines[] | null
  headMeta: Record<string, unknown>
  activeDocumentPath: string
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  markdownTextHighlight: boolean
  selectionKind: 'node' | 'edge' | null
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  uiPanelMicroLabelTextSizeClass: string
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget: HTMLElement | null
  activeFragmentConfig: MarkdownFragmentConfig
  activeFragmentStep: number
  mermaidFrontmatterConfig: Record<string, unknown> | null
  rootThemeMode: 'light' | 'dark'
  effectiveHighlightBackgroundColor: string | null
  effectiveHighlightUnderlineColor: string | null
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration
}

export const buildSlideBody = (args: BuildSlideBodyArgs): React.ReactNode => {
  const {
    hasSlides,
    slides,
    safeActiveSlideId,
    twoColumnTokens,
    slideTokens,
    headMeta,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    uiPanelMicroLabelTextSizeClass,
    mermaidFrontmatterConfig,
  } = args

  if (!hasSlides) {
    return (
      <section className="w-full h-full flex items-center justify-center px-8 py-10 bg-gray-50" aria-label="Presentation Empty State">
        <div
          className={[
            'inline-flex flex-col items-center justify-center rounded-md border border-dashed border-blue-200/80 bg-white/70 px-4 py-3 text-center text-xs text-gray-600',
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
              <LayoutPanelTop className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden={true} />
            </div>
            <div className="font-medium text-blue-700">
              {UI_COPY.markdownPresentationEmptyTitle}
            </div>
          </div>
          <div className="mt-1 text-[11px] text-gray-600">
            {UI_COPY.markdownPresentationEmptyBody}
          </div>
        </div>
      </section>
    )
  }

  const currentSlide = slides[safeActiveSlideId]
  if (!currentSlide) return null
  const slideMeta = (currentSlide.meta || {}) as Record<string, unknown>
  const headMetaRecord = headMeta as Record<string, unknown>
  
  const visualMeta = getSlideVisualMeta(slideMeta, headMetaRecord, uiPanelTextFontClass)
  const { layout } = visualMeta
  const slideHeading = getSlidePrimaryHeading(currentSlide.text)
  const headerNode = (
    <SlideHeader
      meta={visualMeta}
      heading={slideHeading}
      page={safeActiveSlideId + 1}
      total={slides.length}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
    />
  )
  
  let stickyHeadingTopPx = 0
  if (headerNode) {
    if (visualMeta.themeStyle === 'academic') {
      stickyHeadingTopPx = 40 // 40px (h-10)
    } else {
      stickyHeadingTopPx = 32 // 32px (h-8)
    }
  }

  const slideMermaidConfig = parseMermaidConfigFromFrontmatter(currentSlide.meta || {})
  const effectiveMermaidConfig = slideMermaidConfig || mermaidFrontmatterConfig
  
  let content: React.ReactNode = null

  if (layout === 'two-cols' && twoColumnTokens) {
    content = (
      <section className="w-full h-full grid grid-cols-2 gap-8" aria-label="Slide Columns">
        <section className="w-full h-full px-8 pt-10 pb-14 overflow-auto" aria-label="Slide Left Column">
          <MarkdownTokenRenderer
            {...buildTokenRendererProps(twoColumnTokens.left, args, null, undefined, stickyHeadingTopPx)}
            mermaidFrontmatterConfig={effectiveMermaidConfig}
          />
        </section>
        <section className="w-full h-full px-8 pt-10 pb-14 overflow-auto" aria-label="Slide Right Column">
          <MarkdownTokenRenderer
            {...buildTokenRendererProps(twoColumnTokens.right, args, null, undefined, stickyHeadingTopPx)}
            mermaidFrontmatterConfig={effectiveMermaidConfig}
          />
        </section>
      </section>
    )
  } else if (slideTokens) {
    const slideOuterClass =
      layout === 'center'
        ? 'w-full h-full flex flex-col items-center justify-center relative'
        : 'w-full h-full flex flex-col relative'
    const slideContentClass =
      layout === 'center'
        ? 'flex-1 min-h-0 w-full max-w-full overflow-y-auto px-16 py-12 mx-auto flex flex-col items-center justify-center pb-16'
        : 'flex-1 min-h-0 w-full px-16 py-12 overflow-y-auto pb-16'

    content = (
      <section className={slideOuterClass} aria-label="Slide Body">
        <main className={slideContentClass} aria-label="Slide Content">
          <MarkdownTokenRenderer
            {...buildTokenRendererProps(
              slideTokens,
              args,
              null,
              undefined,
              stickyHeadingTopPx,
            )}
            mermaidFrontmatterConfig={effectiveMermaidConfig}
          />
        </main>
      </section>
    )
  }

  if (!content) return null

  return (
    <section className="w-full h-full relative pb-14" aria-label="Slide Document">
      {headerNode}
      {content}
      <SlideFooter
        meta={visualMeta}
        page={safeActiveSlideId + 1}
        total={slides.length}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      />
    </section>
  )
}

type BuildSlidePreviewArgs = {
  slideIdx: number
  slides: Slide[]
  headMeta: Record<string, unknown>
  activeDocumentPath: string
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  uiPanelMicroLabelTextSizeClass?: string
  mermaidFrontmatterConfig: Record<string, unknown> | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget: HTMLElement | null
  fullDocTokens?: TokenWithLines[]
}

export const buildSlidePreview = (args: BuildSlidePreviewArgs): React.ReactNode => {
  const {
    slideIdx,
    slides,
    headMeta,
    activeDocumentPath,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    uiPanelMicroLabelTextSizeClass: uiPanelMicroLabelTextSizeClassRaw,
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    fullDocTokens,
  } = args
  const uiPanelMicroLabelTextSizeClass = uiPanelMicroLabelTextSizeClassRaw || 'text-[10px]'

  const slide = slides[slideIdx]
  if (!slide) return null
  const slideMeta = (slide.meta || {}) as Record<string, unknown>
  const headMetaRecord = headMeta as Record<string, unknown>
  const {
    slideClass,
    layout: layoutPreview,
    backgroundRaw: backgroundRawPreview,
    backgroundSize: backgroundSizePreview,
    backgroundPosition: backgroundPositionPreview,
  } = getSlideVisualMeta(slideMeta, headMetaRecord, uiPanelTextFontClass)
  const stickyHeadingTopClass = 'top-0'
  const stickyHeadingTopPx = 0
  const slideStylePreview = buildBackgroundStyle(
    activeDocumentPath,
    backgroundRawPreview,
    backgroundSizePreview,
    backgroundPositionPreview,
  )
  const slideClassPreview = slideClass
  const { text, body } = getSlideTextBodyAndNotes(slide)
  if (!body) return null
  const commonProps = {
    activeDocumentPath,
    highlightedLineRange: null,
    markdownWordWrap: false,
    markdownPresentationMode: true,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    uiPanelMicroLabelTextSizeClass,
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    markdownTextHighlight: false,
    selectionKind: null as 'node' | 'edge' | null,
    effectiveHighlightBackgroundColor: null,
    effectiveHighlightUnderlineColor: null,
    activeFragmentConfig: { enabled: false, classNames: [], tags: [], steps: 0 },
    activeFragmentStep: 0,
  }

  if (layoutPreview === 'two-cols') {
    const twoColumnTokens = buildTwoColumnTokens({ slide, headMeta, fullDocTokens })
    if (!twoColumnTokens) return null
    const leftTokens = twoColumnTokens.left
    const rightTokens = twoColumnTokens.right
    if (!leftTokens.length && !rightTokens.length) return null
    return (
      <div
        className={[
          'w-full rounded border border-gray-200 bg-white overflow-hidden',
          slideClassPreview,
        ].filter(Boolean).join(' ')}
        style={slideStylePreview}
      >
        <div className="w-full h-full grid grid-cols-2 gap-2">
          <div className="w-full h-full px-2 py-2 overflow-hidden">
            <MarkdownTokenRenderer
              {...buildTokenRendererProps(leftTokens, commonProps, null, stickyHeadingTopClass, stickyHeadingTopPx)}
            />
          </div>
          <div className="w-full h-full px-2 py-2 overflow-hidden">
            <MarkdownTokenRenderer
              {...buildTokenRendererProps(rightTokens, commonProps, null, stickyHeadingTopClass, stickyHeadingTopPx)}
            />
          </div>
        </div>
      </div>
    )
  }
  const slideOuterClassPreview =
    layoutPreview === 'center'
      ? 'w-full h-full flex items-center justify-center'
      : 'w-full h-full flex'
  const slideContentClassPreview =
    layoutPreview === 'center'
      ? 'max-w-full max-h-full px-4 py-3 overflow-hidden mx-auto flex items-center justify-center pb-8'
      : 'w-full h-full px-4 py-3 overflow-hidden pb-8'
  const tokens = fullDocTokens
    ? selectTokensInLineRange(fullDocTokens, slide.startLine, slide.endLine)
    : lexMarkdownContent(text, Math.max(0, (slide.startLine || 1) - 1)).tokens
  if (!tokens || !tokens.length) return null
  return (
    <div
      className={[
        'w-full rounded border border-gray-200 bg-white overflow-hidden',
        slideClassPreview,
      ].filter(Boolean).join(' ')}
      style={slideStylePreview}
    >
      <div className={slideOuterClassPreview}>
        <div className={slideContentClassPreview}>
          <MarkdownTokenRenderer
            {...buildTokenRendererProps(tokens, commonProps, null, stickyHeadingTopClass, stickyHeadingTopPx)}
          />
        </div>
      </div>
    </div>
  )
}
