import React from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { FloatingPanelChatComposer } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposer'
import { buildFloatingPanelChatComposerOverlayParts } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposerMediaOverlay'
import { buildChatInvocationSystemPrompt, parseChatInvocationDirectives } from '@/features/chat/chatInvocationRegistry'
import { findAgenticOsInvocationByToken } from '@/features/agentic-os/agenticOsDocInvocations'
import {
  createAgenticOsRemoteGrammarClient,
  getAgenticOsRemoteGrammarCatalogEntries,
  getAgenticOsRemoteGrammarCatalogSnapshot,
  primeAgenticOsRemoteGrammarCatalogBySigil,
  refreshAgenticOsRemoteGrammarCatalog,
  registerAgenticOsRemoteGrammarCatalogEntries,
  resetAgenticOsRemoteGrammarCatalogForTests,
} from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames, waitForTasks } from '@/tests/lib/reactRootHarness'

export async function testFloatingPanelChatComposerWiresRemoteAgenticOsGrammar() {
  const previousAgentReadyBaseUrl = process.env.VITE_KNOWGRPH_AGENT_READY_BASE_URL
  const originalFetch = globalThis.fetch
  const calls: Array<{ method: string, headers: Headers, body: Record<string, unknown> }> = []
  resetAgenticOsRemoteGrammarCatalogForTests()
  process.env.VITE_KNOWGRPH_AGENT_READY_BASE_URL = 'https://airvio.co/knowgrph'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
    calls.push({ method: String(body.method || ''), headers, body })
    if (String(input) !== 'https://airvio.co/knowgrph/control-plane/mcp') {
      throw new Error(`expected remote grammar fetch to use control-plane MCP, got ${String(input)}`)
    }
    if (body.method === 'initialize') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { protocolVersion: '2024-11-05' },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'mcp-session-id': 'remote-session-1',
        },
      })
    }
    if (body.method === 'tools/call') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          structuredContent: {
            ok: true,
            sourceRevision: 'a'.repeat(40),
            catalog: [
              {
                token: '/remote.only',
                kind: 'command',
                label: 'Remote only',
                summary: 'Live remote grammar suggestion',
                sourcePath: 'https://github.com/huijoohwee/agentic-canvas-os/blob/main/docs/DICTIONARY-COMMAND.md',
                keywords: ['remote', 'live'],
              },
            ],
          },
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  function Harness() {
    const [input, setInput] = React.useState('')
    return (
      <FloatingPanelChatComposer
        input={input}
        setInput={setInput}
        markdownText={'---\nproject: knowgrph\n---\n# Brief'}
        isLoading={false}
        isSubmitDisabled={false}
        uiPanelTextFontClass="text-sm"
        placeholder="Ask a question"
      />
    )
  }

  try {
    await mountReactRoot(root, React.createElement(Harness), { window: dom.window as unknown as Window, frames: 2 })
    const editor = container.querySelector('[data-kg-chat-input="1"]') as HTMLElement | null
    const commandProxy = container.querySelector('[data-kg-card-inline-viewer-edit-command-proxy="1"]') as HTMLTextAreaElement | null
    if (!editor || !commandProxy) throw new Error('expected remote-grammar harness to mount the shared Card/Widget editor')
    editor.textContent = '/remo'
    Simulate.input(editor)
    await waitForFrames(dom.window as unknown as Window, 2)
    const activeEditor = container.querySelector('[data-kg-chat-input="1"]') as HTMLElement
    const range = dom.window.document.createRange(); range.selectNodeContents(activeEditor); range.collapse(false)
    const selection = dom.window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); Simulate.keyUp(activeEditor)
    await waitForTasks(4)
    await waitForFrames(dom.window as unknown as Window, 6)
    const slashMenu = dom.window.document.querySelector('section[aria-label="Chat slash commands"]')
    const remoteItem = Array.from((slashMenu?.querySelectorAll('button') || []) as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('/remote.only'))
    if (!remoteItem) {
      throw new Error(`expected remote MCP grammar suggestion to appear in the slash menu, html=${container.innerHTML}`)
    }
    remoteItem.click()
    await waitForFrames(dom.window as unknown as Window, 2)
    if (commandProxy.value !== '/remote.only ') {
      throw new Error(`expected remote MCP grammar selection to update the composer input, got ${JSON.stringify(commandProxy.value)}`)
    }
    const initializeCall = calls.find(call => call.method === 'initialize')
    const toolsCall = calls.find(call => call.method === 'tools/call' && (call.body.params as { arguments?: { query?: string } })?.arguments?.query === '/remo')
    if (!initializeCall || !toolsCall) {
      throw new Error(`expected remote grammar wiring to perform initialize + tools/call, got ${JSON.stringify(calls.map(call => call.method))}`)
    }
    if (toolsCall.headers.get('mcp-session-id') !== 'remote-session-1') {
      throw new Error(`expected remote grammar tools/call to reuse the MCP session id, got ${JSON.stringify(calls.map(call => ({ method: call.method, sessionId: call.headers.get('mcp-session-id') || '' })) )}`)
    }
    if ((toolsCall.body.params as { arguments?: { query?: string } })?.arguments?.query !== '/remo') {
      throw new Error(`expected remote grammar tools/call to query the live token text, got ${JSON.stringify(toolsCall.body)}`)
    }
  } finally {
    if (typeof previousAgentReadyBaseUrl === 'string') process.env.VITE_KNOWGRPH_AGENT_READY_BASE_URL = previousAgentReadyBaseUrl
    else delete process.env.VITE_KNOWGRPH_AGENT_READY_BASE_URL
    resetAgenticOsRemoteGrammarCatalogForTests()
    globalThis.fetch = originalFetch
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}

export function testRemoteAgenticOsGrammarHydratesSharedInvocationLookups() {
  resetAgenticOsRemoteGrammarCatalogForTests()
  try {
    registerAgenticOsRemoteGrammarCatalogEntries([
      {
        token: '#remote-runtime',
        kind: 'semantic',
        label: 'Remote runtime',
        summary: 'Live remote semantic directive',
        sourcePath: 'https://github.com/huijoohwee/agentic-canvas-os/blob/main/docs/DICTIONARY-SEMANTIC.md#remote-runtime',
        keywords: ['remote', 'runtime'],
      },
      {
        token: '@remote-binding',
        kind: 'binding',
        label: 'Remote binding',
        summary: 'Live remote binding directive',
        sourcePath: 'https://github.com/huijoohwee/agentic-canvas-os/blob/main/docs/DICTIONARY-BINDING.md#remote-binding',
        keywords: ['remote', 'binding'],
      },
    ])
    const semanticInvocation = findAgenticOsInvocationByToken('#remote-runtime')
    if (!semanticInvocation || semanticInvocation.kind !== 'semantic' || !semanticInvocation.sourcePath.includes('DICTIONARY-SEMANTIC.md#remote-runtime')) {
      throw new Error(`expected shared Agentic OS invocation lookup to resolve remote semantic tokens, got ${JSON.stringify(semanticInvocation)}`)
    }
    const bindingInvocation = findAgenticOsInvocationByToken('@remote-binding')
    if (!bindingInvocation || bindingInvocation.kind !== 'binding' || !bindingInvocation.sourcePath.includes('DICTIONARY-BINDING.md#remote-binding')) {
      throw new Error(`expected shared Agentic OS invocation lookup to resolve remote binding tokens, got ${JSON.stringify(bindingInvocation)}`)
    }
    const directives = parseChatInvocationDirectives('Use #memory.search with #remote-runtime and @remote-binding in the same request.')
    const directiveTokens = directives.map(directive => directive.token)
    if (!directiveTokens.includes('#remote-runtime')) {
      throw new Error(`expected remote semantic directives to join the shared chat invocation registry, got ${JSON.stringify(directiveTokens)}`)
    }
    const invocationPrompt = buildChatInvocationSystemPrompt({
      userQuery: 'Use #remote-runtime to bind the live remote grammar context.',
      chatProvider: 'openai',
      chatModel: 'gpt-5-nano',
    })
    if (!invocationPrompt.includes('#remote-runtime') || !invocationPrompt.includes('DICTIONARY-SEMANTIC.md#remote-runtime')) {
      throw new Error(`expected remote semantic directives to project source-backed prompt context, got ${JSON.stringify(invocationPrompt)}`)
    }
    const overlay = buildFloatingPanelChatComposerOverlayParts('Use #remote-runtime with @remote-binding')
    const overlayTokens = overlay.parts.flatMap(part => part.kind === 'invocation' ? [part.text] : [])
    if (!overlayTokens.includes('#remote-runtime') || !overlayTokens.includes('@remote-binding')) {
      throw new Error(`expected remote-only tokens to render through shared invocation chip parsing after hydration, got ${JSON.stringify(overlayTokens)}`)
    }
  } finally {
    resetAgenticOsRemoteGrammarCatalogForTests()
  }
}

export async function testRemoteAgenticOsGrammarIgnoresBareLocalhostOriginWithoutConfiguredBaseUrl() {
  const originalFetch = globalThis.fetch
  const { dom, restore } = initJsdomHarness()
  const calls: string[] = []
  resetAgenticOsRemoteGrammarCatalogForTests()

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input))
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
    if (body.method === 'initialize') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { protocolVersion: '2024-11-05' },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'mcp-session-id': 'remote-session-default',
        },
      })
    }
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        structuredContent: {
          ok: true,
          sourceRevision: 'a'.repeat(40),
          catalog: [],
        },
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const client = createAgenticOsRemoteGrammarClient()
    await client.searchCatalog('/')
    if (calls[0] !== 'https://airvio.co/knowgrph/control-plane/mcp') {
      throw new Error(`expected bare localhost origin to fall back to the default remote control plane, got ${JSON.stringify(calls)}`)
    }
  } finally {
    resetAgenticOsRemoteGrammarCatalogForTests()
    globalThis.fetch = originalFetch
    restore()
    void dom
  }
}

export async function testRemoteAgenticOsGrammarPrimeFailsClosedWhenTransportUnavailable() {
  const originalFetch = globalThis.fetch
  resetAgenticOsRemoteGrammarCatalogForTests()
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed')
  }) as typeof fetch

  try {
    const entries = await primeAgenticOsRemoteGrammarCatalogBySigil('/')
    if (!Array.isArray(entries) || entries.length !== 0) {
      throw new Error(`expected unavailable remote grammar hydration to fail closed with an empty catalog, got ${JSON.stringify(entries)}`)
    }
    if (getAgenticOsRemoteGrammarCatalogEntries().length !== 0) {
      throw new Error(`expected unavailable remote grammar hydration to avoid mutating the shared catalog, got ${JSON.stringify(getAgenticOsRemoteGrammarCatalogEntries())}`)
    }
  } finally {
    resetAgenticOsRemoteGrammarCatalogForTests()
    globalThis.fetch = originalFetch
  }
}

export async function testRemoteAgenticOsGrammarHydrationIsRevisionKeyedAndBounded() {
  const originalFetch = globalThis.fetch
  let sourceRevision = 'a'.repeat(40)
  resetAgenticOsRemoteGrammarCatalogForTests()
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
    if (body.method === 'initialize') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2024-11-05' } }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'mcp-session-id': 'revision-session' },
      })
    }
    const query = String((body.params as { arguments?: { query?: string } })?.arguments?.query || '')
    const kind = query === '/' ? 'command' : query === '#' ? 'semantic' : 'binding'
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        structuredContent: {
          ok: true,
          sourceRevision,
          liveAgentProviderProof: {
            schema: 'agent-live-provider-proof-summary/v1',
            status: 'verified-bounded-live',
            evidenceSchema: 'agent-live-provider-proof-contract/v1',
            sourceStatus: 'runtime-ready-dev',
            sourceRevision,
            proofRevision: 'd'.repeat(40),
            model: 'test-model',
            reasoningEffort: 'low',
            providerCalls: 3,
            inputTokens: 10,
            outputTokens: 5,
            cachedInputTokens: 0,
            estimatedCostUsd: 0.001,
            finalAnswerOwners: { delegation: 'manager', handoff: 'specialist' },
            continuationContext: 'all_turns',
            defaultWorkerConfigured: false,
          },
          catalog: [{ token: `${query}revision-${sourceRevision[0]}`, kind, label: `Revision ${sourceRevision[0]}` }],
        },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch

  try {
    const first = await refreshAgenticOsRemoteGrammarCatalog()
    if (first.hydration.status !== 'fresh' || first.hydration.attempts !== 1 || first.sourceRevision !== sourceRevision) {
      throw new Error(`expected first revision hydration to become fresh in one bounded attempt, got ${JSON.stringify(first)}`)
    }
    if (first.counts.slash !== 1 || first.counts.hash !== 1 || first.counts.at !== 1) {
      throw new Error(`expected exact sigil counts after hydration, got ${JSON.stringify(first.counts)}`)
    }
    if (first.liveAgentProviderProof.status !== 'verified-bounded-live' || first.liveAgentProviderProof.proofRevision !== 'd'.repeat(40)) {
      throw new Error(`expected source-backed live provider proof to hydrate with the catalog revision, got ${JSON.stringify(first.liveAgentProviderProof)}`)
    }
    sourceRevision = 'b'.repeat(40)
    const second = await refreshAgenticOsRemoteGrammarCatalog()
    if (second.sourceRevision !== sourceRevision || second.entries.some(entry => entry.token.endsWith('revision-a'))) {
      throw new Error(`expected docs revision change to invalidate the prior catalog, got ${JSON.stringify(second)}`)
    }
    if (getAgenticOsRemoteGrammarCatalogSnapshot().hydration.attempts > 2) {
      throw new Error('expected catalog hydration attempts to stay within the two-attempt contract')
    }
  } finally {
    resetAgenticOsRemoteGrammarCatalogForTests()
    globalThis.fetch = originalFetch
  }
}
