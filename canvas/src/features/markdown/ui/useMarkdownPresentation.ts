import React from 'react'
import type { Slide } from '@/features/markdown/ui/markdownPreviewSlides'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import {
  type MarkdownFragmentConfig,
  DEFAULT_FRAGMENT_CONFIG,
  buildSlideFragmentConfig,
  normalizeSlideOrder,
} from './markdownPreviewFragments'

type MarkdownPresentationApiRef = React.MutableRefObject<{
  prev: () => void
  next: () => void
  enterFullscreen?: () => void
  setShowSlideThumbnails?: (show: boolean) => void
} | null>

type MarkdownPresentationSlideState = {
  activeSlideIndex: number
  slideCount: number
  activeSlideLine: number
}

type UseMarkdownPresentationArgs = {
  slides: Slide[]
  headMeta: Record<string, unknown>
  markdownPresentationMode: boolean
  highlightedLineRange: HighlightedLineRange
  presentationApiRef?: MarkdownPresentationApiRef
  onPresentationSlideStateChange?: (state: MarkdownPresentationSlideState) => void
  onSlidesReordered?: (nextOrder: number[]) => void
  setShowSlideThumbnails?: (show: boolean) => void
}

export const useMarkdownPresentation = (args: UseMarkdownPresentationArgs) => {
  const {
    slides,
    headMeta,
    markdownPresentationMode,
    highlightedLineRange,
    presentationApiRef,
    onPresentationSlideStateChange,
    onSlidesReordered,
    setShowSlideThumbnails,
  } = args

  const [activeSlideIndex, setActiveSlideIndex] = React.useState(0)
  const [slideOrder, setSlideOrder] = React.useState<number[]>([])

  const orderedSlideIndices = React.useMemo(
    () => normalizeSlideOrder(slideOrder, slides.length),
    [slideOrder, slides.length],
  )

  const activeSlideId =
    orderedSlideIndices[
      Math.min(Math.max(0, activeSlideIndex), Math.max(0, orderedSlideIndices.length - 1))
    ] ?? 0
  const slideCount = slides.length
  const activeSlideLine = React.useMemo(
    () => slides[activeSlideId]?.startLine || 0,
    [activeSlideId, slides],
  )

  const slideFragmentConfigs = React.useMemo(() => {
    const headMetaRecord = headMeta as Record<string, unknown>
    if (!slides.length) return [] as MarkdownFragmentConfig[]
    return slides.map(slide =>
      buildSlideFragmentConfig(headMetaRecord, (slide.meta || {}) as Record<string, unknown>),
    )
  }, [headMeta, slides])

  const [activeFragmentStep, setActiveFragmentStep] = React.useState(0)
  const fullscreenHandlerRef = React.useRef<(() => void) | null>(null)
  const pendingEnterFullscreenRef = React.useRef(false)
  const prevOrderedSlideIndicesRef = React.useRef<number[] | null>(null)
  const ignoreNextSlidesReorderedRef = React.useRef(false)
  const slidesSignatureRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    setSlideOrder(prev => normalizeSlideOrder(prev, slides.length))
  }, [markdownPresentationMode, slides.length])

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      prevOrderedSlideIndicesRef.current = null
      return
    }
    if (!onSlidesReordered) return
    const nextOrdered = normalizeSlideOrder(slideOrder, slides.length)
    const prev = prevOrderedSlideIndicesRef.current
    if (!prev) {
      prevOrderedSlideIndicesRef.current = nextOrdered
      return
    }
    if (prev.length === nextOrdered.length) {
      let same = true
      for (let i = 0; i < prev.length; i += 1) {
        if (prev[i] !== nextOrdered[i]) {
          same = false
          break
        }
      }
      if (same) return
    }
    if (ignoreNextSlidesReorderedRef.current) {
      ignoreNextSlidesReorderedRef.current = false
      prevOrderedSlideIndicesRef.current = nextOrdered
      return
    }
    prevOrderedSlideIndicesRef.current = nextOrdered
    onSlidesReordered(nextOrdered)
  }, [markdownPresentationMode, onSlidesReordered, slideOrder, slides.length])

  React.useEffect(() => {
    const signature = slides.map(s => `${s.startLine}-${s.endLine}-${s.endLine - s.startLine}`).join('|')
    if (slidesSignatureRef.current == null) {
      slidesSignatureRef.current = signature
      return
    }
    if (slidesSignatureRef.current === signature) return
    slidesSignatureRef.current = signature
    if (!markdownPresentationMode) return
    ignoreNextSlidesReorderedRef.current = true
    setSlideOrder([])
  }, [markdownPresentationMode, slides])

  React.useEffect(() => {
    const maxIdx = Math.max(0, orderedSlideIndices.length - 1)
    setActiveSlideIndex(i => Math.min(Math.max(0, i), maxIdx))
  }, [orderedSlideIndices.length])

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      setActiveFragmentStep(0)
      return
    }
    setActiveFragmentStep(0)
  }, [markdownPresentationMode, activeSlideId])

  const activeFragmentConfig =
    slideFragmentConfigs[activeSlideId] || DEFAULT_FRAGMENT_CONFIG

  const handleRegisterFullscreenHandler = React.useCallback((fn: (() => void) | null) => {
    fullscreenHandlerRef.current = fn ? () => fn() : null
    if (fullscreenHandlerRef.current && pendingEnterFullscreenRef.current) {
      pendingEnterFullscreenRef.current = false
      fullscreenHandlerRef.current()
    }
  }, [])

  const enterFullscreen = React.useCallback(() => {
    fullscreenHandlerRef.current?.()
  }, [])

  const goPrev = React.useCallback(() => {
    const cfg = activeFragmentConfig
    if (cfg.enabled && activeFragmentStep > 0) {
      setActiveFragmentStep(step => (step > 0 ? step - 1 : 0))
      return
    }
    const maxOrderedIndex = Math.max(0, orderedSlideIndices.length - 1)
    const currentOrderedIndex = Math.min(Math.max(0, activeSlideIndex), maxOrderedIndex)
    const prevOrderedIndex = Math.max(0, currentOrderedIndex - 1)
    const prevSlideId = orderedSlideIndices[prevOrderedIndex] ?? 0
    const prevCfg = slideFragmentConfigs[prevSlideId] || DEFAULT_FRAGMENT_CONFIG
    setActiveSlideIndex(prevOrderedIndex)
    if (prevCfg.enabled && prevCfg.steps > 0) {
      setActiveFragmentStep(prevCfg.steps)
    } else {
      setActiveFragmentStep(0)
    }
  }, [
    activeFragmentConfig,
    activeFragmentStep,
    activeSlideIndex,
    orderedSlideIndices,
    slideFragmentConfigs,
  ])

  const goNext = React.useCallback(() => {
    const cfg = activeFragmentConfig
    if (cfg.enabled && cfg.steps > 0 && activeFragmentStep < cfg.steps) {
      setActiveFragmentStep(step => {
        const next = step + 1
        return next > cfg.steps ? cfg.steps : next
      })
      return
    }
    const maxOrderedIndex = Math.max(0, orderedSlideIndices.length - 1)
    const currentOrderedIndex = Math.min(Math.max(0, activeSlideIndex), maxOrderedIndex)
    if (currentOrderedIndex >= maxOrderedIndex) return
    const nextOrderedIndex = Math.min(maxOrderedIndex, currentOrderedIndex + 1)
    setActiveSlideIndex(nextOrderedIndex)
    setActiveFragmentStep(0)
  }, [
    activeFragmentConfig,
    activeFragmentStep,
    activeSlideIndex,
    orderedSlideIndices,
  ])

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      if (presentationApiRef) presentationApiRef.current = null
      return
    }
    if (presentationApiRef) {
      presentationApiRef.current = {
        prev: goPrev,
        next: goNext,
        enterFullscreen: () => {
          const handler = fullscreenHandlerRef.current
          if (handler) handler()
          else pendingEnterFullscreenRef.current = true
        },
        setShowSlideThumbnails,
      }
    }
    onPresentationSlideStateChange?.({
      activeSlideIndex: Math.min(
        Math.max(0, activeSlideIndex),
        Math.max(0, orderedSlideIndices.length - 1),
      ),
      slideCount: Math.max(0, slideCount),
      activeSlideLine,
    })
  }, [
    activeSlideIndex,
    activeSlideId,
    activeSlideLine,
    goNext,
    goPrev,
    markdownPresentationMode,
    onPresentationSlideStateChange,
    presentationApiRef,
    orderedSlideIndices.length,
    slideCount,
    setShowSlideThumbnails,
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

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActiveSlideIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActiveSlideIndex(Math.max(0, slides.length - 1))
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        enterFullscreen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goNext, goPrev, markdownPresentationMode, slides.length, enterFullscreen])

  return {
    activeSlideIndex,
    setActiveSlideIndex,
    slideOrder,
    setSlideOrder,
    orderedSlideIndices,
    activeSlideId,
    activeFragmentConfig,
    activeFragmentStep,
    goPrev,
    goNext,
    handleRegisterFullscreenHandler,
    enterFullscreen: () => {
      fullscreenHandlerRef.current?.()
    },
  }
}
