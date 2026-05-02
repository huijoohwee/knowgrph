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

export async function testWorkspaceImportUrlAcceptsAbsoluteFsPathViaViteFsFetch(): Promise<void> {
  const g = globalThis as GlobalWithFetch
  const prev = g.fetch
  let calledUrl = ''
  g.fetch = (async (input: unknown) => {
    calledUrl = input instanceof URL ? input.toString() : String(input || '')
    return {
      ok: true,
      status: 200,
      text: async () => '# Local Demo\n',
    } as Response
  }) as unknown as typeof fetch
  try {
    const inputPath = '/Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph-video-demo.md'
    const res = await fetchWorkspaceUrlContent(inputPath, { mode: 'import' })
    if (calledUrl !== '/@fs/Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph-video-demo.md') {
      throw new Error(`expected absolute filesystem import to fetch through Vite /@fs, got ${String(calledUrl)}`)
    }
    if (res.normalizedUrl !== inputPath) {
      throw new Error(`expected absolute filesystem import to preserve the original source path, got ${String(res.normalizedUrl)}`)
    }
    if (res.name !== 'knowgrph-video-demo.md') {
      throw new Error(`expected absolute filesystem import to derive the source basename, got ${String(res.name)}`)
    }
    if (res.text !== '# Local Demo\n') {
      throw new Error('expected absolute filesystem import to return fetched markdown text verbatim')
    }
  } finally {
    g.fetch = prev
  }
}
