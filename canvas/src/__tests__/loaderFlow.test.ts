import { bestMatch, builtInParsers } from '@/features/parsers'

export function testLoaderAutoDetectSupportsCommonFormats() {
  if (!Array.isArray(builtInParsers) || builtInParsers.length === 0) throw new Error('builtInParsers missing')
  const csv = bestMatch({ name: 'a.csv', text: 'id,label,type\n1,Alpha,Entity' })
  if (!csv || csv.id !== 'csv') throw new Error(`csv bestMatch failed: got ${csv?.id}`)
  const json = bestMatch({ name: 'graph.json', text: '{"type":"Graph","nodes":[],"edges":[]}' })
  if (!json || (json.id !== 'json' && json.id !== 'jsonld')) throw new Error(`json bestMatch failed: got ${json?.id}`)
  const jsonld = bestMatch({ name: 'data.jsonld', text: '{"@context": "https://schema.org", "@type": "Thing"}' })
  if (!jsonld || jsonld.id !== 'jsonld') throw new Error(`jsonld bestMatch failed: got ${jsonld?.id}`)
  const py = bestMatch({ name: 'parser.py', text: 'import json\ndef main():\n  pass' })
  if (!py || py.id !== 'python') throw new Error(`python bestMatch failed: got ${py?.id}`)
}

