import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport'

async function assertImportDoesNotEmitHydrationStub(url: string): Promise<void> {
  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  try {
    g.fetch = (async (input: unknown) => {
      const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : ''
      if (requestUrl.startsWith('/__fetch_remote?url=')) throw new Error('expected URL import to avoid legacy remote fetch route')
      return {
        ok: requestUrl.startsWith('/__webpage_proxy?'),
        status: requestUrl.startsWith('/__webpage_proxy?') ? 200 : 404,
        headers: { get: () => null },
        text: async () => '<!doctype html><html><body><main><h1>Signed in page</h1><p>Visible content</p></main></body></html>',
      } as unknown as Response
    }) as unknown

    const res = await fetchWorkspaceUrlContent(url, { mode: 'import', viewHint: 'markdown' })
    if (!res || typeof res.text !== 'string') throw new Error('missing content')
    if (!/kgWebpageView:\s*"markdown"/i.test(res.text)) throw new Error('expected markdown view')
    if (/kgWebpageHydrate:/i.test(res.text)) throw new Error('expected import to avoid self-hydrating frontmatter')
    if (/Fetching content in background/i.test(res.text)) throw new Error('expected import to avoid background placeholder')
    if (!res.text.includes('Visible content')) throw new Error('expected imported page content')
  } finally {
    g.fetch = prevFetch
  }
}

export async function testUrlImportAuthWallImportAvoidsHydrationStubForXHome() {
  await assertImportDoesNotEmitHydrationStub('https://x.com/home')
}

export async function testUrlImportAuthWallImportAvoidsHydrationStubForLinkedInFeed() {
  await assertImportDoesNotEmitHydrationStub('https://www.linkedin.com/feed/')
}
