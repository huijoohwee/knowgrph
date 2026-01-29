import { GraphData } from './types';

export const filterGraphToFrontmatterMermaid = (data: GraphData): GraphData => {
  const allNodes = data.nodes || []
  const allEdges = data.edges || []
  const nodeById = new Map(allNodes.map(n => [String(n.id), n]))

  const isFrontmatterMermaidNode = (id: string): boolean => {
    const n = nodeById.get(id)
    if (!n) return false
    const props = (n.properties || {}) as Record<string, unknown>
    return props.isMermaidFrontmatter === true || props.mermaidScope === 'frontmatter'
  }

  const seedIds = allNodes
    .map(n => String(n.id))
    .filter(id => isFrontmatterMermaidNode(id))

  if (seedIds.length === 0) return data

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

  while (queue.length > 0) {
    const cur = queue.shift() as string
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
