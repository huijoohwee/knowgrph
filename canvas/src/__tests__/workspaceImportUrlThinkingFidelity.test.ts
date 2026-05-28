import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { plainTextToMarkdown } from '@/lib/markdown/plainTextToMarkdown'
import { restoreWebpageMarkdownSyntaxFidelity } from '@/lib/markdown/webpageMarkdownSyntaxFidelity'
import { chooseDomRecoveredMarkdown } from '@/features/markdown-workspace/workspaceImport/webpageMarkdownFidelity'

export function testWorkspaceImportUrlThinkingUsesGenericToggleHints(): void {
  const source = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'workspaceImport', 'urlContent.ts'),
    'utf8',
  )
  for (const hint of ['Show thinking', 'Show reasoning', 'View thinking', 'View reasoning']) {
    if (!source.includes(`'${hint}'`)) {
      throw new Error(`expected share thinking recovery to include generic toggle hint: ${hint}`)
    }
  }
}

export function testThinkingPlainTextMarkdownPreservesVisibleSyntaxTokens(): void {
  const markdown = restoreWebpageMarkdownSyntaxFidelity(plainTextToMarkdown([
    '> Quoted premise remains visibly quoted.',
    '- Bullet item stays a bullet.',
    '1. Ordered item stays ordered.',
    '[Reuters](https://www.reuters.com/example)',
    '![oil chart](https://example.com/oil-chart.png)',
    '| Institution | Price |',
    '| Goldman | $85/bbl |',
    'Inline code `risk_model()` and math $x+y$ stay visible.',
    '````',
    '```python',
    'print("Brent", 85)',
    '```',
    '````',
  ].join('\n')))
  for (const expected of [
    '> Quoted premise remains visibly quoted.',
    '- Bullet item stays a bullet.',
    '1. Ordered item stays ordered.',
    '[Reuters](https://www.reuters.com/example)',
    '![oil chart](https://example.com/oil-chart.png)',
    '| Institution | Price |',
    '| Goldman | $85/bbl |',
    'Inline code `risk_model()` and math $x+y$ stay visible.',
    '````\n```python\nprint("Brent", 85)\n```\n````',
  ]) {
    if (!markdown.includes(expected)) {
      throw new Error(`expected thinking markdown to preserve visible token block:\n${expected}\n\nACTUAL:\n${markdown}`)
    }
  }
}

export function testWorkspaceImportUrlThinkingChooserPrefersRenderedMarkdownTokenParity(): void {
  const rendered = [
    '> Quoted premise remains visibly quoted.',
    '',
    '- Bullet item stays a bullet.',
    '1. Ordered item stays ordered.',
    '',
    '[Reuters](https://www.reuters.com/example)',
    '![oil chart](https://example.com/oil-chart.png)',
    '',
    '| Institution | Price |',
    '|---|---|',
    '| Goldman | $85/bbl |',
    '',
    'Inline code `risk_model()` and math $x+y$ stay visible.',
    '',
    '````',
    '```python',
    'print("Brent", 85)',
    '```',
    '````',
  ].join('\n')
  const selected = chooseDomRecoveredMarkdown({
    mode: 'import',
    convertedMarkdown: ['```', rendered, '```'].join('\n'),
    renderedTextMarkdown: rendered,
    preferStructuredMarkdown: true,
  })
  if (selected.source !== 'rendered') {
    throw new Error(`expected syntax-rich rendered thinking text to win over a wrapper fence, got ${selected.source}`)
  }
  if (selected.markdown !== rendered) {
    throw new Error(`expected rendered thinking markdown to preserve byte-for-byte visible tokens\nEXPECTED:\n${rendered}\n\nACTUAL:\n${selected.markdown}`)
  }
}
