import React from 'react'
import { UI_INLINE_CHIP_LABEL_15CH_CLASSNAME } from '@/lib/ui/textLayout'

const PROJECTED_CARET_CLASS_NAME =
  'relative z-20 inline-block h-[1em] w-0 border-l border-[color:var(--kg-text-primary)] align-[-0.125em] opacity-95'
const PROJECTED_END_CARET_CLASS_NAME =
  'absolute right-0 top-1/2 z-20 h-[1em] w-0 -translate-y-1/2 border-l border-[color:var(--kg-text-primary)] opacity-95'
const METRIC_TEXT_CLASS_NAME =
  'before:whitespace-pre before:content-[attr(data-kg-textarea-invocation-metric-text)]'

export function renderTextareaInvocationVisibleTokenText(displayText: string): React.ReactNode {
  const text = String(displayText || '')
  const sigil = text.startsWith('/') || text.startsWith('#') || text.startsWith('@') ? text.slice(0, 1) : ''
  return (
    <span
      className={`inline-block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap ${sigil ? UI_INLINE_CHIP_LABEL_15CH_CLASSNAME : ''}`}
      data-kg-textarea-invocation-token-text="1"
      data-kg-textarea-invocation-token-sigil={sigil || undefined}
      data-kg-textarea-invocation-token-label={sigil ? '1' : undefined}
    >
      {text}
    </span>
  )
}

export function renderTextareaInvocationProjectionMetricText(args: {
  caretKind: string
  caretOffset: number | null
  caretToken: string
  className: string
  displayText: string
}): React.ReactNode {
  const text = String(args.displayText || '')
  const offset = args.caretOffset == null
    ? null
    : Math.max(0, Math.min(text.length, Math.floor(args.caretOffset)))
  if (offset == null) {
    return <span className={`${args.className} ${METRIC_TEXT_CLASS_NAME}`} data-kg-textarea-invocation-metric-text={text} />
  }
  return (
    <span className={args.className}>
      <span className={METRIC_TEXT_CLASS_NAME} data-kg-textarea-invocation-metric-text={text.slice(0, offset)} />
      <span
        aria-hidden="true"
        className={offset === text.length ? PROJECTED_END_CARET_CLASS_NAME : PROJECTED_CARET_CLASS_NAME}
        data-kg-textarea-invocation-projected-caret="1"
        data-kg-textarea-invocation-projected-caret-kind={args.caretKind}
        data-kg-textarea-invocation-projected-caret-token={args.caretToken}
      />
      <span className={METRIC_TEXT_CLASS_NAME} data-kg-textarea-invocation-metric-text={text.slice(offset)} />
    </span>
  )
}
