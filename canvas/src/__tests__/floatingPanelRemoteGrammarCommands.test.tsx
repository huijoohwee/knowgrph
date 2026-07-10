import React from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { FloatingPanelChatComposer } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposer'
import { buildFloatingPanelChatComposerOverlayParts } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposerMediaOverlay'
import { buildChatInvocationSystemPrompt, parseChatInvocationDirectives } from '@/features/chat/chatInvocationRegistry'
import { findAgenticOsInvocationByToken } from '@/features/agentic-os/agenticOsDocInvocations'
import { registerAgenticOsRemoteGrammarCatalogEntries, resetAgenticOsRemoteGrammarCatalogForTests } from '@/features/agentic-os/agenticOsRemoteGrammarClient'
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
    const textarea = container.querySelector('[data-kg-chat-input="true"]') as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected remote-grammar harness to mount the chat composer textarea')
    textarea.value = '/remo'
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    Simulate.change(textarea)
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
    if (textarea.value !== '/remote.only ') {
      throw new Error(`expected remote MCP grammar selection to update the composer input, got ${JSON.stringify(textarea.value)}`)
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
