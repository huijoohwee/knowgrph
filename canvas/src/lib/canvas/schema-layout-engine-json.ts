import type { GraphSchema } from '@/lib/graph/schema'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'

export function buildSchemaLayoutEngineJson2d(schema: GraphSchema | null): string {
  const mode = schema ? readLayoutMode(schema) : 'radial'
  const forces = schema?.layout?.forces || null
  const fitPadding = schema?.layout?.fitPadding ?? null
  const flow = schema?.layout?.flow || null
  const edges = schema?.layout?.edges
    ? {
        type: schema.layout.edges.type ?? null,
      }
    : null
  return JSON.stringify({ mode, forces, fitPadding, flow, edges })
}
