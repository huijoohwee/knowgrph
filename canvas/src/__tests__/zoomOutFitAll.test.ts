import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { defaultSchema } from '@/lib/graph/schema'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { fitAllTransform } from '@/components/GraphCanvas/fit'

export function testFitToViewAllowsZoomOutBelowSchemaMinScale() {
  const schema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      zoom: { minScale: 0.1, maxScale: 4 },
    },
    layout: {
      ...defaultSchema.layout,
      fitPadding: 80,
      fitDetectClusters: true,
    },
  }

  const nodes: GraphNode[] = []
  for (let i = 0; i < 20; i += 1) {
    nodes.push({ id: `n${i}`, label: `n${i}`, type: 'Entity', x: i * 8, y: 0, vx: 0, vy: 0, properties: {} })
  }
  nodes.push({ id: 'outlier', label: 'outlier', type: 'Entity', x: 50_000, y: 0, vx: 0, vy: 0, properties: {} })

  const mode = readLayoutMode(schema)
  const opts = readFitAllOptions({ schema, mode, intent: 'fitToView' })
  const t = fitAllTransform(nodes, 800, 600, opts)

  if (!(t.k < 0.1)) {
    throw new Error(`expected fitToView to allow k below schema minScale (k=${t.k})`)
  }
  if (!(t.k > 0.0009)) {
    throw new Error(`expected k to stay above hard min scale (k=${t.k})`)
  }
}
