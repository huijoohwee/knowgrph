import dagre from 'dagre'
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { calculateNodeDimensions } from '@/components/GraphCanvas/layout/utils'

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const getEndpointId = (v: unknown): string => {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (isRecord(v) && (typeof v.id === 'string' || typeof v.id === 'number')) return String(v.id)
  return ''
}

const wrapCache = new Map<string, string>()

const wrapTextByMaxChars = (raw: string, maxCharsPerLine: number): string => {
  const key = `${raw}:${maxCharsPerLine}`
  if (wrapCache.has(key)) return wrapCache.get(key)!

  const maxChars = Number.isFinite(maxCharsPerLine) && maxCharsPerLine > 1 ? Math.floor(maxCharsPerLine) : 1
  const normalized = String(raw || '').replace(/\r\n?/g, '\n')
  const inputLines = normalized.split('\n')

  const chunkWord = (word: string): string[] => {
    const out: string[] = []
    const w = String(word || '')
    if (!w) return ['']
    for (let i = 0; i < w.length; i += maxChars) out.push(w.slice(i, i + maxChars))
    return out
  }

  const wrapLine = (line: string): string[] => {
    const rawLine = String(line || '')
    const trimmed = rawLine.trim()
    if (!trimmed) return ['']
    if (!/\s/.test(trimmed)) {
      if (trimmed.length <= maxChars) return [trimmed]
      return chunkWord(trimmed)
    }
    const words = trimmed.split(/\s+/).filter(Boolean)
    const out: string[] = []
    let current = ''
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i]
      if (!current) {
        if (word.length <= maxChars) {
          current = word
        } else {
          const chunks = chunkWord(word)
          if (chunks.length > 1) out.push(...chunks.slice(0, -1))
          current = chunks[chunks.length - 1] || ''
        }
        continue
      }
      if (current.length + 1 + word.length <= maxChars) {
        current = `${current} ${word}`
        continue
      }
      out.push(current)
      if (word.length <= maxChars) {
        current = word
      } else {
        const chunks = chunkWord(word)
        if (chunks.length > 1) out.push(...chunks.slice(0, -1))
        current = chunks[chunks.length - 1] || ''
      }
    }
    if (current) out.push(current)
    return out.length ? out : ['']
  }

  const outLines: string[] = []
  for (let i = 0; i < inputLines.length; i += 1) outLines.push(...wrapLine(inputLines[i]))
  const result = outLines.join('\n')
  wrapCache.set(key, result)
  return result
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

  const separation = typeof mermaidConfig?.separation === 'number' ? mermaidConfig.separation : 1.2
  const nodeSep = 60 * separation
  const rankSep = 70 * separation

  const g = new dagre.graphlib.Graph({ multigraph: false, compound: true })
  g.setGraph({
    rankdir,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: 80,
    marginy: 80,
    ranker: 'network-simplex',
  })
  g.setDefaultEdgeLabel(() => ({}))

  // 1. Add Subgraphs (Groups) to Dagre first
  for (let i = 0; i < subgraphNodes.length; i += 1) {
    const n = subgraphNodes[i]
    const id = String(n.id)
    // Add as group node - let dagre compute dimensions based on children
    g.setNode(id, { label: n.label, clusterLabelPos: 'top', style: 'fill: transparent; stroke: none;' }) 
  }

  // 2. Add Regular Nodes
  for (let i = 0; i < validNodes.length; i += 1) {
    const node = validNodes[i]
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

  for (const n of allLayoutNodes) {
    const id = String(n.id)
    const props = (n.properties || {}) as Record<string, unknown>
    const parentName = String(props.mermaidSubgraphName || '').trim()
    if (parentName) {
      const parentId = subgraphIdByName.get(parentName)
      if (parentId && parentId !== id) {
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
  for (let i = 0; i < orderedEdges.length; i += 1) {
    const edge = orderedEdges[i]
    const source = getEndpointId(edge.source as unknown)
    const target = getEndpointId(edge.target as unknown)
    if (!source || !target) continue
    if (source === target) continue
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue
    
    // Safety: Filter out edges that connect to/from subgraphs directly to prevent Dagre ranker crashes
    // (Dagre's network-simplex can fail if edges connect to cluster nodes in certain topologies)
    const isSourceSubgraph = subgraphNodes.some(n => String(n.id) === source)
    const isTargetSubgraph = subgraphNodes.some(n => String(n.id) === target)
    if (isSourceSubgraph || isTargetSubgraph) continue

    const k = `${source}->${target}`
    if (!edgeByEndpoints.has(k)) edgeByEndpoints.set(k, edge)
    try {
      g.setEdge(source, target)
    } catch {
      continue
    }
  }

  try {
    dagre.layout(g)
  } catch (e) {
    console.error('Mermaid Layout: Dagre layout failed', e)
    return
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const positions = new Map<string, { x: number; y: number }>()
  g.nodes().forEach((v) => {
    const layoutNodeRaw = g.node(v) as unknown
    if (!isRecord(layoutNodeRaw)) return
    const x = typeof layoutNodeRaw.x === 'number' ? layoutNodeRaw.x : null
    const y = typeof layoutNodeRaw.y === 'number' ? layoutNodeRaw.y : null
    if (x == null || y == null) return

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
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    if (Number.isFinite(y)) {
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  })

  if (minX === Infinity || maxX === -Infinity) return

  const graphWidth = maxX - minX
  const graphHeight = maxY - minY
  const centerX = minX + graphWidth / 2
  const centerY = minY + graphHeight / 2

  const targetCenterX = width / 2
  const targetCenterY = height / 2

  const offsetX = targetCenterX - centerX
  const offsetY = targetCenterY - centerY

  for (let i = 0; i < validNodes.length; i += 1) {
    const node = validNodes[i]
    const id = String(node.id)
    const pos = positions.get(id)
    if (!pos) continue
    node.x = pos.x + offsetX
    node.y = pos.y + offsetY
    node.fx = node.x
    node.fy = node.y
  }

  for (let i = 0; i < subgraphNodes.length; i += 1) {
    const node = subgraphNodes[i]
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

  g.edges().forEach((e) => {
    const key = `${e.v}->${e.w}`
    const edge = edgeByEndpoints.get(key)
    if (!edge) return

    const edgeRaw = g.edge(e.v, e.w) as unknown
    const pointsRaw = isRecord(edgeRaw) && Array.isArray(edgeRaw.points) ? (edgeRaw.points as unknown[]) : null
    const edgePoints = pointsRaw
      ? pointsRaw
          .map((p) => {
            if (!isRecord(p)) return null
            const x = typeof p.x === 'number' ? p.x : null
            const y = typeof p.y === 'number' ? p.y : null
            if (x == null || y == null) return null
            return { x, y }
          })
          .filter((p): p is { x: number; y: number } => !!p)
      : null

    if (!edgePoints || edgePoints.length === 0) return
    if (!edge.properties) edge.properties = {}
    edge.properties['visual:points'] = edgePoints.map((p) => ({
      x: p.x + offsetX,
      y: p.y + offsetY,
    }))
  })
}
