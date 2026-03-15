import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

const isHeadingSectionNode = (n: GraphNode): boolean => {
  if (String(n.type || '') !== 'Section') return false
  const props = (n.properties || {}) as Record<string, unknown>
  return typeof props.level === 'number' && Number.isFinite(props.level)
}

const isSectionEdge = (e: GraphEdge): boolean => String(e.label || '') === 'hasSection'
const isBlockEdge = (e: GraphEdge): boolean => String(e.label || '') === 'hasBlock'
const isItemEdge = (e: GraphEdge): boolean => String(e.label || '') === 'hasItem'
const isImageEdge = (e: GraphEdge): boolean => String(e.label || '') === 'embedsImage'

export const deriveMarkdownHeadingGroups = (data: GraphData): GraphGroup[] => {
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []

  const sectionById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (!isHeadingSectionNode(n)) continue
    sectionById.set(String(n.id), n)
  }
  if (sectionById.size === 0) return []

  const parentSectionById = new Map<string, string>()
  const childSectionsById = new Map<string, Set<string>>()
  const outEdgesBySrc = new Map<string, GraphEdge[]>()
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const src = String(e.source || '')
    if (!src) continue
    const arr = outEdgesBySrc.get(src) || []
    arr.push(e)
    outEdgesBySrc.set(src, arr)

    if (!isSectionEdge(e)) continue
    const tgt = String(e.target || '')
    if (!tgt || !sectionById.has(tgt) || !sectionById.has(src)) continue
    parentSectionById.set(tgt, src)
    const set = childSectionsById.get(src) || new Set<string>()
    set.add(tgt)
    childSectionsById.set(src, set)
  }

  const depthById = new Map<string, number>()
  const computeDepth = (id: string): number => {
    const cached = depthById.get(id)
    if (typeof cached === 'number') return cached
    const parent = parentSectionById.get(id)
    const depth = parent ? computeDepth(parent) + 1 : 0
    depthById.set(id, depth)
    return depth
  }

  const leafCache = new Map<string, string[]>()
  const collectLeafMembers = (sectionId: string, stack: Set<string>): string[] => {
    const cached = leafCache.get(sectionId)
    if (cached) return cached
    if (stack.has(sectionId)) return []
    stack.add(sectionId)

    const out = new Set<string>()
    const visitNode = (nodeId: string) => {
      if (!nodeId) return
      if (sectionById.has(nodeId)) return
      out.add(nodeId)
      const outEdges = outEdgesBySrc.get(nodeId) || []
      for (let i = 0; i < outEdges.length; i += 1) {
        const e = outEdges[i]
        if (!isItemEdge(e)) continue
        const tgt = String(e.target || '')
        if (!tgt) continue
        if (sectionById.has(tgt)) continue
        out.add(tgt)
      }
    }

    const sectionOut = outEdgesBySrc.get(sectionId) || []
    for (let i = 0; i < sectionOut.length; i += 1) {
      const e = sectionOut[i]
      if (isBlockEdge(e) || isImageEdge(e)) {
        visitNode(String(e.target || ''))
      } else if (isSectionEdge(e)) {
        const childId = String(e.target || '')
        if (!childId || !sectionById.has(childId)) continue
        const childLeaves = collectLeafMembers(childId, stack)
        for (let j = 0; j < childLeaves.length; j += 1) out.add(childLeaves[j]!)
      }
    }

    stack.delete(sectionId)
    const finalized = Array.from(out).sort((a, b) => a.localeCompare(b))
    leafCache.set(sectionId, finalized)
    return finalized
  }

  const groups: GraphGroup[] = []
  sectionById.forEach((node, id) => {
    const label = String(node.label || id)
    const parent = parentSectionById.get(id) || null
    groups.push({
      id: `md:${id}`,
      label,
      source: 'markdownHeading',
      depth: computeDepth(id),
      memberNodeIds: collectLeafMembers(id, new Set()),
      parentGroupId: parent ? `md:${parent}` : null,
      style: {},
    })
  })

  groups.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.id.localeCompare(b.id)
  })
  return groups
}
