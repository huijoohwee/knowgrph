import { pmfVoxelToGraphData } from '@/lib/graph/io/pmfVoxel'
import { resolveVoxelClusterColor, resolveVoxelClusterKey } from '@/features/three/voxelStyle'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const testPmfVoxelImportFromSiblingRepoIfPresent = () => {
  const fixture = {
    meta: {
      title: 'PMF Voxel Fixture',
      version: '1.0.0',
    },
    layers: [
      {
        id: 'product',
        level: 0,
        label: 'PRODUCT',
        threeY: -4.5,
        color: '#1D9E75',
        plateOpacity: 0.06,
        maxVoxelHeight: 1.0,
        nodes: [
          { id: 'p1', label: 'P1', gridX: -8, gridZ: 0, scores: { money: 0.5, man: 0.8, machine: 0.7 }, pmfScore: 0.67 },
          { id: 'p2', label: 'P2', gridX: -4, gridZ: 0, scores: { money: 0.7, man: 0.5, machine: 0.6 }, pmfScore: 0.6 },
          { id: 'p3', label: 'P3', gridX: 0, gridZ: 0, scores: { money: 0.3, man: 0.7, machine: 0.9 }, pmfScore: 0.63 },
        ],
      },
      {
        id: 'solution',
        level: 1,
        label: 'SOLUTION',
        threeY: 0,
        color: '#7F77DD',
        plateOpacity: 0.06,
        maxVoxelHeight: 1.4,
        nodes: [
          { id: 's1', label: 'S1', gridX: -5.5, gridZ: 0, scores: { money: 0.5, man: 0.8, machine: 0.4 } },
          { id: 's2', label: 'S2', gridX: -1.8, gridZ: 0, scores: { money: 0.4, man: 0.6, machine: 0.7 } },
          { id: 's3', label: 'S3', gridX: 1.8, gridZ: 0, scores: { money: 0.6, man: 0.5, machine: 0.9 } },
        ],
      },
      {
        id: 'market',
        level: 2,
        label: 'MARKET',
        threeY: 4.5,
        color: '#D85A30',
        plateOpacity: 0.06,
        maxVoxelHeight: 1.8,
        nodes: [
          { id: 'm1', label: 'M1', gridX: -5.5, gridZ: 0, gapScore: 0.3, scores: { money: 0.3, man: 1.0, machine: 0.4 } },
          { id: 'm2', label: 'M2', gridX: -1.8, gridZ: 0, gapScore: 0.52, scores: { money: 0.4, man: 0.7, machine: 0.6 } },
          { id: 'm3', label: 'M3', gridX: 1.8, gridZ: 0, gapScore: 0.58, scores: { money: 0.5, man: 0.6, machine: 0.8 } },
        ],
      },
    ],
    edges: [
      { id: 'e01', from: 'p1', to: 's1', layers: 'product->solution' },
      { id: 'e02', from: 'p1', to: 's2', layers: 'product->solution' },
      { id: 'e03', from: 'p2', to: 's2', layers: 'product->solution' },
      { id: 'e04', from: 'p2', to: 's1', layers: 'product->solution' },
      { id: 'e05', from: 'p3', to: 's3', layers: 'product->solution' },
      { id: 'e06', from: 's1', to: 'm1', layers: 'solution->market' },
      { id: 'e07', from: 's2', to: 'm2', layers: 'solution->market' },
      { id: 'e08', from: 's3', to: 'm3', layers: 'solution->market' },
    ],
  }
  const g = pmfVoxelToGraphData(fixture)
  if (!g || g.type !== 'Graph') throw new Error('pmfVoxelToGraphData must return Graph')
  if (!Array.isArray(g.nodes) || g.nodes.length < 8) throw new Error('pmf graph nodes missing')
  if (!Array.isArray(g.edges) || g.edges.length < 8) throw new Error('pmf graph edges missing')
  const first = g.nodes.find(n => (n.properties as any)?.scores) as any
  if (!first) throw new Error('pmf nodes should include scores')
  const layer = String((first.properties as any)['visual:layer'] || '')
  if (!layer) throw new Error('pmf nodes should include visual:layer')
}

export const testPmfVoxelResolversPreferImportedLayerMetadata = () => {
  const fixture = {
    meta: { title: 'PMF Voxel Fixture', version: '1.0.0' },
    layers: [
      {
        id: 'market',
        label: 'MARKET',
        color: '#D85A30',
        nodes: [
          { id: 'm1', label: 'Capital', scores: { money: 0.3, man: 1.0, machine: 0.4 } },
        ],
      },
    ],
    edges: [],
  }
  const graph = pmfVoxelToGraphData(fixture)
  const node = graph.nodes.find(item => item.id === 'm1')
  if (!node) throw new Error('Expected PMF voxel graph to include node m1')
  const key = resolveVoxelClusterKey(node)
  if (key !== 'market') {
    throw new Error(`Expected voxel cluster key to prefer imported layer metadata, got ${key}`)
  }
  const color = resolveVoxelClusterColor(node)
  if (color !== '#D85A30') {
    throw new Error(`Expected voxel cluster color to prefer imported layer color, got ${String(color)}`)
  }
}

export const testGraphIoAdapterReusesSharedPlainObjectGuardForPmfDetection = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'io', 'adapter.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected graph io adapter to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readPlainObject = (value: unknown): Record<string, unknown> | null => {')) {
    throw new Error('expected graph io adapter to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const obj = readPlainObject(json)')) {
    throw new Error('expected PMF payload detection to reuse the shared local plain-object helper')
  }
  if (text.includes("if (!json || typeof json !== 'object' || Array.isArray(json)) return false")) {
    throw new Error('expected PMF payload detection to stop coercing JSON roots inline')
  }
}

export const testPmfVoxelParserReusesSharedPlainObjectGuard = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'io', 'pmfVoxel.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected pmf voxel parser to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readPlainObject = (value: unknown): Record<string, unknown> | null => {')) {
    throw new Error('expected pmf voxel parser to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const obj = readPlainObject(input) as PmfPayload | null')) {
    throw new Error('expected pmf voxel parser root payload coercion to reuse the shared local plain-object helper')
  }
  if (!text.includes('const scoresObj = readPlainObject(n.scores)')) {
    throw new Error('expected pmf voxel parser score coercion to reuse the shared local plain-object helper')
  }
  if (text.includes("(input && typeof input === 'object' && !Array.isArray(input))")) {
    throw new Error('expected pmf voxel parser to stop coercing payload roots inline')
  }
}
