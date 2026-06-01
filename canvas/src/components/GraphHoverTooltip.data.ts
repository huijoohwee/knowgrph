import type { GraphNode, JSONValue } from '@/lib/graph/types'
import { getNodeImagePreviewUrls } from '@/components/GraphCanvas/helpers'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'

const NODE_PROP_PRIORITY = [
  'name',
  'title',
  'description',
  'summary',
  'category',
  'role',
  'keyword:key',
  'keyword:role',
  'keyword:ner',
  'keyword:frequency',
  'keyword:pagerank',
  'visual:importance',
  'visual:nodeSize',
  'visual:layer',
]

const EDGE_PROP_PRIORITY = [
  'strength:score',
  'strength:ppmi',
  'strength:count',
  'keyword:predicate',
  'keyword:verbLike',
  'keyword:directed',
  'weight',
  'score',
  'confidence',
  'count',
]

function markdownToPlainText(markdown: string): string {
  const raw = String(markdown || '')
  if (!raw.trim()) return ''
  let text = raw
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`[^`]*`/g, ' ')
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
  text = text.replace(/\s+/g, ' ')
  return text.trim()
}

function firstString(obj: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!obj) return null
  for (const key of keys) {
    const v = obj[key]
    const s = typeof v === 'string' ? v.trim() : ''
    if (s) return s
  }
  return null
}

export function buildHoverDescription(node: GraphNode): string {
  const props = (node.properties || {}) as unknown as Record<string, unknown>
  const meta = (node.metadata || {}) as unknown as Record<string, unknown>
  const raw =
    firstString(props, ['description', 'summary', 'chunk_text', 'text', 'markdown', 'mdSectionMarkdown', 'sectionMarkdown']) ||
    firstString(meta, ['mdSectionMarkdown', 'sectionMarkdown', 'markdown', 'description', 'summary', 'text']) ||
    ''
  return markdownToPlainText(raw)
}

export function buildHoverImageInfo(node: GraphNode): { imageSrc: string | null; imageCount: number } {
  const urls = getNodeImagePreviewUrls(node)
  return { imageSrc: urls.length > 0 ? urls[0] : null, imageCount: urls.length }
}

export function buildGraphHoverSemanticKey(args: { kind?: unknown; id?: unknown } | null | undefined): string | null {
  const kind = String(args?.kind || '').trim()
  const id = String(args?.id || '').trim()
  if (!kind || !id) return null
  return buildScopedGraphSemanticKey('graph-hover-panel', { graphSemanticKey: `${kind}:${id}` }) || null
}

export function formatPropValue(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return JSON.stringify(v.slice(0, 3))
  return JSON.stringify(v)
}

export function sortProps(props: Record<string, JSONValue>, kind: 'node' | 'edge'): [string, JSONValue][] {
  const entries = Object.entries(props || {})
  const priority = kind === 'node' ? NODE_PROP_PRIORITY : EDGE_PROP_PRIORITY
  const rank = (key: string) => {
    const idx = priority.indexOf(key)
    return idx === -1 ? priority.length : idx
  }
  return entries
    .slice()
    .sort(([a], [b]) => {
      const ra = rank(a)
      const rb = rank(b)
      if (ra !== rb) return ra - rb
      return a.localeCompare(b)
    })
}
