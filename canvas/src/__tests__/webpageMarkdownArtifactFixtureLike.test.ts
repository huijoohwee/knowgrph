import { buildWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'

const sliceBetween = (text: string, start: string, end: string): string => {
  const a = text.indexOf(start)
  if (a < 0) return ''
  const b = text.indexOf(end, a + start.length)
  if (b < 0) return text.slice(a).trimEnd()
  return text.slice(a, b).trimEnd()
}

export const testWebpageMarkdownArtifactFixtureLikeSections = () => {
  const upstream = [
    '# Example Product',
    '',
    '[Docs](https://example.com/docs) | [Pricing](https://example.com/pricing) | [Contact](https://example.com/contact)',
    '',
    '[Get started](https://example.com/start) | [GitHub](https://example.com/repo) | [Discord](https://example.com/community)',
    '',
    '$ npx example-cli@latest',
    '',
    '## Templates',
    '',
    '- Blank',
    '- Hello World',
    '- Next.js',
    '- Prompt to Motion',
    '- React Router',
    '- Find a template',
    '',
    '## Pricing Comparison (Extracted)',
    '',
    '| Plan | Cost |',
    '|------|------|',
    '| Creator | $75 |',
    '',
    '## Pricing Details (Extracted)',
    '',
    '| Tier | Monthly |',
    '|------|---------|',
    '| Starter | $15 |',
    '',
    '## Company License Options (Extracted)',
    '',
    '- Small teams',
    '- Large teams',
    '',
    '## Rendering Options (Extracted)',
    '',
    '| Method | Speed | Cost | Best For |',
    '|--------|-------|------|----------|',
    '| Local | Fast | Low | Development |',
    '',
    '## Features',
    '',
    'Drag and drop editor.',
    'Dark mode toggle.',
    'Export the result.',
    '',
  ].join('\n')

  const actual = buildWebpageMarkdownArtifactDoc({
    markdown: upstream,
    url: 'https://example.com/',
    title: 'Example Product',
    fidelityMaxLevel: 4,
  })

  if (!actual.includes('## Table of Contents')) throw new Error('missing table of contents')
  if (!actual.includes('## Page Structure Overview')) throw new Error('missing page structure overview')
  if (!actual.includes('## Document Structure')) throw new Error('missing document structure')
  if (!actual.includes('## Navigation Header')) throw new Error('missing navigation header')
  if (!actual.includes('## Hero Section')) throw new Error('missing hero section')
  if (!actual.includes('## Pricing')) throw new Error('missing pricing section')
  if (!actual.includes('## Asset Catalog')) throw new Error('missing asset catalog')

  const overviewSlice = sliceBetween(actual, '## Page Structure Overview', '\n---\n')
  if (!overviewSlice) throw new Error('missing page structure overview slice')
  if (!overviewSlice.includes('NAVIGATION HEADER')) throw new Error('missing navigation header layout')

  const templateSlice = sliceBetween(actual, '## Template Gallery', '\n---\n')
  if (!templateSlice) throw new Error('missing template gallery')
  if (!templateSlice.includes('Blank')) throw new Error('missing template: Blank')
  if (!templateSlice.includes('Next.js')) throw new Error('missing template: Next.js')

  const heroSlice = sliceBetween(actual, '## Hero Section', '\n---\n')
  if (!heroSlice) throw new Error('missing hero slice')
  if (!heroSlice.includes('$ npx example-cli@latest')) throw new Error('missing hero command')
}

