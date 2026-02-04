import type { GraphData } from '@/lib/graph/types'
import type { FlowConfig } from './config'
import { buildFlowHandleId, computeFlowHandlesByNode } from './handles'

type ElkPortSide = 'WEST' | 'EAST' | 'NORTH' | 'SOUTH'

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

type ElkInstance = { layout: (graph: ElkGraph) => Promise<unknown> }
type ElkConstructor = new (opts?: { workerUrl?: string }) => ElkInstance

let elkInstancePromise: Promise<ElkInstance> | null = null

async function getElkInstance(args?: { requireWorker?: boolean }): Promise<ElkInstance> {
  if (elkInstancePromise) return elkInstancePromise
  elkInstancePromise = (async () => {
    const mod = (await import('elkjs/lib/elk.bundled.js')) as unknown as { default?: unknown }
    const ElkCtor = (mod?.default ?? mod) as ElkConstructor
    let workerUrl: string | null = null
    try {
      const workerMod = (await import('elkjs/lib/elk-worker.min.js?url')) as unknown as { default?: unknown }
      workerUrl = typeof workerMod?.default === 'string' ? workerMod.default : null
    } catch {
      workerUrl = null
    }

    if (workerUrl) return new ElkCtor({ workerUrl })
    if (args?.requireWorker) {
      throw new Error('elk worker unavailable')
    }
    return new ElkCtor()
  })()
  return elkInstancePromise
}

export async function buildElkLayout(args: {
  graphData: Pick<GraphData, 'nodes' | 'edges'>
  config: FlowConfig
  layout?: (graph: ElkGraph) => Promise<unknown>
}): Promise<Record<string, { x: number; y: number }>> {
  const nodeList = Array.isArray(args.graphData?.nodes) ? args.graphData.nodes : []
  const edgeList = Array.isArray(args.graphData?.edges) ? args.graphData.edges : []

  const config = args.config
  const portId = (nodeId: string, handleId: string) => `${nodeId}:${handleId}`
  const inPortSide: ElkPortSide = config.elk.direction === 'RIGHT' ? 'WEST' : 'NORTH'
  const outPortSide: ElkPortSide = config.elk.direction === 'RIGHT' ? 'EAST' : 'SOUTH'

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
            'elk.port.side': inPortSide,
            'elk.port.index': String(i),
          },
        })
      }
      for (let i = 0; i < handles.out.length; i += 1) {
        ports.push({
          id: portId(id, handles.out[i].id),
          properties: {
            'elk.port.side': outPortSide,
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
      'elk.algorithm': config.elk.algorithm,
      'elk.direction': config.elk.direction,
      'elk.spacing.nodeNode': String(config.elk.nodeNodeSpacingPx),
      'elk.spacing.edgeNode': String(config.elk.edgeNodeSpacingPx),
      'elk.portConstraints': 'FIXED_SIDE',
      ...(config.elk.algorithm === 'layered'
        ? {
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
            'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
            'elk.layered.spacing.nodeNodeBetweenLayers': String(config.elk.layerSpacingPx),
          }
        : {}),
    },
    children: elkNodes,
    edges: elkEdges,
  }

  const timeoutMs = Math.max(200, Math.floor(config.elk.layoutTimeoutMs))

  const layout =
    typeof args.layout === 'function'
      ? args.layout
      : async (g: ElkGraph) => {
          const elk = await getElkInstance({ requireWorker: true })
          return elk.layout(g)
        }
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
