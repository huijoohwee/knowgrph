import type { ChatInputAppendEventDetail } from '@/features/canvas/utils'

export type ResolvedFloatingPanelChatInputAppend = {
  text: string
  mode: 'append' | 'replace'
  submit: boolean
}

export function resolveFloatingPanelChatInputAppend(
  detail?: ChatInputAppendEventDetail | null,
): ResolvedFloatingPanelChatInputAppend | null {
  const text = typeof detail?.text === 'string' ? detail.text : ''
  if (!text.trim()) return null
  return {
    text,
    mode: detail?.mode === 'replace' ? 'replace' : 'append',
    submit: detail?.submit === true,
  }
}

export function applyFloatingPanelChatInputAppend(
  currentInput: string,
  detail?: ChatInputAppendEventDetail | ResolvedFloatingPanelChatInputAppend | null,
): string {
  const resolved = resolveFloatingPanelChatInputAppend(detail)
  if (!resolved) return String(currentInput || '')
  if (resolved.mode === 'replace') return resolved.text
  const base = String(currentInput || '')
  if (!base.trim()) return resolved.text
  const separator = base.endsWith('\n') ? '\n' : '\n\n'
  return `${base}${separator}${resolved.text}`
}
