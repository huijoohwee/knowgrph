import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { DOCUMENT_CONTAINMENT_EDGE_LABELS } from '@/lib/graph/documentContainmentEdgeLabels'
import { buildHierarchyDepthResolver, buildHierarchicalLeafMemberCollector } from '@/components/GraphCanvas/layout/hierarchicalGroupMembers'

const isHeadingSectionNode = (n: GraphNode): boolean => {
  if (String(n.type || '') !== 'Section') return false
  const props = (n.properties || {}) as Record<string, unknown>
  return typeof props.level === 'number' && Number.isFinite(props.level)
}

const isSectionEdge = (e: GraphEdge): boolean => String(e.label || '') === 'hasSection'
const isBlockEdge = (e: GraphEdge): boolean => String(e.label || '') === 'hasBlock'
const isItemEdge = (e: GraphEdge): boolean => String(e.label || '') === 'hasItem'
const isContainmentEdge = (e: GraphEdge): boolean => DOCUMENT_CONTAINMENT_EDGE_LABELS.has(String(e.label || ''))

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

  const computeDepth = buildHierarchyDepthResolver(parentSectionById)
  const collectLeafMembers = buildHierarchicalLeafMemberCollector({
    getChildIds: sectionId => childSectionsById.get(sectionId),
    getDirectMemberIds: sectionId => {
      const out = new Set<string>()
      const visitNode = (nodeId: string) => {
        const key = String(nodeId || '').trim()
        if (!key || sectionById.has(key)) return
        out.add(key)
        const outEdges = outEdgesBySrc.get(key) || []
        for (let i = 0; i < outEdges.length; i += 1) {
          const e = outEdges[i]
          if (!isItemEdge(e)) continue
          const tgt = String(e.target || '').trim()
          if (!tgt || sectionById.has(tgt)) continue
          out.add(tgt)
        }
      }

      const sectionOut = outEdgesBySrc.get(sectionId) || []
      for (let i = 0; i < sectionOut.length; i += 1) {
        const e = sectionOut[i]
        if (isContainmentEdge(e) && !isSectionEdge(e)) visitNode(String(e.target || ''))
      }
      return out
    },
  })

  const groups: GraphGroup[] = []
  sectionById.forEach((node, id) => {
    const label = String(node.label || id)
    const parent = parentSectionById.get(id) || null
    groups.push({
      id: `md:${id}`,
      label,
      source: 'markdownHeading',
      depth: computeDepth(id),
      memberNodeIds: collectLeafMembers(id),
      parentGroupId: parent ? `md:${parent}` : null,
      style: {
        fill: 'var(--kg-panel-bg)',
        stroke: 'var(--kg-border)',
        strokeWidth: 1.5,
      },
    })
  })

  groups.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.id.localeCompare(b.id)
  })
  return groups
}
