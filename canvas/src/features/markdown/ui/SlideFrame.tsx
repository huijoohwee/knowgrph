import React from 'react'

type SlideFrameProps = {
  frameClassName: string
  slideStyle: React.CSSProperties
  slideTransitionStyle: React.CSSProperties
  slideOuterClass: string
  slideContentClass: string
  onDoubleClick?: (e: React.MouseEvent) => void
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
    children,
  } = props

  // If slideOuterClass/slideContentClass are empty, render children directly
  // This avoids double-wrapping when the content already provides layout structure
  const shouldWrap = slideOuterClass && slideContentClass

  return (
    <article
      className={frameClassName}
      style={{ ...slideStyle, ...slideTransitionStyle }}
      onDoubleClick={onDoubleClick}
    >
      {shouldWrap ? (
        <section className={slideOuterClass}>
          <div className={slideContentClass}>
            {children}
          </div>
        </section>
      ) : (
        children
      )}
    </article>
  )
}

