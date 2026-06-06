export const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const TEXT_CONTENT_TYPES = new Set([
  '',
  'answer',
  'completion',
  'final',
  'final_answer',
  'message',
  'assistant',
  'text',
  'output_text',
  'response.output_text.delta',
  'response.output_text.done',
])

const TEXT_CONTAINER_TYPES = new Set([
  'chat.completion',
  'chat.completion.chunk',
  'response',
  'response.completed',
  'response.content_part.done',
  'response.output_item.done',
])

export const extractAssistantContentText = (value: unknown, depth = 0): string => {
  if (typeof value === 'string') return value
  if (depth > 6) return ''
  if (Array.isArray(value)) {
    return value
      .map(item => extractAssistantContentText(item, depth + 1))
      .filter(Boolean)
      .join('')
  }
  if (!isObjectRecord(value)) return ''

  const type = typeof value.type === 'string' ? value.type.trim().toLowerCase() : ''
  if (type && !TEXT_CONTENT_TYPES.has(type) && !TEXT_CONTAINER_TYPES.has(type)) return ''

  for (const key of [
    'text',
    'output_text',
    'answer',
    'final_answer',
    'final',
    'delta',
    'content',
    'message',
    'response',
    'item',
    'part',
  ]) {
    const raw = value[key]
    if (typeof raw === 'string') return raw
    const nested = extractAssistantContentText(raw, depth + 1)
    if (nested) return nested
  }

  const output = value.output
  if (Array.isArray(output)) return extractAssistantContentText(output, depth + 1)
  return ''
}
