import type { GraphNode } from '@/lib/graph/types'

export const VOXEL_NEON_CLUSTER_COLORS = ['#00f5ff', '#ff00f5', '#7dff00', '#ffd400', '#00ff85', '#7c3aed']

const hashIndex = (value: string, length: number): number => {
  if (length <= 1) return 0
  let h = 2166136261 >>> 0
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % length
}

export const resolveVoxelClusterKey = (node: GraphNode): string => {
  const props = (node.properties || {}) as Record<string, unknown>
  return String(
    props['kg:radarCluster']
    || props['cluster']
    || props['group']
    || node.type
    || '',
  ).trim().toLowerCase()
}

export const resolveVoxelClusterColor = (node: GraphNode): string | null => {
  const key = resolveVoxelClusterKey(node)
  if (!key) return null
  return VOXEL_NEON_CLUSTER_COLORS[hashIndex(key, VOXEL_NEON_CLUSTER_COLORS.length)]
}
