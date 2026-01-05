import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, applyParser } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testWildcardPercentileTukeyHazen() {
  const cfg: CustomParserConfig = {
    id: 'custom-json-pctl-tukey-hazen',
    name: 'Custom JSON Percentile Tukey Hazen',
    base: 'json',
    match: { mode: 'endsWith', value: '.json' },
    transforms: {
      node: {
        props: {
          mapAgg: {
            p75_tukey: { op: 'percentile', path: 'properties.items[].count', p: 75, method: 'tukey' },
            p75_hazen: { op: 'percentile', path: 'properties.items[].count', p: 75, method: 'hazen' }
          }
        }
      }
    }
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const text = JSON.stringify({ nodes: [{ id: 'n1', label: 'x', type: 't', properties: { items: [{ count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }] } }], edges: [] })
  const res = applyParser(toParserId('custom-json-pctl-tukey-hazen'), { name: 'x.json', text })
  if (!res) throw new Error('applyParser failed')
  const p = res.graphData.nodes[0].properties as { p75_tukey: number; p75_hazen: number }
  if (Math.abs(p.p75_tukey - 3.5833333333) > 1e-6) throw new Error('tukey percentile failed')
  if (Math.abs(p.p75_hazen - 3.75) > 1e-6) throw new Error('hazen percentile failed')
}
