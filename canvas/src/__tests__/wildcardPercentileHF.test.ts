import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, applyParser } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testWildcardPercentileHF() {
  const cfg: CustomParserConfig = {
    id: 'custom-json-pctl-hf',
    name: 'Custom JSON Percentile HF',
    base: 'json',
    match: { mode: 'endsWith', value: '.json' },
    transforms: {
      node: {
        props: {
          mapAgg: {
            t7: { op: 'percentile', path: 'properties.items[].count', p: 75, type: 7 },
            t6: { op: 'percentile', path: 'properties.items[].count', p: 75, type: 6 },
            t8: { op: 'percentile', path: 'properties.items[].count', p: 75, type: 8 },
            t2: { op: 'percentile', path: 'properties.items[].count', p: 50, type: 2 }
          }
        }
      }
    }
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const text = JSON.stringify({ nodes: [{ id: 'n1', label: 'x', type: 't', properties: { items: [{ count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }] } }], edges: [] })
  const res = applyParser(toParserId('custom-json-pctl-hf'), { name: 'x.json', text })
  if (!res) throw new Error('applyParser failed')
  const p = res.graphData.nodes[0].properties as { t7: number; t6: number; t8: number; t2: number }
  if (Math.abs(p.t7 - 3.25) > 1e-9) throw new Error('HF type7 failed')
  if (Math.abs(p.t6 - 3.75) > 1e-9) throw new Error('HF type6 failed')
  if (Math.abs(p.t8 - 3.5833333333) > 1e-6) throw new Error('HF type8 failed')
  if (Math.abs(p.t2 - 2.5) > 1e-9) throw new Error('HF type2 failed')
}
