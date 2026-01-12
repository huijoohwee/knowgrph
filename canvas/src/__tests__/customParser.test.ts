import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, bestMatch, applyParser, resetParsers } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testCustomParserConversion() {
  resetParsers()
  const cfg: CustomParserConfig = {
    id: 'custom-json',
    name: 'Custom JSON',
    base: 'json',
    match: { mode: 'endsWith', value: '.json' },
    transforms: { nodeTypeDefault: 'Entity', edgeLabelDefault: 'relatedTo' },
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const bm = bestMatch({ name: 'x.json', text: '{"nodes":[],"edges":[]}' })
  if (!bm || bm.id !== toParserId('custom-json')) throw new Error('bestMatch on custom failed')
  const res = applyParser(toParserId('custom-json'), { name: 'x.json', text: '{"nodes":[],"edges":[]}' })
  if (!res || res.graphData.type !== 'Graph') throw new Error('custom parse apply failed')
}
