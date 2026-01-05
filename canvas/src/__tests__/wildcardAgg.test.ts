import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, applyParser } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testWildcardAggregation() {
  const cfg: CustomParserConfig = {
    id: 'custom-json-agg',
    name: 'Custom JSON Agg',
    base: 'json',
    match: { mode: 'endsWith', value: '.json' },
    transforms: {
      node: {
        props: {
          mapAgg: {
            names: { op: 'join', path: 'properties.items[].name', sep: '|' },
            total: { op: 'sum', path: 'properties.items[].count' },
            n: { op: 'count', path: 'properties.items[]' }
          }
        }
      }
    }
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const text = JSON.stringify({ nodes: [{ id: 'n1', label: 'x', type: 't', properties: { items: [{ name: 'a', count: 1 }, { name: 'b', count: 2 }] } }], edges: [] })
  const res = applyParser(toParserId('custom-json-agg'), { name: 'x.json', text })
  if (!res) throw new Error('applyParser failed')
  const p = res.graphData.nodes[0].properties as Record<string, unknown>
  if (p.names !== 'a|b') throw new Error('join agg failed')
  if (p.total !== 3) throw new Error('sum agg failed')
  if (p.n !== 2) throw new Error('count agg failed')
}
