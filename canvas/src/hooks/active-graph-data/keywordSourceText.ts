import type { GraphData } from '@/lib/graph/types'

const KEYWORD_SOURCE_EDGE_LABELS = new Set<string>([
  'hasSection',
  'hasBlock',
  'hasItem',
  'contains',
  'embedsImage',
  'embedsMedia',
  'linksTo',
  'mentions',
])

export function stripFrontmatter(markdown: string): string {
  const s = String(markdown || '')
  if (!s.startsWith('---')) return s
  const lines = s.split(/\r?\n/)
  if (lines.length < 3) return s
  if (String(lines[0] || '').trim() !== '---') return s
  const endIdx = lines.slice(1).findIndex(l => String(l || '').trim() === '---')
  if (endIdx < 0) return s
  return lines.slice(endIdx + 2).join('\n')
}

export function markdownToPlainText(markdown: string): string {
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

export const pickKeywordTextFromNode = (n: { id?: unknown; label?: unknown; type?: unknown; properties?: unknown }): string[] => {
  const label = typeof n.label === 'string' ? n.label.trim() : ''
  const props = n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties)
    ? (n.properties as Record<string, unknown>)
    : null
  const id = typeof n.id === 'string' ? n.id.trim() : ''
  const textKeys = [
    'text',
    'content',
    'title',
    'name',
    'summary',
    'caption',
    'alt',
    'path',
    'filepath',
    'filePath',
    'file',
    'filename',
    'url',
    'href',
    'slug',
    'keywords',
    'tags',
  ]
  const out: string[] = []
  if (label) out.push(label)
  if (props) {
    for (let i = 0; i < textKeys.length; i += 1) {
      const key = textKeys[i]!
      const v = props[key]
      if (typeof v === 'string') {
        const t = v.trim()
        if (!t) continue
        if (t === label) continue
        out.push(t)
        continue
      }
      if (Array.isArray(v)) {
        for (let j = 0; j < v.length; j += 1) {
          const s = typeof v[j] === 'string' ? String(v[j]).trim() : ''
          if (!s) continue
          if (s === label) continue
          out.push(s)
        }
      }
    }
  }
  if (out.length === 0 && id && id.length <= 200) {
    const hasAlpha = /[a-zA-Z]/.test(id)
    if (hasAlpha) out.push(id)
  }
  return out
}

const WORKSPACE_GRAPH_CONTEXT = 'workspace:graph'
const WORKSPACE_GRAPH_SOURCE = 'workspace:graph'
const WORKSPACE_GRAPH_PARSE_HINT = 'workspace:inline-data'
const WORKSPACE_GRAPH_SOURCE_KIND = 'workspace'

export const buildKeywordSourceTextFromBaselineGraph = (
  graph: GraphData,
  opts?: { maxLines?: number; maxChars?: number },
): string => {
  const maxLines = (() => {
    const raw = opts?.maxLines
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(50, Math.min(200_000, Math.floor(raw)))
    return 8000
  })()
  const maxChars = (() => {
    const raw = opts?.maxChars
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(2000, Math.min(2_000_000, Math.floor(raw)))
    return 120_000
  })()
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph.edges) ? graph.edges : []

  const nodeById = new Map<string, (typeof nodes)[number]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (!n) continue
    const id = String((n as { id?: unknown }).id || '').trim()
    if (!id) continue
    if (!nodeById.has(id)) nodeById.set(id, n)
  }

  const childrenById = new Map<string, string[]>()
  const parentCount = new Map<string, number>()
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i] as unknown as { source?: unknown; target?: unknown; label?: unknown } | null
    if (!e) continue
    const label = String(e.label || '')
    if (!KEYWORD_SOURCE_EDGE_LABELS.has(label)) continue
    const src = String(e.source || '').trim()
    const tgt = String(e.target || '').trim()
    if (!src || !tgt) continue
    if (!nodeById.has(src) || !nodeById.has(tgt)) continue
    const arr = childrenById.get(src) || []
    arr.push(tgt)
    childrenById.set(src, arr)
    parentCount.set(tgt, (parentCount.get(tgt) || 0) + 1)
    if (!parentCount.has(src)) parentCount.set(src, 0)
  }
  childrenById.forEach(arr => arr.sort((a, b) => a.localeCompare(b)))

  const roots: string[] = []
  nodeById.forEach((_, id) => {
    const p = parentCount.get(id) || 0
    if (p === 0) roots.push(id)
  })
  roots.sort((a, b) => a.localeCompare(b))

  const allNodeIds = Array.from(nodeById.keys()).sort((a, b) => a.localeCompare(b))

  const visited = new Set<string>()
  const lines: string[] = []
  let chars = 0
  const nodeSnippet = (id: string): string => {
    const n = nodeById.get(id)
    if (!n) return ''
    const picked = pickKeywordTextFromNode(n as unknown as { id?: unknown; label?: unknown; type?: unknown; properties?: unknown })
    const first = picked[0]
    return typeof first === 'string' ? first.trim() : ''
  }
  const pushLines = (id: string) => {
    const n = nodeById.get(id)
    if (!n) return
    const picked = pickKeywordTextFromNode(n as unknown as { label?: unknown; type?: unknown; properties?: unknown })
    for (let i = 0; i < picked.length; i += 1) {
      const t = picked[i]!
      if (!t) continue
      if (chars >= maxChars) return
      lines.push(t)
      chars += t.length + 1
    }
  }

  const pushEdgeLine = (e: { source?: unknown; target?: unknown; label?: unknown }) => {
    if (lines.length >= maxLines) return
    if (chars >= maxChars) return
    const src = String(e.source || '').trim()
    const tgt = String(e.target || '').trim()
    if (!src || !tgt) return
    if (!nodeById.has(src) || !nodeById.has(tgt)) return
    const a = nodeSnippet(src)
    const b = nodeSnippet(tgt)
    if (!a || !b) return
    const rawLabel = typeof e.label === 'string' ? e.label.trim() : ''
    const lbl = rawLabel && rawLabel.length <= 80 ? rawLabel : ''
    const sentence = lbl ? `${a} ${lbl} ${b}.` : `${a} ${b}.`
    if (!sentence.trim()) return
    if (chars + sentence.length + 1 > maxChars) return
    lines.push(sentence)
    chars += sentence.length + 1
  }

  const seedIds = roots.length > 0 ? roots : allNodeIds
  const queue: string[] = [...seedIds]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (!id || visited.has(id)) continue
    visited.add(id)
    pushLines(id)
    const kids = childrenById.get(id) || []
    for (let i = 0; i < kids.length; i += 1) queue.push(kids[i]!)
    if (lines.length >= maxLines) break
    if (chars >= maxChars) break
  }

  for (let i = 0; i < allNodeIds.length; i += 1) {
    const id = allNodeIds[i]!
    if (!id || visited.has(id)) continue
    visited.add(id)
    pushLines(id)
    if (lines.length >= maxLines) break
    if (chars >= maxChars) break
  }

  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i] as unknown as { source?: unknown; target?: unknown; label?: unknown } | null
    if (!e) continue
    pushEdgeLine(e)
    if (lines.length >= maxLines) break
    if (chars >= maxChars) break
  }

  const deduped: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i]!
    const key = t.length > 260 ? t.slice(0, 260) : t
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(t)
  }
  const joined = deduped.join('\n')
  if (joined.length <= maxChars) return joined
  return joined.slice(0, maxChars)
}
