import { normalizeMarkdownAsciiBlocks } from 'grph-shared/markdown/asciiBlocks'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'

export function testMarkdownNormalizeAsciiBlocksWrapsPipeLayoutAndBoxDrawing() {
  const input = [
    '... | ## Compose with code',
    '... | ## Edit dynamically',
    '... |',
    '',
    '## Pricing',
    '',
    '┌──┬──┐',
    '│ A│ B│',
    '└──┴──┘',
    '',
  ].join('\n')

  const normalized = normalizeMarkdownAsciiBlocks(input)

  if (!normalized.includes('```ascii')) throw new Error('expected ascii fences to be inserted')
  if (!normalized.includes('Compose with code')) throw new Error('expected compose heading preserved in ascii table')
  if (!normalized.includes('┌')) throw new Error('expected box drawing borders to be present')

  const count = (needle: string) => normalized.split(needle).length - 1
  if (count('Compose with code') !== 1) throw new Error('expected no duplicate compose heading text')
  if (count('┌──┬──┐') !== 1) throw new Error('expected no duplicate box drawing lines')
  if (!/```ascii[\s\S]*┌──┬──┐[\s\S]*└──┴──┘[\s\S]*```/m.test(normalized)) {
    throw new Error('expected box drawing block to be wrapped in an ascii fence')
  }
  if (!/\n## Pricing\n/.test(normalized)) throw new Error('expected Pricing heading to remain as markdown heading')
}

export function testMarkdownPreviewLexNormalizesAsciiBlocksToAsciiLangCodeTokens() {
  const input = [
    '... | ## Compose with code',
    '... | ## Edit dynamically',
    '... |',
    '',
    '┌──┬──┐',
    '│ A│ B│',
    '└──┴──┘',
    '',
  ].join('\n')

  const { tokens } = lexMarkdown(input)
  const code = tokens.filter(t => (t as unknown as { type?: unknown }).type === 'code') as Array<{ lang?: string }>
  if (code.length < 2) throw new Error(`expected at least 2 code blocks, got ${code.length}`)
  if (!code.some(t => String(t.lang || '').toLowerCase() === 'ascii')) {
    throw new Error('expected at least one code block with lang=ascii')
  }
}

export function testMarkdownNormalizeAsciiBlocksWrapsLooseBoxDrawingSectionFromRemotionLikePricing() {
  const input = [
    '## Pricing',
    '',
    '┌─',
    'For individuals and companies of up to 3 people',
    '## Free License',
    '[X] Create and automate',
    'Commercial use allowed',
    '',
  ].join('\n')

  const normalized = normalizeMarkdownAsciiBlocks(input)
  if (!/## Pricing/.test(normalized)) throw new Error('expected Pricing heading preserved')
  if (!/```ascii[\s\S]*┌─[\s\S]*## Free License[\s\S]*```/m.test(normalized)) {
    throw new Error('expected remotion-like pricing block to be wrapped in an ascii fence')
  }

  const { tokens } = lexMarkdown(normalized)
  const headings = tokens.filter(t => (t as unknown as { type?: unknown }).type === 'heading') as Array<{ text?: string }>
  const hasFreeLicenseHeading = headings.some(h => String(h.text || '').toLowerCase().includes('free license'))
  if (hasFreeLicenseHeading) throw new Error('expected Free License inside ascii block not to lex as a heading')
}
