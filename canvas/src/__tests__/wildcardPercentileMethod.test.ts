import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, applyParser } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testWildcardPercentileNearest() {
  const cfg: CustomParserConfig = {
    id: 'custom-json-pctl-nearest',
    name: 'Custom JSON Percentile Nearest',
    base: 'json',
    match: { mode: 'endsWith', value: '.json' },
    transforms: {
      node: {
        props: {
          mapAgg: {
            p75: { op: 'percentile', path: 'properties.items[].count', p: 75, method: 'nearest' }
          }
        }
      }
    }
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const text = JSON.stringify({ nodes: [{ id: 'n1', label: 'x', type: 't', properties: { items: [{ count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }] } }], edges: [] })
  const res = applyParser(toParserId('custom-json-pctl-nearest'), { name: 'x.json', text })
  if (!res) throw new Error('applyParser failed')
  const p = res.graphData.nodes[0].properties as { p75: number }
  if (Math.abs(p.p75 - 3) > 1e-9) throw new Error('percentile method failed')
}
