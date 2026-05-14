import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport'

type GlobalWithFetch = typeof globalThis & { fetch?: typeof fetch }

export async function testWorkspaceImportUrlDesignStubDoesNotFetchAndSetsCanvasPreset(): Promise<void> {
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  g.fetch = (async () => {
    throw new Error('Unexpected fetch() during design import stub')
  }) as unknown as typeof fetch
  try {
    const res = await fetchWorkspaceUrlContent('https://example.com/', { mode: 'import', viewHint: 'html', canvas2dRenderer: 'design' })
    if (!res || typeof res.text !== 'string') throw new Error('Expected result text')
    if (!/kgCanvas2dRenderer:\s*"design"/.test(res.text)) throw new Error('Expected design canvas preset in frontmatter')
    if (!/kgWebpageUrl:\s*"https:\/\/example\.com\/"/.test(res.text)) throw new Error('Expected URL in stub')
    if (!/kgWebpageView:\s*"html"/.test(res.text)) throw new Error('Expected html view in stub')
    if (!/kgWebpageFidelityLevel:\s*"4"/.test(res.text)) throw new Error('Expected fidelity 4 for design import')
    if (!/kgWebpageIncludeImages:\s*"true"/.test(res.text)) throw new Error('Expected includeImages=true for design import')
    if (res.text.includes('<html') || res.text.includes('<script')) throw new Error('Stub must not embed HTML')
  } finally {
    g.fetch = prev
  }
}
