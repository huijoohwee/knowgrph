import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import FloatingPanelChat from '@/features/chat/FloatingPanelChat'
import {
  readLocalChatPipelineSurfaceSnapshot,
  resetBrowserLocalSurfaceSnapshotsForTests,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { inspectLocalChatPipelineState } from '@/features/agent-ready/localChatPipelineStateInspection'
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

const KNOWGRPH_CREATED_PATH = '/workspace/chat/kgc_20260523160000.md'
const HISTORY_CREATED_PATH = '/workspace/chat/chh_20260523160000.md'
const PREVIOUS_ACTIVE_PATH = '/workspace/chat/already-open-before-create.md'
const DELAYED_OPEN_DELAY_MS = 200

const findButtonByLabel = (container: HTMLElement, label: string): HTMLButtonElement => {
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
  const match = buttons.find(button => String(button.textContent || '').includes(label))
  if (!match) throw new Error(`expected button with label ${JSON.stringify(label)}`)
  return match
}

const waitForMs = async (ms: number) =>
  await new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

function SettingsCreateWorkspaceFileDelayedOpenHarness(props: {
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
    chatHistoryPathStatus,
    knowgrphPathStatus,
  } = useSettingsWorkspaceActions({
    patchChatValues,
    chatLocalStorageRootPath: values.chatLocalStorageRootPath,
    chatHistoryCloudUrl: values.chatHistoryCloudUrl,
    chatKnowgrphCloudUrl: values.chatKnowgrphCloudUrl,
    openWorkspaceFileImpl: path => {
      setTimeout(() => {
        useMarkdownExplorerStore.getState().setActivePath(path)
      }, DELAYED_OPEN_DELAY_MS)
    },
  })

  return (
    <section>
      <section data-draft-knowgrph-storage-mode={String(values.chatKnowgrphStorageMode || '')} />
      <section data-draft-history-storage-mode={String(values.chatHistoryStorageMode || '')} />
      <section data-draft-knowgrph-cloud-url={String(values.chatKnowgrphCloudUrl || '')} />
      <section data-draft-history-cloud-url={String(values.chatHistoryCloudUrl || '')} />
      <section data-draft-knowgrph-workspace-path={String(values.chatKnowgrphWorkspacePath || '')} />
      <section data-draft-history-workspace-path={String(values.chatHistoryWorkspacePath || '')} />
      <section data-knowgrph-status={String(knowgrphPathStatus || '')} />
      <section data-history-status={String(chatHistoryPathStatus || '')} />
      <button
        type="button"
        onClick={() => void createAndSelectKnowgrphFile()}
      >
        Create Delayed-Open Knowgrph File
      </button>
      <button
        type="button"
        onClick={() => void createAndSelectChatHistoryFile()}
      >
        Create Delayed-Open History File
      </button>
    </section>
  )
}

export async function testSettingsCreateFilesDelayedOpenKeepsCommittedSurfaceTruthfulUntilApply() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let settingsRoot: ReturnType<typeof createRoot> | null = null
  let chatRoot: ReturnType<typeof createRoot> | null = null
  const actionsRef: { current: RegisteredSettingsActions | null } = { current: null }
  const originalDateNow = Date.now

  let cleanupAssertionError: Error | null = null
  try {
    resetBrowserLocalSurfaceSnapshotsForTests()
    resetWorkspaceFsForTests()
    Date.now = () => new Date(2026, 4, 23, 16, 0, 0, 0).getTime()
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
    store.setChatKnowgrphCloudUrl('https://cloud.example/knowgrph-before-delayed-open-create.md')
    store.setChatKnowgrphWorkspacePath(null)
    store.setChatHistoryStorageMode('cloud')
    store.setChatHistoryCloudUrl('https://cloud.example/history-before-delayed-open-create.md')
    store.setChatHistoryWorkspacePath(null)
    useMarkdownExplorerStore.getState().setActivePath(PREVIOUS_ACTIVE_PATH)

    const doc = dom.window.document
    const settingsContainer = doc.createElement('section')
    const chatContainer = doc.createElement('section')
    doc.body.appendChild(settingsContainer)
    doc.body.appendChild(chatContainer)
    settingsRoot = createRoot(settingsContainer as unknown as HTMLElement)
    chatRoot = createRoot(chatContainer as unknown as HTMLElement)

    await mountReactRoot(settingsRoot, React.createElement(SettingsCreateWorkspaceFileDelayedOpenHarness, { actionsRef }), {
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

    const initialChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      initialChatInspection.available !== true ||
      initialChatInspection.workspacePaths.chatKnowgrphWorkspacePath !== null ||
      initialChatInspection.workspacePaths.chatHistoryWorkspacePath !== null ||
      initialChatInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-delayed-open-create.md' ||
      initialChatInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-delayed-open-create.md'
    ) {
      throw new Error(`expected initial FloatingPanel Chat pipeline delayed-open create state to reflect committed cloud values, got ${JSON.stringify(initialChatInspection)}`)
    }

    await act(async () => {
      findButtonByLabel(settingsContainer, 'Create Delayed-Open Knowgrph File').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 4)
    })
    await act(async () => {
      findButtonByLabel(settingsContainer, 'Create Delayed-Open History File').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
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
      draftKnowgrphWorkspacePath !== KNOWGRPH_CREATED_PATH ||
      draftHistoryWorkspacePath !== HISTORY_CREATED_PATH
    ) {
      throw new Error(`expected delayed-open create-file actions to patch draft local storage state immediately, got ${JSON.stringify({
        draftKnowgrphStorageMode,
        draftHistoryStorageMode,
        draftKnowgrphCloudUrl,
        draftHistoryCloudUrl,
        draftKnowgrphWorkspacePath,
        draftHistoryWorkspacePath,
      })}`)
    }
    if (knowgrphStatus !== KNOWGRPH_CREATED_PATH || historyStatus !== HISTORY_CREATED_PATH) {
      throw new Error(`expected delayed-open create-file actions to expose created workspace path status immediately, got ${JSON.stringify({ knowgrphStatus, historyStatus })}`)
    }
    if (useMarkdownExplorerStore.getState().activePath !== PREVIOUS_ACTIVE_PATH) {
      throw new Error(`expected active workspace selection to remain on the previous path before delayed open completes, got ${String(useMarkdownExplorerStore.getState().activePath || '')}`)
    }

    const fs = await getWorkspaceFs()
    const knowgrphText = await fs.readFileText(KNOWGRPH_CREATED_PATH)
    const historyText = await fs.readFileText(HISTORY_CREATED_PATH)
    if (knowgrphText !== '' || historyText !== '') {
      throw new Error(`expected delayed-open create-file actions to materialize empty workspace files immediately, got ${JSON.stringify({ knowgrphText, historyText })}`)
    }

    const preDelayChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      preDelayChatInspection.available !== true ||
      preDelayChatInspection.workspacePaths.chatKnowgrphWorkspacePath !== null ||
      preDelayChatInspection.workspacePaths.chatHistoryWorkspacePath !== null ||
      preDelayChatInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-delayed-open-create.md' ||
      preDelayChatInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-delayed-open-create.md'
    ) {
      throw new Error(`expected committed FloatingPanel surface to remain unchanged before delayed open completes, got ${JSON.stringify(preDelayChatInspection)}`)
    }

    await act(async () => {
      await waitForMs(DELAYED_OPEN_DELAY_MS + 50)
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    if (useMarkdownExplorerStore.getState().activePath !== HISTORY_CREATED_PATH) {
      throw new Error(`expected delayed open to eventually update the active workspace selection to the latest created path, got ${String(useMarkdownExplorerStore.getState().activePath || '')}`)
    }

    const postDelayChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      postDelayChatInspection.available !== true ||
      postDelayChatInspection.workspacePaths.chatKnowgrphWorkspacePath !== null ||
      postDelayChatInspection.workspacePaths.chatHistoryWorkspacePath !== null ||
      postDelayChatInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-delayed-open-create.md' ||
      postDelayChatInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-delayed-open-create.md'
    ) {
      throw new Error(`expected committed FloatingPanel surface to remain unchanged even after delayed open completes before apply, got ${JSON.stringify(postDelayChatInspection)}`)
    }

    await act(async () => {
      actionsRef.current?.apply()
      await waitForFrames(dom.window as unknown as Window, 6)
    })

    const appliedChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      appliedChatInspection.available !== true ||
      appliedChatInspection.workspacePaths.chatKnowgrphWorkspacePath !== KNOWGRPH_CREATED_PATH ||
      appliedChatInspection.workspacePaths.chatHistoryWorkspacePath !== HISTORY_CREATED_PATH ||
      appliedChatInspection.cloudUrls.chatKnowgrphCloudUrl !== null ||
      appliedChatInspection.cloudUrls.chatHistoryCloudUrl !== null
    ) {
      throw new Error(`expected FloatingPanel Chat pipeline delayed-open create state to update after Settings apply, got ${JSON.stringify(appliedChatInspection)}`)
    }
    if (
      useGraphStore.getState().chatKnowgrphWorkspacePath !== KNOWGRPH_CREATED_PATH ||
      useGraphStore.getState().chatHistoryWorkspacePath !== HISTORY_CREATED_PATH ||
      useGraphStore.getState().chatKnowgrphStorageMode !== 'local' ||
      useGraphStore.getState().chatHistoryStorageMode !== 'local'
    ) {
      throw new Error(`expected canonical store delayed-open create state to commit after Settings apply, got ${JSON.stringify({
        chatKnowgrphWorkspacePath: useGraphStore.getState().chatKnowgrphWorkspacePath,
        chatHistoryWorkspacePath: useGraphStore.getState().chatHistoryWorkspacePath,
        chatKnowgrphStorageMode: useGraphStore.getState().chatKnowgrphStorageMode,
        chatHistoryStorageMode: useGraphStore.getState().chatHistoryStorageMode,
      })}`)
    }
  } finally {
    Date.now = originalDateNow
    if (chatRoot) {
      await unmountReactRoot(chatRoot, { window: dom.window as unknown as Window })
    }
    const clearedChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (clearedChatInspection.available !== false) {
      cleanupAssertionError = new Error(`expected FloatingPanel Chat pipeline snapshot cleanup after chat unmount, got ${JSON.stringify(clearedChatInspection)}`)
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
