import type { GraphData } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { deriveMermaidSubgraphGroups } from '@/components/GraphCanvas/layout/mermaidSubgraphGroups'
import { deriveMarkdownHeadingGroups } from '@/components/GraphCanvas/layout/markdownHeadingGroups'

export const deriveGraphGroups = (data: GraphData): GraphGroup[] => {
  const mermaid = deriveMermaidSubgraphGroups(data) as GraphGroup[]
  const headings = deriveMarkdownHeadingGroups(data)
  const keywordLayers = (() => {
    const meta = (data.metadata || {}) as Record<string, unknown>
    if (meta.kind !== 'keyword') return [] as GraphGroup[]
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    const byKey = new Map<string, string[]>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const props = (n.properties || {}) as Record<string, unknown>
      const kind = typeof props['keyword:kind'] === 'string' ? props['keyword:kind'].trim() : ''
      const role = typeof props['keyword:role'] === 'string' ? props['keyword:role'].trim() : ''
      if (role === 'subject' || role === 'object') {
        const k = `keywordRole:${role}`
        const arr = byKey.get(k) || []
        arr.push(String(n.id))
        byKey.set(k, arr)
      }
      if (kind === 'predicate') {
        const k = 'keywordKind:predicate'
        const arr = byKey.get(k) || []
        arr.push(String(n.id))
        byKey.set(k, arr)
      }
    }
    const out: GraphGroup[] = []
    byKey.forEach((memberNodeIds, key) => {
      const ids = Array.from(new Set(memberNodeIds)).filter(Boolean).sort((a, b) => a.localeCompare(b))
      if (ids.length === 0) return
      const label =
        key === 'keywordRole:subject'
          ? 'Subject'
          : key === 'keywordRole:object'
            ? 'Object'
            : key === 'keywordKind:predicate'
              ? 'Predicate'
              : key
      out.push({
        id: `keyword-layer:${key}`,
        label,
        depth: 1,
        memberNodeIds: ids,
        style: {},
      })
    })
    return out
  })()
  const communities = (() => {
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    const byCommunity = new Map<string, string[]>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const props = (n.properties || {}) as Record<string, unknown>
      const raw = props['visual:community']
      const key =
        typeof raw === 'number'
          ? (Number.isFinite(raw) ? String(raw) : '')
          : typeof raw === 'string'
            ? raw.trim()
            : ''
      if (!key) continue
      const arr = byCommunity.get(key) || []
      arr.push(String(n.id))
      byCommunity.set(key, arr)
    }
    const out: GraphGroup[] = []
    byCommunity.forEach((memberNodeIds, key) => {
      const ids = Array.from(new Set(memberNodeIds)).filter(Boolean).sort((a, b) => a.localeCompare(b))
      if (ids.length === 0) return
      out.push({
        id: `community:${key}`,
        label: `Community ${key}`,
        depth: 0,
        memberNodeIds: ids,
        style: {},
      })
    })
    return out
  })()
  const merged = [...mermaid, ...headings, ...keywordLayers, ...communities]
  merged.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.id.localeCompare(b.id)
  })
  return merged
}
