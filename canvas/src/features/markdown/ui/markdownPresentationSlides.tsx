import React from 'react'
import { LayoutPanelTop } from 'lucide-react'
import { UI_COPY } from '@/lib/config'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import { splitMarkdownLines } from '@/lib/markdown'
import { lexMarkdownContent, type TokenWithLines } from './markdownPreviewLex'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import type { MarkdownFragmentConfig } from './markdownPreviewFragments'
import { parseMermaidConfigFromFrontmatter } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type SlideVisualMeta = {
  slideClass: string
  layout: string
  backgroundRaw: string
  backgroundSize: string
  backgroundPosition: string
  authors: string[]
  meeting: string
  date: string
  venue: string
  url: string
  themeStyle: string
  institution: string
}

export const normalizeThemeStyle = (raw: string): 'default' | 'academic' => {
  const t = raw.trim().toLowerCase()
  if (t === 'academic') return 'academic'
  return 'default'
}

const getThemeBaseSlideClass = (themeStyle: string) => {
  if (themeStyle === 'academic') {
    return `${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} tracking-tight`
  }
  return ''
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
  uiPanelTextFontClass: string,
): SlideVisualMeta => {
  const slideClassRaw = String(slideMeta.class || headMetaRecord.class || '').trim()
  const layout = String(slideMeta.layout || headMetaRecord.layout || '').trim().toLowerCase()
  const backgroundRaw = String(slideMeta.background || headMetaRecord.background || '').trim()
  const backgroundSize =
    String(slideMeta.backgroundSize || headMetaRecord.backgroundSize || '').trim() || 'cover'
  const backgroundPosition =
    String(slideMeta.backgroundPosition || headMetaRecord.backgroundPosition || '').trim() || 'center'
  
  const authorsRaw = slideMeta.authors || headMetaRecord.authors || []
  const authors = Array.isArray(authorsRaw) ? authorsRaw.map(String) : [String(authorsRaw)].filter(Boolean)
  const meeting = String(slideMeta.meeting || headMetaRecord.meeting || '').trim()
  const date = String(slideMeta.date || headMetaRecord.date || '').trim()
  const venue = String(slideMeta.venue || headMetaRecord.venue || '').trim()
  const url = String(slideMeta.url || headMetaRecord.url || '').trim()
  const themeStyle = normalizeThemeStyle(String(slideMeta.theme || headMetaRecord.theme || ''))
  const institution = String(slideMeta.institution || headMetaRecord.institution || '').trim()
  const themeBaseClass = getThemeBaseSlideClass(themeStyle)
  const slideClass = [themeBaseClass, uiPanelTextFontClass, slideClassRaw].filter(Boolean).join(' ')

  return {
    slideClass,
    layout,
    backgroundRaw,
    backgroundSize,
    backgroundPosition,
    authors,
    meeting,
    date,
    venue,
    url,
    themeStyle,
    institution,
  }
}

const buildSlideFooter = (args: {
  meta: SlideVisualMeta
  page: number
  total: number
  uiPanelTextFontClass: string
}): React.ReactNode => {
  const { meta, page, total, uiPanelTextFontClass } = args
  if (
    !meta.authors.length &&
    !meta.meeting &&
    !meta.date &&
    !meta.venue &&
    !meta.url &&
    !meta.institution &&
    meta.themeStyle !== 'academic'
  )
    return null

  if (meta.layout === 'cover' || meta.layout === 'intro') return null

  if (meta.themeStyle === 'academic') {
    return (
      <div
        className={`fixed bottom-0 left-0 w-full h-10 px-8 flex justify-between items-center text-xs ${UI_THEME_TOKENS.panel.bg}/95 border-t ${UI_THEME_TOKENS.panel.border} z-10 ${uiPanelTextFontClass}`}
      >
        <div className="min-w-0 flex items-center gap-4">
          {meta.meeting && (
            <span className={`min-w-0 font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>
              {meta.meeting}
            </span>
          )}
          {meta.authors.length > 0 && (
            <span className={`hidden sm:inline-block min-w-0 ${UI_THEME_TOKENS.text.secondary} truncate`}>
              {meta.authors.join(', ')}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-3 ${UI_THEME_TOKENS.text.secondary}`}>
          {(meta.institution || meta.venue) && (
            <span className={`hidden md:inline-block font-medium ${UI_THEME_TOKENS.text.primary} truncate max-w-[28rem]`}>
              {[meta.institution, meta.venue].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className={`font-mono ${UI_THEME_TOKENS.text.tertiary} tabular-nums`}>
            {page} <span className={`mx-1 ${UI_THEME_TOKENS.text.tertiary}`}>/</span> {total}
          </span>
        </div>
      </div>
    )
  }

  const footer = (
    <footer className="fixed bottom-0 left-0 w-full px-4 py-2 text-[10px] text-gray-500 dark:text-gray-500 bg-white dark:bg-[#0d1117] border-t border-gray-200 dark:border-gray-700 flex justify-between items-center z-10 font-sans">
      <div className="flex gap-3">
        {!!meta.meeting && <span>{meta.meeting}</span>}
        {!!meta.venue && <span>{meta.venue}</span>}
        {!!meta.institution && <span>{meta.institution}</span>}
        {!!meta.date && <span>{meta.date}</span>}
      </div>
      <div className="flex gap-3">
        {meta.authors.length > 0 && <span>{meta.authors.join(', ')}</span>}
        {!!meta.url && (
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-blue-600 dark:text-blue-400"
          >
            {meta.url.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>
      <div className="font-mono opacity-60">
        {page} / {total}
      </div>
    </footer>
  )

  return footer
}

const getSlidePrimaryHeading = (slideText: string): string => {
  const lines = splitMarkdownLines(String(slideText || ''))
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] || ''
    const trimmed = raw.trim()
    if (!trimmed.startsWith('#')) continue
    const heading = trimmed.replace(/^#+\s*/, '').trim()
    if (!heading) continue
    if (heading.length <= 80) return heading
    return `${heading.slice(0, 77)}...`
  }
  return ''
}

const buildSlideHeader = (args: {
  meta: SlideVisualMeta
  heading: string
  page: number
  total: number
  uiPanelTextFontClass: string
}): React.ReactNode => {
  const { meta, heading, page, total, uiPanelTextFontClass } = args
  if (
    !heading &&
    !meta.authors.length &&
    !meta.meeting &&
    !meta.date &&
    !meta.venue &&
    !meta.url &&
    !meta.institution &&
    meta.themeStyle !== 'academic'
  )
    return null

  if (meta.layout === 'cover' || meta.layout === 'intro') return null

  if (meta.themeStyle === 'academic') {
    return (
      <div
        className={`absolute top-0 left-0 w-full h-10 px-8 flex justify-between items-center text-xs ${UI_THEME_TOKENS.panel.bg}/95 border-b ${UI_THEME_TOKENS.panel.border} z-20 ${uiPanelTextFontClass}`}
      >
        <div className="min-w-0 flex items-center gap-4">
          {heading ? (
            <span className={`min-w-0 font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>
              {heading}
            </span>
          ) : meta.meeting ? (
            <span className={`min-w-0 font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>
              {meta.meeting}
            </span>
          ) : null}
        </div>
        <div className={`flex items-center gap-3 ${UI_THEME_TOKENS.text.secondary}`}>
          <span className={`font-mono ${UI_THEME_TOKENS.text.tertiary} tabular-nums`}>
            {page} <span className={`mx-1 ${UI_THEME_TOKENS.text.tertiary}`}>/</span> {total}
          </span>
        </div>
      </div>
    )
  }

  return (
    <header
      className={[
        'fixed top-0 left-0 w-full px-4 py-2 text-[10px] border-b flex justify-between items-center z-20 font-sans',
        UI_THEME_TOKENS.text.tertiary,
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
      ].join(' ')}
    >
      <div className="flex gap-3 min-w-0">
        {heading ? <span className="truncate">{heading}</span> : null}
        {!heading && meta.meeting ? <span className="truncate">{meta.meeting}</span> : null}
      </div>
      <div className="font-mono opacity-60">
        {page} / {total}
      </div>
    </header>
  )
}

const buildTokenRendererProps = (
  tokens: TokenWithLines[],
  common: Omit<BuildSlideBodyArgs, 'twoColumnTokens' | 'slideTokens' | 'slides' | 'safeActiveSlideId' | 'hasSlides' | 'headMeta' | 'buildAlwaysOnTokenHighlights'>,
  highlights: Array<{
    textColor: string | null
    underlineColor: string | null
    backgroundColor: string | null
  }> | null,
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
  alwaysOnHighlightMode: common.alwaysOnHighlightMode,
  alwaysOnTokenHighlights: highlights,
  markdownTextHighlight: common.markdownTextHighlight,
  selectionKind: common.selectionKind,
  highlightBackgroundColor: common.effectiveHighlightBackgroundColor,
  highlightUnderlineColor: common.effectiveHighlightUnderlineColor,
  fragmentsEnabled: common.activeFragmentConfig.enabled,
  fragmentStep: common.activeFragmentStep,
  fragmentClassNames: common.activeFragmentConfig.classNames,
  fragmentTags: common.activeFragmentConfig.tags,
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
      const left = fullDocTokens.filter(t => t.startLine >= start && t.endLine <= end)
      return { left, right: [] }
    }
    const absSplitLine = baseOffset + 1 + splitIndex
    const start = slide.startLine
    const end = slide.endLine
    const left = fullDocTokens.filter(t => t.startLine >= start && t.endLine < absSplitLine)
    const right = fullDocTokens.filter(t => t.startLine > absSplitLine && t.endLine <= end)
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
    uiPanelTextFontClass,
    buildAlwaysOnTokenHighlights,
    mermaidFrontmatterConfig,
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
  
  const visualMeta = getSlideVisualMeta(slideMeta, headMetaRecord, uiPanelTextFontClass)
  const { layout } = visualMeta
  const stickyHeadingTopClass = 'top-[33px]'
  const slideHeading = getSlidePrimaryHeading(currentSlide.text)
  const headerNode = buildSlideHeader({
    meta: visualMeta,
    heading: slideHeading,
    page: safeActiveSlideId + 1,
    total: slides.length,
    uiPanelTextFontClass,
  })
  const stickyHeadingTopPx = 33

  const slideMermaidConfig = parseMermaidConfigFromFrontmatter(currentSlide.meta || {})
  const effectiveMermaidConfig = slideMermaidConfig || mermaidFrontmatterConfig
  
  let content: React.ReactNode = null

  if (layout === 'two-cols' && twoColumnTokens) {
    const leftHighlights = buildAlwaysOnTokenHighlights(twoColumnTokens.left)
    const rightHighlights = buildAlwaysOnTokenHighlights(twoColumnTokens.right)
    
    content = (
      <div className="w-full h-full grid grid-cols-2 gap-8">
        <div className="w-full h-full px-8 pt-10 pb-14 overflow-auto">
          <MarkdownTokenRenderer
            {...buildTokenRendererProps(twoColumnTokens.left, args, leftHighlights, stickyHeadingTopClass, stickyHeadingTopPx)}
            mermaidFrontmatterConfig={effectiveMermaidConfig}
          />
        </div>
        <div className="w-full h-full px-8 pt-10 pb-14 overflow-auto">
          <MarkdownTokenRenderer
            {...buildTokenRendererProps(twoColumnTokens.right, args, rightHighlights, stickyHeadingTopClass, stickyHeadingTopPx)}
            mermaidFrontmatterConfig={effectiveMermaidConfig}
          />
        </div>
      </div>
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
      <div className={slideOuterClass}>
        <div className={slideContentClass}>
          <MarkdownTokenRenderer
            {...buildTokenRendererProps(
              slideTokens,
              args,
              buildAlwaysOnTokenHighlights(slideTokens),
              stickyHeadingTopClass,
              stickyHeadingTopPx,
            )}
            mermaidFrontmatterConfig={effectiveMermaidConfig}
          />
        </div>
      </div>
    )
  }

  if (!content) return null

  return (
    <div className="w-full h-full relative pb-14">
      {headerNode}
      {content}
      {buildSlideFooter({ meta: visualMeta, page: safeActiveSlideId + 1, total: slides.length, uiPanelTextFontClass })}
    </div>
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
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    fullDocTokens,
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
  } = getSlideVisualMeta(slideMeta, headMetaRecord, uiPanelTextFontClass)
  const stickyHeadingTopClass = 'top-0'
  const stickyHeadingTopPx = 0
  const slideStylePreview = buildBackgroundStyle(
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
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    alwaysOnHighlightMode: false,
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
    ? fullDocTokens.filter(t => {
        const startLine = typeof t.startLine === 'number' ? t.startLine : 0
        const endLine = typeof t.endLine === 'number' ? t.endLine : startLine
        return startLine >= slide.startLine && endLine <= slide.endLine
      })
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
