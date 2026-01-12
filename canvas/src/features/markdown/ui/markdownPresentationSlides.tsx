import React from 'react'
import { LayoutPanelTop } from 'lucide-react'
import { UI_COPY } from '@/lib/config'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import { splitMarkdownLines } from '@/lib/markdown'
import { lexMarkdownContent, type TokenWithLines } from './markdownPreviewLex'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import type { MarkdownFragmentConfig } from './markdownPreviewFragments'
import { parseMermaidConfigFromFrontmatter } from '@/features/panels/views/preview-panel/ui/mermaidConfig'

type SlideVisualMeta = {
  slideClass: string
  layout: string
  backgroundRaw: string
  backgroundSize: string
  backgroundPosition: string
}

export const buildBackgroundStyle = (
  raw: string,
  size: string,
  position: string,
): React.CSSProperties => {
  const style: React.CSSProperties = {}
  const value = raw.trim()
  if (!value) return style
  const lower = value.toLowerCase()
  if (
    value.startsWith('#') ||
    lower.startsWith('rgb') ||
    lower.startsWith('hsl') ||
    lower.includes('gradient(')
  ) {
    style.background = value
  } else {
    style.backgroundImage = `url(${value})`
    style.backgroundSize = size
    style.backgroundPosition = position
  }
  return style
}

export const getSlideVisualMeta = (
  slideMeta: Record<string, unknown>,
  headMetaRecord: Record<string, unknown>,
): SlideVisualMeta => {
  const slideClass = String(slideMeta.class || headMetaRecord.class || '').trim()
  const layout = String(slideMeta.layout || headMetaRecord.layout || '').trim().toLowerCase()
  const backgroundRaw = String(slideMeta.background || headMetaRecord.background || '').trim()
  const backgroundSize =
    String(slideMeta.backgroundSize || headMetaRecord.backgroundSize || '').trim() || 'cover'
  const backgroundPosition =
    String(slideMeta.backgroundPosition || headMetaRecord.backgroundPosition || '').trim() || 'center'
  return { slideClass, layout, backgroundRaw, backgroundSize, backgroundPosition }
}

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
}): TwoColumnTokens => {
  const { slide, headMeta } = args
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
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget: HTMLElement | null
  alwaysOnHighlightMode: boolean
  buildAlwaysOnTokenHighlights: (tokens: TokenWithLines[] | null) => Array<{
    textColor: string | null
    underlineColor: string | null
    backgroundColor: string | null
  }> | null
  activeFragmentConfig: MarkdownFragmentConfig
  activeFragmentStep: number
  mermaidFrontmatterConfig: Record<string, unknown> | null
  rootThemeMode: 'light' | 'dark'
  effectiveHighlightBackgroundColor: string | null
  effectiveHighlightUnderlineColor: string | null
}

export const buildSlideBody = (args: BuildSlideBodyArgs): React.ReactNode => {
  const {
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
  } = args

  if (!hasSlides) {
    return (
      <div className="w-full h-full flex items-center justify-center px-8 py-10 bg-gray-50">
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
      </div>
    )
  }

  const currentSlide = slides[safeActiveSlideId]
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
            fragmentsEnabled={activeFragmentConfig.enabled}
            fragmentStep={activeFragmentStep}
            fragmentClassNames={activeFragmentConfig.classNames}
            fragmentTags={activeFragmentConfig.tags}
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
            fragmentsEnabled={activeFragmentConfig.enabled}
            fragmentStep={activeFragmentStep}
            fragmentClassNames={activeFragmentConfig.classNames}
            fragmentTags={activeFragmentConfig.tags}
          />
        </div>
      </div>
    )
  }
  if (!slideTokens) return null
  const slideMermaidConfig = parseMermaidConfigFromFrontmatter(currentSlide.meta || {})
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
}

type BuildSlidePreviewArgs = {
  slideIdx: number
  slides: Slide[]
  headMeta: Record<string, unknown>
  activeDocumentPath: string
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  mermaidFrontmatterConfig: Record<string, unknown> | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget: HTMLElement | null
}

export const buildSlidePreview = (args: BuildSlidePreviewArgs): React.ReactNode => {
  const {
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
  } = args

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
  } = getSlideVisualMeta(slideMeta, headMetaRecord)
  const slideStylePreview = buildBackgroundStyle(
    backgroundRawPreview,
    backgroundSizePreview,
    backgroundPositionPreview,
  )
  const slideClassPreview = slideClass
  const { text, body } = getSlideTextBodyAndNotes(slide)
  if (!body) return null
  if (layoutPreview === 'two-cols') {
    const twoColumnTokens = buildTwoColumnTokens({ slide, headMeta })
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
              tokens={leftTokens}
              activeDocumentPath={activeDocumentPath}
              highlightedLineRange={null}
              markdownWordWrap={false}
              markdownPresentationMode={true}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
              mermaidFrontmatterConfig={mermaidFrontmatterConfig}
              rootThemeMode={rootThemeMode}
              previewOverlayScope={previewOverlayScope}
              previewOverlayPortalTarget={previewOverlayPortalTarget}
              markdownTextHighlight={false}
              selectionKind={null}
              highlightBackgroundColor={null}
              highlightUnderlineColor={null}
              alwaysOnHighlightMode={false}
              alwaysOnTokenHighlights={null}
            />
          </div>
          <div className="w-full h-full px-2 py-2 overflow-hidden">
            <MarkdownTokenRenderer
              tokens={rightTokens}
              activeDocumentPath={activeDocumentPath}
              highlightedLineRange={null}
              markdownWordWrap={false}
              markdownPresentationMode={true}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
              mermaidFrontmatterConfig={mermaidFrontmatterConfig}
              rootThemeMode={rootThemeMode}
              previewOverlayScope={previewOverlayScope}
              previewOverlayPortalTarget={previewOverlayPortalTarget}
              markdownTextHighlight={false}
              selectionKind={null}
              highlightBackgroundColor={null}
              highlightUnderlineColor={null}
              alwaysOnHighlightMode={false}
              alwaysOnTokenHighlights={null}
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
      ? 'max-w-full max-h-full px-4 py-3 overflow-hidden mx-auto flex items-center justify-center'
      : 'w-full h-full px-4 py-3 overflow-hidden'
  const out = lexMarkdownContent(
    text,
    Math.max(0, (slide.startLine || 1) - 1),
  )
  const tokens = out.tokens
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
            tokens={tokens}
            activeDocumentPath={activeDocumentPath}
            highlightedLineRange={null}
            markdownWordWrap={false}
            markdownPresentationMode={true}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
            mermaidFrontmatterConfig={mermaidFrontmatterConfig}
            rootThemeMode={rootThemeMode}
            previewOverlayScope={previewOverlayScope}
            previewOverlayPortalTarget={previewOverlayPortalTarget}
            markdownTextHighlight={false}
            selectionKind={null}
            highlightBackgroundColor={null}
            highlightUnderlineColor={null}
            alwaysOnHighlightMode={false}
            alwaysOnTokenHighlights={null}
          />
        </div>
      </div>
    </div>
  )
}
