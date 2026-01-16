import React from 'react'

type SlideFrameProps = {
  frameClassName: string
  slideStyle: React.CSSProperties
  slideTransitionStyle: React.CSSProperties
  slideOuterClass: string
  slideContentClass: string
  onDoubleClick?: (e: React.MouseEvent) => void
  autoScaleContent?: boolean
  children: React.ReactNode
}

export function SlideFrame(props: SlideFrameProps) {
  const {
    frameClassName,
    slideStyle,
    slideTransitionStyle,
    slideOuterClass,
    slideContentClass,
    onDoubleClick,
    autoScaleContent = false,
    children,
  } = props

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const innerRef = React.useRef<HTMLDivElement | null>(null)
  const [contentScale, setContentScale] = React.useState<number>(1)

  const recomputeScale = React.useCallback(() => {
    if (!autoScaleContent) return
    const container = containerRef.current
    const inner = innerRef.current
    if (!container || !inner) return
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    const sw = inner.scrollWidth
    const sh = inner.scrollHeight
    if (!sw || !sh) return
    const sx = w / sw
    const sy = h / sh
    const s = Math.min(1, sx, sy)
    const clamped = Math.max(0.45, Math.min(1, s))
    setContentScale(clamped)
  }, [autoScaleContent])

  React.useLayoutEffect(() => {
    recomputeScale()
  }, [recomputeScale, children, slideContentClass, slideOuterClass])

  React.useEffect(() => {
    if (!autoScaleContent) return
    const container = containerRef.current
    const inner = innerRef.current
    if (!container || !inner) return
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      recomputeScale()
    })
    ro.observe(container)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [autoScaleContent, recomputeScale])

  return (
    <article
      className={frameClassName}
      style={{ ...slideStyle, ...slideTransitionStyle }}
      onDoubleClick={onDoubleClick}
    >
      {slideContentClass ? (
        slideOuterClass ? (
          <section className={slideOuterClass}>
            <div ref={containerRef} className={slideContentClass}>
              <div
                ref={innerRef}
                style={{
                  transform: autoScaleContent ? `scale(${contentScale})` : undefined,
                  transformOrigin: 'top left',
                }}
              >
                {children}
              </div>
            </div>
          </section>
        ) : (
          <div ref={containerRef} className={slideContentClass}>
            <div
              ref={innerRef}
              style={{
                transform: autoScaleContent ? `scale(${contentScale})` : undefined,
                transformOrigin: 'top left',
              }}
            >
              {children}
            </div>
          </div>
        )
      ) : (
        children
      )}
    </article>
  )
}
