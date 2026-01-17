import React from 'react'

type SlideFrameProps = {
  frameClassName: string
  slideStyle: React.CSSProperties
  slideTransitionStyle: React.CSSProperties
  onDoubleClick?: (e: React.MouseEvent) => void
  children: React.ReactNode
}

export function SlideFrame(props: SlideFrameProps) {
  const {
    frameClassName,
    slideStyle,
    slideTransitionStyle,
    onDoubleClick,
    children,
  } = props

  return (
    <article
      className={frameClassName}
      style={{ ...slideStyle, ...slideTransitionStyle }}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </article>
  )
}
