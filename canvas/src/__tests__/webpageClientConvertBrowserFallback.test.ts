import {
  convertWebpageUrlToMarkdownViaBrowser,
  setWebpageClientConvertDomExportForTests,
  setWebpageClientConvertJsdomLikeForTests,
} from '@/lib/websites/webpageClientConvert'

type GlobalWithFetch = typeof globalThis & { fetch?: typeof fetch }

function installWebpageProxyFetch(htmlByUrl: Map<string, string>, calls: string[]) {
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  g.fetch = (async (input: unknown) => {
    const url = input instanceof URL ? input.toString() : String(input || '')
    calls.push(url)
    if (!url.startsWith('/__webpage_proxy?')) {
      return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
    }
    const qs = new URLSearchParams(url.slice(url.indexOf('?') + 1))
    const sourceUrl = qs.get('url') || ''
    const first = htmlByUrl.values().next()
    const html = htmlByUrl.get(sourceUrl) || (first.done ? '' : first.value) || ''
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }) as unknown as typeof fetch
  return () => {
    g.fetch = prev
  }
}

export async function testWebpageClientConvertBrowserRecoversLongLoadingShellViaDomExport() {
  const url = 'https://example.com/shared-conversation'
  const shellLinks = Array.from(
    { length: 18 },
    (_, index) => `<a href="/shortcut-${index + 1}">Open App Shortcut ${index + 1}</a>`,
  ).join('')
  const shellHtml = [
    '<!doctype html>',
    '<html>',
    '<head><title>Shared Conversation</title></head>',
    '<body>',
    '<header><a href="/app">Get App</a><a href="/open">Open App</a><a href="/site">Visit Website</a><a href="/signin">Sign in</a><a href="/install">Install App</a></header>',
    '<main>',
    '<h1>Shared Conversation</h1>',
    '<p>Loading shared chat...</p>',
    `<nav>${shellLinks}</nav>`,
    '</main>',
    '</body>',
    '</html>',
  ].join('')
  const recoveredTitle = 'Shared Conversation Analysis'
  const recoveredHtml = [
    '<!doctype html>',
    '<html>',
    `<head><title>${recoveredTitle}</title></head>`,
    '<body>',
    '<main>',
    `<h1>${recoveredTitle}</h1>`,
    '<p>Analyze recent oil market reports from major institutions like Goldman Sachs and UBS.</p>',
    '<p>Identify a shared logical blind spot and re-simulate the next six-month trajectory.</p>',
    '<p>Detailed section 1 captures the hydrated report body with concrete evidence, shipping risk, and inventory lag.</p>',
    '<p>Detailed section 2 captures the downstream implications for price floors and transition feedback loops.</p>',
    '</main>',
    '</body>',
    '</html>',
  ].join('')
  const recoveredText = [
    recoveredTitle,
    '',
    'Analyze recent oil market reports from major institutions like Goldman Sachs and UBS.',
    '',
    'Identify a shared logical blind spot and re-simulate the next six-month trajectory.',
  ].join('\n')
  const proxyCalls: string[] = []
  const domModes: string[] = []
  const restore = installWebpageProxyFetch(new Map([[url, shellHtml]]), proxyCalls)
  setWebpageClientConvertJsdomLikeForTests(false)
  setWebpageClientConvertDomExportForTests(async args => {
    domModes.push(String(args.mode || ''))
    if (args.mode === 'html') return { text: recoveredHtml, title: recoveredTitle, clipped: false }
    return { text: recoveredText, title: recoveredTitle, clipped: false }
  })
  try {
    const res = await convertWebpageUrlToMarkdownViaBrowser({ url })
    if (res.ok !== true) {
      throw new Error(`expected browser conversion to recover hydrated DOM content, got ${JSON.stringify(res)}`)
    }
    if (!res.markdown.includes('Goldman Sachs and UBS')) {
      throw new Error('expected browser conversion to preserve hydrated report body text')
    }
    if (!res.markdown.includes('logical blind spot')) {
      throw new Error('expected browser conversion to preserve downstream hydrated report sections')
    }
    if (res.markdown.includes('Loading shared chat')) {
      throw new Error('expected browser conversion to reject the loading shell markdown')
    }
    if (!proxyCalls.some(call => call.startsWith('/__webpage_proxy?'))) {
      throw new Error('expected browser conversion to probe the shared webpage proxy fast path first')
    }
    if (!domModes.includes('html')) {
      throw new Error(`expected browser conversion to probe the hydrated html DOM export, got ${JSON.stringify(domModes)}`)
    }
  } finally {
    setWebpageClientConvertDomExportForTests(null)
    setWebpageClientConvertJsdomLikeForTests(null)
    restore()
  }
}
