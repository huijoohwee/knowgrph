import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import FloatingPanelChat from '@/features/chat/FloatingPanelChat'
import {
  readLocalChatPipelineSurfaceSnapshot,
  resetBrowserLocalSurfaceSnapshotsForTests,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { inspectLocalChatPipelineState } from '@/features/agent-ready/localChatPipelineStateInspection'
import { CHAT_PROVIDER_OPENAI } from '@/lib/chatEndpoint'
import { useSettingsChatAssist } from '@/features/panels/views/useSettingsChatAssist'
import { useSettingsSync } from '@/features/panels/views/useSettingsSync'
import { CHAT_KTV_ROW_KEYS } from '@/features/panels/views/settingsView.constants'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'

const findButtonByLabel = (container: HTMLElement, label: string): HTMLButtonElement => {
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
  const match = buttons.find(button => String(button.textContent || '').includes(label))
  if (!match) throw new Error(`expected button with label ${JSON.stringify(label)}`)
  return match
}

export async function testMainPanelSettingsSyncsLiveFloatingChatPipelineInspection() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let mainPanelRoot: ReturnType<typeof createRoot> | null = null
  let chatRoot: ReturnType<typeof createRoot> | null = null

  let cleanupAssertionError: Error | null = null
  try {
    resetBrowserLocalSurfaceSnapshotsForTests()
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    const store = useGraphStore.getState()
    store.resetAll()
    store.setChatProvider(CHAT_PROVIDER_OPENAI)
    store.setChatEndpointUrl('https://api.openai.com/v1/chat/completions')
    store.setChatModel('gpt-4.1-mini')
    store.setChatContextScope('selection')
    store.setChatStorageTarget('chatKnowgrph')

    const doc = dom.window.document
    const mainPanelContainer = doc.createElement('div')
    const chatContainer = doc.createElement('div')
    doc.body.appendChild(mainPanelContainer)
    doc.body.appendChild(chatContainer)
    mainPanelRoot = createRoot(mainPanelContainer as unknown as HTMLElement)
    chatRoot = createRoot(chatContainer as unknown as HTMLElement)

    const SettingsHarness = () => {
      const dirtyRef = React.useRef(new Set<string>())
      const [values, setValues] = React.useState<Record<string, string | number | boolean>>({
        chatProvider: CHAT_PROVIDER_OPENAI,
        chatEndpointUrl: 'https://api.openai.com/v1/chat/completions',
        chatModel: 'gpt-4.1-mini',
        chatAuthMode: 'serverManaged',
        chatContextScope: 'selection',
        integrationConfigsJson: JSON.stringify({ aiChat: { enabled: false, provider: 'native', openTab: 'chat' } }),
      })
      useSettingsSync({ dirtyRef, setValues, values })
      const { buildChatAssistNodes } = useSettingsChatAssist({
        dirtyRef,
        openLocalChatApiKeyEntry: () => {},
        setValues,
        values,
      })
      return (
        <div>
          <div data-row="provider">{buildChatAssistNodes(CHAT_KTV_ROW_KEYS.provider)}</div>
          <div data-row="context">{buildChatAssistNodes(CHAT_KTV_ROW_KEYS.contextScope)}</div>
        </div>
      )
    }

    await mountReactRoot(
      mainPanelRoot,
      React.createElement(SettingsHarness),
      { window: dom.window as unknown as Window, frames: 10 },
    )
    await mountReactRoot(chatRoot, React.createElement(FloatingPanelChat), {
      window: dom.window as unknown as Window,
      frames: 8,
    })

    const initialInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (initialInspection.available !== true) {
      throw new Error(`expected mounted FloatingPanel Chat pipeline readiness to be available, got ${JSON.stringify(initialInspection)}`)
    }
    if (
      initialInspection.chatContextScope !== 'selection' ||
      initialInspection.chatStorageTarget !== 'chatKnowgrph'
    ) {
      throw new Error(`expected initial floating chat pipeline readiness to reflect the seeded store state, got ${JSON.stringify(initialInspection)}`)
    }
    if (!initialInspection.chatProviderSummary.includes('OpenAI')) {
      throw new Error(`expected initial floating chat pipeline readiness to report the OpenAI provider summary, got ${JSON.stringify(initialInspection.chatProviderSummary)}`)
    }

    const providerRow = mainPanelContainer.querySelector('[data-row="provider"]') as HTMLElement | null
    if (!providerRow) {
      throw new Error(`expected settings harness provider row, got ${JSON.stringify(mainPanelContainer.textContent || '')}`)
    }

    await act(async () => {
      findButtonByLabel(providerRow, 'Local').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 3)
    })
    await act(async () => {
      await waitForFrames(dom.window as unknown as Window, 6)
    })

    const updatedInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      updatedInspection.available !== true ||
      updatedInspection.chatContextScope !== 'selection' ||
      updatedInspection.chatStorageTarget !== 'chatKnowgrph'
    ) {
      throw new Error(`expected floating chat pipeline readiness to preserve the current context/storage surface while MainPanel Settings provider changes sync live, got ${JSON.stringify(updatedInspection)}`)
    }
    if (!updatedInspection.chatProviderSummary.includes('Local Gateway')) {
      throw new Error(`expected floating chat pipeline readiness to reflect the Local provider summary after MainPanel Settings update, got ${JSON.stringify(updatedInspection.chatProviderSummary)}`)
    }
  } finally {
    if (chatRoot) {
      await unmountReactRoot(chatRoot, { window: dom.window as unknown as Window })
    }
    const clearedInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (clearedInspection.available !== false) {
      cleanupAssertionError = new Error(`expected floating chat pipeline readiness snapshot cleanup after chat unmount, got ${JSON.stringify(clearedInspection)}`)
    }
    if (mainPanelRoot) {
      await unmountReactRoot(mainPanelRoot, { window: dom.window as unknown as Window })
    }
    resetBrowserLocalSurfaceSnapshotsForTests()
    useGraphStore.getState().resetAll()
    restoreDom()
    restoreWindow()
  }
  if (cleanupAssertionError) throw cleanupAssertionError
}
