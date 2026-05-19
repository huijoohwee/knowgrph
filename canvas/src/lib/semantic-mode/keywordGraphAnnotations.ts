import type { GraphNode, JSONValue } from '@/lib/graph/types'
import { normalizeEntityKey } from '@/lib/graph/textAnalysis'
import type { MarkdownAnnotation } from '@/lib/markdown/markdownSigil'

type KeywordAnnotationStyle = {
  count: number
  color: string | null
  background: string | null
  highlighted: boolean
}

const toKeywordHighlightProperties = (style: KeywordAnnotationStyle): Record<string, JSONValue> => ({
  'keyword:highlight': true as unknown as JSONValue,
  'keyword:highlight:count': style.count as unknown as JSONValue,
  'keyword:highlight:source': 'markdown-sigil' as unknown as JSONValue,
  ...(style.color ? { 'keyword:highlight:color': style.color as unknown as JSONValue } : {}),
  ...(style.background ? { 'keyword:highlight:background': style.background as unknown as JSONValue } : {}),
  ...(style.highlighted ? { 'keyword:highlight:default': true as unknown as JSONValue } : {}),
})

export const readKeywordAnnotationPropertiesByKey = (
  annotations: MarkdownAnnotation[] | undefined,
  isUsefulEntityKey: (key: string) => boolean,
): Map<string, Record<string, JSONValue>> => {
  const styles = new Map<string, KeywordAnnotationStyle>()
  if (!Array.isArray(annotations) || annotations.length === 0) return new Map()
  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i]
    if (!annotation) continue
    const key = normalizeEntityKey(annotation.text)
    if (!isUsefulEntityKey(key)) continue
    const color = typeof annotation.color === 'string' && annotation.color.trim() ? annotation.color.trim() : null
    const background = typeof annotation.background === 'string' && annotation.background.trim() ? annotation.background.trim() : null
    const existing = styles.get(key)
    if (existing) {
      existing.count += 1
      if (!existing.color && color) existing.color = color
      if (!existing.background && background) existing.background = background
      if (annotation.highlighted === true) existing.highlighted = true
      continue
    }
    styles.set(key, { count: 1, color, background, highlighted: annotation.highlighted === true })
  }
  const out = new Map<string, Record<string, JSONValue>>()
  styles.forEach((style, key) => out.set(key, toKeywordHighlightProperties(style)))
  return out
}

export const countHighlightedKeywordNodes = (nodes: GraphNode[]): number => {
  return nodes.filter(node => ((node.properties || {}) as Record<string, unknown>)['keyword:highlight'] === true).length
}
