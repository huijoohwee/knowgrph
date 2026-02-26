import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'

export async function testHtmlToMarkdownUnifiedDedupeParagraphs() {
  const para =
    'This is a long paragraph intended to test SSOT dedupe in the HTML to Markdown unified converter. It should be removed if duplicated verbatim in the output.'
  const html = [
    '<main>',
    `  <p>${para}</p>`,
    `  <p>${para}</p>`,
    '  <p>Short line stays.</p>',
    '  <pre><code>code fence should not be deduped even if repeated</code></pre>',
    '  <pre><code>code fence should not be deduped even if repeated</code></pre>',
    '</main>',
  ].join('\n')

  const res = await convertHtmlToMarkdownUnified({ html, fidelityLevel: 3 })
  if (res.ok !== true) throw new Error('expected ok conversion')
  const md = res.markdown
  const count = md.split(para).length - 1
  if (count !== 1) throw new Error(`expected duplicated paragraph to be deduped to 1, got ${count}`)
  if (!md.includes('Short line stays.')) throw new Error('expected short paragraph to remain')
  const codeCount = md.split('code fence should not be deduped').length - 1
  if (codeCount !== 2) throw new Error(`expected code fences to remain duplicated, got ${codeCount}`)
}
