import { bestMatch, builtInParsers, registerParser, resetParsers } from '@/features/parsers'

export function testParserAutoSelectOnLoad() {
  if (!Array.isArray(builtInParsers) || builtInParsers.length === 0) throw new Error('builtInParsers missing')
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))
  const csv = bestMatch({ name: 'nodes.csv', text: 'id,label,type\na,b,c' })
  if (!csv || String(csv.id) !== 'auto') throw new Error(`csv bestMatch failed: got ${csv?.id}`)
  const json = bestMatch({ name: 'unicorn-investors-test.json', text: '{"type":"Graph","nodes":[],"edges":[]}' })
  if (!json || String(json.id) !== 'auto') throw new Error(`json bestMatch failed: got ${json?.id}`)
}
