import { registerParser, unregisterParser, listParsers, bestMatch, applyParser, toParserId, resetParsers } from '@/features/parsers'
import type { ParserSpec } from '@/features/parsers'

export function testParserRegistryCrud() {
  resetParsers()
  const spec: ParserSpec = {
    id: toParserId('x'),
    name: 'X',
    match: (name) => (name || '').endsWith('.x'),
    parse: (name, text) => {
      void name
      void text
      return { graphData: { context: 't', type: 'Graph', nodes: [], edges: [] }, warnings: [] }
    },
  }
  registerParser(spec)
  const list1 = listParsers()
  if (!list1.find(s => s.id === toParserId('x'))) throw new Error('register failed')
  const bm = bestMatch({ name: 'a.x', text: '' })
  if (!bm || bm.id !== toParserId('x')) throw new Error('bestMatch failed')
  const res = applyParser(toParserId('x'), { name: 'a.x', text: '' })
  if (!res || res.graphData.type !== 'Graph') throw new Error('applyParser failed')
  unregisterParser(toParserId('x'))
  const list2 = listParsers()
  if (list2.find(s => s.id === toParserId('x'))) throw new Error('unregister failed')
}
