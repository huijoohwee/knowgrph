import {
  getAgenticOsRemoteGrammarCatalogSnapshot,
  primeAgenticOsRemoteGrammarCatalogBySigil,
  refreshAgenticOsRemoteGrammarCatalog,
  resetAgenticOsRemoteGrammarCatalogForTests,
} from '@/features/agentic-os/agenticOsRemoteGrammarClient'

const rpcResponse = (id: unknown, result: Record<string, unknown>, sessionId = '') => new Response(
  JSON.stringify({ jsonrpc: '2.0', id, result }),
  {
    status: 200,
    headers: {
      'content-type': 'application/json',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
  },
)

export async function testRemoteGrammarRejectsStaleEpochFailureAfterFreshRefresh() {
  const originalFetch = globalThis.fetch
  const sourceRevision = 'd'.repeat(40)
  let deferOldRequest = true
  let freshCycleComplete = false
  let staleRetryCalls = 0
  let rejectOldRequest: ((reason?: unknown) => void) | undefined
  let markOldRequestStarted: (() => void) | undefined
  const oldRequestStarted = new Promise<void>(resolve => { markOldRequestStarted = resolve })
  resetAgenticOsRemoteGrammarCatalogForTests()

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
    if (body.method === 'initialize') {
      return rpcResponse(body.id, { protocolVersion: '2024-11-05' }, `epoch-${String(body.id)}`)
    }
    const query = String((body.params as { arguments?: { query?: string } })?.arguments?.query || '')
    if (deferOldRequest) {
      deferOldRequest = false
      markOldRequestStarted?.()
      return new Promise<Response>((_resolve, reject) => { rejectOldRequest = reject })
    }
    if (freshCycleComplete) {
      staleRetryCalls += 1
      throw new Error('stale request retried after the fresh cycle')
    }
    const kind = query === '/' ? 'command' : query === '#' ? 'semantic' : 'binding'
    const dictionary = kind === 'command' ? 'COMMAND' : kind === 'semantic' ? 'SEMANTIC' : 'BINDING'
    return rpcResponse(body.id, {
      structuredContent: {
        ok: true,
        sourceRevision,
        catalog: [{
          token: `${query}epoch-fresh`,
          kind,
          label: `Fresh ${kind}`,
          sourcePath: `DICTIONARY-${dictionary}.md#${query}epoch-fresh`,
        }],
      },
    })
  }) as typeof fetch

  try {
    const stalePrime = primeAgenticOsRemoteGrammarCatalogBySigil('/')
    await oldRequestStarted
    const refreshed = await refreshAgenticOsRemoteGrammarCatalog()
    if (refreshed.hydration.status !== 'fresh' || refreshed.sourceRevision !== sourceRevision) {
      throw new Error(`expected replacement hydration cycle to become fresh, got ${JSON.stringify(refreshed)}`)
    }
    freshCycleComplete = true
    rejectOldRequest?.(new Error('old hydration transport failed'))
    await stalePrime

    const settled = getAgenticOsRemoteGrammarCatalogSnapshot()
    if (settled.hydration.status !== 'fresh' || settled.hydration.error || settled.sourceRevision !== sourceRevision) {
      throw new Error(`expected stale rejection to leave the fresh cycle untouched, got ${JSON.stringify(settled)}`)
    }
    if (staleRetryCalls !== 0 || settled.counts.slash !== 1 || settled.counts.hash !== 1 || settled.counts.at !== 1) {
      throw new Error(`expected exactly one fresh entry per sigil and no stale retry, got retries=${staleRetryCalls} counts=${JSON.stringify(settled.counts)}`)
    }
  } finally {
    rejectOldRequest?.(new Error('test cleanup'))
    resetAgenticOsRemoteGrammarCatalogForTests()
    globalThis.fetch = originalFetch
  }
}
