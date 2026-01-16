import React from 'react'

type MarkdownBlockContainerProps = {
  as: React.ElementType
  className?: string
  highlightClass: string
  highlightStyle?: React.CSSProperties
  startLine: number
  endLine?: number
  id?: string
  children: React.ReactNode
}

export const MarkdownBlockContainer = React.forwardRef<HTMLElement, MarkdownBlockContainerProps>(({
  as: Tag,
  className,
  highlightClass,
  highlightStyle,
  startLine,
  endLine,
  id,
  children,
}, ref) => {
  const cls = [className, highlightClass].filter(Boolean).join(' ')

  return (
    <Tag
      ref={ref}
      id={id}
      className={cls}
      style={highlightStyle}
      data-start-line={startLine}
      data-end-line={endLine ?? startLine}
    >
      {children}
    </Tag>
  )
})
