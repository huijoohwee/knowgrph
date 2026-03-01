import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'

export async function testMarkdownFrontmatterUrlIsUsedAsBaseForMediaResolution() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = [
    '---',
    'kgWebpageUrl: "https://example.com/path/page"',
    '---',
    '',
    '# Title',
    '',
    '![img](/img.png)',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('workspace:docs/example.md', markdown)
  const res = applyParser(toParserId('jsonld'), {
    name: 'doc.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  const mediaUrls: string[] = []
  for (const n of nodes) {
    const p0 = (n.properties || {}) as Record<string, unknown>
    const inner =
      p0.properties && typeof p0.properties === 'object' && !Array.isArray(p0.properties)
        ? (p0.properties as Record<string, unknown>)
        : p0
    const url = String(inner.media_url || inner.url || inner.media || '').trim()
    if (url) mediaUrls.push(url)
  }

  if (!mediaUrls.includes('https://example.com/img.png')) {
    throw new Error(`expected resolved media url https://example.com/img.png, got: ${mediaUrls.slice(0, 5).join(', ')}`)
  }
}
