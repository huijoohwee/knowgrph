import type { GraphData, GraphNode, GraphEdge, JSONValue } from './types'

type N8nNode = {
  id: string
  name: string
  type: string
  typeVersion?: number
  position?: [number, number]
  parameters?: Record<string, JSONValue>
  credentials?: Record<string, JSONValue>
}

type N8nConnections = Record<string, Record<string, Array<{ node: string; type: string; index: number }>>>

export const isN8nWorkflow = (json: unknown): boolean => {
  try {
    const obj = (json && typeof json === 'object') ? (json as Record<string, unknown>) : {}
    const nodes = Array.isArray(obj.nodes) ? obj.nodes : []
    const hasConnections = obj && typeof obj.connections === 'object'
    if (!nodes.length || !hasConnections) return false
    const t0 = String(nodes[0]?.type || '')
    return t0.includes('n8n-nodes-') || t0.includes('@n8n/')
  } catch {
    return false
  }
}

export const parseN8nWorkflow = (json: unknown): { graphData: GraphData; warnings: string[] } => {
  const warnings: string[] = []
  const obj = (json && typeof json === 'object') ? (json as Record<string, unknown>) : {}
  const nodesSrc: N8nNode[] = Array.isArray(obj.nodes) ? (obj.nodes as N8nNode[]) : []
  const nameToId = new Map<string, string>()
  const nodes: GraphNode[] = nodesSrc.map((n) => {
    const id = String(n.id)
    const label = String(n.name || id)
    const type = String(n.type || 'Entity')
    nameToId.set(label, id)
    const props: Record<string, JSONValue> = {}
    if (n.parameters && typeof n.parameters === 'object') props.parameters = n.parameters
    if (n.credentials && typeof n.credentials === 'object') props.credentials = n.credentials
    if (typeof n.typeVersion === 'number') props.typeVersion = n.typeVersion
    const node: GraphNode = { id, label, type, properties: props }
    if (Array.isArray(n.position) && n.position.length === 2) {
      const [x, y] = n.position
      if (typeof x === 'number') node.x = x
      if (typeof y === 'number') node.y = y
    }
    return node
  })

  const rawConn = (obj as Record<string, unknown>).connections
  const conn: N8nConnections = (rawConn && typeof rawConn === 'object') ? (rawConn as N8nConnections) : {}
  const edges: GraphEdge[] = []
  const sourceNames = Object.keys(conn)
  for (const srcName of sourceNames) {
    const byChannel = conn[srcName] || {}
    const srcId = nameToId.get(srcName)
    if (!srcId) {
      warnings.push(`Unresolved source node name: ${srcName}`)
      continue
    }
    for (const channel of Object.keys(byChannel)) {
      const arr = byChannel[channel] || []
      for (let i = 0; i < arr.length; i++) {
        const dstName = String(arr[i]?.node || '')
        const dstId = nameToId.get(dstName)
        if (!dstId) {
          warnings.push(`Unresolved target node name: ${dstName}`)
          continue
        }
        edges.push({
          id: `${srcId}-${channel}-${dstId}-${i}`,
          source: srcId,
          target: dstId,
          label: channel,
          properties: { index: arr[i]?.index },
        })
      }
    }
  }

  const graphData: GraphData = {
    context: 'n8n-workflow',
    type: 'Graph',
    nodes,
    edges,
  }
  return { graphData, warnings }
}
