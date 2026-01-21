import type { GraphData } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { deriveMermaidSubgraphGroups } from '@/components/GraphCanvas/layout/mermaidSubgraphGroups'
import { deriveMarkdownHeadingGroups } from '@/components/GraphCanvas/layout/markdownHeadingGroups'

export const deriveGraphGroups = (data: GraphData): GraphGroup[] => {
  const mermaid = deriveMermaidSubgraphGroups(data) as GraphGroup[]
  const headings = deriveMarkdownHeadingGroups(data)
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
  const merged = [...mermaid, ...headings, ...communities]
  merged.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.id.localeCompare(b.id)
  })
  return merged
}
