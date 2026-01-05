import { setCachedParse, getCachedParse } from '@/features/parsers/cache'
import type { ParseResult } from '@/features/parsers/types'
import { toParserId } from '@/features/parsers'

export function testParserCacheCfgKey() {
  const pid = 'csv'
  const name = 'data.csv'
  const text = 'a,b\n1,2'
  const resA: ParseResult = { graphData: { context: '', type: 'Graph', nodes: [], edges: [] }, warnings: [] }
  const resB: ParseResult = {
    graphData: { context: '', type: 'Graph', nodes: [{ id: 'x', label: 'X', type: 'T', properties: {} }], edges: [] },
    warnings: [],
  }
  const parserId = toParserId(pid)
  setCachedParse(parserId, name, text, resA, 'json:123')
  setCachedParse(parserId, name, text, resB, 'yaml:456')
  const gotA = getCachedParse(parserId, name, text, 'json:123')
  const gotB = getCachedParse(parserId, name, text, 'yaml:456')
  if (!gotA || !gotB) throw new Error('Cached entries not found')
  if (gotA === gotB) throw new Error('cfgKey should produce distinct cache entries')
}
