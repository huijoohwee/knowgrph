import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'

export async function testHtmlToMarkdownUnifiedPreservesGridSectionsAsHtml() {
  const res = await convertHtmlToMarkdownUnified({
    html: [
      '<main>',
      '<h1>Pencil</h1>',
      '<section class="grid grid-cols-12 gap-4">',
      '<section class="col-span-6"><p>A</p></section>',
      '<section class="col-span-6"><p>B</p></section>',
      '</section>',
      '</main>',
    ].join(''),
    baseUrl: 'https://example.com/',
    fidelityLevel: 4,
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!/<section\b[^>]*\bgrid\b/i.test(md)) throw new Error(`expected grid section to be preserved as html, got:\n${md}`)
  if (!/grid-cols-12/i.test(md)) throw new Error('expected grid-cols-12 class preserved in html')
  if (!/col-span-6/i.test(md)) throw new Error('expected col-span class preserved in html')
}

