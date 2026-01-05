import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, applyParser } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testWildcardPercentile() {
  const cfg: CustomParserConfig = {
    id: 'custom-json-pctl',
    name: 'Custom JSON Percentile',
    base: 'json',
    match: { mode: 'endsWith', value: '.json' },
    transforms: {
      node: {
        props: {
          mapAgg: {
            p75: { op: 'percentile', path: 'properties.items[].count', p: 75 },
            med: { op: 'median', path: 'properties.items[].count' }
          }
        }
      }
    }
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const text = JSON.stringify({ nodes: [{ id: 'n1', label: 'x', type: 't', properties: { items: [{ count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }] } }], edges: [] })
  const res = applyParser(toParserId('custom-json-pctl'), { name: 'x.json', text })
  if (!res) throw new Error('applyParser failed')
  const p = res.graphData.nodes[0].properties as { p75: number; med: number }
  if (Math.abs(p.p75 - 3.25) > 1e-9) throw new Error('percentile 75 failed')
  if (Math.abs(p.med - 2.5) > 1e-9) throw new Error('median failed')
}
