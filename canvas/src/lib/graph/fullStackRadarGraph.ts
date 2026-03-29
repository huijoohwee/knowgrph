import type { GraphData, GraphEdge, GraphNode, JSONValue } from './types'

type StackEntry = Record<string, unknown>

const asObject = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const asText = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const slug = (value: string): string => {
  const s = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'node'
}

const clusterFromLayer = (layerRaw: unknown): { id: string; label: string } => {
  const parts = Array.isArray(layerRaw) ? layerRaw : [layerRaw]
  const tokens = parts
    .map(v => asText(v).trim())
    .filter(Boolean)
    .flatMap(v => v.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
  const has = (k: string) => tokens.includes(k)

  if (has('scm') || has('infra') || has('deploy') || has('ci') || has('cd')) return { id: 'infra', label: 'Infrastructure' }
  if (has('scraping') || has('ingestion') || has('source')) return { id: 'scraping', label: 'Scraping' }
  if (has('orchestration') || has('ai') || has('proxy') || has('model')) return { id: 'ai', label: 'AI' }
  if (has('database') || has('storage') || has('cache') || has('dedup')) return { id: 'storage', label: 'Storage' }
  if (has('queue') || has('scheduler') || has('redis')) return { id: 'queue', label: 'Queue' }
  if (has('api') || has('edge') || has('worker')) return { id: 'api', label: 'API' }
  if (has('bot') || has('alert') || has('notification')) return { id: 'bot', label: 'Bot' }
  if (has('canvas') || has('frontend') || has('hosting') || has('cdn')) return { id: 'frontend', label: 'Frontend' }

  const first = asText(parts[0] || '').trim()
  if (!first) return { id: 'general', label: 'General' }
  return { id: slug(first), label: first }
}

const parseDfStage = (entry: StackEntry): number | null => {
  const dataFlow = asObject(entry.data_flow)
  const raw = asText(dataFlow?.df_stage || '').trim().toLowerCase()
  const m = raw.match(/(\d+)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

const buildFlowEdges = (nodesByStage: Map<number, GraphNode[]>): GraphEdge[] => {
  const stages = Array.from(nodesByStage.keys()).sort((a, b) => a - b)
  const edges: GraphEdge[] = []
  let idx = 0
  for (let s = 0; s < stages.length - 1; s += 1) {
    const from = nodesByStage.get(stages[s]!) || []
    const to = nodesByStage.get(stages[s + 1]!) || []
    if (from.length === 0 || to.length === 0) continue
    for (let i = 0; i < from.length; i += 1) {
      const src = from[i]!
      const pick = to[Math.floor((i * to.length) / Math.max(1, from.length))]
      if (!pick) continue
      idx += 1
      edges.push({
        id: `flow:${idx}`,
        source: String(src.id),
        target: String(pick.id),
        label: 'pointsTo',
        properties: {
          'kg:radarFlow': true,
          'visual:curve': 'quadratic',
          'visual:curveInterpolator': 'orbital',
          'visual:curveBend': 0.18,
          'visual:orbitShift': 0.06,
          'visual:pathD': 'M0,0 Q0,0 0,0',
          'visual:arrowD': 'M0,0 L0,0 L0,0 Z',
          force_strength: 0.16,
          distance_px: 360,
          'visual:width': 1.9,
        },
      })
    }
  }
  return edges
}

export const isFullStackRadarSource = (raw: unknown): boolean => {
  const obj = asObject(raw)
  if (!obj) return false
  const stack = asArray(obj.stack).map(asObject).filter(Boolean) as StackEntry[]
  if (stack.length < 4) return false
  let hasTool = 0
  let hasLayer = 0
  for (let i = 0; i < stack.length; i += 1) {
    const item = stack[i]!
    if (asText(item.tool || '').trim()) hasTool += 1
    const layer = item.layer
    if ((typeof layer === 'string' && layer.trim()) || (Array.isArray(layer) && layer.length > 0)) hasLayer += 1
  }
  return hasTool >= Math.max(3, Math.floor(stack.length * 0.5)) && hasLayer >= Math.max(3, Math.floor(stack.length * 0.5))
}

export const buildFullStackRadarGraph = (raw: unknown): GraphData | null => {
  if (!isFullStackRadarSource(raw)) return null
  const obj = asObject(raw)
  if (!obj) return null
  const stack = asArray(obj.stack).map(asObject).filter(Boolean) as StackEntry[]
  if (stack.length === 0) return null

  const clusterOrder: string[] = []
  const clusterLabelById = new Map<string, string>()
  const toolNodes: GraphNode[] = []
  const nodesByStage = new Map<number, GraphNode[]>()
  const usedIds = new Set<string>()

  const nextToolId = (entry: StackEntry, i: number): string => {
    const rawId = asText(entry.id || '').trim()
    const base = rawId ? `tool:${slug(rawId)}` : `tool:${slug(asText(entry.tool || `item-${i + 1}`))}`
    let id = base
    let n = 1
    while (usedIds.has(id)) {
      n += 1
      id = `${base}-${n}`
    }
    usedIds.add(id)
    return id
  }

  for (let i = 0; i < stack.length; i += 1) {
    const entry = stack[i]!
    const toolName = asText(entry.tool || '').trim() || `Tool ${i + 1}`
    const risk = asText(entry.risk || '').trim().toLowerCase()
    const criticalPath = asObject(entry.critical_path)
    const isP0 = Boolean(entry.p0) || (asText(criticalPath?.status || '').includes('P0') || asText(criticalPath?.category || '').toLowerCase().includes('p0'))
    const cluster = clusterFromLayer(entry.layer)
    if (!clusterLabelById.has(cluster.id)) {
      clusterOrder.push(cluster.id)
      clusterLabelById.set(cluster.id, cluster.label)
    }
    const nodeId = nextToolId(entry, i)
    const radius =
      risk === 'high' ? 20 : risk === 'medium' || risk === 'med' ? 16 : 13
    const node: GraphNode = {
      id: nodeId,
      label: toolName,
      type: 'tool',
      properties: {
        layer: Array.isArray(entry.layer) ? entry.layer.join(' · ') : asText(entry.layer || ''),
        risk: asText(entry.risk || ''),
        tco: asText(entry.tco || ''),
        locality: asText(entry.locality || ''),
        'kg:radarCluster': cluster.id,
        'kg:radarNode': true,
        'visual:shape': 'circle',
        'visual:radius': radius,
        ...(isP0 ? { 'visual:strokeWidth': 3.2 } : {}),
      } as Record<string, JSONValue>,
    }
    const stage = parseDfStage(entry)
    if (stage != null) {
      const arr = nodesByStage.get(stage) || []
      arr.push(node)
      nodesByStage.set(stage, arr)
    }
    toolNodes.push(node)
  }

  const hubRadius = 900
  const hubNodes: GraphNode[] = []
  const spokes: GraphEdge[] = []
  const toolByCluster = new Map<string, GraphNode[]>()
  for (let i = 0; i < toolNodes.length; i += 1) {
    const tool = toolNodes[i]!
    const clusterId = asText((tool.properties || {})['kg:radarCluster'] || '').trim() || 'general'
    const arr = toolByCluster.get(clusterId) || []
    arr.push(tool)
    toolByCluster.set(clusterId, arr)
  }

  for (let i = 0; i < clusterOrder.length; i += 1) {
    const clusterId = clusterOrder[i]!
    const angle = (Math.PI * 2 * i) / Math.max(1, clusterOrder.length) - Math.PI / 2
    const x = Math.cos(angle) * hubRadius
    const y = Math.sin(angle) * hubRadius
    const hubId = `hub:${clusterId}`
    const clusterLabel = clusterLabelById.get(clusterId) || clusterId
    hubNodes.push({
      id: hubId,
      label: clusterLabel,
      type: 'hub',
      x,
      y,
      properties: {
        'kg:radarHub': true,
        'kg:radarCluster': clusterId,
        'visual:shape': 'circle',
        'visual:radius': 34,
        'visual:strokeWidth': 2.6,
      },
    })
    const members = toolByCluster.get(clusterId) || []
    for (let j = 0; j < members.length; j += 1) {
      const m = members[j]!
      const ringIndex = Math.floor(j / 6)
      const inRingIndex = j % 6
      const ringSize = Math.min(8, Math.max(4, members.length - ringIndex * 4))
      const spread = Math.PI * Math.min(0.95, 0.58 + ringIndex * 0.12)
      const centered = ((inRingIndex + 0.5) / Math.max(1, ringSize)) - 0.5
      const localAngle = angle + centered * spread
      const orbit = 138 + ringIndex * 44 + (inRingIndex % 2 === 0 ? 0 : 10)
      m.x = x + Math.cos(localAngle) * orbit
      m.y = y + Math.sin(localAngle) * orbit
      spokes.push({
        id: `spoke:${clusterId}:${String(m.id)}`,
        source: hubId,
        target: String(m.id),
        label: 'spokeTo',
        properties: {
          'kg:radarSpoke': true,
          'visual:dash': '3,6',
          'visual:width': 1.4,
          force_strength: 0.62,
          distance_px: 150,
        },
      })
    }
  }

  const flow = buildFlowEdges(nodesByStage)
  const nodes = [...hubNodes, ...toolNodes]
  const edges = [...spokes, ...flow]
  if (nodes.length === 0) return null

  return {
    type: 'apiGraph',
    context: 'full-stack-radar-json',
    metadata: {
      source: 'full-stack-radar-json',
      graphKind: 'radar-galaxy',
      importedShape: 'stack-pipeline',
      superClusterCount: hubNodes.length,
      toolCount: toolNodes.length,
      flowEdgeCount: flow.length,
    },
    nodes,
    edges,
  }
}
