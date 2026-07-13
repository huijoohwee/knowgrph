export type TextareaInvocationSourceBinding = {
  index: number
  end: number
  raw: string
  label: string
  displayText: string
  sourceUrl: string
}

const TEXTAREA_INVOCATION_SOURCE_BINDING_RE = /@?\[([^\]\r\n]+\.md)\]\(((?:workspace:)?\/[^\s)]+\.md|https?:\/\/[^\s)]+)\)/giu

export function collectTextareaInvocationSourceBindings(text: string): TextareaInvocationSourceBinding[] {
  const source = String(text || '')
  const bindings: TextareaInvocationSourceBinding[] = []
  TEXTAREA_INVOCATION_SOURCE_BINDING_RE.lastIndex = 0
  for (;;) {
    const match = TEXTAREA_INVOCATION_SOURCE_BINDING_RE.exec(source)
    if (!match) break
    const label = String(match[1] || '').trim()
    bindings.push({
      index: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      label,
      displayText: `@${label}`,
      sourceUrl: String(match[2] || '').trim(),
    })
  }
  return bindings
}
