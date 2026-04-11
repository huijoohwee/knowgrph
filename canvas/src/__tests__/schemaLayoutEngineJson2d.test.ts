import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'

export function testSchemaLayoutEngineJson2dIncludesFlowKey() {
  const json = buildSchemaLayoutEngineJson2d(null)
  const parsed = JSON.parse(json) as Record<string, unknown>
  if (!parsed || typeof parsed !== 'object') throw new Error('expected json to parse into object')
  if (!('flow' in parsed)) throw new Error('expected schema layout engine json to include flow key')
}

export function testSchemaLayoutEngineJson2dIncludesEdgeTypeKey() {
  const base = buildSchemaLayoutEngineJson2d({
    layout: {
      mode: 'radial',
      edges: { type: 'straight' },
    },
  } as never)
  const next = buildSchemaLayoutEngineJson2d({
    layout: {
      mode: 'radial',
      edges: { type: 'bezier' },
    },
  } as never)
  const parsed = JSON.parse(base) as Record<string, unknown>
  if (!parsed || typeof parsed !== 'object') throw new Error('expected json object')
  if (!('edges' in parsed)) throw new Error('expected schema layout engine json to include edges key')
  if (base === next) throw new Error('expected schema layout engine json to change when edge type changes')
}
