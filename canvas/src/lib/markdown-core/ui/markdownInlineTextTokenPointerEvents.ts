import type React from 'react'
import { INLINE_MARKDOWN_EDIT_TOKEN_SELECTOR } from '@/lib/markdown-core/ui/markdownBlockContainerCore.inlineMediaEditHtml'

export const isInlineTokenPointerTarget = (target: EventTarget | null): boolean => {
  const candidate = target as { closest?: (selector: string) => Element | null } | null
  return typeof candidate?.closest === 'function' && !!candidate.closest(INLINE_MARKDOWN_EDIT_TOKEN_SELECTOR)
}

export function preventInlineTokenSecondMouseDown(event: React.MouseEvent<HTMLElement>): void {
  if (event.detail < 2 || !isInlineTokenPointerTarget(event.target)) return
  event.preventDefault()
  event.stopPropagation()
}

export function stopInlineTextEditorDoubleClick(event: React.MouseEvent<HTMLElement>): void {
  if (isInlineTokenPointerTarget(event.target)) event.preventDefault()
  event.stopPropagation()
}
