const API_NATIVE_BROWSER_CONTENT_KEYS = ['markdown', 'text', 'content', 'body', 'value'] as const
const API_NATIVE_BROWSER_NESTED_KEYS = ['result', 'data', 'response', 'payload'] as const
const API_NATIVE_BROWSER_THINKING_KEYS = [
  'thinkingMarkdown',
  'thinking_markdown',
  'thinking',
  'reasoningMarkdown',
  'reasoning_markdown',
  'reasoning',
  'thoughtsMarkdown',
  'thoughts_markdown',
  'thoughts',
] as const

function extractApiNativeBrowserString(value: unknown, maxDepth = 4): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object' || maxDepth <= 0) return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractApiNativeBrowserString(item, maxDepth - 1)
      if (nested) return nested
    }
    return ''
  }
  const record = value as Record<string, unknown>
  for (const key of API_NATIVE_BROWSER_CONTENT_KEYS) {
    const nested = extractApiNativeBrowserString(record[key], maxDepth - 1)
    if (nested) return nested
  }
  for (const key of API_NATIVE_BROWSER_NESTED_KEYS) {
    const nested = extractApiNativeBrowserString(record[key], maxDepth - 1)
    if (nested) return nested
  }
  return ''
}

function extractApiNativeBrowserField(value: unknown, keys: readonly string[], maxDepth = 4): string {
  if (!value || typeof value !== 'object' || maxDepth <= 0) return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractApiNativeBrowserField(item, keys, maxDepth - 1)
      if (nested) return nested
    }
    return ''
  }
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const raw = record[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  for (const key of API_NATIVE_BROWSER_NESTED_KEYS) {
    const nested = extractApiNativeBrowserField(record[key], keys, maxDepth - 1)
    if (nested) return nested
  }
  return ''
}

export function readApiNativeBrowserResponseText(rawText: string): string {
  const text = String(rawText || '').trim()
  if (!text) return ''
  try {
    const parsed = JSON.parse(text) as unknown
    return extractApiNativeBrowserString(parsed) || text
  } catch {
    return text
  }
}

export function readApiNativeBrowserMarkdownPayload(rawText: string): { markdown: string; thinkingMarkdown?: string } {
  const text = String(rawText || '').trim()
  if (!text) return { markdown: '' }
  try {
    const parsed = JSON.parse(text) as unknown
    const markdown = extractApiNativeBrowserString(parsed) || text
    const thinkingMarkdown = extractApiNativeBrowserField(parsed, API_NATIVE_BROWSER_THINKING_KEYS)
    return { markdown, ...(thinkingMarkdown ? { thinkingMarkdown } : {}) }
  } catch {
    return { markdown: text }
  }
}
