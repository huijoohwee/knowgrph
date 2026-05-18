import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport'

export async function testWorkspaceImportLargeWebpageMarkdownIsClipped() {
  const sourceUrl = 'https://www.mudah.my/large-markdown'
  const manyParas = Array.from({ length: 30_000 }, (_, index) => `<p>hello world ${index}</p>`).join('')
  const manyScripts = Array.from({ length: 25 }, () => '<script>var x=1;</script>').join('')
  const html = `<!doctype html><html><head><title>Mudah.my</title>${manyScripts}</head><body><main><h1>Welcome to Mudah.my</h1>${manyParas}</main></body></html>`

  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  try {
    g.fetch = (async (input: unknown) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : ''
      if (url.startsWith('/__webpage_proxy?')) {
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

    const res = await fetchWorkspaceUrlContent(sourceUrl, { mode: 'refresh', viewHint: 'markdown' })
    if (!res || typeof res.text !== 'string') throw new Error('missing content')
    if (!res.text.includes('Welcome to Mudah.my')) throw new Error('expected heading preserved')
    if (!res.text.includes('…(clipped')) throw new Error('expected clipped marker')
    if (res.text.length > 240_000) throw new Error(`expected clipped doc <= 240k chars, got ${res.text.length}`)
  } finally {
    g.fetch = prevFetch
  }
}
