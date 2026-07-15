import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { parseHtmlToMarkdownAllText } from '@/features/parsers/html-parser'

export async function testHtmlParserAllTextIncludesNavAndMain() {
  const { restore } = initJsdomHarness()
  try {
    const html = [
      '<!doctype html>',
      '<html>',
      '<head><title>Doc Title</title></head>',
      '<body>',
      '<nav><a href="/a">Nav A</a></nav>',
      '<main><h1>Main H1</h1><p>Hello world</p><table><tr><th>Name</th><th>Note</th></tr><tr><td>A | B</td><td>Line<br>Two</td></tr></table></main>',
      '</body>',
      '</html>',
    ].join('')

    const md = parseHtmlToMarkdownAllText(html, 'https://example.com/')
    if (!md.includes('# Doc Title') && !md.includes('# Main H1')) throw new Error('expected title or h1')
    if (!md.includes('Nav A')) throw new Error('expected nav text included')
    if (!md.includes('Hello world')) throw new Error('expected main text included')
    if (!md.includes('(https://example.com/a)')) throw new Error('expected relative href resolved')
    if (!md.includes('| Name | Note |') || !md.includes('| A \\| B | Line Two |')) {
      throw new Error(`expected fallback HTML tables to reuse canonical Markdown pipe-table serialization, got:\n${md}`)
    }
    if (/<table\b|<br\s*\/?>/i.test(md)) throw new Error('expected no authored table HTML in parser output')
  } finally {
    restore()
  }
}
