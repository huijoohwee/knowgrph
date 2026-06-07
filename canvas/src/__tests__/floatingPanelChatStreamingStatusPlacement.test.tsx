import React from 'react'
import { createRoot } from 'react-dom/client'
import { FloatingPanelChatMessagesSection } from '@/features/chat/FloatingPanelChatSections'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export async function testFloatingPanelChatStreamsReasoningStatusAtTopOfChat() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    await mountReactRoot(
      root,
      React.createElement(FloatingPanelChatMessagesSection, {
        messages: [{
          id: 'assistant-1',
          role: 'assistant',
          content: 'Assistant response is still streaming.',
        }],
        isLoading: true,
        historyKey: 'history-key',
        uiPanelTextFontClass: 'text-sm',
        uiPanelKeyValueTextSizeClass: 'text-xs',
        uiPanelMicroLabelTextSizeClass: 'text-xs',
        streamingReasoningPreview: 'Reasoning 447: convergence. | web_search: Bitcoin options skew gold options premium',
        streamingUsageSummary: 'Tokens 1024',
        streamingFinishReason: null,
        writingWorkspaceFileLabel: 'Writing to kgc-trace_20260606T011923Z.md...',
        setMessages: () => undefined,
      }),
      { window: dom.window as unknown as Window, frames: 2 },
    )

    const status = container.querySelector('[data-kg-chat-stream-status="top"]') as HTMLElement | null
    if (!status) throw new Error('expected streaming reasoning status to render inside the chat messages section')
    if (status !== container.firstElementChild) {
      throw new Error('expected streaming status to be the first chat message-section element')
    }
    if (status.getAttribute('role') !== 'status' || status.getAttribute('aria-live') !== 'polite') {
      throw new Error('expected streaming status to expose a polite live region')
    }
    if (!status.className.includes('sticky') || !status.className.includes('top-0')) {
      throw new Error(`expected streaming status to stay pinned to the top of Chat, got ${status.className}`)
    }

    const reasoning = status.querySelector('[data-kg-chat-stream-reasoning="true"]') as HTMLElement | null
    if (!reasoning || !String(reasoning.textContent || '').includes('web_search: Bitcoin options skew')) {
      throw new Error(`expected reasoning/tool signal to stream in the top chat status, got ${status.textContent}`)
    }
    if (!String(status.textContent || '').includes('Writing to kgc-trace_20260606T011923Z.md')) {
      throw new Error(`expected workspace write status to move with the streaming chat status, got ${status.textContent}`)
    }

    await mountReactRoot(
      root,
      React.createElement(FloatingPanelChatMessagesSection, {
        messages: [{
          id: 'assistant-1',
          role: 'assistant',
          content: 'Assistant response is settled.',
        }],
        isLoading: false,
        historyKey: 'history-key',
        uiPanelTextFontClass: 'text-sm',
        uiPanelKeyValueTextSizeClass: 'text-xs',
        uiPanelMicroLabelTextSizeClass: 'text-xs',
        streamingReasoningPreview: 'Reasoning 447: stale footer status',
        streamingUsageSummary: 'Tokens 1024',
        streamingFinishReason: null,
        writingWorkspaceFileLabel: 'Writing to kgc-trace_20260606T011923Z.md...',
        setMessages: () => undefined,
      }),
      { window: dom.window as unknown as Window, frames: 2 },
    )

    if (container.querySelector('[data-kg-chat-stream-status="top"]')) {
      throw new Error('expected settled Chat state to hide stale streaming status')
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}

export function testWorkspaceRuntimeDoesNotMirrorChatStreamingStatusIntoToast() {
  const text = readFileSync(resolve(process.cwd(), 'src/lib/markdown-workspace-runtime/MarkdownWorkspaceRuntime.impl.tsx'), 'utf8')
  if (text.includes('Streaming to ')) {
    throw new Error('expected chat/SSE streaming file status to stay in FloatingPanel Chat instead of generic workspace toast')
  }
  if (text.includes('streamingWorkspaceToastActiveRef') || text.includes('workspaceStreamingStatusLabel')) {
    throw new Error('expected workspace runtime not to own a duplicate chat streaming toast lifecycle')
  }
}
