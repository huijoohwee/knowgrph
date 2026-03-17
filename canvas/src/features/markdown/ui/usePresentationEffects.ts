import React from 'react'
import { lsBool, lsSetBool } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'

type UsePresentationEffectsProps = {
  slides: Array<{ meta?: Record<string, unknown> }>
  activeSlideId: number
  headMeta: Record<string, unknown>
  onRegisterFullscreenHandler?: (fn: (() => void) | null) => void
  setShowSlidesSidebar: (show: boolean) => void
  showSlidesSidebar: boolean
}

export function usePresentationEffects(props: UsePresentationEffectsProps) {
  const {
    slides,
    activeSlideId,
    headMeta,
    onRegisterFullscreenHandler,
    setShowSlidesSidebar,
    showSlidesSidebar,
  } = props

  const [isSlidesFullscreenOpen, setIsSlidesFullscreenOpen] = React.useState(false)
  const [showSpeakerNotes, setShowSpeakerNotes] = React.useState<boolean>(() =>
    lsBool(LS_KEYS.previewSlidesShowNotes, false),
  )
  const [slideTransitionPhase, setSlideTransitionPhase] = React.useState<'from' | 'to'>('to')
  const [isSidebarHovered, setIsSidebarHovered] = React.useState(false)

  const sidebarHoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSidebarMouseEnter = React.useCallback(() => {
    if (sidebarHoverTimeoutRef.current) {
      clearTimeout(sidebarHoverTimeoutRef.current)
      sidebarHoverTimeoutRef.current = null
    }
    setIsSidebarHovered(true)
  }, [])

  const handleSidebarMouseLeave = React.useCallback(() => {
    sidebarHoverTimeoutRef.current = setTimeout(() => {
      setIsSidebarHovered(false)
    }, 300) // 300ms grace period for scrollbar interaction
  }, [])

  React.useEffect(() => {
    return () => {
      if (sidebarHoverTimeoutRef.current) {
        clearTimeout(sidebarHoverTimeoutRef.current)
      }
    }
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
    if (isSlidesFullscreenOpen) {
      setShowSlidesSidebar(false)
    }
  }, [isSlidesFullscreenOpen, setShowSlidesSidebar])

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

  const previewOverlayContainerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof document === 'undefined') return
    if (isSlidesFullscreenOpen && previewOverlayContainerRef.current) {
      const el = previewOverlayContainerRef.current as unknown as { requestFullscreen?: () => Promise<void> }
      const fn = el?.requestFullscreen
      if (typeof fn !== 'function') return
      try {
        const p = fn.call(el)
        if (p && typeof (p as Promise<void>).catch === 'function') {
          ;(p as Promise<void>).catch(() => void 0)
        }
      } catch {
        void 0
      }
    }
  }, [isSlidesFullscreenOpen])

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && isSlidesFullscreenOpen) {
        setIsSlidesFullscreenOpen(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [isSlidesFullscreenOpen])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.previewSlidesShowThumbnails, showSlidesSidebar)
  }, [showSlidesSidebar])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.previewSlidesShowNotes, showSpeakerNotes)
  }, [showSpeakerNotes])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setShowSpeakerNotes(prev => !prev)
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        setShowSlidesSidebar(!showSlidesSidebar)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showSlidesSidebar, setShowSlidesSidebar])

  return {
    isSlidesFullscreenOpen,
    setIsSlidesFullscreenOpen,
    showSpeakerNotes,
    setShowSpeakerNotes,
    slideTransitionPhase,
    isSidebarHovered,
    handleSidebarMouseEnter,
    handleSidebarMouseLeave,
    activeTransitionKey,
    previewOverlayContainerRef,
  }
}
