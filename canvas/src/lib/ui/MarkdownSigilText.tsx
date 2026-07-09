import React from 'react'
import {
  DATA_VIEW_CHIP_ROW_CLASSNAME,
  readInlineKeywordChipLabel,
  readInlineKeywordChipToneValue,
  resolveDataViewChipClass,
  splitInlineKeywordChipTokens,
} from '@/features/markdown/ui/dataViewChipStyles'
import {
  extractMarkdownAnnotationsFromText,
  hasMarkdownAnnotationSyntax,
  readMarkdownSigilInlineStyle,
  type MarkdownAnnotation,
} from '@/lib/markdown/markdownSigil'
import { renderAgenticOsInvocationKeywordChip } from '@/features/agentic-os/agenticOsInvocationChips'
import { UI_INLINE_CHIP_LABEL_15CH_CLASSNAME, UI_INLINE_CHIP_SHELL_15CH_CLASSNAME, UI_TEXT_TRUNCATE_CHIP } from '@/lib/ui/textLayout'
import { getSemanticHighlightSurfaceAttributes, getSemanticHighlightSurfaceClassName, resolveSemanticHighlightColors, SEMANTIC_HIGHLIGHT_SURFACES } from '@/lib/ui/semanticHighlight'

type MarkdownSigilTextOptions = {
  maxAnnotations?: number
  maxScanChars?: number
  highlightClassName?: string
  keywordChipClassName?: string
  renderKeywordChip?: (args: { value: string; label: string; className: string }) => React.ReactNode | null
}

type MarkdownSigilTextProps = MarkdownSigilTextOptions & {
  text: string
  as?: 'span' | 'div'
  className?: string
  title?: string
}

const readAnnotationStyle = (annotation: MarkdownAnnotation): React.CSSProperties => {
  const explicit = readMarkdownSigilInlineStyle(annotation)
  const fallback = resolveSemanticHighlightColors({ defaultHighlight: annotation.highlighted })
  if (annotation.highlighted && !explicit.backgroundColor) explicit.backgroundColor = fallback.background
  if (annotation.highlighted && !explicit.color) explicit.color = fallback.color
  return explicit
}

export const renderMarkdownSigilInlineText = (
  raw: string,
  options?: MarkdownSigilTextOptions,
): React.ReactNode => {
  const text = String(raw ?? '')
  if (!text) return text
  const annotations = extractMarkdownAnnotationsFromText(
    text,
    options?.maxAnnotations ?? 24,
    options?.maxScanChars ?? 4000,
  )
  const hasSigils = hasMarkdownAnnotationSyntax(text) && annotations.length > 0
  if (!hasSigils) {
    const keywordSegments = splitInlineKeywordChipTokens(text)
    if (keywordSegments.every(segment => segment.kind === 'text')) return text
    return keywordSegments.map((segment, index) => {
      if (segment.kind === 'text') return <React.Fragment key={`text-${index}`}>{segment.value}</React.Fragment>
      const className = [
        options?.keywordChipClassName || DATA_VIEW_CHIP_ROW_CLASSNAME,
        UI_INLINE_CHIP_SHELL_15CH_CLASSNAME,
        resolveDataViewChipClass(readInlineKeywordChipToneValue(segment.value)),
      ].join(' ')
      const customChip = options?.renderKeywordChip?.({
        value: segment.value,
        label: readInlineKeywordChipLabel(segment.value),
        className,
      })
      if (customChip) return <React.Fragment key={`keyword-${index}`}>{customChip}</React.Fragment>
      const invocationChip = renderAgenticOsInvocationKeywordChip({ value: segment.value, className })
      if (invocationChip) return <React.Fragment key={`keyword-${index}`}>{invocationChip}</React.Fragment>
      return (
        <span
          key={`keyword-${index}`}
          className={className}
          title={segment.value}
          data-kg-card-inline-keyword-pill="1"
        >
          <span className={`${UI_TEXT_TRUNCATE_CHIP} ${UI_INLINE_CHIP_LABEL_15CH_CLASSNAME}`}>{readInlineKeywordChipLabel(segment.value)}</span>
        </span>
      )
    })
  }

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
        className={options?.highlightClassName || `${getSemanticHighlightSurfaceClassName(SEMANTIC_HIGHLIGHT_SURFACES.markdownSigil)} rounded-sm px-0.5`}
        {...getSemanticHighlightSurfaceAttributes(SEMANTIC_HIGHLIGHT_SURFACES.markdownSigil)}
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
      keywordChipClassName: props.keywordChipClassName,
      renderKeywordChip: props.renderKeywordChip,
    }),
    [props.highlightClassName, props.keywordChipClassName, props.maxAnnotations, props.maxScanChars, props.renderKeywordChip, props.text],
  )
  return (
    <Tag className={props.className} title={props.title}>
      {content}
    </Tag>
  )
})
