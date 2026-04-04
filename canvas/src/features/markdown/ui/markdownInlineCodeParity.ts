export const MARKDOWN_INLINE_CODE_VIEW_CLASS = [
  'font-mono',
  'ring-1 ring-inset ring-[color:var(--kg-code-border)]',
  'bg-[color:var(--kg-code-bg)] text-[color:var(--kg-code-text)]',
  'align-baseline leading-[var(--kg-inline-code-line-height,inherit)]',
  'px-1.5 py-0 rounded',
  'text-[length:var(--kg-inline-code-font-size,inherit)]',
]
  .filter(Boolean)
  .join(' ')

export const MARKDOWN_INLINE_CODE_EDIT_DESCENDANT_CLASSES = [
  '[&_code]:font-mono',
  '[&_code]:border-0',
  '[&_code]:ring-1',
  '[&_code]:ring-inset',
  '[&_code]:ring-[color:var(--kg-code-border)]',
  '[&_code]:bg-[color:var(--kg-code-bg)]',
  '[&_code]:text-[color:var(--kg-code-text)]',
  '[&_code]:align-baseline',
  '[&_code]:leading-[var(--kg-inline-code-line-height,inherit)]',
  '[&_code]:px-1.5',
  '[&_code]:py-0',
  '[&_code]:rounded',
  '[&_code]:text-[length:var(--kg-inline-code-font-size,inherit)]',
]
