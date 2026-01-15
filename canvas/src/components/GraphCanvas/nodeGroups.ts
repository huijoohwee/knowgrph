import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';

export type NodeGroup = {
  id: string
  memberIds: string[]
  meta?: {
    groupBy: 'property' | 'type' | 'community'
    ownerId?: string
    ownerType?: string
    propertyKey?: string
    groupValue?: string
  }
}

export const buildNodeGroups = (graphData: GraphData): NodeGroup[] => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  if (!nodes.length) return []
  const nodeIdSet = new Set<string>()
  const normalizeId = (raw: unknown): string => {
    const s = String(raw ?? '')
    return s.startsWith('kg:') ? s.slice(3) : s
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    nodeIdSet.add(String(n.id))
  }
  const groups: NodeGroup[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const owner = nodes[i]
    const props = owner && owner.properties ? owner.properties : {}
    const keys = Object.keys(props)
    if (!keys.length) continue
    for (let j = 0; j < keys.length; j += 1) {
      const key = keys[j]
      const value = props[key] as JSONValue
      if (!Array.isArray(value)) continue
      const memberIds: string[] = []
      for (let k = 0; k < value.length; k += 1) {
        const v = value[k] as JSONValue
        if (typeof v === 'string') {
          const id = normalizeId(v)
          if (nodeIdSet.has(id)) memberIds.push(id)
        } else if (v && typeof v === 'object') {
          const maybe = (v as { [key: string]: unknown })['@id']
          if (typeof maybe === 'string') {
            const id = normalizeId(maybe)
            if (nodeIdSet.has(id)) memberIds.push(id)
          }
        }
      }
      if (memberIds.length < 2) continue
      const deduped = Array.from(new Set(memberIds))
      if (deduped.length < 2) continue
      const groupId = String(owner.id) + '::' + key
      groups.push({
        id: groupId,
        memberIds: deduped,
        meta: { groupBy: 'property', ownerId: String(owner.id), ownerType: String(owner.type || ''), propertyKey: key },
      })
    }
  }
  return groups
}

const DOCUMENT_BLOCK_TYPES = new Set([
  'Document',
  'Section',
  'Paragraph',
  'CodeBlock',
  'Table',
  'List',
  'ListItem',
  'MermaidSubgraph', // Exclude explicit subgraphs from automatic property grouping if needed
])

const buildNodeGroupsByCommunity = (graphData: GraphData, minGroupSize: number): NodeGroup[] => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  if (!nodes.length) return []
  const byCommunity = new Map<string, string[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const props = (n.properties || {}) as Record<string, unknown>
    const raw = props['visual:community']
    const c =
      typeof raw === 'number'
        ? (Number.isFinite(raw) ? String(raw) : '')
        : (typeof raw === 'string' ? raw.trim() : '')
    if (!c) continue
    const arr = byCommunity.get(c) || []
    arr.push(String(n.id))
    byCommunity.set(c, arr)
  }
  const groups: NodeGroup[] = []
  byCommunity.forEach((memberIds, c) => {
    const deduped = Array.from(new Set(memberIds))
    if (deduped.length < Math.max(2, minGroupSize)) return
    groups.push({ id: `community::${c}`, memberIds: deduped, meta: { groupBy: 'community', groupValue: c } })
  })
  return groups
}

export const buildNodeGroupsFromSchema = (graphData: GraphData, schema: GraphSchema): NodeGroup[] => {
  const buildMermaidSubgraphGroups = (): NodeGroup[] => {
    if (schema.layout?.mode !== 'mermaid') return []
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    
    // Pre-index nodes by subgraph name for O(N) lookup
    const nodesBySubgraphName = new Map<string, GraphNode[]>()
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const props = (node.properties || {}) as Record<string, unknown>
      const parent = String(props['mermaidSubgraphName'] || '').trim()
      if (parent) {
        const list = nodesBySubgraphName.get(parent) || []
        list.push(node)
        nodesBySubgraphName.set(parent, list)
      }
    }

    const nodeIdSet = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      nodeIdSet.add(String(nodes[i]?.id ?? ''))
    }
    const groups: NodeGroup[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (!n || String(n.type || '') !== 'MermaidSubgraph') continue
      const subgraphName = String(n.properties?.subgraphName || n.properties?.nodeName || n.label || '').trim()
      if (!subgraphName) continue

      const memberNodes = nodesBySubgraphName.get(subgraphName) || []
      const memberIds = memberNodes.map(m => String(m.id))
      
      const deduped = Array.from(new Set(memberIds))
      if (deduped.length < 1) continue
      groups.push({
        id: `mermaidSubgraph::${String(n.id)}`,
        memberIds: deduped,
        meta: {
          groupBy: 'property',
          ownerId: String(n.id),
          ownerType: 'MermaidSubgraph',
          propertyKey: 'mermaidSubgraphName',
          groupValue: subgraphName,
        },
      })
    }

    // Sort groups by hierarchy depth (root first) so parents are drawn before children
    const subgraphParentByName = new Map<string, string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (String(n.type || '') !== 'MermaidSubgraph') continue
      const name = String(n.properties?.subgraphName || n.properties?.nodeName || n.label || '').trim()
      const parent = String(n.properties?.mermaidSubgraphName || '').trim()
      if (name) subgraphParentByName.set(name, parent)
    }

    const getDepth = (name: string): number => {
      let d = 0
      let curr = name
      const visited = new Set<string>()
      while (curr && !visited.has(curr)) {
        visited.add(curr)
        const p = subgraphParentByName.get(curr)
        if (!p) break
        curr = p
        d += 1
      }
      return d
    }

    groups.sort((a, b) => {
      const da = getDepth(a.meta?.groupValue || '')
      const db = getDepth(b.meta?.groupValue || '')
      return da - db
    })

    return groups
  }

  const mode = schema.layers?.mode || 'property'
  const mermaidGroups = buildMermaidSubgraphGroups()
  if (mode === 'document-structure') {
    const groups = buildNodeGroups(graphData)
    if (!groups.length) return groups
    const filtered = groups.filter((g) => {
      const ownerType = g.meta?.ownerType ? String(g.meta.ownerType) : ''
      if (!ownerType) return true
      if (DOCUMENT_BLOCK_TYPES.has(ownerType)) return false
      return true
    })
    const base = filtered.length > 0 ? filtered : groups
    return mermaidGroups.length ? [...mermaidGroups, ...base] : base
  }
  if (mode === 'semantic') {
    const minGroupSizeRaw = schema.layers?.documentStructure?.minGroupSize
    const minGroupSize =
      typeof minGroupSizeRaw === 'number' && Number.isFinite(minGroupSizeRaw) ? Math.max(2, Math.floor(minGroupSizeRaw)) : 2
    const base = buildNodeGroupsByCommunity(graphData, minGroupSize)
    return mermaidGroups.length ? [...mermaidGroups, ...base] : base
  }
  const base = buildNodeGroups(graphData)
  return mermaidGroups.length ? [...mermaidGroups, ...base] : base
}
