import { buildWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'

export const testWebpageMarkdownArtifactIncludesLayoutAndMotionFrames = () => {
  const md = [
    '# Make videos programmatically',
    '',
    '[Docs](https://example.com/docs)',
    '',
    '[Get started](https://example.com/start)',
    '',
    '## Compose with code',
    '',
    'compose.webm',
    '',
    'Use React to create sophisticated videos with code.',
    '',
    '<section style="animation: spin 1s linear infinite">x</section>',
    '',
    'Uses lottie animations',
    '',
    '## Demo',
    '',
    'Drag and drop the cards to reorder them.',
    'Dark mode toggle',
    'Export the video!',
    '0:00',
    '',
    '## Use Cases',
    '',
    '- Music visualization',
    '- Captions',
    '- Screencast',
    '- Year in review',
    '',
    '[Showcase page](https://example.com/showcase)',
    '',
    '## Pricing',
    '',
    'Free License',
    'Company License',
    'Enterprise License',
    '',
    'Pricing: $100/mo',
    '',
    '## Trusted by',
    '',
    'Book a call',
    'Write an email',
    'Support',
    '',
  ].join('\n')

  const out = buildWebpageMarkdownArtifactDoc({ markdown: md, url: 'https://localhost/' })
  if (!out.includes('## Table of Contents')) throw new Error('missing Table of Contents')
  const tocIdx = out.indexOf('## Table of Contents')
  if (tocIdx < 0) throw new Error('missing Table of Contents')
  const listIdx = (() => {
    const m = out.slice(tocIdx).match(/\n\s*1\.\s*\[/m)
    if (!m || typeof m.index !== 'number') return -1
    return tocIdx + m.index
  })()
  if (listIdx < 0) throw new Error('missing first TOC item')
  const between = out.slice(tocIdx, listIdx)
  if (!between.includes('```ascii')) {
    throw new Error('expected ASCII wireframe between Table of Contents heading and first item')
  }
  if (!out.includes('## Page Structure Overview')) throw new Error('missing Page Structure Overview')
  if (!out.includes('NAVIGATION HEADER')) throw new Error('missing NAVIGATION HEADER frame')
  if (!out.includes('HERO SECTION')) throw new Error('missing HERO SECTION frame')
  if (!out.includes('## Document Structure')) throw new Error('missing Document Structure')
  if (!out.includes('## Navigation Header')) throw new Error('missing Navigation Header section')
  if (!out.includes('### Navigation Menu Structure')) throw new Error('missing Navigation Menu Structure')
  if (!out.includes('## Hero Section')) throw new Error('missing Hero Section')
  if (!out.includes('## Page Statistics')) throw new Error('missing Page Statistics')
  if (!out.includes('## Pricing')) throw new Error('missing Pricing section')
  if (!out.includes('## Asset Catalog')) throw new Error('missing Asset Catalog')
}
