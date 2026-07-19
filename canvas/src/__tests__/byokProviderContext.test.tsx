import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import FloatingPanelChat from '@/features/chat/FloatingPanelChat'
import { resolveFloatingPanelChatCredentialContext } from '@/features/chat/floatingPanelChat/floatingPanelChatCredentialContext'
import { resolveSubmitRuntimeFriendlyMessage } from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitErrors'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

export function testFloatingPanelChatCredentialPromptFollowsSelectedTextGenerationProvider() {
  const context = resolveFloatingPanelChatCredentialContext({
    currentNode: {
      id: 'byteplus-card',
      type: 'TextGeneration',
      label: 'Widget Card',
      properties: {
        chatAuthMode: 'byok',
        chatEndpointUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
        chatModel: 'seed-2-0-lite-260228',
      },
    },
    globalProvider: 'openai',
    globalAuthMode: 'serverManaged',
    globalEndpointUrl: 'https://api.openai.com/v1/responses',
    globalModel: 'gpt-5-nano',
  })
  if (context.source !== 'selection' || context.provider !== 'byteplus-modelark' || context.authMode !== 'byok' || context.model !== 'seed-2-0-lite-260228') {
    throw new Error(`expected selected TextGeneration provider tuple to own the BYOK prompt, got ${JSON.stringify(context)}`)
  }
}

export async function testFloatingPanelChatRendersSelectedTextGenerationProviderOnByokInput() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setChatProvider('openai')
  useGraphStore.getState().setChatAuthMode('serverManaged')
  useGraphStore.getState().setGraphData({
    type: 'Graph',
    nodes: [{
      id: 'byteplus-card',
      type: 'TextGeneration',
      label: 'Widget Card',
      properties: {
        chatAuthMode: 'byok',
        chatEndpointUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
        chatModel: 'seed-2-0-lite-260228',
      },
    }],
    edges: [],
  })
  useGraphStore.getState().selectNode('byteplus-card')
  try {
    await mountReactRoot(root, React.createElement(FloatingPanelChat), { window: dom.window as unknown as Window, frames: 2, tasks: 1 })
    const toggle = container.querySelector('[data-kg-chat-api-key-toggle="true"]') as HTMLButtonElement | null
    if (!toggle) throw new Error('expected selected BYOK TextGeneration card to expose the credential toggle')
    await act(async () => {
      toggle.click()
      await waitForFrames(dom.window as unknown as Window, 1)
    })
    const keyInput = container.querySelector('[data-kg-chat-api-key-input="true"]') as HTMLInputElement | null
    if (keyInput?.getAttribute('aria-label') !== 'BytePlus ModelArk BYOK API key') {
      throw new Error(`expected selected BytePlus card to own the credential label, got ${keyInput?.getAttribute('aria-label')}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    useGraphStore.getState().resetAll()
    restore()
  }
}

export function testResolveSubmitRuntimeFriendlyMessageMapsBytePlusKeyFormatMismatchWithRegionAndRequestId() {
  const friendly = resolveSubmitRuntimeFriendlyMessage({
    raw: 'The API key format is incorrect. Request id: 021784435259095276a11b7c1fd19a88cefa8362a9a9ca6828c1d',
    endpointUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions',
    chatProvider: 'byteplus-modelark',
    chatAuthMode: 'byok',
  })
  if (!friendly.includes('BytePlus ModelArk') || !friendly.includes('matches the endpoint region') || !friendly.includes('021784435259095276a11b7c1fd19a88cefa8362a9a9ca6828c1d')) {
    throw new Error(`Expected BytePlus key-format diagnosis to preserve provider, region, and request id, got: ${friendly}`)
  }
}
