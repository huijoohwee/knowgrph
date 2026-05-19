import React from 'react'
import {
  extractMarkdownAnnotationsFromText,
  hasMarkdownAnnotationSyntax,
  readMarkdownSigilInlineStyle,
  type MarkdownAnnotation,
} from '@/lib/markdown/markdownSigil'

const DEFAULT_MARK_BACKGROUND = '#FEF3C7'
const DEFAULT_MARK_COLOR = '#78350F'

type MarkdownSigilTextOptions = {
  maxAnnotations?: number
  maxScanChars?: number
  highlightClassName?: string
}

type MarkdownSigilTextProps = MarkdownSigilTextOptions & {
  text: string
  as?: 'span' | 'div'
  className?: string
  title?: string
}

const readAnnotationStyle = (annotation: MarkdownAnnotation): React.CSSProperties => {
  const explicit = readMarkdownSigilInlineStyle(annotation)
  if (annotation.highlighted && !explicit.backgroundColor) explicit.backgroundColor = DEFAULT_MARK_BACKGROUND
  if (annotation.highlighted && !explicit.color) explicit.color = DEFAULT_MARK_COLOR
  return explicit
}

export const renderMarkdownSigilInlineText = (
  raw: string,
  options?: MarkdownSigilTextOptions,
): React.ReactNode => {
  const text = String(raw ?? '')
  if (!text || !hasMarkdownAnnotationSyntax(text)) return text
  const annotations = extractMarkdownAnnotationsFromText(
    text,
    options?.maxAnnotations ?? 24,
    options?.maxScanChars ?? 4000,
  )
  if (annotations.length === 0) return text

  const out: React.ReactNode[] = []
  let cursor = 0
  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i]
    if (!annotation) continue
    const start = Math.max(0, Math.min(text.length, annotation.start))
    const end = Math.max(start, Math.min(text.length, annotation.end))
    if (end <= cursor) continue
    if (start > cursor) out.push(text.slice(cursor, start))
    out.push(
      <span
        key={`sigil-${start}-${end}-${i}`}
        data-kg-sigil="1"
        data-kg-sigil-default={annotation.highlighted && !annotation.background ? '1' : undefined}
        className={options?.highlightClassName || 'rounded-sm px-0.5'}
        style={readAnnotationStyle(annotation)}
      >
        {annotation.text}
      </span>,
    )
    cursor = end
  }
  if (cursor < text.length) out.push(text.slice(cursor))
  return out.length > 0 ? out : text
}

export const MarkdownSigilText = React.memo(function MarkdownSigilText(props: MarkdownSigilTextProps) {
  const Tag = props.as || 'span'
  const content = React.useMemo(
    () => renderMarkdownSigilInlineText(props.text, {
      maxAnnotations: props.maxAnnotations,
      maxScanChars: props.maxScanChars,
      highlightClassName: props.highlightClassName,
    }),
    [props.highlightClassName, props.maxAnnotations, props.maxScanChars, props.text],
  )
  return (
    <Tag className={props.className} title={props.title}>
      {content}
    </Tag>
  )
})
