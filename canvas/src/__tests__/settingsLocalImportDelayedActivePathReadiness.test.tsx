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
import {
  ACTIVE_WORKSPACE_SYNC_RETRY_MS,
} from '@/features/panels/views/settingsView.constants'
import { CHAT_PROVIDER_OPENAI } from '@/lib/chatEndpoint'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

type RegisteredSettingsActions = {
  apply: () => void
  reset: () => void
}

const KNOWGRPH_IMPORTED_FILE_NAME = 'kgc_20260523150000.md'
const HISTORY_IMPORTED_FILE_NAME = 'history_delayed_20260523150000.md'
const KNOWGRPH_IMPORTED_PATH = `/workspace/chat/${KNOWGRPH_IMPORTED_FILE_NAME}`
const HISTORY_IMPORTED_PATH = `/workspace/chat/${HISTORY_IMPORTED_FILE_NAME}`
const DELAYED_IMPORT_STATUS = 'Importing local files...'
const ACTIVE_PATH_SYNC_DELAY_MS = ACTIVE_WORKSPACE_SYNC_RETRY_MS * 2 + 50
const ACTIVE_PATH_SYNC_SETTLE_MS = ACTIVE_WORKSPACE_SYNC_RETRY_MS * 3 + 100

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

function SettingsLocalImportDelayedActivePathHarness(props: {
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
    importLocalFilesForChatHistory,
    importLocalFilesForKnowgrph,
    chatHistoryPathStatus,
    knowgrphPathStatus,
  } = useSettingsWorkspaceActions({
    patchChatValues,
    chatLocalStorageRootPath: values.chatLocalStorageRootPath,
    chatHistoryCloudUrl: values.chatHistoryCloudUrl,
    chatKnowgrphCloudUrl: values.chatKnowgrphCloudUrl,
  })

  const knowgrphFiles = React.useMemo(
    () => [new File(['# Delayed Knowgrph Import\n'], KNOWGRPH_IMPORTED_FILE_NAME, { type: 'text/markdown' })] as unknown as FileList,
    [],
  )
  const historyFiles = React.useMemo(
    () => [new File(['# Delayed History Import\n'], HISTORY_IMPORTED_FILE_NAME, { type: 'text/markdown' })] as unknown as FileList,
    [],
  )

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
        onClick={() => importLocalFilesForKnowgrph(knowgrphFiles)}
      >
        Import Delayed Knowgrph File
      </button>
      <button
        type="button"
        onClick={() => importLocalFilesForChatHistory(historyFiles)}
      >
        Import Delayed History File
      </button>
    </section>
  )
}

export async function testSettingsLocalImportDelayedActivePathKeepsCommittedSurfaceTruthfulUntilApply() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let settingsRoot: ReturnType<typeof createRoot> | null = null
  let chatRoot: ReturnType<typeof createRoot> | null = null
  const actionsRef: { current: RegisteredSettingsActions | null } = { current: null }
  const importedFileNames: string[] = []
  const unregisterBridge = registerMarkdownWorkspaceActionBridge('test-delayed-local-import-bridge', {
    importLocalFiles: files => {
      const snapshot = files ? Array.from(files as ArrayLike<File>) : []
      const firstName = String(snapshot[0]?.name || '').trim()
      if (!firstName) return
      importedFileNames.push(firstName)
      const targetPath = firstName === KNOWGRPH_IMPORTED_FILE_NAME ? KNOWGRPH_IMPORTED_PATH : HISTORY_IMPORTED_PATH
      setTimeout(() => {
        useMarkdownExplorerStore.getState().setActivePath(targetPath)
      }, ACTIVE_PATH_SYNC_DELAY_MS)
    },
  })

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
    store.setChatContextScope('workspace')
    store.setChatStorageTarget('chatKnowgrph')
    store.setChatKnowgrphStorageMode('cloud')
    store.setChatKnowgrphCloudUrl('https://cloud.example/knowgrph-before-delayed-local-import.md')
    store.setChatKnowgrphWorkspacePath(null)
    store.setChatHistoryStorageMode('cloud')
    store.setChatHistoryCloudUrl('https://cloud.example/history-before-delayed-local-import.md')
    store.setChatHistoryWorkspacePath(null)

    const doc = dom.window.document
    const settingsContainer = doc.createElement('section')
    const chatContainer = doc.createElement('section')
    doc.body.appendChild(settingsContainer)
    doc.body.appendChild(chatContainer)
    settingsRoot = createRoot(settingsContainer as unknown as HTMLElement)
    chatRoot = createRoot(chatContainer as unknown as HTMLElement)

    await mountReactRoot(settingsRoot, React.createElement(SettingsLocalImportDelayedActivePathHarness, { actionsRef }), {
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
      initialChatInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-delayed-local-import.md' ||
      initialChatInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-delayed-local-import.md'
    ) {
      throw new Error(`expected initial FloatingPanel Chat pipeline delayed local-import state to reflect committed cloud values, got ${JSON.stringify(initialChatInspection)}`)
    }

    await act(async () => {
      findButtonByLabel(settingsContainer, 'Import Delayed Knowgrph File').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    const initialDraftKnowgrphStorageMode = settingsContainer.querySelector('[data-draft-knowgrph-storage-mode]')?.getAttribute('data-draft-knowgrph-storage-mode')
    const initialDraftKnowgrphCloudUrl = settingsContainer.querySelector('[data-draft-knowgrph-cloud-url]')?.getAttribute('data-draft-knowgrph-cloud-url')
    const initialDraftKnowgrphWorkspacePath = settingsContainer.querySelector('[data-draft-knowgrph-workspace-path]')?.getAttribute('data-draft-knowgrph-workspace-path')
    const initialKnowgrphStatus = settingsContainer.querySelector('[data-knowgrph-status]')?.getAttribute('data-knowgrph-status')

    if (
      initialDraftKnowgrphStorageMode !== 'local' ||
      initialDraftKnowgrphCloudUrl !== '' ||
      initialDraftKnowgrphWorkspacePath !== '' ||
      initialKnowgrphStatus !== DELAYED_IMPORT_STATUS
    ) {
      throw new Error(`expected delayed knowgrph import to stay in pre-sync draft state before active path resolves, got ${JSON.stringify({
        initialDraftKnowgrphStorageMode,
        initialDraftKnowgrphCloudUrl,
        initialDraftKnowgrphWorkspacePath,
        initialKnowgrphStatus,
      })}`)
    }

    const preResolvedKnowgrphInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      preResolvedKnowgrphInspection.available !== true ||
      preResolvedKnowgrphInspection.workspacePaths.chatKnowgrphWorkspacePath !== null ||
      preResolvedKnowgrphInspection.workspacePaths.chatHistoryWorkspacePath !== null ||
      preResolvedKnowgrphInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-delayed-local-import.md' ||
      preResolvedKnowgrphInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-delayed-local-import.md'
    ) {
      throw new Error(`expected committed FloatingPanel surface to remain unchanged before delayed knowgrph path sync resolves, got ${JSON.stringify(preResolvedKnowgrphInspection)}`)
    }

    await act(async () => {
      await waitForMs(ACTIVE_PATH_SYNC_SETTLE_MS)
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    const resolvedDraftKnowgrphWorkspacePath = settingsContainer.querySelector('[data-draft-knowgrph-workspace-path]')?.getAttribute('data-draft-knowgrph-workspace-path')
    const resolvedKnowgrphStatus = settingsContainer.querySelector('[data-knowgrph-status]')?.getAttribute('data-knowgrph-status')
    if (resolvedDraftKnowgrphWorkspacePath !== KNOWGRPH_IMPORTED_PATH || resolvedKnowgrphStatus !== KNOWGRPH_IMPORTED_PATH) {
      throw new Error(`expected delayed knowgrph import to resolve draft workspace path after retry sync, got ${JSON.stringify({
        resolvedDraftKnowgrphWorkspacePath,
        resolvedKnowgrphStatus,
      })}`)
    }

    useMarkdownExplorerStore.getState().setActivePath(null)

    await act(async () => {
      findButtonByLabel(settingsContainer, 'Import Delayed History File').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    const initialDraftHistoryStorageMode = settingsContainer.querySelector('[data-draft-history-storage-mode]')?.getAttribute('data-draft-history-storage-mode')
    const initialDraftHistoryCloudUrl = settingsContainer.querySelector('[data-draft-history-cloud-url]')?.getAttribute('data-draft-history-cloud-url')
    const initialDraftHistoryWorkspacePath = settingsContainer.querySelector('[data-draft-history-workspace-path]')?.getAttribute('data-draft-history-workspace-path')
    const initialHistoryStatus = settingsContainer.querySelector('[data-history-status]')?.getAttribute('data-history-status')
    if (
      initialDraftHistoryStorageMode !== 'local' ||
      initialDraftHistoryCloudUrl !== '' ||
      initialDraftHistoryWorkspacePath !== '' ||
      initialHistoryStatus !== DELAYED_IMPORT_STATUS
    ) {
      throw new Error(`expected delayed history import to stay in pre-sync draft state before active path resolves, got ${JSON.stringify({
        initialDraftHistoryStorageMode,
        initialDraftHistoryCloudUrl,
        initialDraftHistoryWorkspacePath,
        initialHistoryStatus,
      })}`)
    }

    const preResolvedHistoryInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      preResolvedHistoryInspection.available !== true ||
      preResolvedHistoryInspection.workspacePaths.chatKnowgrphWorkspacePath !== null ||
      preResolvedHistoryInspection.workspacePaths.chatHistoryWorkspacePath !== null ||
      preResolvedHistoryInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-delayed-local-import.md' ||
      preResolvedHistoryInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-delayed-local-import.md'
    ) {
      throw new Error(`expected committed FloatingPanel surface to remain unchanged before delayed history path sync resolves, got ${JSON.stringify(preResolvedHistoryInspection)}`)
    }

    await act(async () => {
      await waitForMs(ACTIVE_PATH_SYNC_SETTLE_MS)
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    const resolvedDraftHistoryWorkspacePath = settingsContainer.querySelector('[data-draft-history-workspace-path]')?.getAttribute('data-draft-history-workspace-path')
    const resolvedHistoryStatus = settingsContainer.querySelector('[data-history-status]')?.getAttribute('data-history-status')
    if (resolvedDraftHistoryWorkspacePath !== HISTORY_IMPORTED_PATH || resolvedHistoryStatus !== HISTORY_IMPORTED_PATH) {
      throw new Error(`expected delayed history import to resolve draft workspace path after retry sync, got ${JSON.stringify({
        resolvedDraftHistoryWorkspacePath,
        resolvedHistoryStatus,
      })}`)
    }

    if (
      importedFileNames.length !== 2 ||
      importedFileNames[0] !== KNOWGRPH_IMPORTED_FILE_NAME ||
      importedFileNames[1] !== HISTORY_IMPORTED_FILE_NAME
    ) {
      throw new Error(`expected delayed local-import bridge to receive both local files, got ${JSON.stringify(importedFileNames)}`)
    }

    const preApplyChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      preApplyChatInspection.available !== true ||
      preApplyChatInspection.workspacePaths.chatKnowgrphWorkspacePath !== null ||
      preApplyChatInspection.workspacePaths.chatHistoryWorkspacePath !== null ||
      preApplyChatInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/knowgrph-before-delayed-local-import.md' ||
      preApplyChatInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/history-before-delayed-local-import.md'
    ) {
      throw new Error(`expected FloatingPanel Chat pipeline delayed local-import state to remain on committed cloud values before Settings apply, got ${JSON.stringify(preApplyChatInspection)}`)
    }

    await act(async () => {
      actionsRef.current?.apply()
      await waitForFrames(dom.window as unknown as Window, 6)
    })

    const appliedChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      appliedChatInspection.available !== true ||
      appliedChatInspection.workspacePaths.chatKnowgrphWorkspacePath !== KNOWGRPH_IMPORTED_PATH ||
      appliedChatInspection.workspacePaths.chatHistoryWorkspacePath !== HISTORY_IMPORTED_PATH ||
      appliedChatInspection.cloudUrls.chatKnowgrphCloudUrl !== null ||
      appliedChatInspection.cloudUrls.chatHistoryCloudUrl !== null
    ) {
      throw new Error(`expected FloatingPanel Chat pipeline delayed local-import state to commit after Settings apply, got ${JSON.stringify(appliedChatInspection)}`)
    }
  } finally {
    unregisterBridge()
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
    useGraphStore.getState().resetAll()
    useMarkdownExplorerStore.getState().setActivePath(null)
    restoreDom()
    restoreWindow()
  }
  if (cleanupAssertionError) throw cleanupAssertionError
}
