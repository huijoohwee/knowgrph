import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

type TreeLabelLodConfig = NonNullable<NonNullable<NonNullable<GraphSchema['performance']>['lod']>['tree']>

const coerceFinitePositiveInt = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const n = Math.floor(value)
  return n > 0 ? n : null
}

const resolveLabelMode = (mode: unknown): NonNullable<TreeLabelLodConfig['labelMode']> => {
  if (mode === 'all' || mode === 'internal' || mode === 'none' || mode === 'auto') return mode
  return 'auto'
}

const coerceEndpointId = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}

const buildTreeStructure = (args: {
  nodes: GraphNode[]
  edgesForDisplay: GraphEdge[]
  direction: 'source-target' | 'target-source'
}) => {
  const { nodes, edgesForDisplay, direction } = args
  const nodeIds = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) nodeIds.add(String(nodes[i].id))

  const childrenByParent = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()

  const bump = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) || 0) + 1)

  for (let i = 0; i < edgesForDisplay.length; i += 1) {
    const edge = edgesForDisplay[i]
    const src = coerceEndpointId(edge.source)
    const tgt = coerceEndpointId(edge.target)
    if (!src || !tgt || src === tgt) continue
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) continue
    const parent = direction === 'source-target' ? src : tgt
    const child = direction === 'source-target' ? tgt : src
    if (!parent || !child || parent === child) continue
    let set = childrenByParent.get(parent)
    if (!set) {
      set = new Set<string>()
      childrenByParent.set(parent, set)
    }
    set.add(child)
    bump(outDegree, parent)
    bump(inDegree, child)
  }

  const roots: string[] = []
  nodeIds.forEach((id) => {
    const hasChildren = (outDegree.get(id) || 0) > 0
    if (!hasChildren) return
    const indeg = inDegree.get(id) || 0
    if (indeg === 0) roots.push(id)
  })
  roots.sort((a, b) => a.localeCompare(b))

  const depthById = new Map<string, number>()
  const queue: string[] = roots.slice()
  for (let i = 0; i < queue.length; i += 1) depthById.set(queue[i], 0)

  while (queue.length > 0) {
    const parent = queue.shift() as string
    const parentDepth = depthById.get(parent) ?? 0
    const children = childrenByParent.get(parent)
    if (!children) continue
    children.forEach((child) => {
      if (!nodeIds.has(child)) return
      const nextDepth = parentDepth + 1
      const prev = depthById.get(child)
      if (prev != null && prev <= nextDepth) return
      depthById.set(child, nextDepth)
      queue.push(child)
    })
  }

  const internalIds: string[] = []
  const leafIds: string[] = []
  nodeIds.forEach((id) => {
    const out = outDegree.get(id) || 0
    if (out > 0) internalIds.push(id)
    else leafIds.push(id)
  })

  return { nodeIds, childrenByParent, inDegree, outDegree, depthById, internalIds, leafIds }
}

export const computeTreeLabelVisibility = (args: {
  nodes: GraphNode[]
  edgesForDisplay: GraphEdge[]
  direction: 'source-target' | 'target-source'
  lod: TreeLabelLodConfig | null | undefined
}): Set<string> => {
  const { nodes, edgesForDisplay, direction, lod } = args
  const mode = resolveLabelMode(lod?.labelMode)

  const { nodeIds, outDegree, depthById, internalIds, leafIds } = buildTreeStructure({
    nodes,
    edgesForDisplay,
    direction,
  })

  if (mode === 'none') return new Set<string>()
  if (mode === 'all') return new Set<string>(Array.from(nodeIds))

  const compareInternal = (a: string, b: string) => {
    const da = depthById.get(a) ?? 0
    const db = depthById.get(b) ?? 0
    if (da !== db) return da - db
    const oa = outDegree.get(a) || 0
    const ob = outDegree.get(b) || 0
    if (oa !== ob) return ob - oa
    return a.localeCompare(b)
  }

  const compareLeaf = (a: string, b: string) => {
    const da = depthById.get(a) ?? Number.POSITIVE_INFINITY
    const db = depthById.get(b) ?? Number.POSITIVE_INFINITY
    if (da !== db) return da - db
    return a.localeCompare(b)
  }

  internalIds.sort(compareInternal)
  leafIds.sort(compareLeaf)

  if (mode === 'internal') return new Set<string>(internalIds)

  const maxLabels =
    coerceFinitePositiveInt(lod?.maxLabels) ??
    (() => {
      const n = nodeIds.size
      if (n <= 220) return n
      const scaled = Math.round(40 + 12 * Math.sqrt(Math.max(1, n)))
      return Math.max(80, Math.min(400, scaled))
    })()

  const maxLeafLabels = coerceFinitePositiveInt(lod?.maxLeafLabels)

  const visible = new Set<string>()

  const pushInternalCount = Math.min(internalIds.length, maxLabels)
  for (let i = 0; i < pushInternalCount; i += 1) visible.add(internalIds[i])

  if (visible.size >= maxLabels) return visible

  let leafBudget = Math.max(0, maxLabels - visible.size)
  if (maxLeafLabels != null) leafBudget = Math.min(leafBudget, maxLeafLabels)

  for (let i = 0; i < leafIds.length && leafBudget > 0; i += 1) {
    const id = leafIds[i]
    if (visible.has(id)) continue
    visible.add(id)
    leafBudget -= 1
  }

  return visible
}

export const computeTreeCollapseHiddenNodes = (args: {
  nodes: GraphNode[]
  edgesForDisplay: GraphEdge[]
  direction: 'source-target' | 'target-source'
  lod: TreeLabelLodConfig | null | undefined
}): Set<string> => {
  const { nodes, edgesForDisplay, direction, lod } = args
  const mode = lod?.collapseMode === 'depth' ? 'depth' : 'none'
  if (mode !== 'depth') return new Set<string>()
  const maxDepth = coerceFinitePositiveInt(lod?.maxDepth)
  if (maxDepth == null) return new Set<string>()

  const { nodeIds, depthById } = buildTreeStructure({
    nodes,
    edgesForDisplay,
    direction,
  })

  const hidden = new Set<string>()
  nodeIds.forEach((id) => {
    const d = depthById.get(id)
    if (d != null && d > maxDepth) hidden.add(id)
  })
  return hidden
}
