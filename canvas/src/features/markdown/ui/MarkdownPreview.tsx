import React from 'react'
import { lexMarkdown, lexMarkdownContent } from '@/features/markdown/ui/markdownPreviewLex'
import { UI_COPY } from '@/lib/config'
import { LS_KEYS } from '@/lib/config'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import {
  parseMermaidConfigFromFrontmatter,
  useRootThemeMode,
} from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { isTruthyString, looksLikeMdx, splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import { Alert, Chart, LiveCode, Mermaid } from '@/features/markdown/ui/mdxComponents'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import PreviewGallery from '@/features/panels/views/preview-panel/ui/PreviewGallery'
import * as jsxRuntime from 'react/jsx-runtime'

type HighlightedLineRange = { start: number; end: number } | null

const MDX_COMPONENTS = {
  Alert,
  Chart,
  LiveCode,
  Mermaid,
  h1: (props: React.ComponentPropsWithoutRef<'h1'>) => (
    <h1 {...props} className="text-3xl font-semibold mt-5 mb-2" />
  ),
  h2: (props: React.ComponentPropsWithoutRef<'h2'>) => (
    <h2 {...props} className="text-2xl font-semibold mt-5 mb-2" />
  ),
  h3: (props: React.ComponentPropsWithoutRef<'h3'>) => (
    <h3 {...props} className="text-xl font-semibold mt-5 mb-2" />
  ),
  p: (props: React.ComponentPropsWithoutRef<'p'>) => (
    <p {...props} className="text-base leading-relaxed mt-2 mb-2" />
  ),
  ul: (props: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul {...props} className="list-disc pl-5 text-base leading-relaxed my-3" />
  ),
  ol: (props: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol {...props} className="list-decimal pl-5 text-base leading-relaxed my-3" />
  ),
  li: (props: React.ComponentPropsWithoutRef<'li'>) => <li {...props} className="my-1" />,
  hr: (props: React.ComponentPropsWithoutRef<'hr'>) => (
    <hr {...props} className="my-4 border-gray-200" />
  ),
  pre: (props: React.ComponentPropsWithoutRef<'pre'>) => (
    <pre {...props} className="mt-3 mb-3 p-3 rounded border border-gray-200 bg-gray-50 overflow-auto" />
  ),
  code: (props: React.ComponentPropsWithoutRef<'code'>) => (
    <code {...props} className="font-mono text-xs" />
  ),
}

export type MarkdownPreviewPresentationApi = {
  prev: () => void
  next: () => void
}

export type MarkdownPreviewPresentationSlideState = {
  activeSlideIndex: number
  slideCount: number
}

type MarkdownPreviewProps = {
  markdownText: string
  activeDocumentPath: string
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  markdownPresentationMode: boolean
  presentationApiRef?: React.MutableRefObject<MarkdownPreviewPresentationApi | null>
  onPresentationSlideStateChange?: (state: MarkdownPreviewPresentationSlideState) => void
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  previewOverlayScope?: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
}

const normalizeSlideOrder = (prev: number[], slideCount: number): number[] => {
  const n = Math.max(0, slideCount)
  const raw = Array.isArray(prev) ? prev : []
  const normalized = raw.filter(i => Number.isFinite(i) && i >= 0 && i < n)
  const seen = new Set<number>()
  const deduped: number[] = []
  for (const i of normalized) {
    if (seen.has(i)) continue
    seen.add(i)
    deduped.push(i)
  }
  for (let i = 0; i < n; i += 1) {
    if (!seen.has(i)) deduped.push(i)
  }
  return deduped
}

const MarkdownPreview = React.forwardRef<HTMLDivElement, MarkdownPreviewProps>(function MarkdownPreview(
  {
    markdownText,
    activeDocumentPath,
    highlightedLineRange,
    markdownWordWrap,
    markdownPresentationMode,
    presentationApiRef,
    onPresentationSlideStateChange,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    previewOverlayScope = 'viewport',
    previewOverlayPortalTarget,
  },
  ref,
  ) {

  const rootThemeMode = useRootThemeMode()
  const rootElRef = React.useRef<HTMLDivElement | null>(null)
  const setRootRef = React.useCallback((el: HTMLDivElement | null) => {
    rootElRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el
  }, [ref])

  const { headMeta, slides } = React.useMemo(() => splitSlides(markdownText || ''), [markdownText])
  const mermaidFrontmatterConfig = React.useMemo(() => parseMermaidConfigFromFrontmatter(headMeta), [headMeta])

  const mdxEnabled = React.useMemo(
    () => isTruthyString(headMeta.mdx) || isTruthyString(headMeta.slidevMdx) || looksLikeMdx(markdownText || ''),
    [headMeta, markdownText],
  )

  const [activeSlideIndex, setActiveSlideIndex] = React.useState(0)
  const [isSlidesFullscreenOpen, setIsSlidesFullscreenOpen] = React.useState(false)
  const [slideOrder, setSlideOrder] = React.useState<number[]>([])

  const orderedSlideIndices = React.useMemo(
    () => normalizeSlideOrder(slideOrder, slides.length),
    [slideOrder, slides.length],
  )

  const activeSlideId = orderedSlideIndices[Math.min(Math.max(0, activeSlideIndex), Math.max(0, orderedSlideIndices.length - 1))] ?? 0
  const activeSlide = slides[activeSlideId] || slides[0]

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    setSlideOrder(prev => normalizeSlideOrder(prev, slides.length))
  }, [markdownPresentationMode, slides.length])

  React.useEffect(() => {
    const maxIdx = Math.max(0, orderedSlideIndices.length - 1)
    setActiveSlideIndex(i => Math.min(Math.max(0, i), maxIdx))
  }, [orderedSlideIndices.length])

  const goPrev = React.useCallback(() => {
    setActiveSlideIndex(i => Math.max(0, i - 1))
  }, [])

  const goNext = React.useCallback(() => {
    setActiveSlideIndex(i => Math.min(Math.max(0, orderedSlideIndices.length - 1), i + 1))
  }, [orderedSlideIndices.length])

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      if (presentationApiRef) presentationApiRef.current = null
      return
    }
    if (presentationApiRef) {
      presentationApiRef.current = { prev: goPrev, next: goNext }
    }
    onPresentationSlideStateChange?.({
      activeSlideIndex: Math.min(Math.max(0, activeSlideIndex), Math.max(0, orderedSlideIndices.length - 1)),
      slideCount: Math.max(0, slides.length),
    })
  }, [
    activeSlideIndex,
    goNext,
    goPrev,
    markdownPresentationMode,
    onPresentationSlideStateChange,
    presentationApiRef,
    orderedSlideIndices.length,
    slides.length,
  ])

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    if (!highlightedLineRange) return
    const target = highlightedLineRange.start
    const idx = slides.findIndex(s => target >= s.startLine && target <= s.endLine)
    if (idx >= 0) {
      const next = orderedSlideIndices.indexOf(idx)
      const nextIdx = next >= 0 ? next : idx
      setActiveSlideIndex(prev => (prev === nextIdx ? prev : nextIdx))
    }
  }, [highlightedLineRange, markdownPresentationMode, orderedSlideIndices, slides])

  const [presentationViewport, setPresentationViewport] = React.useState<{ w: number; h: number }>({ w: 1, h: 1 })
  React.useEffect(() => {
    if (!markdownPresentationMode) return
    const el = rootElRef.current
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
  }, [markdownPresentationMode])

  const baseSlideSize = React.useMemo(() => ({ w: 1280, h: 720 }), [])
  const slideScale = React.useMemo(() => {
    const availableW = Math.max(1, presentationViewport.w)
    const availableH = Math.max(1, presentationViewport.h)
    return Math.max(0.05, Math.min(availableW / baseSlideSize.w, availableH / baseSlideSize.h))
  }, [baseSlideSize.h, baseSlideSize.w, presentationViewport.h, presentationViewport.w])

  type MdxContentComponent = React.ComponentType<Record<string, unknown>>
  const mdxCacheRef = React.useRef<Map<string, MdxContentComponent>>(new Map())
  const [mdxContent, setMdxContent] = React.useState<MdxContentComponent | null>(null)
  const [mdxError, setMdxError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!markdownPresentationMode || !mdxEnabled) {
      setMdxContent(null)
      setMdxError(null)
      return
    }
    const slide = activeSlide
    const key = `${slide.startLine}:${slide.text}`
    const cached = mdxCacheRef.current.get(key)
    if (cached) {
      setMdxContent(() => cached)
      setMdxError(null)
      return
    }
    let cancelled = false
    setMdxContent(null)
    setMdxError(null)
    void (async () => {
      try {
        const mod = await import('@mdx-js/mdx')
        const gfm = await import('remark-gfm')
        if (cancelled) return
        const remarkGfm: unknown = (gfm as { default?: unknown }).default
        const evaluate: ((value: string, options: Record<string, unknown>) => Promise<unknown>) | undefined = (
          mod as { evaluate?: unknown }
        ).evaluate as ((value: string, options: Record<string, unknown>) => Promise<unknown>) | undefined
        if (!evaluate) throw new Error('MDX evaluate() is not available')
        const evaluated = await evaluate(slide.text || '', {
          ...jsxRuntime,
          useDynamicImport: true,
          remarkPlugins: typeof remarkGfm === 'function' ? [remarkGfm] : [],
          development: false,
        })
        if (cancelled) return
        const Content =
          typeof evaluated === 'object' && evaluated != null && 'default' in evaluated
            ? ((evaluated as { default?: unknown }).default as unknown)
            : undefined
        const Component = typeof Content === 'function' ? (Content as MdxContentComponent) : undefined
        if (!Component) throw new Error('MDX did not produce a component')
        mdxCacheRef.current.set(key, Component)
        setMdxContent(() => Component)
        setMdxError(null)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setMdxError(msg || 'MDX render failed')
        setMdxContent(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSlide, markdownPresentationMode, mdxEnabled])

  const { tokens } = React.useMemo(() => lexMarkdown(markdownText || ''), [markdownText])

  const body = React.useMemo(
    () =>
      (
        <MarkdownTokenRenderer
          tokens={tokens}
          activeDocumentPath={activeDocumentPath}
          highlightedLineRange={highlightedLineRange}
          markdownWordWrap={markdownWordWrap}
          markdownPresentationMode={markdownPresentationMode}
          uiPanelTextFontClass={uiPanelTextFontClass}
          uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
          mermaidFrontmatterConfig={mermaidFrontmatterConfig}
          rootThemeMode={rootThemeMode}
          previewOverlayScope={previewOverlayScope}
          previewOverlayPortalTarget={previewOverlayPortalTarget}
        />
      ),
    [
      activeDocumentPath,
      highlightedLineRange,
      markdownPresentationMode,
      markdownWordWrap,
      mermaidFrontmatterConfig,
      previewOverlayScope,
      previewOverlayPortalTarget,
      rootThemeMode,
      tokens,
      uiPanelMonospaceTextClass,
      uiPanelTextFontClass,
    ],
  )

  const slideTokens = React.useMemo(() => {
    if (!markdownPresentationMode) return null
    const slide = activeSlide
    const out = lexMarkdownContent(slide.text || '', Math.max(0, (slide.startLine || 1) - 1))
    return out.tokens
  }, [activeSlide, markdownPresentationMode])

  const slideBody = React.useMemo(() => {
    if (!markdownPresentationMode) return null
    if (!slideTokens) return null
    const slide = activeSlide
    const slideMermaidConfig = parseMermaidConfigFromFrontmatter(slide.meta || {})
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
      />
    )
  }, [
    activeDocumentPath,
    activeSlide,
    highlightedLineRange,
    markdownWordWrap,
    mermaidFrontmatterConfig,
    previewOverlayScope,
    previewOverlayPortalTarget,
    rootThemeMode,
    slideTokens,
    uiPanelMonospaceTextClass,
    uiPanelTextFontClass,
    markdownPresentationMode,
  ])

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    const el = rootElRef.current
    if (!el) return
    el.focus?.()
  }, [markdownPresentationMode])

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActiveSlideIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActiveSlideIndex(Math.max(0, slides.length - 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goNext, goPrev, markdownPresentationMode, slides.length])

  if (markdownPresentationMode) {
    const slideClass = String(activeSlide?.meta?.class || '').trim()
    const layout = String(activeSlide?.meta?.layout || '').trim()
    const background = String(activeSlide?.meta?.background || '').trim()
    const slideStyle: React.CSSProperties = background ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}
    const slideOuterClass =
      layout === 'center'
        ? 'w-full h-full flex items-center justify-center'
        : 'w-full h-full'
    const SlideMdx = mdxContent
    const slideContent = mdxEnabled ? (
      mdxError ? (
        <pre className="p-3 rounded border border-gray-200 bg-gray-50 overflow-auto text-xs font-mono whitespace-pre-wrap">
          {mdxError}
        </pre>
      ) : SlideMdx ? (
        <SlideMdx components={MDX_COMPONENTS} />
      ) : (
        <div className="text-xs text-gray-500">{UI_COPY.markdownPreviewSlideLoadingLabel}</div>
      )
    ) : (
      <>{slideBody}</>
    )
    return (
      <>
        <div
          ref={setRootRef}
          tabIndex={0}
          className={[
            'flex-1 min-h-0 w-full overflow-hidden bg-gray-100 outline-none flex flex-col',
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
                    <div className="w-full h-full px-12 py-10 overflow-auto">
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
                  const normalized = normalizeSlideOrder(next, slides.length)
                  setSlideOrder(normalized)
                  const nextPos = normalized.indexOf(activeSlideId)
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
                      <div className="w-full h-full px-12 py-10 overflow-auto">
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

  return (
    <div
      ref={setRootRef}
      className={[
        'flex-1 min-h-0 overflow-auto px-2 py-2',
        markdownPresentationMode ? 'bg-white' : '',
        uiPanelTextFontClass,
      ].join(' ')}
    >
      <div className={markdownPresentationMode ? 'mx-auto max-w-3xl px-2 py-4' : ''}>
        {body}
      </div>
    </div>
  )
})

export default MarkdownPreview
