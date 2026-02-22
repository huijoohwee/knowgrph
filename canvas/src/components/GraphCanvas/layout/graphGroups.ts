import type { GraphData } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { deriveMermaidSubgraphGroups } from '@/components/GraphCanvas/layout/mermaidSubgraphGroups'
import { deriveMarkdownHeadingGroups } from '@/components/GraphCanvas/layout/markdownHeadingGroups'

export const deriveGraphGroups = (data: GraphData, options?: { forceDocumentStructure?: boolean }): GraphGroup[] => {
  const meta = (data.metadata || {}) as Record<string, unknown>
  const isKeywordGraph = meta.kind === 'keyword'
  const mermaid = (!isKeywordGraph || options?.forceDocumentStructure) ? (deriveMermaidSubgraphGroups(data) as GraphGroup[]) : []
  const headings = (!isKeywordGraph || options?.forceDocumentStructure) ? deriveMarkdownHeadingGroups(data) : []
  const keywordLayers = (() => {
    // Check if we have keyword roles in the data
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    const hasKeywordRoles = nodes.some(n => {
      const props = (n.properties || {}) as Record<string, unknown>
      const role = typeof props['keyword:role'] === 'string' ? props['keyword:role'].trim() : ''
      return role === 'subject' || role === 'object' || role === 'entity'
    })

    if (!isKeywordGraph && !options?.forceDocumentStructure && !hasKeywordRoles) return [] as GraphGroup[]
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
    // Check if we have keyword:kind=entity and keyword:ner
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    const hasNer = nodes.some(n => {
      const props = (n.properties || {}) as Record<string, unknown>
      const kind = typeof props['keyword:kind'] === 'string' ? props['keyword:kind'].trim() : ''
      const ner = typeof props['keyword:ner'] === 'string' ? props['keyword:ner'].trim() : ''
      return kind === 'entity' && ner && ner !== 'O'
    })

    if (!isKeywordGraph && !options?.forceDocumentStructure && !hasNer) return [] as GraphGroup[]
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
    const propsByCommunity = new Map<string, { depth?: number; xIndex?: number; yIndex?: number }>()

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const props = (n.properties || {}) as Record<string, unknown>
      const raw = props['visual:community'] ?? props['visual:layer']
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

      const current = propsByCommunity.get(key) || {}
      
      let depthCandidate = current.depth
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        depthCandidate = Math.max(depthCandidate ?? -Infinity, raw)
      }

      const explicitDepth = typeof props['visual:depth'] === 'number' ? props['visual:depth'] : typeof props['visual:zIndex'] === 'number' ? props['visual:zIndex'] : undefined
      if (typeof explicitDepth === 'number' && Number.isFinite(explicitDepth)) {
         depthCandidate = Math.max(depthCandidate ?? -Infinity, explicitDepth)
      }

      const xIndex = typeof props['visual:xIndex'] === 'number' ? props['visual:xIndex'] : undefined
      const yIndex = typeof props['visual:yIndex'] === 'number' ? props['visual:yIndex'] : undefined

      if (typeof xIndex === 'number' && Number.isFinite(xIndex)) {
          current.xIndex = Math.max(current.xIndex ?? -Infinity, xIndex)
      }
      if (typeof yIndex === 'number' && Number.isFinite(yIndex)) {
          current.yIndex = Math.max(current.yIndex ?? -Infinity, yIndex)
      }
      
      current.depth = depthCandidate
      propsByCommunity.set(key, current)
    }
    const out: GraphGroup[] = []
    byCommunity.forEach((memberNodeIds, key) => {
      const ids = Array.from(new Set(memberNodeIds)).filter(Boolean).sort((a, b) => a.localeCompare(b))
      if (ids.length === 0) return
      const props = propsByCommunity.get(key)
      out.push({
        id: `community:${key}`,
        label: `Community ${key}`,
        depth: props?.depth ?? 0,
        xIndex: props?.xIndex,
        yIndex: props?.yIndex,
        memberNodeIds: ids,
        style: {},
      })
    })
    return out
  })()
  const merged = [...mermaid, ...headings, ...keywordLayers, ...keywordNerGroups, ...communities]

  const nodeIdSet = (() => {
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    const s = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String((nodes[i] as { id?: unknown } | null)?.id || '').trim()
      if (!id) continue
      s.add(id)
    }
    return s
  })()

  const collapsedNodeIdByGroupId = (() => {
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    const out = new Map<string, { nodeId: string; label: string; depth: number }>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as unknown as { id?: unknown; label?: unknown; properties?: unknown } | null
      const nodeId = String(n?.id || '').trim()
      if (!nodeId) continue
      const props = n?.properties && typeof n.properties === 'object' && !Array.isArray(n.properties)
        ? (n.properties as Record<string, unknown>)
        : null
      if (!props) continue
      if (props['kg:collapsed'] !== true) continue
      const groupId = typeof props['kg:groupId'] === 'string' ? props['kg:groupId'].trim() : ''
      if (!groupId) continue
      const depthRaw = props['kg:groupDepth']
      const depth = typeof depthRaw === 'number' && Number.isFinite(depthRaw) ? Math.max(0, Math.floor(depthRaw)) : 0
      const label = String(n?.label || groupId).trim() || groupId
      out.set(groupId, { nodeId, label, depth })
    }
    return out
  })()

  if (collapsedNodeIdByGroupId.size > 0) {
    for (let i = 0; i < merged.length; i += 1) {
      const g = merged[i]
      const gid = String(g.id || '').trim()
      if (!gid) continue
      const collapsed = collapsedNodeIdByGroupId.get(gid)
      if (!collapsed) continue
      const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
      let hasLiveMember = false
      for (let j = 0; j < members.length; j += 1) {
        const nid = String(members[j] || '').trim()
        if (!nid) continue
        if (nodeIdSet.has(nid)) {
          hasLiveMember = true
          break
        }
      }
      if (hasLiveMember) continue
      merged[i] = { ...g, memberNodeIds: [collapsed.nodeId] }
    }

    collapsedNodeIdByGroupId.forEach((collapsed, groupId) => {
      const exists = merged.some(g => String(g.id || '').trim() === groupId)
      if (exists) return
      merged.push({
        id: groupId,
        label: collapsed.label,
        depth: collapsed.depth,
        memberNodeIds: [collapsed.nodeId],
        style: {},
      })
    })
  }

  merged.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    const axRaw = (a as unknown as { xIndex?: unknown }).xIndex
    const bxRaw = (b as unknown as { xIndex?: unknown }).xIndex
    const ax = typeof axRaw === 'number' && Number.isFinite(axRaw) ? axRaw : 0
    const bx = typeof bxRaw === 'number' && Number.isFinite(bxRaw) ? bxRaw : 0
    if (ax !== bx) return ax - bx
    const ayRaw = (a as unknown as { yIndex?: unknown }).yIndex
    const byRaw = (b as unknown as { yIndex?: unknown }).yIndex
    const ay = typeof ayRaw === 'number' && Number.isFinite(ayRaw) ? ayRaw : 0
    const by = typeof byRaw === 'number' && Number.isFinite(byRaw) ? byRaw : 0
    if (ay !== by) return ay - by
    return a.id.localeCompare(b.id)
  })
  return merged
}
