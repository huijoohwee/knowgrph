import { GraphData } from './types';

const FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY = 'flow:quickEditorFormId' as const
const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const
const FLOW_EDGE_SOURCE_PORT_KEY = 'flow:sourcePortKey' as const
const FLOW_EDGE_TARGET_PORT_KEY = 'flow:targetPortKey' as const

const isFrontmatterMermaidNode = (n: { properties?: unknown } | null | undefined): boolean => {
  if (!n) return false
  const props = (n as { properties?: unknown }).properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return false
  const p = props as Record<string, unknown>
  return p.isMermaidFrontmatter === true || p.mermaidScope === 'frontmatter'
}

export const hasFrontmatterMermaidSeeds = (data: GraphData): boolean => {
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  for (let i = 0; i < nodes.length; i += 1) {
    if (isFrontmatterMermaidNode(nodes[i])) return true
  }
  return false
}

export const filterGraphToFrontmatterMermaid = (data: GraphData): GraphData => {
  const allNodes = data.nodes || []
  const allEdges = data.edges || []

  const seedIds: string[] = []
  for (let i = 0; i < allNodes.length; i += 1) {
    const n = allNodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    if (isFrontmatterMermaidNode(n)) seedIds.push(id)
  }

  if (seedIds.length === 0) return data

  const nodeById = new Map(allNodes.map(n => [String(n.id), n]))

  const normalizeEndpointId = (v: unknown): string => {
    if (!v) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'object' && !Array.isArray(v) && 'id' in (v as Record<string, unknown>)) {
      return String((v as Record<string, unknown>).id || '')
    }
    return ''
  }

  const pointsToAdj = new Map<string, string[]>()
  const pointsToIncoming = new Map<string, string[]>()
  for (const e of allEdges) {
    if (String(e.label || '') !== 'pointsTo') continue
    const src = normalizeEndpointId(e.source)
    const tgt = normalizeEndpointId(e.target)
    if (!src || !tgt) continue
    const nextTargets = pointsToAdj.get(src)
    if (nextTargets) {
      nextTargets.push(tgt)
    } else {
      pointsToAdj.set(src, [tgt])
    }
    const nextIncoming = pointsToIncoming.get(tgt)
    if (nextIncoming) {
      nextIncoming.push(src)
    } else {
      pointsToIncoming.set(tgt, [src])
    }
  }

  const included = new Set<string>()
  const queue: string[] = []
  for (const id of seedIds) {
    included.add(id)
    queue.push(id)
  }

  let qi = 0
  while (qi < queue.length) {
    const cur = queue[qi] as string
    qi += 1
    const next = pointsToAdj.get(cur) || []
    for (const tgt of next) {
      if (!included.has(tgt)) {
        included.add(tgt)
        queue.push(tgt)
      }
    }
  }

  for (const tgt of included) {
    const incoming = pointsToIncoming.get(tgt) || []
    for (const src of incoming) {
      const srcNode = nodeById.get(src)
      if (!srcNode) continue
      if (srcNode.type !== 'InternalLink' && srcNode.type !== 'Anchor' && srcNode.type !== 'Paragraph') continue
      const props = (srcNode.properties || {}) as Record<string, unknown>
      if (srcNode.type === 'Paragraph' && props.calloutType !== true) continue
      included.add(src)
    }
  }

  const nodes = allNodes.filter(n => included.has(String(n.id)))
  const edges = allEdges.filter(e => {
    const src = normalizeEndpointId(e.source)
    const tgt = normalizeEndpointId(e.target)
    return src && tgt && included.has(String(src)) && included.has(String(tgt))
  })

  return { ...data, nodes, edges }
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function readEndpointId(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'object' && !Array.isArray(v) && 'id' in (v as Record<string, unknown>)) {
    const id = (v as Record<string, unknown>).id
    if (typeof id === 'string') return id
    if (typeof id === 'number') return Number.isFinite(id) ? String(id) : ''
  }
  return ''
}

function isFlowNode(n: unknown): boolean {
  if (!n || typeof n !== 'object' || Array.isArray(n)) return false
  const props = (n as { properties?: unknown }).properties
  if (!isRecord(props)) return false
  const form = props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]
  if (typeof form === 'string' && form.trim()) return true
  const portTypes = props[FLOW_PORT_TYPES_KEY]
  if (isRecord(portTypes)) return true
  return false
}

function isFlowEdge(e: unknown): boolean {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false
  const props = (e as { properties?: unknown }).properties
  if (!isRecord(props)) return false
  const s = props[FLOW_EDGE_SOURCE_PORT_KEY]
  const t = props[FLOW_EDGE_TARGET_PORT_KEY]
  return (typeof s === 'string' && s.trim().length > 0) || (typeof t === 'string' && t.trim().length > 0)
}

export const filterGraphToFrontmatterFlow = (data: GraphData): GraphData => {
  const allNodes = Array.isArray(data.nodes) ? data.nodes : []
  const allEdges = Array.isArray(data.edges) ? data.edges : []

  const included = new Set<string>()
  for (let i = 0; i < allNodes.length; i += 1) {
    const n = allNodes[i]
    const id = String((n as { id?: unknown })?.id || '').trim()
    if (!id) continue
    if (isFlowNode(n)) included.add(id)
  }

  for (let i = 0; i < allEdges.length; i += 1) {
    const e = allEdges[i]
    if (!isFlowEdge(e)) continue
    const src = readEndpointId((e as { source?: unknown }).source)
    const tgt = readEndpointId((e as { target?: unknown }).target)
    if (src) included.add(src)
    if (tgt) included.add(tgt)
  }

  if (included.size === 0) return data

  const nodes = allNodes.filter(n => included.has(String((n as { id?: unknown })?.id || '').trim()))
  const edges = allEdges.filter(e => {
    const src = readEndpointId((e as { source?: unknown }).source)
    const tgt = readEndpointId((e as { target?: unknown }).target)
    return src && tgt && included.has(src) && included.has(tgt)
  })

  return { ...data, nodes, edges }
}
