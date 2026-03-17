import React from 'react'

type MarkdownBlockContainerProps = {
  as: React.ElementType
  className?: string
  highlightClass: string
  highlightStyle?: React.CSSProperties
  startLine: number
  endLine?: number
  id?: string
  defaultOpen?: boolean
  open?: boolean
  children: React.ReactNode
}

export const MarkdownBlockContainer = React.forwardRef<HTMLElement, MarkdownBlockContainerProps & React.HTMLAttributes<HTMLElement>>(({
  as: Tag,
  className,
  highlightClass,
  highlightStyle,
  startLine,
  endLine,
  id,
  children,
  ...rest
}, ref) => {
  const cls = [className, highlightClass].filter(Boolean).join(' ')

  return (
    <Tag
      ref={ref}
      {...(rest as unknown as Record<string, unknown>)}
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
