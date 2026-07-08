import React from 'react'
import { createRoot } from 'react-dom/client'
import { FloatingPanelChatFooter } from '@/features/chat/FloatingPanelChatSections'
import { UI_COPY } from '@/lib/config'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'

export async function testFloatingPanelChatFooterSuppressesDuplicateConnectivityError() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const timeoutText = UI_COPY.chatSubmitTransportTimeoutError('OpenAI')
  try {
    await mountReactRoot(
      root,
      React.createElement(FloatingPanelChatFooter, {
        input: '',
        setInput: () => undefined,
        isLoading: false,
        errorText: timeoutText,
        connectivity: 'error',
        connectivityDetail: timeoutText,
        currentNode: null,
        modelId: 'gpt-5-nano',
        modelOptions: ['gpt-5-nano'],
        onModelChanged: () => undefined,
        uiPanelTextFontClass: 'text-sm',
        uiPanelMicroLabelTextSizeClass: 'text-xs',
        isSubmitDisabled: true,
        onSubmit: event => event.preventDefault(),
        onStop: () => undefined,
      }),
      { window: dom.window as unknown as Window, frames: 2 },
    )
    const matches = (Array.from(container.querySelectorAll('section')) as HTMLElement[])
      .filter(element => String(element.textContent || '').trim() === timeoutText)
    if (matches.length !== 1) {
      throw new Error(`expected duplicate timeout notification to render once, got ${matches.length}`)
    }
    if (!matches[0]?.className.includes('text-red-700')) {
      throw new Error(`expected primary error notification to remain visible, got ${matches[0]?.className || 'missing'}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
