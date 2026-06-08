import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { listTypedFlowPortKeys, pickDefaultFlowPortKey, readFlowEdgePortKey, FLOW_PORT_TYPES_KEY } from '@/lib/graph/flowPorts'
import { readNodeProperties } from '@/lib/graph/nodeProperties'
import { isPlainObject } from '@/lib/graph/value'

export type FlowEditorPortRowDirection = 'input' | 'output'

export type FlowEditorPortRow = {
  key: string
  nodeId: string
  nodeLabel: string
  nodeType: string
  direction: FlowEditorPortRowDirection
  portKey: string
  socketType: string
  connectedEdgeCount: number
  connectedEdgeIds: string[]
}

export type FlowEditorPortRowsSummary = {
  inputCount: number
  outputCount: number
  connectedCount: number
  rows: FlowEditorPortRow[]
}

const normalizeString = (value: unknown): string => String(value ?? '').trim()

const readFlowPortSocketType = (node: GraphNode, dir: 'in' | 'out', portKey: string): string => {
  const props = readNodeProperties(node)
  const rawPortTypes = (props as Record<string, JSONValue | undefined>)[FLOW_PORT_TYPES_KEY]
  if (!isPlainObject(rawPortTypes)) return ''
  const bucket = rawPortTypes[dir]
  if (!isPlainObject(bucket)) return ''
  const raw = bucket[portKey]
  return normalizeString(raw)
}

const readComparableEdgePortKey = (args: {
  edge: GraphEdge
  node: GraphNode
  dir: 'in' | 'out'
}): string | null => {
  const side = args.dir === 'out' ? 'source' : 'target'
  return readFlowEdgePortKey(args.edge, side) || pickDefaultFlowPortKey(args.node, args.dir)
}

const listConnectedEdgeIds = (args: {
  graphData: Pick<GraphData, 'edges'>
  node: GraphNode
  dir: 'in' | 'out'
  portKey: string
}): string[] => {
  const edges = Array.isArray(args.graphData.edges) ? args.graphData.edges : []
  const ids: string[] = []
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index]
    if (!edge) continue
    const edgeId = normalizeString(edge.id)
    if (!edgeId) continue
    const { src, tgt } = readGraphEdgeEndpoints(edge)
    const isEndpointMatch = args.dir === 'out' ? src === args.node.id : tgt === args.node.id
    if (!isEndpointMatch) continue
    if (readComparableEdgePortKey({ edge, node: args.node, dir: args.dir }) !== args.portKey) continue
    ids.push(edgeId)
  }
  return ids
}

const buildRowsForNodeDirection = (args: {
  graphData: Pick<GraphData, 'edges'>
  node: GraphNode
  dir: 'in' | 'out'
}): FlowEditorPortRow[] => {
  const portKeys = listTypedFlowPortKeys(args.node, args.dir)
  const direction: FlowEditorPortRowDirection = args.dir === 'in' ? 'input' : 'output'
  const nodeId = normalizeString(args.node.id)
  if (!nodeId || portKeys.length === 0) return []
  const nodeLabel = normalizeString(args.node.label) || nodeId
  const nodeType = normalizeString(args.node.type) || 'Node'
  return portKeys.map(portKey => {
    const socketType = readFlowPortSocketType(args.node, args.dir, portKey) || 'value'
    const connectedEdgeIds = listConnectedEdgeIds({
      graphData: args.graphData,
      node: args.node,
      dir: args.dir,
      portKey,
    })
    return {
      key: `${nodeId}:${direction}:${portKey}`,
      nodeId,
      nodeLabel,
      nodeType,
      direction,
      portKey,
      socketType,
      connectedEdgeCount: connectedEdgeIds.length,
      connectedEdgeIds,
    }
  })
}

const compareNodePosition = (left: GraphNode, right: GraphNode): number => {
  const leftY = Number.isFinite(left.y) ? Number(left.y) : 0
  const rightY = Number.isFinite(right.y) ? Number(right.y) : 0
  if (leftY !== rightY) return leftY - rightY
  const leftX = Number.isFinite(left.x) ? Number(left.x) : 0
  const rightX = Number.isFinite(right.x) ? Number(right.x) : 0
  if (leftX !== rightX) return leftX - rightX
  return normalizeString(left.id).localeCompare(normalizeString(right.id))
}

export function buildFlowEditorPortRows(graphData: Pick<GraphData, 'nodes' | 'edges'> | null | undefined): FlowEditorPortRowsSummary {
  const nodes = Array.isArray(graphData?.nodes) ? [...graphData.nodes].sort(compareNodePosition) : []
  const rows: FlowEditorPortRow[] = []
  const seen = new Set<string>()
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodeRows = [
      ...buildRowsForNodeDirection({ graphData: graphData || { edges: [] }, node, dir: 'in' }),
      ...buildRowsForNodeDirection({ graphData: graphData || { edges: [] }, node, dir: 'out' }),
    ]
    for (let rowIndex = 0; rowIndex < nodeRows.length; rowIndex += 1) {
      const row = nodeRows[rowIndex]
      if (seen.has(row.key)) continue
      seen.add(row.key)
      rows.push(row)
    }
  }
  const inputCount = rows.filter(row => row.direction === 'input').length
  const outputCount = rows.filter(row => row.direction === 'output').length
  const connectedCount = rows.filter(row => row.connectedEdgeCount > 0).length
  return { inputCount, outputCount, connectedCount, rows }
}

export function resolveFlowEditorFocusedEdgeIds(
  graphData: Pick<GraphData, 'nodes' | 'edges'> | null | undefined,
  selectedRowKey: string | null | undefined,
): { active: boolean; edgeIds: string[] } {
  const key = normalizeString(selectedRowKey)
  if (!key) return { active: false, edgeIds: [] }
  const summary = buildFlowEditorPortRows(graphData)
  const row = summary.rows.find(candidate => candidate.key === key)
  if (!row) return { active: false, edgeIds: [] }
  return { active: true, edgeIds: row.connectedEdgeIds }
}
