import { postprocessWebpageMarkdownSsot } from '@/lib/markdown/webpageMarkdownPostprocess'

export function testWebpageMarkdownPostprocessCoalescesPlainCardBlocksIntoMarkdownTable() {
  const input = [
    '# Pencil',
    '',
    'Design canvas',
    'Infinite design canvas',
    'Design your products with pixel-perfect precision without ever leaving your IDE.',
    '',
    'Speed & precision',
    'Vibe designing with precision',
    'Prompt entire screens or specific parts directly in context.',
    '',
    'From vectors to code. Pixel perfect.',
    'Ship production-ready apps where code stays true to the design.',
    'Design and code live under one roof—in your repo.',
    '',
  ].join('\n')

  const out = postprocessWebpageMarkdownSsot(input)
  if (!/\|\s*Design canvas\s*\|\s*Speed & precision\s*\|/m.test(out)) {
    throw new Error('expected coalesced markdown pipe table header')
  }
  if (!/\|\s*---\s*\|\s*---\s*\|/m.test(out)) throw new Error('expected markdown pipe table separator')
  if (!out.includes('pixel-perfect precision')) throw new Error('expected card body preserved')
  if (!out.includes('Prompt entire screens')) throw new Error('expected card body preserved')

  const count = (needle: string) => out.split(needle).length - 1
  if (count('Design canvas') !== 1) throw new Error('expected no duplicated card titles')
  if (count('Speed & precision') !== 1) throw new Error('expected no duplicated card titles')
}

export function testWebpageMarkdownPostprocessNormalizesPlainListsIntoBullets() {
  const input = [
    '# Example',
    '',
    'First feature',
    'Second feature',
    'Third feature',
    '',
  ].join('\n')
  const out = postprocessWebpageMarkdownSsot(input)
  if (!out.includes('- First feature')) throw new Error('expected First feature as bullet')
  if (!out.includes('- Second feature')) throw new Error('expected Second feature as bullet')
  if (!out.includes('- Third feature')) throw new Error('expected Third feature as bullet')
}

export function testWebpageMarkdownPostprocessCoalescesNavLinksToTable() {
  const input = [
    '# Pencil',
    '',
    '[Pencil Logo](/) [Downloads](/downloads) [Pricing](/pricing) [Prompt Gallery](/gallery) [Docs](/docs) [Download Pencil](/download)',
    '',
    'Backed by',
    '',
  ].join('\n')
  const out = postprocessWebpageMarkdownSsot(input)
  if (!out.includes('| [Pencil Logo](/) | [Downloads](/downloads) | [Pricing](/pricing) |')) {
    throw new Error('expected nav links to be coalesced into a table header row')
  }
  if (!out.includes('| --- | --- | --- |')) throw new Error('expected nav table separator row')
  if (!out.includes('Backed by')) throw new Error('expected following content preserved')
}

export function testWebpageMarkdownPostprocessCoalescesHtmlGridNavIntoTable() {
  const input = [
    '# Pencil',
    '',
    '<div style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:8px">',
    '<a href="/">Pencil Logo</a>',
    '<a href="/downloads">Downloads</a>',
    '<a href="/pricing">Pricing</a>',
    '<a href="/gallery">Prompt Gallery</a>',
    '<a href="/docs">Docs</a>',
    '<a href="/download">Download Pencil</a>',
    '</div>',
    '',
    'Backed by',
    '',
  ].join('\n')
  const out = postprocessWebpageMarkdownSsot(input)
  if (/<\s*div\b/i.test(out)) throw new Error('expected no raw div html in output')
  if (!out.includes('| [Pencil Logo](/) | [Downloads](/downloads) | [Pricing](/pricing) |')) {
    throw new Error('expected html grid nav block to coalesce into a markdown table')
  }
  if (!out.includes('| --- | --- | --- |')) throw new Error('expected nav table separator row')
  if (!out.includes('Backed by')) throw new Error('expected following content preserved')
}

export function testWebpageMarkdownPostprocessCoalescesHtmlFlexCardGridIntoMarkdownTableOrList() {
  const input = [
    '# Example',
    '',
    '<div class="flex flex-wrap gap-4">',
    '<a href="https://example.invalid/a"><img src="https://example.invalid/a.png" alt="A" /></a>',
    '<a href="https://example.invalid/b"><img src="https://example.invalid/b.png" alt="B" /></a>',
    '<a href="https://example.invalid/c"><img src="https://example.invalid/c.png" alt="C" /></a>',
    '<a href="https://example.invalid/d"><img src="https://example.invalid/d.png" alt="D" /></a>',
    '</div>',
    '',
  ].join('\n')
  const out = postprocessWebpageMarkdownSsot(input)
  if (/<\s*div\b/i.test(out) || /<\s*a\b/i.test(out) || /<\s*img\b/i.test(out)) {
    throw new Error(`expected html grid block to be converted to pure markdown, got: ${out}`)
  }
  const expectsAny =
    out.includes('[![A](https://example.invalid/a.png)](https://example.invalid/a)') ||
    out.includes('- [![A](https://example.invalid/a.png)](https://example.invalid/a)')
  if (!expectsAny) {
    throw new Error(`expected linked markdown image cells, got: ${out}`)
  }
}
