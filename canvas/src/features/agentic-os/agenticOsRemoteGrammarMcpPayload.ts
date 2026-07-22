const parseJsonMaybe = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

export const parseAgenticOsRemoteGrammarMcpResponse = (text: string): Record<string, unknown> | null => {
  const direct = parseJsonMaybe(text)
  if (direct) return direct
  const frames = String(text || '')
    .split(/\r?\n\r?\n/)
    .flatMap(eventText => {
      const dataLines = eventText.split(/\r?\n/).filter(line => line.startsWith('data:'))
      return dataLines.length > 0
        ? [dataLines.map(line => line.slice(5).trimStart()).join('\n')]
        : []
    })
    .map(parseJsonMaybe)
    .filter(Boolean) as Record<string, unknown>[]
  return frames[frames.length - 1] || null
}

export const extractAgenticOsRemoteGrammarMcpPayload = <Payload extends object>(
  rpc: Record<string, unknown>,
): Partial<Payload> => {
  const result = rpc.result
  if (!result || typeof result !== 'object' || Array.isArray(result)) return {}
  const structuredContent = (result as { structuredContent?: unknown }).structuredContent
  if (structuredContent && typeof structuredContent === 'object' && !Array.isArray(structuredContent)) {
    return structuredContent as Partial<Payload>
  }
  const content = (result as { content?: Array<{ type?: string, text?: string }> }).content
  const textBlock = Array.isArray(content)
    ? content.find(block => block && block.type === 'text' && typeof block.text === 'string')
    : null
  if (!textBlock?.text) return {}
  return (parseJsonMaybe(textBlock.text) || {}) as Partial<Payload>
}
