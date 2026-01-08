import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export async function testMarkdownHtmlImgSmokeProducesMediaNodes() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const path = resolve(process.cwd(), '../data/_tmp_md_smoke/markdown-html-img-smoke.md')
  const markdown = readFileSync(path, 'utf8')

  const jsonld = buildMarkdownJsonLd(
    'file://markdown-html-img-smoke.md',
    markdown,
  )

  const res = applyParser(toParserId('jsonld'), {
    name: 'doc.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  const mediaNodes = nodes.filter(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    const inner = (props.properties || {}) as Record<string, unknown>
    const url = String(inner.media_url || inner.url || '')
    const kind = String(inner.media_kind || '')
    return !!url && (kind === 'image' || !kind)
  })

  if (mediaNodes.length === 0) {
    throw new Error('expected at least one media-capable node from markdown-html-img-smoke.md')
  }

  await Promise.resolve()
}

