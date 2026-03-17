import React from 'react'

export function usePresentationLayout(
  rootRef: (el: HTMLDivElement | null) => void,
  baseSlideSize: { w: number; h: number }
) {
  const [presentationViewport, setPresentationViewport] = React.useState<{ w: number; h: number }>({ w: 1, h: 1 })
  const containerRef = React.useRef<HTMLElement | null>(null)

  const setRef = React.useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el
    rootRef(el)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    setPresentationViewport(prev => (prev.w === w && prev.h === h ? prev : { w, h }))
  }, [rootRef])

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

  const slideScale = React.useMemo(() => {
    const availableW = Math.max(1, presentationViewport.w)
    const availableH = Math.max(1, presentationViewport.h)
    return Math.max(0.05, Math.min(availableW / baseSlideSize.w, availableH / baseSlideSize.h))
  }, [baseSlideSize.h, baseSlideSize.w, presentationViewport.h, presentationViewport.w])

  return { setRef, slideScale, presentationViewport }
}
