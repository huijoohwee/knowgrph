import { replaceTextRangeWithInvocationBoundary } from '@/lib/markdown/invocationTokens'

export const normalizeCardInlineEditorValue = (value: string): string => String(value ?? '').replace(/\r/g, '')

export function readCardInlineEditorInputSelection(input: HTMLInputElement | HTMLTextAreaElement | null): { start: number; end: number } {
  if (!input) return { start: 0, end: 0 }
  const length = String(input.value || '').length
  const rawStart = typeof input.selectionStart === 'number' ? input.selectionStart : length
  const rawEnd = typeof input.selectionEnd === 'number' ? input.selectionEnd : rawStart
  const start = Math.max(0, Math.min(length, rawStart))
  const end = Math.max(0, Math.min(length, rawEnd))
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

export function focusCardInlineEditorInputSelectionSoon(input: HTMLInputElement | HTMLTextAreaElement | null, start: number, end: number = start) {
  if (!input) return
  window.requestAnimationFrame(() => {
    try {
      input.focus({ preventScroll: true })
      input.setSelectionRange(start, end)
    } catch {
      void 0
    }
  })
}

export function replaceCardInlineEditorTextRange(args: { text: string; start: number; end: number; replacement: string }): { text: string; cursor: number } {
  const text = normalizeCardInlineEditorValue(args.text)
  return replaceTextRangeWithInvocationBoundary({ ...args, text })
}
