import { buildWebpageHtmlSrcdoc } from '@/lib/websites/webpageIframeSrcdoc'

export function testWebpageHtmlSrcdocShrinksLargeHtmlInsteadOfFailing() {
  const hugeScript = `<script>${'x'.repeat(2_100_000)}</script>`
  const html = `<!doctype html><html><head>${hugeScript}<style>${'a'.repeat(40_000)}</style></head><body><h1>Hi</h1></body></html>`
  const built = buildWebpageHtmlSrcdoc({ html, baseHref: 'https://example.com/', scriptPolicy: 'strip' })
  if (!built.includes('<h1>Hi</h1>')) throw new Error('expected body content to remain after shrinking')
  if (built.includes('HTML too large for sandboxed srcdoc')) {
    throw new Error('expected srcdoc builder to shrink first instead of emitting size error')
  }
}

