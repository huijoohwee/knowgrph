import type { GraphSchema } from '@/lib/graph/schema'
import type { Canvas2dRendererId, Canvas3dModeId } from '@/lib/config.render'
import { isD3Like2dRenderer } from '@/lib/config.render'
import { readLayoutMode2d } from '@/lib/graph/layoutMode'

export const coerceCanvas2dRendererForSchema = (args: {
  requested: Canvas2dRendererId
  canvas3dMode: Canvas3dModeId
  schema: GraphSchema
}): Canvas2dRendererId => {
  const layoutMode = readLayoutMode2d(args.schema)
  const voxelRenderer =
    args.canvas3dMode === 'voxel' && !isD3Like2dRenderer(args.requested)
      ? 'd3Bipartite'
      : args.requested
  if (layoutMode !== 'radial') return voxelRenderer
  return isD3Like2dRenderer(voxelRenderer) ? voxelRenderer : 'd3'
}
