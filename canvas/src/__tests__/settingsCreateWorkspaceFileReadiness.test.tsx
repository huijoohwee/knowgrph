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

const KNOWGRPH_CREATED_PATH = '/workspace/chat/kgc_20260523140000.md'
const HISTORY_CREATED_PATH = '/workspace/chat/chh_20260523140000.md'

const findButtonByLabel = (container: HTMLElement, label: string): HTMLButtonElement => {
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
  const match = buttons.find(button => String(button.textContent || '').includes(label))
  if (!match) throw new Error(`expected button with label ${JSON.stringify(label)}`)
  return match
}

function SettingsCreateWorkspaceFileHarness(props: {
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
        onClick={() => void createAndSelectKnowgrphFile()}
      >
        Create Knowgrph File
      </button>
      <button
        type="button"
        onClick={() => void createAndSelectChatHistoryFile()}
      >
        Create History File
      </button>
    </div>
  )
}

export async function testSettingsCreateAndSelectFilesKeepDraftStateLocalUntilApplyCommitsFloatingChatSurface() {
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
    Date.now = () => new Date(2026, 4, 23, 14, 0, 0, 0).getTime()
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
    store.setChatKnowgrphCloudUrl('https://cloud.example/knowgrph-before-create.md')
    store.setChatKnowgrphWorkspacePath(null)
    store.setChatHistoryStorageMode('cloud')
    store.setChatHistoryCloudUrl('https://cloud.example/history-before-create.md')
    store.setChatHistoryWorkspacePath(null)

    const doc = dom.window.document
    const settingsContainer = doc.createElement('div')
    const chatContainer = doc.createElement('div')
    doc.body.appendChild(settingsContainer)
    doc.body.appendChild(chatContainer)
    settingsRoot = createRoot(settingsContainer as unknown as HTMLElement)
    chatRoot = createRoot(chatContainer as unknown as HTMLElement)

    await mountReactRoot(settingsRoot, React.createElement(SettingsCreateWorkspaceFileHarness, { actionsRef }), {
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
      initialChatInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-create.md' ||
      initialChatInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-create.md'
    ) {
      throw new Error(`expected initial FloatingPanel Chat pipeline create-file state to reflect committed cloud values, got ${JSON.stringify(initialChatInspection)}`)
    }

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
      draftKnowgrphWorkspacePath !== KNOWGRPH_CREATED_PATH ||
      draftHistoryWorkspacePath !== HISTORY_CREATED_PATH
    ) {
      throw new Error(`expected create-file actions to patch draft local storage state, got ${JSON.stringify({
        draftKnowgrphStorageMode,
        draftHistoryStorageMode,
        draftKnowgrphCloudUrl,
        draftHistoryCloudUrl,
        draftKnowgrphWorkspacePath,
        draftHistoryWorkspacePath,
      })}`)
    }
    if (knowgrphStatus !== KNOWGRPH_CREATED_PATH || historyStatus !== HISTORY_CREATED_PATH) {
      throw new Error(`expected create-file actions to expose created workspace path status, got ${JSON.stringify({ knowgrphStatus, historyStatus })}`)
    }
    if (useMarkdownExplorerStore.getState().activePath !== HISTORY_CREATED_PATH) {
      throw new Error(`expected last created workspace file to become the active editor path, got ${String(useMarkdownExplorerStore.getState().activePath || '')}`)
    }

    const fs = await getWorkspaceFs()
    const knowgrphText = await fs.readFileText(KNOWGRPH_CREATED_PATH)
    const historyText = await fs.readFileText(HISTORY_CREATED_PATH)
    if (knowgrphText !== '' || historyText !== '') {
      throw new Error(`expected create-file actions to materialize empty workspace files, got ${JSON.stringify({ knowgrphText, historyText })}`)
    }

    const preApplyChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      preApplyChatInspection.available !== true ||
      preApplyChatInspection.workspacePaths.chatKnowgrphWorkspacePath !== null ||
      preApplyChatInspection.workspacePaths.chatHistoryWorkspacePath !== null ||
      preApplyChatInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-create.md' ||
      preApplyChatInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-create.md'
    ) {
      throw new Error(`expected FloatingPanel Chat pipeline create-file state to remain on committed values before Settings apply, got ${JSON.stringify(preApplyChatInspection)}`)
    }
    if (
      useGraphStore.getState().chatKnowgrphWorkspacePath !== null ||
      useGraphStore.getState().chatHistoryWorkspacePath !== null ||
      useGraphStore.getState().chatKnowgrphStorageMode !== 'cloud' ||
      useGraphStore.getState().chatHistoryStorageMode !== 'cloud'
    ) {
      throw new Error(`expected canonical store create-file state to remain unchanged before Settings apply, got ${JSON.stringify({
        chatKnowgrphWorkspacePath: useGraphStore.getState().chatKnowgrphWorkspacePath,
        chatHistoryWorkspacePath: useGraphStore.getState().chatHistoryWorkspacePath,
        chatKnowgrphStorageMode: useGraphStore.getState().chatKnowgrphStorageMode,
        chatHistoryStorageMode: useGraphStore.getState().chatHistoryStorageMode,
      })}`)
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
      throw new Error(`expected FloatingPanel Chat pipeline create-file state to update after Settings apply, got ${JSON.stringify(appliedChatInspection)}`)
    }
    if (
      useGraphStore.getState().chatKnowgrphWorkspacePath !== KNOWGRPH_CREATED_PATH ||
      useGraphStore.getState().chatHistoryWorkspacePath !== HISTORY_CREATED_PATH ||
      useGraphStore.getState().chatKnowgrphStorageMode !== 'local' ||
      useGraphStore.getState().chatHistoryStorageMode !== 'local'
    ) {
      throw new Error(`expected canonical store create-file state to commit after Settings apply, got ${JSON.stringify({
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
