import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport'
import { setWorkspaceWebpageDomExportForTests } from '@/features/markdown-workspace/workspaceImport/urlContent'
import { resetWorkspaceUrlContentCacheForTests } from '@/features/markdown-workspace/workspaceImport/urlContentCache'

type GlobalWithFetch = typeof globalThis & { fetch?: typeof fetch }

export async function testWorkspaceImportUrlRejectsBareLoadingIframeShellBeforePersisting(): Promise<void> {
  resetWorkspaceUrlContentCacheForTests()
  const url = 'https://example.test/share/loading-shell'
  const g = globalThis as GlobalWithFetch
  const previousFetch = g.fetch
  g.fetch = (async (input: unknown) => {
    const requestUrl = input instanceof URL ? input.toString() : String(input || '')
    if (requestUrl.startsWith('/__webpage_proxy?')) {
      return new Response('<!doctype html><html><head><title>Shared Surface</title></head><body>Loading...<iframe height="1" width="1" style="visibility:hidden"></iframe></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    }
    return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }) as typeof fetch
  setWorkspaceWebpageDomExportForTests(async args => ({
    text: args.mode === 'html'
      ? `<main><h1>Hydrated shared analysis</h1>${Array.from({ length: 4 }, (_, index) => `<p>Substantive hydrated content ${index + 1} replaces the loading shell before persistence with enough body detail for the shared fidelity gate.</p>`).join('')}</main>`
      : ['Hydrated shared analysis', '', ...Array.from({ length: 4 }, (_, index) => `Substantive hydrated content ${index + 1} replaces the loading shell before persistence with enough body detail for the shared fidelity gate.`)].join('\n'),
    title: 'Hydrated shared analysis',
    clipped: false,
  }))
  try {
    const result = await fetchWorkspaceUrlContent(url, { mode: 'import', viewHint: 'markdown' })
    if (!result.text.includes('Substantive hydrated content 1 replaces the loading shell before persistence')) {
      throw new Error(`expected hydrated DOM content instead of loading shell, got:\n${result.text}`)
    }
    if (/Loading\.\.\.|<iframe\b/i.test(result.text)) {
      throw new Error(`expected low-fidelity loading iframe shell to be rejected before persistence, got:\n${result.text}`)
    }
  } finally {
    setWorkspaceWebpageDomExportForTests(null)
    g.fetch = previousFetch
    resetWorkspaceUrlContentCacheForTests()
  }
}
