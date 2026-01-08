import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'

export async function testMarkdownGithubBlobIngestionProducesMediaNodes() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = [
    '# Title',
    '',
    'Paragraph with an image:',
    '',
    '![Alt text](/owner/repo/raw/main/image.png)',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd(
    'https://github.com/owner/repo/blob/main/chapter-summaries.md',
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
    throw new Error('expected at least one media-capable node from markdown inline image')
  }

  await Promise.resolve()
}

export async function testMarkdownHtmlImgIngestionProducesMediaNodes() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = [
    '# Title',
    '',
    'Paragraph with HTML image:',
    '',
    '<center><img src="assets/ai-judge.png" width="600"><br></center>',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd(
    'https://github.com/owner/repo/blob/main/chapter-summaries.md',
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
    throw new Error('expected at least one media-capable node from html img tag')
  }

  await Promise.resolve()
}
