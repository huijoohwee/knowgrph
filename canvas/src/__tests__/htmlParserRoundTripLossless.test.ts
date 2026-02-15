import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { parseHtmlToMarkdownAllText, parseHtmlToMarkdown } from '@/features/parsers/html-parser'

export async function testHtmlParserUsesEmbeddedLosslessMarkdownSource() {
  const { restore } = initJsdomHarness()
  try {
    const md = [
      '---',
      'title: "Round Trip"',
      'tags: [a, b]',
      '---',
      '',
      '# Heading',
      '',
      'A paragraph with **bold**, *em*, and a [link](https://example.com?q=1&x=2).',
      '',
      '- Item 1',
      '- Item 2',
      '',
      '```js',
      'const x = "</script>"',
      '```',
      '',
    ].join('\n')

    const b64 = Buffer.from(md, 'utf8').toString('base64')
    const html = [
      '<!doctype html>',
      '<html><head><title>Ignored</title></head><body>',
      `<script type="application/x-kg-markdown" data-kg-markdown-source="1" data-kg-encoding="base64">${b64}</script>`,
      '<main><h1>Not used</h1></main>',
      '</body></html>',
    ].join('')

    const a = parseHtmlToMarkdownAllText(html, 'https://example.com/')
    const b = parseHtmlToMarkdown(html, 'https://example.com/')
    if (a !== md) throw new Error('expected parseHtmlToMarkdownAllText to return embedded markdown source exactly')
    if (b !== md) throw new Error('expected parseHtmlToMarkdown to return embedded markdown source exactly')
  } finally {
    restore()
  }
}

