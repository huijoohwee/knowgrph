import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

type PmfNode = {
  id: string
  label?: string
  tagline?: string
  techStack?: unknown
  tools?: unknown
  problems?: unknown
  scores?: unknown
  pmfScore?: unknown
  gapScore?: unknown
  gridX?: unknown
  gridZ?: unknown
}

type PmfLayer = {
  id: string
  level?: unknown
  label?: string
  sublabel?: string
  threeY?: unknown
  color?: unknown
  plateOpacity?: unknown
  maxVoxelHeight?: unknown
  nodes?: PmfNode[]
}

type PmfEdge = { id?: string; from?: string; to?: string; layers?: string }

type PmfPayload = {
  meta?: Record<string, unknown>
  layers?: PmfLayer[]
  edges?: PmfEdge[]
}

const asNumber = (v: unknown): number | null => {
  if (typeof v !== 'number') return null
  if (!Number.isFinite(v)) return null
  return v
}

const asString = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))

export function pmfVoxelToGraphData(input: unknown): GraphData {
  const obj = (input && typeof input === 'object' && !Array.isArray(input)) ? (input as PmfPayload) : null
  const layers = Array.isArray(obj?.layers) ? obj!.layers! : []
  const edges = Array.isArray(obj?.edges) ? obj!.edges! : []
  const nodesOut: GraphNode[] = []
  const seenNodeIds = new Set<string>()

  for (let li = 0; li < layers.length; li += 1) {
    const layer = layers[li]
    if (!layer || typeof layer !== 'object') continue
    const layerId = String(layer.id || '').trim()
    const layerLabel = String(layer.label || layerId || `layer-${li}`).trim()
    const level = asNumber(layer.level) ?? li
    const layerColor = typeof layer.color === 'string' ? String(layer.color).trim() : ''
    const layerThreeY = asNumber(layer.threeY)
    const layerPlateOpacity = asNumber(layer.plateOpacity)
    const layerMaxVoxelHeight = asNumber(layer.maxVoxelHeight)
    const layerNodes = Array.isArray(layer.nodes) ? layer.nodes : []
    for (let ni = 0; ni < layerNodes.length; ni += 1) {
      const n = layerNodes[ni]
      if (!n) continue
      const id = String(n.id || '').trim()
      if (!id || seenNodeIds.has(id)) continue
      seenNodeIds.add(id)
      const label = String(n.label || id).trim()
      const scoresObj = (n.scores && typeof n.scores === 'object' && !Array.isArray(n.scores)) ? (n.scores as Record<string, unknown>) : null
      const scores: Record<string, JSONValue> | undefined = scoresObj
        ? ({
          money: (asNumber(scoresObj.money) ?? 0) as JSONValue,
          man: (asNumber(scoresObj.man) ?? 0) as JSONValue,
          machine: (asNumber(scoresObj.machine) ?? 0) as JSONValue,
        } as Record<string, JSONValue>)
        : undefined

      const props: Record<string, JSONValue> = {
        'visual:layer': (layerId || layerLabel).toLowerCase() as JSONValue,
        'visual:layerLevel': level as JSONValue,
        ...(layerLabel ? ({ 'layer:label': layerLabel } as Record<string, JSONValue>) : {}),
        ...(layer.sublabel ? ({ 'layer:sublabel': String(layer.sublabel) } as Record<string, JSONValue>) : {}),
        ...(layerColor ? ({ 'layer:color': layerColor } as Record<string, JSONValue>) : {}),
        ...(layerThreeY != null ? ({ 'layer:threeY': layerThreeY as JSONValue } as Record<string, JSONValue>) : {}),
        ...(layerPlateOpacity != null ? ({ 'layer:plateOpacity': layerPlateOpacity as JSONValue } as Record<string, JSONValue>) : {}),
        ...(layerMaxVoxelHeight != null ? ({ 'layer:maxVoxelHeight': layerMaxVoxelHeight as JSONValue } as Record<string, JSONValue>) : {}),
        ...(n.tagline ? ({ tagline: String(n.tagline) } as Record<string, JSONValue>) : {}),
        ...(scores ? ({ scores } as Record<string, JSONValue>) : {}),
      }
      const pmfScore = asNumber(n.pmfScore)
      if (pmfScore != null) props.pmfScore = pmfScore as JSONValue
      const gapScore = asNumber(n.gapScore)
      if (gapScore != null) props.gapScore = gapScore as JSONValue

      const gridX = asNumber(n.gridX)
      const gridZ = asNumber(n.gridZ)
      if (gridX != null) props.gridX = gridX as JSONValue
      if (gridZ != null) props.gridZ = gridZ as JSONValue

      const techStack = Array.isArray(n.techStack) ? n.techStack.map(asString).filter(Boolean) : null
      if (techStack && techStack.length) props.techStack = techStack as unknown as JSONValue
      const tools = Array.isArray(n.tools) ? n.tools.map(asString).filter(Boolean) : null
      if (tools && tools.length) props.tools = tools as unknown as JSONValue
      const problems = Array.isArray(n.problems) ? n.problems.map(asString).filter(Boolean) : null
      if (problems && problems.length) props.problems = problems as unknown as JSONValue

      nodesOut.push({
        id,
        type: layerId || layerLabel || 'layer',
        label,
        properties: props,
      } as GraphNode)
    }
  }

  const edgesOut: GraphEdge[] = []
  const seenEdgeIds = new Set<string>()
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    if (!e) continue
    const src = String(e.from || '').trim()
    const tgt = String(e.to || '').trim()
    if (!src || !tgt) continue
    const id = String(e.id || `pmf-edge-${i}`).trim()
    if (!id || seenEdgeIds.has(id)) continue
    seenEdgeIds.add(id)
    edgesOut.push({
      id,
      source: src,
      target: tgt,
      label: String(e.layers || 'edge'),
      properties: {
        layers: String(e.layers || ''),
      } as unknown as Record<string, JSONValue>,
    } as GraphEdge)
  }

  const meta = (obj?.meta && typeof obj.meta === 'object' && !Array.isArray(obj.meta)) ? obj.meta : {}
  const metadata: Record<string, JSONValue> = {
    kind: 'pmfVoxel',
    title: typeof meta.title === 'string' ? meta.title : 'PMF Voxel',
    version: typeof meta.version === 'string' ? meta.version : '1.0.0',
  }
  return {
    type: 'Graph',
    context: 'pmfVoxel',
    nodes: nodesOut,
    edges: edgesOut,
    metadata,
  } as GraphData
}
