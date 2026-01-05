import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, applyParser } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testCustomParserTypeMethodWarning() {
  const cfg: CustomParserConfig = {
    id: 'custom-json-warn',
    name: 'Custom JSON Warn',
    base: 'json',
    match: { mode: 'endsWith', value: '.json' },
    transforms: {
      node: {
        props: {
          mapAgg: {
            pctl: { op: 'percentile', path: 'properties.items[].count', p: 50, type: 7, method: 'nearest' }
          }
        }
      }
    }
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const text = JSON.stringify({ nodes: [{ id: 'n1', label: 'x', type: 't', properties: { items: [{ count: 1 }, { count: 2 }] } }], edges: [] })
  const res = applyParser(toParserId('custom-json-warn'), { name: 'x.json', text })
  if (!res) throw new Error('applyParser failed')
  const hasWarn = (res.warnings || []).some(w => String(w).includes('both type and method set'))
  if (!hasWarn) throw new Error('missing type+method precedence warning')
}
