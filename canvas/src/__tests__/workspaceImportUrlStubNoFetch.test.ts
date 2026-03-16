import { fetchWorkspaceUrlContent } from '@/components/BottomPanel/markdownWorkspace/workspaceImport'

type GlobalWithFetch = typeof globalThis & { fetch?: typeof fetch }

async function assertStubFor(url: string) {
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  g.fetch = (async () => {
    throw new Error('Unexpected fetch() during import stub')
  }) as unknown as typeof fetch
  try {
    const res = await fetchWorkspaceUrlContent(url, { mode: 'import' })
    if (!res || typeof res.text !== 'string') throw new Error('Expected result text')
    if (!res.text.includes('kgWebpageUrl:')) throw new Error('Expected webpage frontmatter')
    if (!res.text.includes(url)) throw new Error('Expected URL in stub')
    if (!res.text.includes('kgWebpageView:')) throw new Error('Expected view in stub')
    if (res.text.includes('<html') || res.text.includes('<script')) throw new Error('Stub must not embed HTML')
  } finally {
    g.fetch = prev
  }
}

export async function testWorkspaceImportUrlStubDoesNotFetch(): Promise<void> {
  await assertStubFor('https://www.figma.com/')
  await assertStubFor('https://vercel.com/')
}

