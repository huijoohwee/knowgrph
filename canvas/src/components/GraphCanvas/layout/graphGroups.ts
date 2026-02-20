import type { GraphData } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { deriveMermaidSubgraphGroups } from '@/components/GraphCanvas/layout/mermaidSubgraphGroups'
import { deriveMarkdownHeadingGroups } from '@/components/GraphCanvas/layout/markdownHeadingGroups'

export const deriveGraphGroups = (data: GraphData): GraphGroup[] => {
  const meta = (data.metadata || {}) as Record<string, unknown>
  const isKeywordGraph = meta.kind === 'keyword'
  const mermaid = isKeywordGraph ? ([] as GraphGroup[]) : (deriveMermaidSubgraphGroups(data) as GraphGroup[])
  const headings = isKeywordGraph ? ([] as GraphGroup[]) : deriveMarkdownHeadingGroups(data)
  const keywordLayers = (() => {
    if (!isKeywordGraph) return [] as GraphGroup[]
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    const roleStroke = {
      subject: '#007BFF',
      object: '#28A745',
      entity: '#9CA3AF',
    } as const
    const byKey = new Map<string, string[]>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const props = (n.properties || {}) as Record<string, unknown>
      const kind = typeof props['keyword:kind'] === 'string' ? props['keyword:kind'].trim() : ''
      const role = typeof props['keyword:role'] === 'string' ? props['keyword:role'].trim() : ''
      if (kind === 'entity' && (role === 'subject' || role === 'object' || role === 'entity')) {
        const k = `keywordRole:${role}`
        const arr = byKey.get(k) || []
        arr.push(String(n.id))
        byKey.set(k, arr)
      }
    }
    const out: GraphGroup[] = []
    byKey.forEach((memberNodeIds, key) => {
      const ids = Array.from(new Set(memberNodeIds)).filter(Boolean).sort((a, b) => a.localeCompare(b))
      if (ids.length === 0) return
      const role = key === 'keywordRole:subject' ? 'subject' : key === 'keywordRole:object' ? 'object' : 'entity'
      const label =
        key === 'keywordRole:subject'
          ? 'Subject'
          : key === 'keywordRole:object'
            ? 'Object'
            : key === 'keywordRole:entity'
              ? 'Entity'
              : key
      out.push({
        id: `keyword-layer:${key}`,
        label,
        depth: 1,
        memberNodeIds: ids,
        style: { stroke: roleStroke[role] },
      })
    })
    return out
  })()
  const keywordNerGroups = (() => {
    if (!isKeywordGraph) return [] as GraphGroup[]
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    const byNer = new Map<string, string[]>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const props = (n.properties || {}) as Record<string, unknown>
      const kind = typeof props['keyword:kind'] === 'string' ? props['keyword:kind'].trim() : ''
      if (kind !== 'entity') continue
      const nerRaw = typeof props['keyword:ner'] === 'string' ? props['keyword:ner'].trim() : ''
      const ner = nerRaw ? nerRaw.toUpperCase() : ''
      if (!ner || ner === 'O') continue
      const arr = byNer.get(ner) || []
      arr.push(String(n.id))
      byNer.set(ner, arr)
    }

    if (byNer.size === 0) return [] as GraphGroup[]

    const strokeFor = (ner: string): string => {
      if (ner === 'PERSON') return '#007BFF'
      if (ner === 'ORG') return '#FFC107'
      if (ner === 'GPE' || ner === 'LOC') return '#28A745'
      if (ner === 'DATE' || ner === 'TIME') return '#FD7E14'
      if (ner === 'EVENT') return '#DC3545'
      return '#9CA3AF'
    }

    const groups: Array<{ ner: string; ids: string[] }> = []
    byNer.forEach((memberNodeIds, ner) => {
      const ids = Array.from(new Set(memberNodeIds)).filter(Boolean).sort((a, b) => a.localeCompare(b))
      if (ids.length < 2) return
      groups.push({ ner, ids })
    })
    groups.sort((a, b) => {
      if (b.ids.length !== a.ids.length) return b.ids.length - a.ids.length
      return a.ner.localeCompare(b.ner)
    })
    const keep = groups.slice(0, 10)

    return keep.map(g => ({
      id: `keyword-ner:${g.ner}`,
      label: g.ner,
      depth: 2,
      memberNodeIds: g.ids,
      style: { stroke: strokeFor(g.ner) },
    }))
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
  const merged = [...mermaid, ...headings, ...keywordLayers, ...keywordNerGroups, ...communities]
  merged.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.id.localeCompare(b.id)
  })
  return merged
}
