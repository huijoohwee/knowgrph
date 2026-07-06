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
  const start = Math.max(0, Math.min(text.length, args.start))
  const end = Math.max(start, Math.min(text.length, args.end))
  const next = `${text.slice(0, start)}${args.replacement}${text.slice(end)}`
  return { text: next, cursor: start + args.replacement.length }
}

export function readCardInlineMediaCommandDuplicateNeedle(url: string): string {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid')
    parsed.searchParams.delete('kg_media_token')
    const pathAndQuery = `${parsed.pathname}${parsed.search}`
    return parsed.origin === 'https://example.invalid' ? pathAndQuery : `${parsed.origin}${pathAndQuery}`
  } catch {
    return raw.split('?kg_media_token=')[0]?.trim() || raw
  }
}
