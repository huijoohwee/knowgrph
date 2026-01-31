import ELK from 'elkjs/lib/elk.bundled.js'
import type { GraphData } from '@/lib/graph/types'
import type { FlowConfig } from './config'
import { buildFlowHandleId, computeFlowHandlesByNode } from './handles'

type ElkPortSide = 'WEST' | 'EAST'

type ElkNode = {
  id: string
  width: number
  height: number
  ports?: Array<{ id: string; properties?: Record<string, string> }>
}

type ElkEdge = {
  id: string
  sources: string[]
  targets: string[]
}

type ElkGraph = {
  id: string
  layoutOptions: Record<string, string>
  children: ElkNode[]
  edges: ElkEdge[]
}

type ElkLayoutChild = { id?: unknown; x?: unknown; y?: unknown }
type ElkLayoutResult = { children?: unknown }

export async function buildElkLayout(args: {
  graphData: Pick<GraphData, 'nodes' | 'edges'>
  config: FlowConfig
  layout?: (graph: ElkGraph) => Promise<unknown>
}): Promise<Record<string, { x: number; y: number }>> {
  const nodeList = Array.isArray(args.graphData?.nodes) ? args.graphData.nodes : []
  const edgeList = Array.isArray(args.graphData?.edges) ? args.graphData.edges : []

  const config = args.config
  const portId = (nodeId: string, handleId: string) => `${nodeId}:${handleId}`

  const nodeById = new Set<string>()
  for (let i = 0; i < nodeList.length; i += 1) {
    const id = String(nodeList[i]?.id || '').trim()
    if (id) nodeById.add(id)
  }

  const handlesByNode = computeFlowHandlesByNode({
    nodes: nodeList as ReadonlyArray<{ id: unknown }>,
    edges: edgeList as ReadonlyArray<{ id: unknown; source: unknown; target: unknown }>,
  })

  const elkNodes: ElkNode[] = nodeList
    .map(n => {
      const id = String(n?.id || '').trim()
      if (!id) return null
      const handles = handlesByNode[id] || { in: [], out: [] }
      const ports: Array<{ id: string; properties?: Record<string, string> }> = []
      for (let i = 0; i < handles.in.length; i += 1) {
        ports.push({
          id: portId(id, handles.in[i].id),
          properties: {
            'elk.port.side': 'WEST' satisfies ElkPortSide,
            'elk.port.index': String(i),
          },
        })
      }
      for (let i = 0; i < handles.out.length; i += 1) {
        ports.push({
          id: portId(id, handles.out[i].id),
          properties: {
            'elk.port.side': 'EAST' satisfies ElkPortSide,
            'elk.port.index': String(i),
          },
        })
      }
      return {
        id,
        width: config.node.widthPx,
        height: config.node.heightPx,
        ports,
      } satisfies ElkNode
    })
    .filter(Boolean) as ElkNode[]

  const elkEdges: ElkEdge[] = edgeList
    .map(e => {
      const id = String(e?.id || '').trim()
      const source = String(e?.source || '').trim()
      const target = String(e?.target || '').trim()
      if (!id || !source || !target) return null
      if (!nodeById.has(source) || !nodeById.has(target)) return null
      const sourceHandle = buildFlowHandleId({ dir: 'out', edgeId: id })
      const targetHandle = buildFlowHandleId({ dir: 'in', edgeId: id })
      return {
        id,
        sources: [portId(source, sourceHandle)],
        targets: [portId(target, targetHandle)],
      } satisfies ElkEdge
    })
    .filter(Boolean) as ElkEdge[]

  const graph: ElkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': config.elk.direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.spacing.nodeNode': String(config.elk.nodeNodeSpacingPx),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(config.elk.layerSpacingPx),
      'elk.spacing.edgeNode': String(config.elk.edgeNodeSpacingPx),
      'elk.portConstraints': 'FIXED_SIDE',
    },
    children: elkNodes,
    edges: elkEdges,
  }

  const timeoutMs = Math.max(200, Math.floor(config.elk.layoutTimeoutMs))

  const layout = typeof args.layout === 'function' ? args.layout : (g: ElkGraph) => new ELK().layout(g)
  const layoutPromise = layout(graph)
  const timed = await Promise.race([
    layoutPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('elk layout timeout')), timeoutMs)),
  ])

  const timedGraph = timed as ElkLayoutResult
  const childrenRaw = timedGraph?.children
  const children = Array.isArray(childrenRaw) ? (childrenRaw as unknown[]) : []

  const out: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < children.length; i += 1) {
    const c = children[i] as ElkLayoutChild
    const id = String(c?.id ?? '').trim()
    const x = typeof c?.x === 'number' ? c.x : NaN
    const y = typeof c?.y === 'number' ? c.y : NaN
    if (!id) continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out[id] = { x, y }
  }
  return out
}
