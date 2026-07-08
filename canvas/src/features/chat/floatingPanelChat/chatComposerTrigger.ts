export type ChatComposerTrigger = {
  kind: 'slash' | 'variable' | 'keyword'
  query: string
  rangeStart: number
  rangeEnd: number
}

export const resolveChatComposerTrigger = (rawText: unknown, rawCursor: unknown): ChatComposerTrigger | null => {
  const text = String(rawText || '')
  const cursor = Math.max(0, Math.min(text.length, Number.isFinite(rawCursor) ? Math.floor(Number(rawCursor)) : text.length))
  const lineStart = text.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1
  const preceding = text.slice(lineStart, cursor)
  const match = /(^|\s)([@/#])([A-Za-z0-9_.-]*)$/.exec(preceding)
  if (!match) return null
  const token = `${match[2]}${match[3]}`
  return {
    kind: match[2] === '/' ? 'slash' : match[2] === '@' ? 'variable' : 'keyword',
    query: match[3] || '',
    rangeStart: cursor - token.length,
    rangeEnd: cursor,
  }
}

export const replaceChatComposerTrigger = (args: {
  text: string
  trigger: ChatComposerTrigger
  replacement: string
}): { text: string; cursor: number } => {
  const replacement = normalizeChatComposerTriggerReplacement(args.replacement)
  const text = String(args.text || '')
  const start = Math.max(0, Math.min(text.length, args.trigger.rangeStart))
  const end = Math.max(start, Math.min(text.length, args.trigger.rangeEnd))
  const suffixStart = findChatComposerTriggerSuffixStart(text, end)
  return {
    text: `${text.slice(0, start)}${replacement}${text.slice(suffixStart)}`,
    cursor: start + replacement.length,
  }
}

function normalizeChatComposerTriggerReplacement(replacement: unknown): string {
  const text = String(replacement || '').trimEnd()
  return text ? `${text} ` : ''
}

function findChatComposerTriggerSuffixStart(text: string, end: number): number {
  let cursor = end
  while (cursor < text.length && /[ \t]/.test(text[cursor] || '')) cursor += 1
  return cursor
}
