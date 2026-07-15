import { replaceTextRangeWithInvocationBoundary } from '@/lib/markdown/invocationTokens'

export function readCardInlineTextInputSelection(input: HTMLInputElement | HTMLTextAreaElement | null): { start: number; end: number } {
  if (!input) return { start: 0, end: 0 }
  const length = String(input.value || '').length
  const rawStart = typeof input.selectionStart === 'number' ? input.selectionStart : length
  const rawEnd = typeof input.selectionEnd === 'number' ? input.selectionEnd : rawStart
  const start = Math.max(0, Math.min(length, rawStart))
  const end = Math.max(0, Math.min(length, rawEnd))
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

export function focusCardInlineTextInputSelectionSoon(input: HTMLInputElement | HTMLTextAreaElement | null, start: number, end: number = start, focusSelection?: (start: number, end?: number) => void) {
  if (focusSelection) { focusSelection(start, end); return }
  if (!input) return
  window.requestAnimationFrame(() => {
    try { input.focus({ preventScroll: true }); input.setSelectionRange(start, end) } catch { void 0 }
  })
}

export function replaceDraftRange(args: { input: HTMLInputElement | HTMLTextAreaElement | null; draft: string; setDraft: (next: string) => void; onCommandDraftChange?: (next: string) => void; start: number; end: number; replacement: string; focusSelection?: (start: number, end?: number) => void }): { text: string; cursor: number } {
  const text = String(args.draft || '')
  const result = replaceTextRangeWithInvocationBoundary({ text, start: args.start, end: args.end, replacement: args.replacement })
  args.setDraft(result.text)
  args.onCommandDraftChange?.(result.text)
  focusCardInlineTextInputSelectionSoon(args.input, result.cursor, result.cursor, args.focusSelection)
  return result
}

export function findInlineCommandTokenRange(args: { text: string; selection: { start: number; end: number }; sigil: '@' | '/' | '#' }): { start: number; end: number } {
  const text = String(args.text || '')
  const start = Math.max(0, Math.min(text.length, args.selection.start))
  const end = Math.max(start, Math.min(text.length, args.selection.end))
  const selected = text.slice(start, end)
  if (new RegExp('^\\' + args.sigil + '[A-Za-z0-9_.-]{0,96}$').test(selected)) return { start, end }
  const match = new RegExp('\\' + args.sigil + '[A-Za-z0-9_.-]{0,96}$').exec(text.slice(0, end))
  return match ? { start: end - match[0].length, end } : { start: end, end }
}

export function insertMarkdownBlockRange(args: { text: string; start: number; end: number; block: string }): { text: string; cursor: number } {
  const text = String(args.text || '').replace(/\r/g, '')
  const block = String(args.block || '').trim()
  const start = Math.max(0, Math.min(text.length, args.start))
  const end = Math.max(start, Math.min(text.length, args.end))
  const before = text.slice(0, start).replace(/[ \t]+$/g, '')
  const after = text.slice(end).replace(/^[ \t]+/g, '')
  const prefix = before ? (before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n') : ''
  const suffix = after ? (after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n') : ''
  const next = before + prefix + block + suffix + after
  return { text: next, cursor: before.length + prefix.length + block.length }
}

export function replaceCurrentLine(args: { input: HTMLInputElement | HTMLTextAreaElement | null; draft: string; setDraft: (next: string) => void; onCommandDraftChange?: (next: string) => void; prefix: string; selection?: { start: number; end: number }; focusSelection?: (start: number, end?: number) => void }) {
  const text = String(args.draft || '')
  const selection = args.selection || readCardInlineTextInputSelection(args.input)
  const lineStart = text.lastIndexOf('\n', Math.max(0, selection.start) - 1) + 1
  const lineEndRaw = text.indexOf('\n', selection.end)
  const lineEnd = lineEndRaw >= 0 ? lineEndRaw : text.length
  const rawLine = text.slice(lineStart, lineEnd)
  const content = rawLine.replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+|- \[[ xX]\]\s+)/, '').trimStart()
  replaceDraftRange({ ...args, start: lineStart, end: lineEnd, replacement: args.prefix + content })
}
