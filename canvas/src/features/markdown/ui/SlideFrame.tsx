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

  return (
    <article
      className={frameClassName}
      style={{ ...slideStyle, ...slideTransitionStyle }}
      onDoubleClick={onDoubleClick}
    >
      <div className={slideOuterClass}>
        <div className={slideContentClass}>
          {children}
        </div>
      </div>
    </article>
  )
}

