import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import FloatingPanelChat from '@/features/chat/FloatingPanelChat'
import {
  readLocalChatPipelineSurfaceSnapshot,
  resetBrowserLocalSurfaceSnapshotsForTests,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { inspectLocalChatPipelineState } from '@/features/agent-ready/localChatPipelineStateInspection'
import { registerMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { DEFAULT_PAYMENT_PROVIDER_ID } from '@/features/payments/providers'
import { useSettingsView } from '@/features/panels/views/useSettingsView'
import { useSettingsSync } from '@/features/panels/views/useSettingsSync'
import { useSettingsWorkspaceActions } from '@/features/panels/views/useSettingsWorkspaceActions'
import { CHAT_PROVIDER_OPENAI } from '@/lib/chatEndpoint'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

type RegisteredSettingsActions = {
  apply: () => void
  reset: () => void
}

const CLOUD_KNOWGRPH_URL = 'https://cloud.example/knowgrph-before-create-latest.md'
const CLOUD_HISTORY_URL = 'https://cloud.example/history-before-create-latest.md'
const CREATED_KNOWGRPH_PATH = '/workspace/chat/kgc_20260523174000.md'
const CREATED_HISTORY_PATH = '/workspace/chat/chh_20260523174000.md'

const findButtonByLabel = (container: HTMLElement, label: string): HTMLButtonElement => {
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
  const match = buttons.find(button => String(button.textContent || '').includes(label))
  if (!match) throw new Error(`expected button with label ${JSON.stringify(label)}`)
  return match
}

function SettingsCloudThenCreateHarness(props: {
  actionsRef: React.MutableRefObject<RegisteredSettingsActions | null>
}): React.ReactElement {
  const {
    values,
    setValues,
    dirtyRef,
  } = useSettingsView({
    searchQuery: 'chat',
    mode: 'all',
    paymentsProviderId: DEFAULT_PAYMENT_PROVIDER_ID,
    onRegisterActions: next => {
      props.actionsRef.current = { apply: next.apply, reset: next.reset }
    },
  })

  useSettingsSync({ dirtyRef, setValues, values })

  const patchChatValues = React.useCallback((patch: Record<string, string>) => {
    Object.keys(patch).forEach(key => dirtyRef.current.add(key))
    setValues(prev => ({ ...prev, ...patch }))
  }, [dirtyRef, setValues])

  const {
    createAndSelectChatHistoryFile,
    createAndSelectKnowgrphFile,
    importCloudUrlForChatHistory,
    importCloudUrlForKnowgrph,
    chatHistoryPathStatus,
    knowgrphPathStatus,
  } = useSettingsWorkspaceActions({
    patchChatValues,
    chatLocalStorageRootPath: values.chatLocalStorageRootPath,
    chatHistoryCloudUrl: values.chatHistoryCloudUrl,
    chatKnowgrphCloudUrl: values.chatKnowgrphCloudUrl,
  })

  return (
    <div>
      <div data-draft-knowgrph-storage-mode={String(values.chatKnowgrphStorageMode || '')} />
      <div data-draft-history-storage-mode={String(values.chatHistoryStorageMode || '')} />
      <div data-draft-knowgrph-cloud-url={String(values.chatKnowgrphCloudUrl || '')} />
      <div data-draft-history-cloud-url={String(values.chatHistoryCloudUrl || '')} />
      <div data-draft-knowgrph-workspace-path={String(values.chatKnowgrphWorkspacePath || '')} />
      <div data-draft-history-workspace-path={String(values.chatHistoryWorkspacePath || '')} />
      <div data-knowgrph-status={String(knowgrphPathStatus || '')} />
      <div data-history-status={String(chatHistoryPathStatus || '')} />
      <button
        type="button"
        onClick={() => patchChatValues({
          chatKnowgrphCloudUrl: CLOUD_KNOWGRPH_URL,
          chatHistoryCloudUrl: CLOUD_HISTORY_URL,
        })}
      >
        Set Cloud Draft URLs
      </button>
      <button type="button" onClick={() => importCloudUrlForKnowgrph()}>
        Import Knowgrph Cloud URL
      </button>
      <button type="button" onClick={() => importCloudUrlForChatHistory()}>
        Import History Cloud URL
      </button>
      <button type="button" onClick={() => void createAndSelectKnowgrphFile()}>
        Create Knowgrph File
      </button>
      <button type="button" onClick={() => void createAndSelectChatHistoryFile()}>
        Create History File
      </button>
    </div>
  )
}

export async function testSettingsCloudThenCreateKeepsCommittedSurfaceTruthfulWhileLatestDraftWins() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let settingsRoot: ReturnType<typeof createRoot> | null = null
  let chatRoot: ReturnType<typeof createRoot> | null = null
  const actionsRef: { current: RegisteredSettingsActions | null } = { current: null }
  const importedUrls: string[] = []
  const originalDateNow = Date.now
  const unregisterBridge = registerMarkdownWorkspaceActionBridge('test-cloud-then-create-bridge', {
    importUrl: url => {
      importedUrls.push(String(url || '').trim())
    },
  })

  let cleanupAssertionError: Error | null = null
  try {
    resetBrowserLocalSurfaceSnapshotsForTests()
    resetWorkspaceFsForTests()
    Date.now = () => new Date(2026, 4, 23, 17, 40, 0, 0).getTime()
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    const store = useGraphStore.getState()
    store.resetAll()
    store.setChatProvider(CHAT_PROVIDER_OPENAI)
    store.setChatEndpointUrl('https://api.openai.com/v1/chat/completions')
    store.setChatModel('gpt-4.1-mini')
    store.setChatContextScope('workspace')
    store.setChatStorageTarget('chatKnowgrph')
    store.setChatLocalStorageRootPath('/workspace/chat')
    store.setChatKnowgrphStorageMode('cloud')
    store.setChatKnowgrphCloudUrl('https://cloud.example/knowgrph-before-cloud-create.md')
    store.setChatKnowgrphWorkspacePath(null)
    store.setChatHistoryStorageMode('cloud')
    store.setChatHistoryCloudUrl('https://cloud.example/history-before-cloud-create.md')
    store.setChatHistoryWorkspacePath(null)

    const doc = dom.window.document
    const settingsContainer = doc.createElement('div')
    const chatContainer = doc.createElement('div')
    doc.body.appendChild(settingsContainer)
    doc.body.appendChild(chatContainer)
    settingsRoot = createRoot(settingsContainer as unknown as HTMLElement)
    chatRoot = createRoot(chatContainer as unknown as HTMLElement)

    await mountReactRoot(settingsRoot, React.createElement(SettingsCloudThenCreateHarness, { actionsRef }), {
      window: dom.window as unknown as Window,
      frames: 10,
    })
    await mountReactRoot(chatRoot, React.createElement(FloatingPanelChat), {
      window: dom.window as unknown as Window,
      frames: 8,
    })

    if (!actionsRef.current?.apply) {
      throw new Error('expected Settings owner to register an apply action')
    }

    await act(async () => {
      findButtonByLabel(settingsContainer, 'Set Cloud Draft URLs').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 2)
    })
    await act(async () => {
      findButtonByLabel(settingsContainer, 'Import Knowgrph Cloud URL').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 2)
    })
    await act(async () => {
      findButtonByLabel(settingsContainer, 'Import History Cloud URL').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 2)
    })
    await act(async () => {
      findButtonByLabel(settingsContainer, 'Create Knowgrph File').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 4)
    })
    await act(async () => {
      findButtonByLabel(settingsContainer, 'Create History File').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 4)
    })

    const draftKnowgrphStorageMode = settingsContainer.querySelector('[data-draft-knowgrph-storage-mode]')?.getAttribute('data-draft-knowgrph-storage-mode')
    const draftHistoryStorageMode = settingsContainer.querySelector('[data-draft-history-storage-mode]')?.getAttribute('data-draft-history-storage-mode')
    const draftKnowgrphCloudUrl = settingsContainer.querySelector('[data-draft-knowgrph-cloud-url]')?.getAttribute('data-draft-knowgrph-cloud-url')
    const draftHistoryCloudUrl = settingsContainer.querySelector('[data-draft-history-cloud-url]')?.getAttribute('data-draft-history-cloud-url')
    const draftKnowgrphWorkspacePath = settingsContainer.querySelector('[data-draft-knowgrph-workspace-path]')?.getAttribute('data-draft-knowgrph-workspace-path')
    const draftHistoryWorkspacePath = settingsContainer.querySelector('[data-draft-history-workspace-path]')?.getAttribute('data-draft-history-workspace-path')
    const knowgrphStatus = settingsContainer.querySelector('[data-knowgrph-status]')?.getAttribute('data-knowgrph-status')
    const historyStatus = settingsContainer.querySelector('[data-history-status]')?.getAttribute('data-history-status')

    if (
      draftKnowgrphStorageMode !== 'local' ||
      draftHistoryStorageMode !== 'local' ||
      draftKnowgrphCloudUrl !== '' ||
      draftHistoryCloudUrl !== '' ||
      draftKnowgrphWorkspacePath !== CREATED_KNOWGRPH_PATH ||
      draftHistoryWorkspacePath !== CREATED_HISTORY_PATH
    ) {
      throw new Error(`expected later create-file actions to win over earlier cloud-import draft state, got ${JSON.stringify({
        draftKnowgrphStorageMode,
        draftHistoryStorageMode,
        draftKnowgrphCloudUrl,
        draftHistoryCloudUrl,
        draftKnowgrphWorkspacePath,
        draftHistoryWorkspacePath,
      })}`)
    }
    if (knowgrphStatus !== CREATED_KNOWGRPH_PATH || historyStatus !== CREATED_HISTORY_PATH) {
      throw new Error(`expected later create-file statuses to win over earlier cloud-import statuses, got ${JSON.stringify({ knowgrphStatus, historyStatus })}`)
    }
    if (
      importedUrls.length !== 2 ||
      importedUrls[0] !== CLOUD_KNOWGRPH_URL ||
      importedUrls[1] !== CLOUD_HISTORY_URL
    ) {
      throw new Error(`expected workspace bridge to receive both earlier cloud import URLs, got ${JSON.stringify(importedUrls)}`)
    }
    if (useMarkdownExplorerStore.getState().activePath !== CREATED_HISTORY_PATH) {
      throw new Error(`expected later created file to become the active editor path, got ${String(useMarkdownExplorerStore.getState().activePath || '')}`)
    }

    const fs = await getWorkspaceFs()
    const createdKnowgrphText = await fs.readFileText(CREATED_KNOWGRPH_PATH)
    const createdHistoryText = await fs.readFileText(CREATED_HISTORY_PATH)
    if (createdKnowgrphText !== '' || createdHistoryText !== '') {
      throw new Error(`expected later create-file actions to materialize empty workspace files, got ${JSON.stringify({
        createdKnowgrphText,
        createdHistoryText,
      })}`)
    }

    const preApplyInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      preApplyInspection.available !== true ||
      preApplyInspection.workspacePaths.chatKnowgrphWorkspacePath !== null ||
      preApplyInspection.workspacePaths.chatHistoryWorkspacePath !== null ||
      preApplyInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-cloud-create.md' ||
      preApplyInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-cloud-create.md'
    ) {
      throw new Error(`expected committed FloatingPanel surface to stay on preexisting cloud values before apply across cloud/create overlap, got ${JSON.stringify(preApplyInspection)}`)
    }

    await act(async () => {
      actionsRef.current?.apply()
      await waitForFrames(dom.window as unknown as Window, 6)
    })

    const appliedInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      appliedInspection.available !== true ||
      appliedInspection.workspacePaths.chatKnowgrphWorkspacePath !== CREATED_KNOWGRPH_PATH ||
      appliedInspection.workspacePaths.chatHistoryWorkspacePath !== CREATED_HISTORY_PATH ||
      appliedInspection.cloudUrls.chatKnowgrphCloudUrl !== null ||
      appliedInspection.cloudUrls.chatHistoryCloudUrl !== null
    ) {
      throw new Error(`expected committed FloatingPanel surface to commit the later create-file draft values after apply, got ${JSON.stringify(appliedInspection)}`)
    }
    if (
      useGraphStore.getState().chatKnowgrphWorkspacePath !== CREATED_KNOWGRPH_PATH ||
      useGraphStore.getState().chatHistoryWorkspacePath !== CREATED_HISTORY_PATH ||
      useGraphStore.getState().chatKnowgrphStorageMode !== 'local' ||
      useGraphStore.getState().chatHistoryStorageMode !== 'local' ||
      String(useGraphStore.getState().chatKnowgrphCloudUrl || '').trim() !== '' ||
      String(useGraphStore.getState().chatHistoryCloudUrl || '').trim() !== ''
    ) {
      throw new Error(`expected canonical store to commit the later create-file draft values after apply, got ${JSON.stringify({
        chatKnowgrphWorkspacePath: useGraphStore.getState().chatKnowgrphWorkspacePath,
        chatHistoryWorkspacePath: useGraphStore.getState().chatHistoryWorkspacePath,
        chatKnowgrphStorageMode: useGraphStore.getState().chatKnowgrphStorageMode,
        chatHistoryStorageMode: useGraphStore.getState().chatHistoryStorageMode,
        chatKnowgrphCloudUrl: useGraphStore.getState().chatKnowgrphCloudUrl,
        chatHistoryCloudUrl: useGraphStore.getState().chatHistoryCloudUrl,
      })}`)
    }
  } finally {
    unregisterBridge()
    Date.now = originalDateNow
    if (chatRoot) {
      await unmountReactRoot(chatRoot, { window: dom.window as unknown as Window })
    }
    const clearedInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (clearedInspection.available !== false) {
      cleanupAssertionError = new Error(`expected FloatingPanel Chat pipeline snapshot cleanup after chat unmount, got ${JSON.stringify(clearedInspection)}`)
    }
    if (settingsRoot) {
      await unmountReactRoot(settingsRoot, { window: dom.window as unknown as Window })
    }
    resetBrowserLocalSurfaceSnapshotsForTests()
    resetWorkspaceFsForTests()
    useGraphStore.getState().resetAll()
    useMarkdownExplorerStore.getState().setActivePath(null)
    restoreDom()
    restoreWindow()
  }
  if (cleanupAssertionError) throw cleanupAssertionError
}
