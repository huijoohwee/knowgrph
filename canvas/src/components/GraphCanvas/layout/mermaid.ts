import dagre from 'dagre'
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { calculateNodeDimensions, wrapTextByMaxChars, isRecordType } from '@/components/GraphCanvas/layout/utils'

const getEndpointId = (v: unknown): string => {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (isRecordType(v) && (typeof v.id === 'string' || typeof v.id === 'number')) return String(v.id)
  return ''
}

export const applyMermaidLayout = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
) => {
  if (!nodes.length) return

  const nodeIds = new Set<string>()
  const validNodes: GraphNode[] = []
  const subgraphNodes: GraphNode[] = []

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n.id)
    if (!id) continue
    if (nodeIds.has(id)) continue
    
    nodeIds.add(id)
    if (String(n.type || '') === 'MermaidSubgraph') {
      subgraphNodes.push(n)
    } else {
      validNodes.push(n)
    }
  }

  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < validNodes.length; i += 1) nodeById.set(String(validNodes[i].id), validNodes[i])
  for (let i = 0; i < subgraphNodes.length; i += 1) nodeById.set(String(subgraphNodes[i].id), subgraphNodes[i])

  const getMermaidParentName = (n: GraphNode): string => {
    const props = (n.properties || {}) as Record<string, unknown>
    return String(props.mermaidSubgraphName || '').trim()
  }
  const getMermaidSubgraphName = (n: GraphNode): string => {
    return String(n.properties?.subgraphName || n.label || '').trim()
  }
  validNodes.sort((a, b) => {
    const pa = getMermaidParentName(a)
    const pb = getMermaidParentName(b)
    if (pa !== pb) return pa.localeCompare(pb)
    return String(a.id).localeCompare(String(b.id))
  })
  subgraphNodes.sort((a, b) => {
    const na = getMermaidSubgraphName(a)
    const nb = getMermaidSubgraphName(b)
    if (na !== nb) return na.localeCompare(nb)
    return String(a.id).localeCompare(String(b.id))
  })

  const mermaidConfig = schema.layout?.mermaid || {}
  const orientation = mermaidConfig?.orientation || 'vertical'
  const direction = mermaidConfig?.direction || 'source-target'

  const labelCharWidth = (() => {
    const raw = mermaidConfig?.labelCharWidth
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
    return 9
  })()
  const labelLineHeight = (() => {
    const raw = mermaidConfig?.labelLineHeight
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
    return 20
  })()
  const labelPaddingX = (() => {
    const raw = mermaidConfig?.labelPaddingX
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
    return 32
  })()
  const labelPaddingY = (() => {
    const raw = mermaidConfig?.labelPaddingY
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
    return 20
  })()
  const labelMinWidth = (() => {
    const raw = mermaidConfig?.labelMinWidth
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
    return 40
  })()
  const labelMinHeight = (() => {
    const raw = mermaidConfig?.labelMinHeight
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
    return 20
  })()
  const maxNodeWidth = (() => {
    const raw = mermaidConfig?.maxNodeWidth
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 80) return raw
    return 320
  })()
  const maxCharsPerLine = Math.max(4, Math.floor((maxNodeWidth - labelPaddingX) / Math.max(1, labelCharWidth)))

  let rankdir = 'LR'
  if (orientation === 'vertical') rankdir = direction === 'target-source' ? 'BT' : 'TB'
  else rankdir = direction === 'target-source' ? 'RL' : 'LR'

  const separation = typeof mermaidConfig?.separation === 'number' ? Math.min(mermaidConfig.separation, 0.8) : 0.8
  // ENHANCE: Adjusted separation defaults to be more compact by default, but scalable
  // Cap separation at 0.8 to prevent extreme spread for dense graphs
  const nodeSep = 40 * separation
  const rankSep = 40 * separation

  const g = new dagre.graphlib.Graph({ multigraph: false, compound: true })
  g.setGraph({
    rankdir,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: 20, // ENHANCE: Reduced margin to prevent huge bounding boxes
    marginy: 20, // ENHANCE: Reduced margin
    ranker: 'network-simplex',
  })
  g.setDefaultEdgeLabel(() => ({}))

  // 1. Add Subgraphs (Groups) to Dagre first
  const subgraphDummyId = new Map<string, string>()

  for (const n of subgraphNodes) {
    const id = String(n.id)
    // Add as group node - let dagre compute dimensions based on children
    g.setNode(id, { label: n.label, clusterLabelPos: 'top', style: 'fill: transparent; stroke: none;' }) 
    
    // Create a dummy node inside the subgraph to anchor edges
    const dummyId = `${id}__dummy`
    subgraphDummyId.set(id, dummyId)
    g.setNode(dummyId, { width: 1, height: 1, label: '' })
    ;(g as any).setParent(dummyId, id)
  }

  // 2. Add Regular Nodes
  for (const node of validNodes) {
    const id = String(node.id)
    const baseLabel = String(node.label || node.id || '')
    const wrappedLabel = wrapTextByMaxChars(baseLabel, maxCharsPerLine)
    const { width: w, height: h } = calculateNodeDimensions(
      { ...node, label: wrappedLabel } as GraphNode,
      {
        charWidth: labelCharWidth,
        lineHeight: labelLineHeight,
        paddingX: labelPaddingX,
        paddingY: labelPaddingY,
        minWidth: labelMinWidth,
        minHeight: labelMinHeight,
      },
    )

    if (!node.properties) node.properties = {}
    node.properties['visual:width'] = w
    node.properties['visual:height'] = h
    node.properties['visual:label'] = wrappedLabel

    g.setNode(id, { width: w, height: h })
  }

  // 3. Set Parent-Child Relationships
  const allLayoutNodes = [...validNodes, ...subgraphNodes]
  // Index subgraphs by name for lookup (since property is mermaidSubgraphName)
  const subgraphIdByName = new Map<string, string>()
  for (const sn of subgraphNodes) {
    const name = String(sn.properties?.subgraphName || sn.label || '').trim()
    if (name) subgraphIdByName.set(name, String(sn.id))
  }

  const subgraphParentByName = new Map<string, string>()
  for (const sn of subgraphNodes) {
    const name = getMermaidSubgraphName(sn)
    if (!name) continue
    subgraphParentByName.set(name, getMermaidParentName(sn))
  }
  const subgraphDepthByName = new Map<string, number>()
  const getSubgraphDepth = (name: string, stack: Set<string>): number => {
    const cached = subgraphDepthByName.get(name)
    if (typeof cached === 'number') return cached
    if (stack.has(name)) return 0
    stack.add(name)
    const parent = String(subgraphParentByName.get(name) || '').trim()
    if (!parent || !subgraphParentByName.has(parent)) {
      subgraphDepthByName.set(name, 0)
      stack.delete(name)
      return 0
    }
    const depth = 1 + getSubgraphDepth(parent, stack)
    subgraphDepthByName.set(name, depth)
    stack.delete(name)
    return depth
  }
  for (const sn of subgraphNodes) {
    const name = getMermaidSubgraphName(sn)
    if (!sn.properties) sn.properties = {}
    if (!name) {
      sn.properties['visual:subgraphDepth'] = 0
      continue
    }
    sn.properties['visual:subgraphDepth'] = getSubgraphDepth(name, new Set<string>())
  }

  for (const n of allLayoutNodes) {
    const id = String(n.id)
    const props = (n.properties || {}) as Record<string, unknown>
    const parentName = String(props.mermaidSubgraphName || '').trim()
    if (parentName) {
      const parentId = subgraphIdByName.get(parentName)
      if (parentId && parentId !== id) {
        // dagre.graphlib.Graph definition is missing setParent in @types/dagre
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(g as any).setParent(id, parentId)
      }
    }
  }

  const edgeByEndpoints = new Map<string, GraphEdge>()
  const orderedEdges = [...edges].sort((a, b) => {
    const as = getEndpointId(a.source as unknown)
    const at = getEndpointId(a.target as unknown)
    const bs = getEndpointId(b.source as unknown)
    const bt = getEndpointId(b.target as unknown)
    const ka = `${as}->${at}`
    const kb = `${bs}->${bt}`
    return ka.localeCompare(kb)
  })
  
  for (const edge of orderedEdges) {
    const source = getEndpointId(edge.source as unknown)
    const target = getEndpointId(edge.target as unknown)
    if (!source || !target) continue
    if (source === target) continue
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue
    
    // Use direct edges first. If Dagre crashes, we fall back to tight-tree.
    // We previously used dummy nodes to avoid crashes, but that broke vertical stacking of subgraphs.
    // const dagreSource = isSourceSubgraph ? subgraphDummyId.get(source) || source : source
    // const dagreTarget = isTargetSubgraph ? subgraphDummyId.get(target) || target : target
    
    const k = `${source}->${target}`
    if (!edgeByEndpoints.has(k)) edgeByEndpoints.set(k, edge)
    
    // Debug critical edges
    if (source.includes('PresentationStart') || target.includes('BusinessProblem')) {
        // console.log(`Adding edge: ${source} -> ${target}`)
    }
    
    // Use dummy nodes for subgraph connections to enforce layout and avoid crashes
    const dagreSource = subgraphDummyId.get(source) || source
    const dagreTarget = subgraphDummyId.get(target) || target
    
    // ENHANCE: Increase minlen for subgraph-to-subgraph edges to encourage vertical stacking
    const isSubgraphEdge = subgraphDummyId.has(source) || subgraphDummyId.has(target)
    const options = isSubgraphEdge ? { minlen: 5, weight: 100 } : {}

    try {
      g.setEdge(dagreSource, dagreTarget, options)
    } catch {
      continue
    }
  }

  try {
    dagre.layout(g)
  } catch (err) {
    console.warn('Mermaid Layout: Dagre layout failed with network-simplex, falling back to tight-tree', err)
    // Fallback to tight-tree if network-simplex fails
    g.setGraph({
      rankdir,
      nodesep: nodeSep,
      ranksep: rankSep,
      marginx: 40,
      marginy: 40,
      ranker: 'tight-tree',
    })
    try {
      dagre.layout(g)
    } catch (err2) {
       console.error('Mermaid Layout: Fallback failed', err2)
    }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const positions = new Map<string, { x: number; y: number }>()
  
  // ENHANCE: Use for...of for cleaner iteration over g.nodes()
  const graphNodes = g.nodes()
  for (const v of graphNodes) {
    const layoutNodeRaw = g.node(v) as unknown
    if (!isRecordType(layoutNodeRaw)) continue
    const x = typeof layoutNodeRaw.x === 'number' ? layoutNodeRaw.x : null
    const y = typeof layoutNodeRaw.y === 'number' ? layoutNodeRaw.y : null
    if (x == null || y == null) continue

    positions.set(v, { x, y })

    const node = nodeById.get(String(v))
    if (node) {
      const w = typeof layoutNodeRaw.width === 'number' ? layoutNodeRaw.width : null
      const h = typeof layoutNodeRaw.height === 'number' ? layoutNodeRaw.height : null
      if (!node.properties) node.properties = {}
      if (w != null && Number.isFinite(w)) node.properties['visual:width'] = w
      if (h != null && Number.isFinite(h)) node.properties['visual:height'] = h
      node.properties['visual:x'] = x
      node.properties['visual:y'] = y
    }

    if (Number.isFinite(x)) {
      if (x! < minX) minX = x!
      if (x! > maxX) maxX = x!
    }
    if (Number.isFinite(y)) {
      if (y! < minY) minY = y!
      if (y! > maxY) maxY = y!
    }
  }
  
  // Re-calculate bounds based ONLY on real nodes (excluding dummies) to ensure visual centering
  minX = Infinity
  maxX = -Infinity
  minY = Infinity
  maxY = -Infinity
  
  for (const node of [...validNodes, ...subgraphNodes]) {
      const id = String(node.id)
      const pos = positions.get(id)
      if (!pos) continue
      
      // We need to account for node width/height to center the BOUNDING BOX, not just centers
      const w = Number(node.properties?.['visual:width']) || 0
      const h = Number(node.properties?.['visual:height']) || 0
      
      const left = pos.x - w / 2
      const right = pos.x + w / 2
      const top = pos.y - h / 2
      const bottom = pos.y + h / 2
      
      if (left < minX) minX = left
      if (right > maxX) maxX = right
      if (top < minY) minY = top
      if (bottom > maxY) maxY = bottom
  }

  if (minX === Infinity || maxX === -Infinity) return

  const graphWidth = maxX - minX
  const graphHeight = maxY - minY
  const centerX = minX + graphWidth / 2
  const centerY = minY + graphHeight / 2

  const targetCenterX = width / 2
  const targetCenterY = height / 2

  const offsetX = targetCenterX - centerX
  const offsetY = targetCenterY - centerY

  for (const node of validNodes) {
    const id = String(node.id)
    const pos = positions.get(id)
    if (!pos) continue
    node.x = pos.x + offsetX
    node.y = pos.y + offsetY
    node.fx = node.x
    node.fy = node.y
  }

  for (const node of subgraphNodes) {
    const id = String(node.id)
    const pos = positions.get(id)
    if (!pos) continue

    if (!node.properties) node.properties = {}
    
    // We get the width/height from dagre layout result
    const layoutNodeRaw = g.node(id) as { width?: number; height?: number } | undefined
    if (layoutNodeRaw) {
       const w = typeof layoutNodeRaw.width === 'number' ? layoutNodeRaw.width : 0
       const h = typeof layoutNodeRaw.height === 'number' ? layoutNodeRaw.height : 0
       node.properties['visual:width'] = w
       node.properties['visual:height'] = h
    }

    node.properties['visual:x'] = pos.x
    node.properties['visual:y'] = pos.y

    node.x = pos.x + offsetX
    node.y = pos.y + offsetY
    node.fx = node.x
    node.fy = node.y
  }

  // 4. Map edges back
  for (const edge of orderedEdges) {
    const source = getEndpointId(edge.source as unknown)
    const target = getEndpointId(edge.target as unknown)
    if (!source || !target || source === target) continue

    const dagreSource = subgraphDummyId.get(source) || source
    const dagreTarget = subgraphDummyId.get(target) || target

    const edgeRaw = g.edge(dagreSource, dagreTarget) as unknown
    const pointsRaw = isRecordType(edgeRaw) && Array.isArray(edgeRaw.points) ? (edgeRaw.points as unknown[]) : null
    const edgePoints = pointsRaw
      ? pointsRaw
          .map((p) => {
            if (!isRecordType(p)) return null
            const x = typeof p.x === 'number' ? p.x : null
            const y = typeof p.y === 'number' ? p.y : null
            if (x == null || y == null) return null
            return { x, y }
          })
          .filter((p): p is { x: number; y: number } => !!p)
      : null

    if (!edgePoints || edgePoints.length === 0) continue
    if (!edge.properties) edge.properties = {}
    edge.properties['visual:points'] = edgePoints.map((p) => ({
      x: p.x + offsetX,
      y: p.y + offsetY,
    }))
  }
}
