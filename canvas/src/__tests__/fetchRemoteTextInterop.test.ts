import { fetchRemoteText, fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'

type FetchStubResponse = {
  ok: boolean
  status: number
  headers: { get: (key: string) => string | null }
  body?: null
  text: () => Promise<string>
}

type WindowOriginLike = { location?: { origin?: string } }
type GlobalWithFetch = { fetch?: typeof fetch; window?: WindowOriginLike }

export const testFetchRemoteTextValidateSupportsStringAndArgs = async () => {
  const g = globalThis as unknown as GlobalWithFetch
  const prevFetch = g.fetch
  const prevWindow = g.window
  const calls: { url: string; method?: string }[] = []

  g.window = { location: { origin: 'http://localhost:5173' } }
  g.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : ''
    calls.push({ url, method: init?.method })
    const response: FetchStubResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: null,
      text: async () => '  hello  ',
    }
    return response as unknown as Response
  }) as unknown as typeof fetch

  try {
    const t1 = await fetchRemoteTextDetailed('https://example.com/a.txt', {
      useProxy: 'never',
      validate: ({ text, url }) => text.trim() === 'hello' && url.includes('example.com'),
    })
    if ('kind' in t1) throw new Error(`Expected ok result (args validate), got ${t1.kind}`)

    const t2 = await fetchRemoteTextDetailed('https://example.com/b.txt', {
      useProxy: 'never',
      validate: (text: string) => text.trim() === 'hello',
    })
    if ('kind' in t2) throw new Error(`Expected ok result (string validate), got ${t2.kind}`)

    if (calls.length !== 2) throw new Error(`Expected 2 fetch calls, got ${calls.length}`)
  } finally {
    g.fetch = prevFetch
    g.window = prevWindow
  }
}

export const testFetchRemoteTextPreflightHeadGuardsTooLarge = async () => {
  const g = globalThis as unknown as GlobalWithFetch
  const prevFetch = g.fetch
  const prevWindow = g.window
  const calls: { url: string; method?: string }[] = []

  g.window = { location: { origin: 'http://localhost:5173' } }
  g.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : ''
    calls.push({ url, method: init?.method })
    const isHead = String(init?.method || '').toUpperCase() === 'HEAD'
    const response: FetchStubResponse = {
      ok: true,
      status: 200,
      headers: {
        get: (key: string) => {
          if (key.toLowerCase() !== 'content-length') return null
          return isHead ? String(10_000_000) : String(1)
        },
      },
      body: null,
      text: async () => 'x',
    }
    return response as unknown as Response
  }) as unknown as typeof fetch

  try {
    const res = await fetchRemoteTextDetailed('https://example.com/huge.txt', {
      useProxy: 'always',
      preflightHead: true,
      maxBytes: 100,
    })
    if (!('kind' in res)) throw new Error('Expected too_large failure')
    if (res.kind !== 'too_large') throw new Error(`Expected kind=too_large, got ${res.kind}`)

    if (calls.length !== 1) throw new Error(`Expected only HEAD call, got ${calls.length}`)
    if ((calls[0]?.method || '').toUpperCase() !== 'HEAD') throw new Error('Expected HEAD preflight')
    if (!calls[0]?.url.startsWith('/__fetch_remote?url=')) throw new Error('Expected proxy URL for HEAD preflight')
  } finally {
    g.fetch = prevFetch
    g.window = prevWindow
  }
}

export const testFetchRemoteTextWrapperUseProxyBoolean = async () => {
  const g = globalThis as unknown as GlobalWithFetch
  const prevFetch = g.fetch
  const prevWindow = g.window
  const calls: string[] = []

  g.window = { location: { origin: 'http://localhost:5173' } }
  g.fetch = (async (input: unknown) => {
    const url = typeof input === 'string' ? input : ''
    calls.push(url)
    const response: FetchStubResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: null,
      text: async () => 'ok',
    }
    return response as unknown as Response
  }) as unknown as typeof fetch

  try {
    const text = await fetchRemoteText('https://example.com/p.txt', { useProxy: true })
    if (text !== 'ok') throw new Error('Expected ok text result')
    if (calls.length !== 1) throw new Error(`Expected 1 fetch call, got ${calls.length}`)
    if (!calls[0]?.startsWith('/__fetch_remote?url=')) throw new Error('Expected proxy URL for fetchRemoteText wrapper')
  } finally {
    g.fetch = prevFetch
    g.window = prevWindow
  }
}
