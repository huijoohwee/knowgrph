import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, applyParser } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testTransformArrayPath() {
  const cfg: CustomParserConfig = {
    id: 'custom-json-array',
    name: 'Custom JSON Array',
    base: 'json',
    match: { mode: 'endsWith', value: '.json' },
    transforms: {
      node: { labelFrom: 'properties.items[1].name' },
      edge: {},
    },
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const text = JSON.stringify({ nodes: [{ id: 'n1', label: 'x', type: 't', properties: { items: [{ name: 'a' }, { name: 'b' }] } }], edges: [] })
  const res = applyParser(toParserId('custom-json-array'), { name: 'x.json', text })
  if (!res) throw new Error('applyParser failed')
  const n = res.graphData.nodes[0]
  if (n.label !== 'b') throw new Error('array path resolution failed')
}
