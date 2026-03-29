import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

export function withD3BipartiteSceneSchema(args: {
  schema: GraphSchema
  graphData: GraphData
  canvasRenderMode: '2d' | '3d'
  canvas2dRenderer?: string
  forceForAny2dRenderer?: boolean
}): GraphSchema {
  const { schema, graphData, canvasRenderMode, canvas2dRenderer, forceForAny2dRenderer } = args
  if (canvasRenderMode !== '2d') return schema
  const meta = (graphData?.metadata || {}) as Record<string, unknown>
  const graphKind = typeof meta.graphKind === 'string' ? meta.graphKind : ''
  if (graphKind !== 'bipartite') return schema
  const renderer = String(canvas2dRenderer || '')
  const isD3LikeRenderer = renderer === 'd3' || renderer === 'd3Bipartite'
  if (!forceForAny2dRenderer && !isD3LikeRenderer) return schema
  return {
    ...schema,
    performance: {
      ...(schema.performance || {}),
      lod: {
        ...((schema.performance || {}).lod || {}),
        hideLabelsBelowScale: 0,
      },
    },
    layout: {
      ...(schema.layout || {}),
      forces: {
        ...((schema.layout || {}).forces || {}),
        centerStrength: 0,
        disjointComponents: false,
        postFitForce: false,
        ...( { bipartiteMode: true } as any ),
        linkDistanceByLabel: {
          ...((((schema.layout || {}).forces || {}) as any).linkDistanceByLabel || {}),
          linksTo: 680,
          spokeTo: 110,
        },
      },
      mode: 'force',
    },
  }
}
