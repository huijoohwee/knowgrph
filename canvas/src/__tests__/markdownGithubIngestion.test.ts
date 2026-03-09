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
    const url = String(props.media_url || props.url || '')
    const kind = String(props.media_kind || '')
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
    const url = String(props.media_url || props.url || '')
    const kind = String(props.media_kind || '')
    return !!url && (kind === 'image' || !kind)
  })

  if (mediaNodes.length === 0) {
    throw new Error('expected at least one media-capable node from html img tag')
  }

  await Promise.resolve()
}

export async function testMarkdownAutolinkImageIngestionProducesMediaNodes() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const url =
    'https://substackcdn.com/image/fetch/$s_!kA4x!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0bc01ebb-a883-4e5c-bd2b-fa7aaa872edb_1600x1059.png'
  const markdown = ['# Title', '', `<${url}>`, '', url, ''].join('\n')

  const jsonld = buildMarkdownJsonLd('https://example.invalid/doc.md', markdown)
  const res = applyParser(toParserId('jsonld'), { name: 'doc.jsonld', text: JSON.stringify(jsonld) })
  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)

  const nodes = res.graphData.nodes || []
  const mediaNodes = nodes.filter(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    const kind = String(props.media_kind || '')
    const mediaUrl = String(props.media_url || '')
    return kind === 'image' && mediaUrl.includes('substackcdn.com/image/fetch')
  })
  if (mediaNodes.length === 0) throw new Error('expected image media node from autolink/bare image URL')
  await Promise.resolve()
}

export async function testMarkdownHtmlIframeIngestionProducesMediaNodes() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = [
    '# Title',
    '',
    'Paragraph with HTML iframe:',
    '',
    '<iframe src="https://www.ycombinator.com/library/8d-how-to-build-a-great-series-a-pitch-and-deck"></iframe>',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('https://example.invalid/doc.md', markdown)
  const res = applyParser(toParserId('jsonld'), { name: 'doc.jsonld', text: JSON.stringify(jsonld) })
  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)

  const nodes = res.graphData.nodes || []
  const iframeNodes = nodes.filter(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    const kind = String(props.media_kind || '')
    const url = String(props.iframe_url || props.media_url || props.url || '')
    return kind === 'iframe' && /ycombinator\.com\/library\/8d/i.test(url)
  })
  if (iframeNodes.length === 0) throw new Error('expected iframe media node from html iframe tag')
  await Promise.resolve()
}

export async function testMarkdownStandaloneLinkWebpageIngestionProducesIframeNode() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = [
    '# Title',
    '',
    '[Article](https://www.aljazeera.com/news/2026/2/19/visualising-ai-spending-how-does-it-compare-with-historys-mega-projects)',
    '',
    '[YouTube](https://youtu.be/XzzPRQRDcDw?t=2997)',
    '',
    '[Tweet](https://x.com/HuiJooHwee/status/2023774971982672097?s=20)',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('https://example.invalid/doc.md', markdown)
  const res = applyParser(toParserId('jsonld'), { name: 'doc.jsonld', text: JSON.stringify(jsonld) })
  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)

  const nodes = res.graphData.nodes || []

  const hasAljazeeraIframe = nodes.some(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    return String(props.media_kind || '') === 'iframe' && String(props.iframe_url || '').includes('aljazeera.com/news/2026/2/19/')
  })
  if (!hasAljazeeraIframe) throw new Error('expected standalone webpage link to ingest as iframe media node')

  const hasNoCookieYoutubeEmbed = nodes.some(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    const src = String(props.iframe_url || '')
    return String(props.media_kind || '') === 'iframe' && src.startsWith('https://www.youtube-nocookie.com/embed/') && src.includes('?start=')
  })
  if (!hasNoCookieYoutubeEmbed) throw new Error('expected youtube standalone link to ingest as youtube-nocookie iframe embed with start')

  const hasTweetEmbed = nodes.some(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    return String(props.media_kind || '') === 'iframe' && String(props.iframe_url || '').includes('platform.twitter.com/embed/Tweet.html?id=2023774971982672097')
  })
  if (!hasTweetEmbed) throw new Error('expected x.com status to ingest as platform.twitter.com tweet iframe embed')

  await Promise.resolve()
}

export async function testMarkdownHtmlVideoIngestionProducesMediaNodes() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = [
    '# Title',
    '',
    'Video block:',
    '',
    '<video controls><source src="https://example.invalid/demo.mp4" type="video/mp4" /></video>',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('https://example.invalid/doc.md', markdown)
  const res = applyParser(toParserId('jsonld'), { name: 'doc.jsonld', text: JSON.stringify(jsonld) })
  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)

  const nodes = res.graphData.nodes || []
  const videoNodes = nodes.filter(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    const kind = String(props.media_kind || '')
    const url = String(props.video || props.media_url || props.url || '')
    return kind === 'video' && /demo\.mp4/i.test(url)
  })
  if (videoNodes.length === 0) throw new Error('expected video media node from html video tag')
  await Promise.resolve()
}
