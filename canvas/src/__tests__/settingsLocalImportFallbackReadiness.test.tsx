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
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

type RegisteredSettingsActions = {
  apply: () => void
  reset: () => void
}

const KNOWGRPH_IMPORTED_FILE_NAME = 'kgc_20260523134500.md'
const HISTORY_IMPORTED_FILE_NAME = 'history_local_fallback_20260523134500.md'
const KNOWGRPH_IMPORTED_PATH = `/workspace/chat/${KNOWGRPH_IMPORTED_FILE_NAME}`
const HISTORY_IMPORTED_PATH = `/workspace/chat/${HISTORY_IMPORTED_FILE_NAME}`

const findButtonByLabel = (container: HTMLElement, label: string): HTMLButtonElement => {
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
  const match = buttons.find(button => String(button.textContent || '').includes(label))
  if (!match) throw new Error(`expected button with label ${JSON.stringify(label)}`)
  return match
}

function SettingsLocalImportFallbackHarness(props: {
  actionsRef: React.MutableRefObject<RegisteredSettingsActions | null>
  fallbackCalls: Array<{ fileNames: string[] }>
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
    importLocalFilesFallbackImpl: async args => {
      const snapshot = args.files ? Array.from(args.files as ArrayLike<File>) : []
      const fileNames = snapshot.map(file => String(file?.name || '').trim()).filter(Boolean)
      props.fallbackCalls.push({ fileNames })
      const firstName = fileNames[0] || ''
      if (firstName === KNOWGRPH_IMPORTED_FILE_NAME) {
        useMarkdownExplorerStore.getState().setActivePath(KNOWGRPH_IMPORTED_PATH)
      } else if (firstName === HISTORY_IMPORTED_FILE_NAME) {
        useMarkdownExplorerStore.getState().setActivePath(HISTORY_IMPORTED_PATH)
      }
      args.pushUiToast({
        id: 'launch:import:localFiles',
        kind: 'neutral',
        message: `Fallback local import invoked: ${fileNames.join(', ')}`,
        ttlMs: null,
        dismissible: false,
      })
    },
  })

  const knowgrphFiles = React.useMemo(
    () => [new File(['---\n$schema: "kgc-pipeline/v1"\n---\n\n# Fallback Knowgrph\n'], KNOWGRPH_IMPORTED_FILE_NAME, { type: 'text/markdown' })] as unknown as FileList,
    [],
  )
  const historyFiles = React.useMemo(
    () => [new File(['# Fallback History\n'], HISTORY_IMPORTED_FILE_NAME, { type: 'text/markdown' })] as unknown as FileList,
    [],
  )

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
        onClick={() => importLocalFilesForKnowgrph(knowgrphFiles)}
      >
        Fallback Import Knowgrph Local File
      </button>
      <button
        type="button"
        onClick={() => importLocalFilesForChatHistory(historyFiles)}
      >
        Fallback Import History Local File
      </button>
    </div>
  )
}

export async function testSettingsLocalImportFallbackKeepsDraftStateLocalUntilApplyCommitsFloatingChatSurface() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let settingsRoot: ReturnType<typeof createRoot> | null = null
  let chatRoot: ReturnType<typeof createRoot> | null = null
  const actionsRef: { current: RegisteredSettingsActions | null } = { current: null }
  const fallbackCalls: Array<{ fileNames: string[] }> = []

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
    store.setChatKnowgrphCloudUrl('https://cloud.example/fallback-local-knowgrph.md')
    store.setChatKnowgrphWorkspacePath(null)
    store.setChatHistoryStorageMode('cloud')
    store.setChatHistoryCloudUrl('https://cloud.example/fallback-local-history.md')
    store.setChatHistoryWorkspacePath(null)

    const doc = dom.window.document
    const settingsContainer = doc.createElement('div')
    const chatContainer = doc.createElement('div')
    doc.body.appendChild(settingsContainer)
    doc.body.appendChild(chatContainer)
    settingsRoot = createRoot(settingsContainer as unknown as HTMLElement)
    chatRoot = createRoot(chatContainer as unknown as HTMLElement)

    await mountReactRoot(
      settingsRoot,
      React.createElement(SettingsLocalImportFallbackHarness, { actionsRef, fallbackCalls }),
      { window: dom.window as unknown as Window, frames: 10 },
    )
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
      initialChatInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/fallback-local-knowgrph.md' ||
      initialChatInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/fallback-local-history.md'
    ) {
      throw new Error(`expected initial FloatingPanel Chat pipeline local-import state to reflect committed cloud values, got ${JSON.stringify(initialChatInspection)}`)
    }

    await act(async () => {
      findButtonByLabel(settingsContainer, 'Fallback Import Knowgrph Local File').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 2)
    })
    await act(async () => {
      findButtonByLabel(settingsContainer, 'Fallback Import History Local File').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 2)
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
      draftKnowgrphWorkspacePath !== KNOWGRPH_IMPORTED_PATH ||
      draftHistoryWorkspacePath !== HISTORY_IMPORTED_PATH
    ) {
      throw new Error(`expected no-bridge local import path to patch draft local storage state, got ${JSON.stringify({
        draftKnowgrphStorageMode,
        draftHistoryStorageMode,
        draftKnowgrphCloudUrl,
        draftHistoryCloudUrl,
        draftKnowgrphWorkspacePath,
        draftHistoryWorkspacePath,
      })}`)
    }
    if (knowgrphStatus !== KNOWGRPH_IMPORTED_PATH || historyStatus !== HISTORY_IMPORTED_PATH) {
      throw new Error(`expected no-bridge local import path to expose imported workspace path status, got ${JSON.stringify({ knowgrphStatus, historyStatus })}`)
    }
    if (
      fallbackCalls.length !== 2 ||
      fallbackCalls[0]?.fileNames[0] !== KNOWGRPH_IMPORTED_FILE_NAME ||
      fallbackCalls[1]?.fileNames[0] !== HISTORY_IMPORTED_FILE_NAME
    ) {
      throw new Error(`expected no-bridge local import path to invoke fallback for both files, got ${JSON.stringify(fallbackCalls)}`)
    }

    const launchImportToast = useGraphStore.getState().uiToasts.find(toast => toast.id === 'launch:import:localFiles')
    if (!launchImportToast || !String(launchImportToast.message || '').includes('Fallback local import invoked')) {
      throw new Error(`expected fallback local import path to surface a launch:import:localFiles toast, got ${JSON.stringify(useGraphStore.getState().uiToasts)}`)
    }

    const preApplyChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (
      preApplyChatInspection.available !== true ||
      preApplyChatInspection.workspacePaths.chatKnowgrphWorkspacePath !== null ||
      preApplyChatInspection.workspacePaths.chatHistoryWorkspacePath !== null ||
      preApplyChatInspection.cloudUrls.chatKnowgrphCloudUrl !== 'https://cloud.example/fallback-local-knowgrph.md' ||
      preApplyChatInspection.cloudUrls.chatHistoryCloudUrl !== 'https://cloud.example/fallback-local-history.md'
    ) {
      throw new Error(`expected FloatingPanel Chat pipeline local-import state to remain on committed values before Settings apply, got ${JSON.stringify(preApplyChatInspection)}`)
    }
    if (
      useGraphStore.getState().chatKnowgrphWorkspacePath !== null ||
      useGraphStore.getState().chatHistoryWorkspacePath !== null ||
      useGraphStore.getState().chatKnowgrphStorageMode !== 'cloud' ||
      useGraphStore.getState().chatHistoryStorageMode !== 'cloud'
    ) {
      throw new Error(`expected canonical store local-import state to remain unchanged before Settings apply, got ${JSON.stringify({
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
      appliedChatInspection.workspacePaths.chatKnowgrphWorkspacePath !== KNOWGRPH_IMPORTED_PATH ||
      appliedChatInspection.workspacePaths.chatHistoryWorkspacePath !== HISTORY_IMPORTED_PATH ||
      appliedChatInspection.cloudUrls.chatKnowgrphCloudUrl !== null ||
      appliedChatInspection.cloudUrls.chatHistoryCloudUrl !== null
    ) {
      throw new Error(`expected FloatingPanel Chat pipeline local-import state to update after Settings apply, got ${JSON.stringify(appliedChatInspection)}`)
    }
  } finally {
    if (chatRoot) {
      await unmountReactRoot(chatRoot, { window: dom.window as unknown as Window })
    }
    const clearedChatInspection = inspectLocalChatPipelineState(readLocalChatPipelineSurfaceSnapshot())
    if (clearedChatInspection.available !== false) {
      throw new Error(`expected FloatingPanel Chat pipeline snapshot cleanup after chat unmount, got ${JSON.stringify(clearedChatInspection)}`)
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
}
