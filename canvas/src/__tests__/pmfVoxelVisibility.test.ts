import { parseGraph } from '@/lib/graph/io/adapter'
import { defaultSchema } from '@/lib/graph/schema'
import { computePositionsVoxel } from '@/lib/three/positions.impl'

const PMF_FIXTURE = {
  meta: {
    title: 'Hackamap — PMF Voxel Layer Model',
    version: '1.0.0',
  },
  layers: [
    {
      id: 'product',
      level: 0,
      label: 'PRODUCT',
      color: '#1D9E75',
      nodes: [
        { id: 'hackamap', label: 'Hackamap', gridX: -8, gridZ: 0, scores: { money: 0.5, man: 0.8, machine: 0.7 } },
      ],
    },
    {
      id: 'solution',
      level: 1,
      label: 'SOLUTION',
      color: '#7F77DD',
      nodes: [
        { id: 'build', label: 'Build & Hire', gridX: 1.8, gridZ: 0, scores: { money: 0.6, man: 0.5, machine: 0.9 } },
      ],
    },
    {
      id: 'market',
      level: 2,
      label: 'MARKET',
      color: '#D85A30',
      nodes: [
        { id: 'capital', label: 'Capital', gridX: 5.5, gridZ: 0, scores: { money: 1.0, man: 0.5, machine: 0.3 } },
      ],
    },
  ],
  edges: [
    { id: 'e1', from: 'hackamap', to: 'build', layers: 'product->solution' },
    { id: 'e2', from: 'build', to: 'capital', layers: 'solution->market' },
  ],
}

export const testPmfJsonRoutesToPmfVoxelParser = () => {
  const { data } = parseGraph('PMF.json', JSON.stringify(PMF_FIXTURE))
  if (data.context !== 'pmfVoxel') {
    throw new Error(`Expected pmfVoxel context, got ${data.context}`)
  }
  if (!Array.isArray(data.nodes) || data.nodes.length !== 3) {
    throw new Error(`Expected 3 nodes from PMF payload, got ${data.nodes?.length}`)
  }
  const n = data.nodes.find(node => node.id === 'hackamap')
  if (!n) throw new Error('Expected hackamap node in PMF graph')
  const props = (n.properties || {}) as Record<string, unknown>
  const layer = String(props['visual:layer'] || '')
  if (!layer) throw new Error('PMF node should include visual:layer')
  const scores = props.scores as Record<string, unknown> | undefined
  if (!scores || typeof scores.money !== 'number' || typeof scores.man !== 'number' || typeof scores.machine !== 'number') {
    throw new Error('PMF node should include scores.money/man/machine')
  }
  const layerColor = String(props['layer:color'] || '')
  if (!layerColor) throw new Error('PMF node should include layer:color')
}

export const testPmfVoxelPositionsUseMultipleLayerHeights = () => {
  const { data } = parseGraph('PMF.json', JSON.stringify(PMF_FIXTURE))
  const positions = computePositionsVoxel(data.nodes, defaultSchema)
  const zValues = new Set<number>()
  for (let i = 0; i < data.nodes.length; i += 1) {
    const id = data.nodes[i]!.id
    const p = positions[id]
    if (!p) continue
    zValues.add(Number(p[2]))
  }
  if (zValues.size < 2) {
    throw new Error(`Expected multiple voxel layer heights, got ${Array.from(zValues).join(',')}`)
  }
  const xs = data.nodes
    .map(node => positions[node.id]?.[0])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const spread = xs.length > 0 ? (Math.max(...xs) - Math.min(...xs)) : 0
  if (spread < 100) {
    throw new Error(`Expected PMF gridX-driven horizontal spread, got ${spread}`)
  }
}
