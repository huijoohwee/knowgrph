import {
  buildCardMarkdownPreviewText,
  hasCardMarkdownPreviewSyntax,
  readCardMarkdownPreviewSourceLineRange,
} from '@/lib/cards/cardMarkdownPreviewUtils'

export function testCardMarkdownPreviewTextUsesSourceLineRangeForStructuredMarkdown() {
  const markdownText = [
    '# Intro',
    '',
    '```md',
    '> quoted',
    '',
    '| ID | Value |',
    '| --- | --- |',
    '| C1 | Fresh |',
    '',
    '![preview](https://example.com/preview.png)',
    '[open](https://example.com)',
    '<iframe src="https://example.com/embed"></iframe>',
    '<video src="https://example.com/demo.mp4"></video>',
    '```',
    '',
    'After',
  ].join('\n')

  const source = readCardMarkdownPreviewSourceLineRange({ markdownText, startLine: 3, endLine: 14 })
  const panelText = buildCardMarkdownPreviewText({
    markdownText,
    block: {
      startLine: 3,
      endLine: 14,
      title: 'Code',
      summary: 'fallback should not win',
      preview: { kind: 'code', code: { lang: 'md', lines: ['fallback should not win'] } },
    },
  })

  if (source !== panelText) throw new Error('expected Card markdown preview text to reuse the source line range')
  for (const snippet of [
    '```md',
    '> quoted',
    '| ID | Value |',
    '![preview](https://example.com/preview.png)',
    '[open](https://example.com)',
    '<iframe src="https://example.com/embed"></iframe>',
    '<video src="https://example.com/demo.mp4"></video>',
  ]) {
    if (!panelText.includes(snippet)) throw new Error(`expected source panel text to preserve ${snippet}`)
  }
}

export function testCardMarkdownPreviewTextFallbacksPreserveSharedMarkdownSyntax() {
  const guardedCodeText = buildCardMarkdownPreviewText({
    markdownText: '# Unrelated heading',
    block: {
      startLine: 1,
      endLine: 1,
      title: 'Code',
      preview: { kind: 'code', code: { lang: 'ts', lines: ['const fromPreview = true'] } },
    },
  })
  if (guardedCodeText.includes('# Unrelated heading') || !guardedCodeText.includes('const fromPreview = true')) {
    throw new Error(`expected incompatible source lines to fall back to the block preview payload, got ${guardedCodeText}`)
  }

  const tableText = buildCardMarkdownPreviewText({
    block: {
      title: 'Table',
      preview: {
        kind: 'table',
        table: {
          columns: ['ID', 'Value'],
          rows: [['C1', 'Data | freshness']],
        },
      },
    },
  })
  if (!tableText.includes('| ID | Value |') || !tableText.includes('Data \\| freshness')) {
    throw new Error(`expected table fallback to stay markdown-table compatible, got ${tableText}`)
  }

  const codeText = buildCardMarkdownPreviewText({
    block: {
      title: 'Code',
      preview: { kind: 'code', code: { lang: 'ts', lines: ['const value = 42'] } },
    },
  })
  if (!codeText.includes('```ts') || !codeText.includes('const value = 42')) {
    throw new Error(`expected code fallback to stay fenced-code compatible, got ${codeText}`)
  }

  const blockquoteText = buildCardMarkdownPreviewText({
    block: {
      title: 'Quote',
      preview: { kind: 'blockquote', blockquote: { lines: ['Insight stays structured'] } },
    },
  })
  if (blockquoteText !== '> Insight stays structured') {
    throw new Error(`expected blockquote fallback to stay markdown-blockquote compatible, got ${blockquoteText}`)
  }

  const htmlText = buildCardMarkdownPreviewText({
    block: {
      title: 'Embed',
      preview: { kind: 'html', html: { raw: '<iframe src="https://example.com/embed"></iframe>' } },
    },
  })
  if (htmlText !== '<iframe src="https://example.com/embed"></iframe>') {
    throw new Error(`expected html fallback to preserve raw media HTML for shared markdown media rendering, got ${htmlText}`)
  }
}

export function testCardMarkdownPreviewSyntaxDetectsMarkdownTables() {
  const tableMarkdown = [
    '| ID | Criterion |',
    '| --- | --- |',
    '| C1 | Data freshness |',
  ].join('\n')
  if (!hasCardMarkdownPreviewSyntax(tableMarkdown)) {
    throw new Error('expected Card markdown syntax detection to include markdown table pipes')
  }
}
