import { GraphNode, GraphEdge } from '@/lib/graph/types'

export type HierarchyNode = {
  id: string
  children?: HierarchyNode[]
}

export function buildHierarchy(
  nodes: GraphNode[],
  edges: GraphEdge[],
  nodeIds: Set<string>
): HierarchyNode | null {
  if (nodes.length === 0) return null

  // Build adjacency list for candidate edges (child -> parents) to find roots
  const parentCount = new Map<string, number>()
  const childrenMap = new Map<string, string[]>()
  
  nodes.forEach(n => {
    parentCount.set(String(n.id), 0)
    childrenMap.set(String(n.id), [])
  })

  // Only consider edges where both endpoints exist
  edges.forEach(e => {
    const src = String(e.source)
    const tgt = String(e.target)
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) return
    if (src === tgt) return // Ignore self-loops for hierarchy

    // Check if this edge closes a cycle or adds a second parent (making it not a tree)
    // For a strict tree, each node has at most 1 parent.
    // We'll enforce a spanning tree via BFS later, but here we just need roots.
    // Actually, let's just use the edges as directed.
    
    // We'll build the hierarchy using BFS/DFS from roots to avoid cycles/multi-parents
    // But first we need to identify potential roots (in-degree 0 in the subgraph)
    parentCount.set(tgt, (parentCount.get(tgt) || 0) + 1)
    childrenMap.get(src)?.push(tgt)
  })

  // Find roots (in-degree 0)
  const roots: string[] = []
  nodes.forEach(n => {
    if ((parentCount.get(String(n.id)) || 0) === 0) {
      roots.push(String(n.id))
    }
  })

  // If no roots (cycle), pick the first node as arbitrary root
  if (roots.length === 0 && nodes.length > 0) {
    roots.push(String(nodes[0].id))
  }

  // Build the tree using BFS to handle cycles/DAGs (spanning tree)
  const visited = new Set<string>()
  
  const buildNode = (id: string): HierarchyNode => {
    visited.add(id)
    const childrenIds = childrenMap.get(id) || []
    const children: HierarchyNode[] = []
    
    for (const childId of childrenIds) {
      if (!visited.has(childId)) {
        children.push(buildNode(childId))
      }
    }
    
    return children.length > 0 ? { id, children } : { id }
  }

  if (roots.length === 1) {
    return buildNode(roots[0])
  }

  // Multiple roots: create a virtual root
  const virtualChildren = roots.map(rootId => buildNode(rootId))
  return { id: '__root__', children: virtualChildren }
}
