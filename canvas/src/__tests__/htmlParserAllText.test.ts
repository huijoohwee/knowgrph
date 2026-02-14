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
      '<main><h1>Main H1</h1><p>Hello world</p></main>',
      '</body>',
      '</html>',
    ].join('')

    const md = parseHtmlToMarkdownAllText(html, 'https://example.com/')
    if (!md.includes('# Doc Title') && !md.includes('# Main H1')) throw new Error('expected title or h1')
    if (!md.includes('Nav A')) throw new Error('expected nav text included')
    if (!md.includes('Hello world')) throw new Error('expected main text included')
    if (!md.includes('(https://example.com/a)')) throw new Error('expected relative href resolved')
  } finally {
    restore()
  }
}

