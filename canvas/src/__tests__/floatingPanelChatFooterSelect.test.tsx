import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { FloatingPanelChatFooter } from '@/features/chat/FloatingPanelChatSections'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

export async function testFloatingPanelChatFooterModelSelectStaysNativeLabeledAndChangeable() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const changedModels: string[] = []

  try {
    await mountReactRoot(
      root,
      React.createElement(FloatingPanelChatFooter, {
        input: '',
        setInput: () => undefined,
        isLoading: false,
        errorText: null,
        connectivity: 'unknown',
        connectivityDetail: null,
        currentNode: null,
        modelId: 'gpt-5-nano',
        modelOptions: ['gpt-5-nano', 'gpt-5-mini', 'gpt-5'],
        onModelChanged: modelId => changedModels.push(modelId),
        uiPanelTextFontClass: 'text-sm',
        uiPanelMicroLabelTextSizeClass: 'text-xs',
        isSubmitDisabled: true,
        onSubmit: event => event.preventDefault(),
        onStop: () => undefined,
      }),
      { window: dom.window as unknown as Window, frames: 2 },
    )

    const control = container.querySelector('[data-kg-chat-model-control="true"]')
    if (!control) throw new Error('expected chat model control row to expose the stable data hook')

    const select = container.querySelector('[data-kg-chat-model-select="true"]') as HTMLSelectElement | null
    if (!select) throw new Error('expected chat model select to expose the stable data hook')
    if (select.disabled) throw new Error('expected chat model select to stay enabled when not loading and multiple options exist')
    if (select.getAttribute('aria-label') !== 'Model') throw new Error('expected chat model select to expose a semantic label')
    if (!select.className.includes('kg-responsive-control-inline-fill') || !select.className.includes('kg-responsive-compact-panel-field-input')) {
      throw new Error('expected chat model select to use shared fill and compact field owners')
    }

    const label = (Array.from(container.querySelectorAll('label')) as HTMLLabelElement[])
      .find(candidate => candidate.htmlFor === select.id)
    if (!label || String(label.textContent || '').trim() !== 'Model') {
      throw new Error('expected chat model label to be associated with the native select')
    }

    await act(async () => {
      select.value = 'gpt-5-mini'
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 1)
    })
    if (changedModels[0] !== 'gpt-5-mini') {
      throw new Error(`expected native select change to publish next model, got ${JSON.stringify(changedModels)}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
