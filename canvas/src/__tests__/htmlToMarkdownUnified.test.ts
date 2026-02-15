import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'

export async function testHtmlToMarkdownUnifiedConvertsBasicHtml() {
  const res = await convertHtmlToMarkdownUnified({
    html: [
      '<h1>Hello</h1>',
      '<p>World</p>',
      '<a href="/docs">Docs</a>',
      '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>',
      '<iframe srcdoc="<!doctype html><html><body><h1>Hi</h1></body></html>"></iframe>',
      '<details open><summary>More</summary><p>Details body</p></details>',
    ].join(''),
    baseUrl: 'https://example.com/',
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!md.includes('# Hello')) throw new Error('expected heading')
  if (!md.toLowerCase().includes('world')) throw new Error('expected paragraph')
  if (!md.includes('(https://example.com/docs)')) throw new Error('expected resolved link')
  if (!md.includes('<svg')) throw new Error('expected svg html preserved')
  if (!md.includes('<iframe')) throw new Error('expected iframe html preserved')
  if (!md.includes('<details')) throw new Error('expected details html preserved')
}
