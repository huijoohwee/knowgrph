import type { Canvas2dRendererId, Canvas3dModeId } from '@/lib/config'
import type { GraphSchema } from '@/lib/graph/schema'

type VoxelModeApplicabilityArgs = {
  canvas2dRenderer: Canvas2dRendererId
  documentSemanticMode: 'document' | 'keyword'
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  schema: GraphSchema | null | undefined
}

export function normalizeCanvas3dMode(raw: unknown): Canvas3dModeId {
  return raw === 'voxel' ? 'voxel' : '3d'
}

export function isVoxelModeApplicable(args: VoxelModeApplicabilityArgs): boolean {
  if (args.canvas2dRenderer !== 'd3Bipartite') return false
  const semanticAllowed =
    args.frontmatterModeEnabled === true ||
    args.multiDimTableModeEnabled === true ||
    args.documentSemanticMode === 'document' ||
    args.documentSemanticMode === 'keyword'
  if (!semanticAllowed) return false
  return args.schema?.layout?.mode === 'block'
}

export function resolveCanvas3dMode(args: VoxelModeApplicabilityArgs & { requested: Canvas3dModeId }): Canvas3dModeId {
  if (args.requested === 'voxel' && !isVoxelModeApplicable(args)) return '3d'
  return args.requested
}
