import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, applyParser } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testWildcardMinMaxAvg() {
  const cfg: CustomParserConfig = {
    id: 'custom-json-agg2',
    name: 'Custom JSON Agg 2',
    base: 'json',
    match: { mode: 'endsWith', value: '.json' },
    transforms: {
      node: {
        props: {
          mapAgg: {
            minC: { op: 'min', path: 'properties.items[].count' },
            maxC: { op: 'max', path: 'properties.items[].count' },
            avgC: { op: 'avg', path: 'properties.items[].count' }
          }
        }
      }
    }
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const text = JSON.stringify({ nodes: [{ id: 'n1', label: 'x', type: 't', properties: { items: [{ count: 1 }, { count: 2 }, { count: 3 }] } }], edges: [] })
  const res = applyParser(toParserId('custom-json-agg2'), { name: 'x.json', text })
  if (!res) throw new Error('applyParser failed')
  const p = res.graphData.nodes[0].properties as { minC: number; maxC: number; avgC: number }
  if (p.minC !== 1) throw new Error('min agg failed')
  if (p.maxC !== 3) throw new Error('max agg failed')
  if (Math.abs(p.avgC - 2) > 1e-9) throw new Error('avg agg failed')
}
