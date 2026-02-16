import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'

export function testSchemaLayoutEngineJson2dIncludesFlowKey() {
  const json = buildSchemaLayoutEngineJson2d(null)
  const parsed = JSON.parse(json) as Record<string, unknown>
  if (!parsed || typeof parsed !== 'object') throw new Error('expected json to parse into object')
  if (!('flow' in parsed)) throw new Error('expected schema layout engine json to include flow key')
}

