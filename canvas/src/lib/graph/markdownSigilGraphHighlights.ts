import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { LRUCache } from '@/lib/cache/LRUCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { hashSignatureParts } from '@/lib/hash/signature'
import {
  extractMarkdownAnnotationsFromText,
  hasMarkdownAnnotationSyntax,
  type MarkdownAnnotation,
} from '@/lib/markdown/markdownSigil'

const GRAPH_HIGHLIGHT_CACHE = new LRUCache<string, GraphData>(24)
const NODE_TEXT_KEYS = ['text', 'content', 'title', 'name', 'summary', 'caption', 'alt', 'keywords', 'tags'] as const
const DEFAULT_HIGHLIGHT_FILL = '#FEF3C7'
const DEFAULT_HIGHLIGHT_STROKE = '#D97706'
const DEFAULT_HIGHLIGHT_LABEL = '#78350F'

const readRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

const readString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

const readKeywordAnnotation = (node: GraphNode): MarkdownAnnotation | null => {
  const props = readRecord(node.properties)
  if (props['keyword:highlight'] !== true) return null
  const text = String(node.label || readString(props, 'keyword:key') || '').trim()
  if (!text) return null
  return {
    raw: text,
    text,
    start: 0,
    end: text.length,
    highlighted: props['keyword:highlight:default'] === true || !!readString(props, 'keyword:highlight:background'),
    color: readString(props, 'keyword:highlight:color') || null,
    background: readString(props, 'keyword:highlight:background') || null,
  }
}

const readFirstMarkdownAnnotation = (node: GraphNode): { annotation: MarkdownAnnotation; fromLabel: boolean } | null => {
  const label = typeof node.label === 'string' ? node.label.trim() : ''
  if (hasMarkdownAnnotationSyntax(label)) {
    const first = extractMarkdownAnnotationsFromText(label, 1, 2000)[0]
    if (first) return { annotation: first, fromLabel: true }
  }
  const props = readRecord(node.properties)
  for (let i = 0; i < NODE_TEXT_KEYS.length; i += 1) {
    const value = props[NODE_TEXT_KEYS[i]!]
    const values = Array.isArray(value) ? value : [value]
    for (let j = 0; j < values.length; j += 1) {
      const raw = typeof values[j] === 'string' ? String(values[j]).trim() : ''
      if (!hasMarkdownAnnotationSyntax(raw)) continue
      const first = extractMarkdownAnnotationsFromText(raw, 1, 2000)[0]
      if (first) return { annotation: first, fromLabel: false }
    }
  }
  return null
}

const buildCandidateSignature = (graphData: GraphData): string => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const parts: Array<string | number | boolean | null | undefined> = ['markdown-sigil-candidates', nodes.length]
  let captured = 0
  for (let i = 0; i < nodes.length && captured < 96; i += 1) {
    const node = nodes[i]
    if (!node) continue
    const props = readRecord(node.properties)
    const label = typeof node.label === 'string' ? node.label : ''
    const keywordMarked = props['keyword:highlight'] === true
    if (keywordMarked || hasMarkdownAnnotationSyntax(label)) {
      parts.push(String(node.id || ''), label.slice(0, 180), keywordMarked ? 'kw' : '')
      captured += 1
      continue
    }
    for (let k = 0; k < NODE_TEXT_KEYS.length && captured < 96; k += 1) {
      const raw = props[NODE_TEXT_KEYS[k]!]
      const text = typeof raw === 'string' ? raw : ''
      if (!hasMarkdownAnnotationSyntax(text)) continue
      parts.push(String(node.id || ''), NODE_TEXT_KEYS[k], text.slice(0, 180))
      captured += 1
      break
    }
  }
  parts.push(captured)
  return hashSignatureParts(parts)
}

const applyAnnotationProps = (props: Record<string, unknown>, annotation: MarkdownAnnotation): Record<string, JSONValue> => {
  const next = { ...props } as Record<string, JSONValue>
  const fill = annotation.background || (annotation.highlighted ? DEFAULT_HIGHLIGHT_FILL : '')
  const stroke = annotation.color || annotation.background || (annotation.highlighted ? DEFAULT_HIGHLIGHT_STROKE : '')
  const labelColor = annotation.color || (annotation.highlighted ? DEFAULT_HIGHLIGHT_LABEL : '')
  next['markdown:highlight'] = true as unknown as JSONValue
  next['markdown:highlight:text'] = annotation.text as unknown as JSONValue
  next['markdown:highlight:source'] = 'markdown-sigil' as unknown as JSONValue
  next['visual:highlight'] = true as unknown as JSONValue
  if (labelColor && !readString(next, 'visual:labelColor')) next['visual:labelColor'] = labelColor as unknown as JSONValue
  if (stroke && !readString(next, 'visual:stroke')) next['visual:stroke'] = stroke as unknown as JSONValue
  if (fill && !readString(next, 'visual:fill') && !readString(next, 'fill')) {
    next['visual:fill'] = fill as unknown as JSONValue
  }
  if (stroke && typeof next['visual:strokeWidth'] !== 'number') next['visual:strokeWidth'] = 2 as unknown as JSONValue
  return next
}

export const applyMarkdownSigilHighlightsToGraphData = (args: {
  graphData: GraphData | null | undefined
  graphRevision?: number | null
}): GraphData | null => {
  const graphData = args.graphData || null
  if (!graphData) return null
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  if (nodes.length === 0) return graphData
  const metadata = readRecord(graphData.metadata)
  const candidateSignature = buildCandidateSignature(graphData)
  const graphKey = buildScopedGraphSemanticKey('markdown-sigil-render-highlights', {
    graphData,
    graphRevision: args.graphRevision ?? null,
    graphSemanticKey: readString(metadata, 'graphSemanticKey'),
    sourceLayerHash: readString(metadata, 'sourceLayerHash'),
    sourceLayerOrderHash: readString(metadata, 'sourceLayerOrderHash'),
  })
  const cacheKey = hashSignatureParts(['markdown-sigil-render-highlights', graphKey, candidateSignature])
  const cached = GRAPH_HIGHLIGHT_CACHE.get(cacheKey)
  if (cached) return cached

  let changed = false
  let highlightCount = 0
  const nextNodes = nodes.map(node => {
    if (!node) return node
    const keywordAnnotation = readKeywordAnnotation(node)
    const markdownAnnotation = keywordAnnotation ? null : readFirstMarkdownAnnotation(node)
    const annotation = keywordAnnotation || markdownAnnotation?.annotation || null
    if (!annotation) return node
    const props = applyAnnotationProps(readRecord(node.properties), annotation)
    const nextLabel = markdownAnnotation?.fromLabel ? annotation.text : node.label
    highlightCount += 1
    changed = true
    return { ...node, label: nextLabel, properties: props }
  })
  if (!changed) return graphData
  const out: GraphData = {
    ...graphData,
    metadata: {
      ...metadata,
      markdownSigilHighlightCount: highlightCount as unknown as JSONValue,
      markdownSigilHighlightKey: candidateSignature as unknown as JSONValue,
    },
    nodes: nextNodes,
  }
  GRAPH_HIGHLIGHT_CACHE.set(cacheKey, out)
  return out
}
