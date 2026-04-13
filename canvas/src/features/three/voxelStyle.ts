import type { GraphNode } from '@/lib/graph/types'

export const VOXEL_NEON_CLUSTER_COLORS = ['#00f5ff', '#ff00f5', '#7dff00', '#ffd400', '#00ff85', '#7c3aed']

export type VoxelScores = { money: number; man: number; machine: number }

export const VOXEL_SCORE_DIMENSIONS: Array<{ key: keyof VoxelScores; label: string; color: string }> = [
  { key: 'money', label: 'Money', color: '#EF9F27' },
  { key: 'man', label: 'Man', color: '#D85A30' },
  { key: 'machine', label: 'Machine', color: '#1D9E75' },
]

const hashIndex = (value: string, length: number): number => {
  if (length <= 1) return 0
  let h = 2166136261 >>> 0
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % length
}

const readTrimmedStringProp = (props: Record<string, unknown>, keys: string[]): string => {
  for (let i = 0; i < keys.length; i += 1) {
    const raw = props[keys[i]!]
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (value) return value
  }
  return ''
}

export const resolveVoxelClusterKey = (node: GraphNode): string => {
  const props = (node.properties || {}) as Record<string, unknown>
  const explicitKey = readTrimmedStringProp(props, [
    'kg:radarCluster',
    'cluster',
    'group',
    'visual:layer',
    'layer:label',
    'layer',
  ])
  return String(
    explicitKey
    || node.type
    || '',
  ).trim().toLowerCase()
}

export const resolveVoxelClusterColor = (node: GraphNode): string | null => {
  const props = (node.properties || {}) as Record<string, unknown>
  const explicitColor = readTrimmedStringProp(props, [
    'layer:color',
    'visual:color',
    'color',
  ])
  if (explicitColor) return explicitColor
  const key = resolveVoxelClusterKey(node)
  if (!key) return null
  return VOXEL_NEON_CLUSTER_COLORS[hashIndex(key, VOXEL_NEON_CLUSTER_COLORS.length)]
}

const clamp01 = (v: number): number => {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

export const extractVoxelScores = (node: GraphNode): VoxelScores | null => {
  const props = (node.properties || {}) as Record<string, unknown>
  const scores = (props['scores'] && typeof props['scores'] === 'object' && !Array.isArray(props['scores']))
    ? (props['scores'] as Record<string, unknown>)
    : null
  const read = (key: keyof VoxelScores): number | null => {
    const fromScores = scores ? scores[key] : undefined
    const v = fromScores ?? props[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    return clamp01(v)
  }
  const money = read('money')
  const man = read('man')
  const machine = read('machine')
  if (money == null || man == null || machine == null) return null
  return { money, man, machine }
}

export const resolveVoxelLayerMaxVoxelHeight = (node: GraphNode): number | null => {
  const props = (node.properties || {}) as Record<string, unknown>
  const v = props['layer:maxVoxelHeight']
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.max(0.2, Math.min(12, v))
}

export const resolveVoxelLayerPlateOpacity = (node: GraphNode): number | null => {
  const props = (node.properties || {}) as Record<string, unknown>
  const v = props['layer:plateOpacity']
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.max(0, Math.min(1, v))
}
