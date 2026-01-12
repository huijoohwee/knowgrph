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

export const MarkdownBlockContainer = ({
  as: Tag,
  className,
  highlightClass,
  highlightStyle,
  startLine,
  endLine,
  id,
  children,
}: MarkdownBlockContainerProps) => {
  const cls = [className, highlightClass].filter(Boolean).join(' ')
  


  return (
    <Tag
      id={id}
      className={cls}
      style={highlightStyle}
      data-start-line={startLine}
      data-end-line={endLine ?? startLine}
    >
      {children}
    </Tag>
  )
}

