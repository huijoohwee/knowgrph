import React from 'react'

type SlideFrameProps = {
  frameClassName: string
  slideStyle: React.CSSProperties
  slideTransitionStyle: React.CSSProperties
  slideOuterClass: string
  slideContentClass: string
  onDoubleClick?: () => void
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
    <div
      className={frameClassName}
      style={{ ...slideStyle, ...slideTransitionStyle }}
      onDoubleClick={onDoubleClick}
    >
      <div className={slideOuterClass}>
        <div className={slideContentClass}>
          {children}
        </div>
      </div>
    </div>
  )
}

