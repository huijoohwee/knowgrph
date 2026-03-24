import { buildJsonLdMarkdown, extractJsonLdFromHtmlText } from '@/components/BottomPanel/markdownWorkspace/workspaceImport/apiNative'
import { fetchWorkspaceUrlContent } from '@/components/BottomPanel/markdownWorkspace/workspaceImport'

export function testUrlImportApiNativeJsonLdExtractsAndRendersMarkdown() {
  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<title>Mudah.my | Malaysia\u2019s Largest Marketplace</title>',
    '<script type="application/ld+json">',
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Mudah.my',
      url: 'https://www.mudah.my/',
    }),
    '</script>',
    '</head>',
    '<body>',
    '<h1>Welcome</h1>',
    '</body>',
    '</html>',
  ].join('')

  const jsonLd = extractJsonLdFromHtmlText(html)
  if (!Array.isArray(jsonLd) || jsonLd.length < 1) throw new Error('expected json-ld extraction')

  const md = buildJsonLdMarkdown({ url: 'https://www.mudah.my/', htmlTitle: 'Mudah.my', jsonLd })
  if (!md.includes('# Mudah.my')) throw new Error('expected markdown heading')
  if (!md.includes('```json')) throw new Error('expected json fence')
  if (!md.includes('"@type": "WebSite"')) throw new Error('expected json content')
}

export async function testUrlImportApiNativeJsonLdPrefersApiNativeForMudah() {
  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<title>Mudah.my | Malaysia\u2019s Largest Marketplace</title>',
    '<script type="application/ld+json">',
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Mudah.my',
      url: 'https://www.mudah.my/',
    }),
    '</script>',
    '</head>',
    '<body>',
    '<h1>Welcome</h1>',
    '</body>',
    '</html>',
  ].join('')

  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  try {
    g.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => html,
      } as unknown as Response
    }) as unknown

    const res = await fetchWorkspaceUrlContent('https://www.mudah.my/', { mode: 'refresh', viewHint: 'json' })
    if (!res.text.includes('```json')) throw new Error('expected api-native json-ld markdown')
    if (!res.text.includes('"@type": "WebSite"')) throw new Error('expected json content')
  } finally {
    g.fetch = prevFetch
  }
}

export async function testUrlImportApiNativeJsonLdImportModeDoesNotBlockOnHtmlFetch() {
  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  try {
    g.fetch = (async () => {
      throw new Error('fetch should not be called in import mode')
    }) as unknown
    const res = await fetchWorkspaceUrlContent('https://www.mudah.my/', { mode: 'import', viewHint: 'markdown' })
    if (!res || typeof res.text !== 'string') throw new Error('missing content')
    if (!res.text.includes('kgWebpageUrl: "https://www.mudah.my/"')) throw new Error('expected stub frontmatter')
  } finally {
    g.fetch = prevFetch
  }
}

export async function testUrlImportRefreshMarkdownParsesMudahTextFromHtml() {
  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<title>Mudah.my</title>',
    '</head>',
    '<body>',
    '<main>',
    '<h1>Welcome to Mudah.my</h1>',
    '<p>Mudah.my offers to millions of unique visitors who use our marketplace to buy and sell almost anything.</p>',
    '<p>Begin your easy buying and selling experience with Mudah.my today!</p>',
    '</main>',
    '</body>',
    '</html>',
  ].join('')

  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  try {
    g.fetch = (async (input: unknown) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : ''
      if (url.startsWith('/__fetch_remote?url=')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => html,
        } as unknown as Response
      }
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
        text: async () => 'not found',
      } as unknown as Response
    }) as unknown

    const res = await fetchWorkspaceUrlContent('https://www.mudah.my/', { mode: 'refresh', viewHint: 'markdown' })
    const body = res.text.replace(/^---[\s\S]*?\n---\n?/m, '')
    if (!body.includes('Welcome to Mudah.my')) throw new Error('expected main heading preserved')
    if (!body.includes('millions of unique visitors')) throw new Error('expected paragraph preserved')
    if (!body.includes('easy buying and selling')) throw new Error('expected closing paragraph preserved')
  } finally {
    g.fetch = prevFetch
  }
}
