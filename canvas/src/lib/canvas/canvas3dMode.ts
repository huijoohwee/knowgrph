import type { Canvas2dRendererId, Canvas3dModeId } from '@/lib/config'
import type { GraphSchema } from '@/lib/graph/schema'

type VoxelModeApplicabilityArgs = {
  canvas2dRenderer: Canvas2dRendererId
  documentSemanticMode: 'document' | 'keyword'
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  schema: GraphSchema | null | undefined
}

export type VoxelModeInapplicableReason = 'renderer' | 'semantic' | 'layout' | null

export function normalizeCanvas3dMode(raw: unknown): Canvas3dModeId {
  return raw === 'voxel' ? 'voxel' : '3d'
}

export function isVoxelSemanticModeAllowed(args: Pick<VoxelModeApplicabilityArgs, 'documentSemanticMode' | 'frontmatterModeEnabled' | 'multiDimTableModeEnabled'>): boolean {
  return (
    args.frontmatterModeEnabled === true ||
    args.multiDimTableModeEnabled === true ||
    args.documentSemanticMode === 'document' ||
    args.documentSemanticMode === 'keyword'
  )
}

export function getVoxelModeInapplicableReason(args: VoxelModeApplicabilityArgs): VoxelModeInapplicableReason {
  if (args.canvas2dRenderer !== 'd3Bipartite') return 'renderer'
  if (!isVoxelSemanticModeAllowed(args)) return 'semantic'
  if (args.schema?.layout?.mode !== 'block') return 'layout'
  return null
}

export function isVoxelModeApplicable(args: VoxelModeApplicabilityArgs): boolean {
  return getVoxelModeInapplicableReason(args) === null
}

export function resolveCanvas3dMode(args: VoxelModeApplicabilityArgs & { requested: Canvas3dModeId }): Canvas3dModeId {
  if (args.requested === 'voxel' && !isVoxelModeApplicable(args)) return '3d'
  return args.requested
}
