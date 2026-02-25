import { fetchWorkspaceUrlContent } from '@/components/BottomPanel/markdownWorkspace/workspaceImport'
import { isFrontmatterOnlyDoc } from '@/lib/markdown/frontmatter'

export const testImportUrlWebpageCreatesHtmlFrontmatterStub = async () => {
  const res = await fetchWorkspaceUrlContent('https://grapesjs.com/pricing')
  if (!res || typeof res.text !== 'string') throw new Error('missing content')
  const text = res.text
  if (!text.includes('kgWebpageUrl:')) throw new Error('missing kgWebpageUrl')
  if (!text.includes('kgWebpageView:')) throw new Error('missing kgWebpageView')
  if (!/kgWebpageView:\s*"html"/i.test(text) && !/kgWebpageView:\s*html/i.test(text)) {
    throw new Error('expected kgWebpageView to be html')
  }
  const body = text.replace(/^---[\s\S]*?\n---\n?/m, '')
  if (body.trim()) throw new Error('expected stub body to be empty')
}

export const testImportUrlWebpageRefreshUsesSourceFaithfulForMultipleUrls = async () => {
  const urls = [
    'https://grapesjs.com/pricing',
    'https://example.com/',
    'https://api.byteplus.com/api-sdk/view?serviceCode=ecs&version=2020-04-01&language=Python',
  ]

  const htmlBody =
    '<!doctype html><html><head><title>Test Page</title></head><body><h1>Source Faithful Heading</h1><p>First section</p><p>Second section</p></body></html>'

  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  try {
    g.fetch = (async (input: unknown, init?: unknown) => {
      const initObj = init && typeof init === 'object' ? (init as { method?: unknown }) : null
      const methodRaw = initObj?.method
      const method = (typeof methodRaw === 'string' ? methodRaw : 'GET').toUpperCase()
      const res = {
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
        text: async () => (method === 'HEAD' ? '' : htmlBody),
      }
      return res as unknown as Response
    }) as unknown

    for (const url of urls) {
      const refreshed = await fetchWorkspaceUrlContent(url, { mode: 'refresh' })
      if (!refreshed || typeof refreshed.text !== 'string') throw new Error('missing refresh content')
      if (refreshed.normalizedUrl !== url) {
        throw new Error(`expected normalizedUrl to equal input URL for refresh: ${url}`)
      }
      if (!refreshed.name || !refreshed.name.endsWith('.md')) {
        throw new Error(`expected refresh mode to derive a .md file name for URL: ${url}`)
      }
      const text = refreshed.text
      if (!text.includes('Source-Faithful (No Invented Content)')) {
        throw new Error(`expected Source-Faithful fidelity marker for URL: ${url}`)
      }
      if (isFrontmatterOnlyDoc(text)) {
        throw new Error(`expected non-empty body for URL: ${url}`)
      }
      const body = text.replace(/^---[\s\S]*?\n---\n?/m, '')
      if (!body.includes('Source Faithful Heading')) {
        throw new Error(`expected HTML-derived heading in body for URL: ${url}`)
      }
    }
  } finally {
    g.fetch = prevFetch
  }
}
