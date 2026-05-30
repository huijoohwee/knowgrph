import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { createNewChatHistoryWorkspaceFilePath } from '@/features/chat/chatHistoryWorkspace'
import { getMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { importLocalFilesFallback, importLocalFolderFallback, importUrlFallback } from '@/features/toolbar/launchDropdownFallbacks'
import {
  ACTIVE_WORKSPACE_SYNC_MAX_ATTEMPTS,
  ACTIVE_WORKSPACE_SYNC_RETRY_MS,
} from './settingsView.constants'
import { openMarkdownWorkspaceEditorPane } from '@/features/workspace-table/workspaceTableSsot'

type WorkspaceKind = 'chatHistory' | 'knowgrph'

type UseSettingsWorkspaceActionsArgs = {
  patchChatValues: (patch: Record<string, string>) => void
  chatLocalStorageRootPath: string | number | boolean | undefined
  chatHistoryCloudUrl: string | number | boolean | undefined
  chatKnowgrphCloudUrl: string | number | boolean | undefined
  createWorkspaceFilePathImpl?: typeof createNewChatHistoryWorkspaceFilePath
  openWorkspaceFileImpl?: (path: string) => void
  importLocalFilesFallbackImpl?: typeof importLocalFilesFallback
  importLocalFolderFallbackImpl?: typeof importLocalFolderFallback
  importUrlFallbackImpl?: typeof importUrlFallback
}

export function useSettingsWorkspaceActions({
  patchChatValues,
  chatLocalStorageRootPath,
  chatHistoryCloudUrl,
  chatKnowgrphCloudUrl,
  createWorkspaceFilePathImpl = createNewChatHistoryWorkspaceFilePath,
  openWorkspaceFileImpl,
  importLocalFilesFallbackImpl = importLocalFilesFallback,
  importLocalFolderFallbackImpl = importLocalFolderFallback,
  importUrlFallbackImpl = importUrlFallback,
}: UseSettingsWorkspaceActionsArgs) {
  const [knowgrphPathStatus, setKnowgrphPathStatus] = React.useState<string | null>(null)
  const [isUpdatingKnowgrphPath, setIsUpdatingKnowgrphPath] = React.useState(false)
  const [chatHistoryPathStatus, setChatHistoryPathStatus] = React.useState<string | null>(null)
  const [isUpdatingChatHistoryPath, setIsUpdatingChatHistoryPath] = React.useState(false)
  const kgcLocalImportInputRef = React.useRef<HTMLInputElement | null>(null)
  const kgcLocalFolderImportInputRef = React.useRef<HTMLInputElement | null>(null)
  const localImportInputRef = React.useRef<HTMLInputElement | null>(null)
  const localFolderImportInputRef = React.useRef<HTMLInputElement | null>(null)
  const activeWorkspaceSyncTimeoutsRef = React.useRef<{ chatHistory: number | null, knowgrph: number | null }>({
    chatHistory: null,
    knowgrph: null,
  })
  const bridge = getMarkdownWorkspaceActionBridge()
  const bridgeImportLocalFiles = bridge.importLocalFiles
  const bridgeImportLocalFolder = bridge.importLocalFolder
  const bridgeImportUrl = bridge.importUrl
  const pushUiToast = useGraphStore(s => s.pushUiToast)
  React.useEffect(() => {
    const timeouts = activeWorkspaceSyncTimeoutsRef.current
    return () => {
      if (timeouts.chatHistory !== null) {
        window.clearTimeout(timeouts.chatHistory)
      }
      if (timeouts.knowgrph !== null) {
        window.clearTimeout(timeouts.knowgrph)
      }
    }
  }, [])

  const openWorkspaceFile = React.useCallback((path: string) => {
    const normalized = normalizeWorkspacePath(path)
    if (typeof openWorkspaceFileImpl === 'function') {
      openWorkspaceFileImpl(normalized)
      return
    }
    openMarkdownWorkspaceEditorPane(useGraphStore.getState())
    useMarkdownExplorerStore.getState().setActivePath(normalized)
  }, [openWorkspaceFileImpl])

  const syncPathFromActiveWorkspaceFile = React.useCallback((kind: WorkspaceKind, attempt = 0) => {
    const active = useMarkdownExplorerStore.getState().activePath
    const normalized = active ? normalizeWorkspacePath(active) : ''
    if (normalized && normalized.toLowerCase().endsWith('.md')) {
      if (kind === 'chatHistory') {
        patchChatValues({
          chatHistoryStorageMode: 'local',
          chatHistoryCloudUrl: '',
          chatHistoryWorkspacePath: normalized,
        })
        setChatHistoryPathStatus(normalized)
      } else {
        patchChatValues({
          chatKnowgrphStorageMode: 'local',
          chatKnowgrphCloudUrl: '',
          chatKnowgrphWorkspacePath: normalized,
        })
        setKnowgrphPathStatus(normalized)
      }
      activeWorkspaceSyncTimeoutsRef.current[kind] = null
      return
    }
    if (attempt >= ACTIVE_WORKSPACE_SYNC_MAX_ATTEMPTS || typeof window === 'undefined') {
      activeWorkspaceSyncTimeoutsRef.current[kind] = null
      return
    }
    const nextAttempt = attempt + 1
    activeWorkspaceSyncTimeoutsRef.current[kind] = window.setTimeout(() => {
      syncPathFromActiveWorkspaceFile(kind, nextAttempt)
    }, ACTIVE_WORKSPACE_SYNC_RETRY_MS)
  }, [patchChatValues])

  const createWorkspaceBackedFile = React.useCallback(async (kind: WorkspaceKind) => {
    const setPending = kind === 'chatHistory' ? setIsUpdatingChatHistoryPath : setIsUpdatingKnowgrphPath
    const setStatus = kind === 'chatHistory' ? setChatHistoryPathStatus : setKnowgrphPathStatus
    const storageType = kind === 'chatHistory' ? 'chatHistory' : 'chatKnowgrph'
    const patch = kind === 'chatHistory'
      ? {
          chatHistoryStorageMode: 'local',
          chatHistoryCloudUrl: '',
        }
      : {
          chatKnowgrphStorageMode: 'local',
          chatKnowgrphCloudUrl: '',
        }
    const pathKey = kind === 'chatHistory' ? 'chatHistoryWorkspacePath' : 'chatKnowgrphWorkspacePath'
    setPending(true)
    setStatus(null)
    try {
      const created = await createWorkspaceFilePathImpl(Date.now(), {
        storageType,
        defaultLocalRootPath: String(chatLocalStorageRootPath || '').trim() || null,
      })
      patchChatValues({
        ...patch,
        [pathKey]: created,
      })
      openWorkspaceFile(created)
      setStatus(created)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err || 'Failed to create file'))
    } finally {
      setPending(false)
    }
  }, [chatLocalStorageRootPath, createWorkspaceFilePathImpl, openWorkspaceFile, patchChatValues])

  const applyActiveWorkspaceFile = React.useCallback((kind: WorkspaceKind) => {
    const setStatus = kind === 'chatHistory' ? setChatHistoryPathStatus : setKnowgrphPathStatus
    setStatus(null)
    const active = useMarkdownExplorerStore.getState().activePath
    const normalized = active ? normalizeWorkspacePath(active) : null
    if (!normalized || !normalized.toLowerCase().endsWith('.md')) {
      setStatus('No active markdown file is selected in Workspace Editor.')
      return
    }
    if (kind === 'chatHistory') {
      patchChatValues({
        chatHistoryStorageMode: 'local',
        chatHistoryCloudUrl: '',
        chatHistoryWorkspacePath: normalized,
      })
    } else {
      patchChatValues({
        chatKnowgrphStorageMode: 'local',
        chatKnowgrphCloudUrl: '',
        chatKnowgrphWorkspacePath: normalized,
      })
    }
    openWorkspaceFile(normalized)
    setStatus(normalized)
  }, [openWorkspaceFile, patchChatValues])

  const openFilePicker = React.useCallback((el: HTMLInputElement | null) => {
    if (!el) return
    try {
      const anyEl = el as unknown as { showPicker?: () => void }
      if (typeof anyEl.showPicker === 'function') {
        anyEl.showPicker()
        return
      }
    } catch {
      void 0
    }
    try {
      el.click()
    } catch {
      void 0
    }
  }, [])

  const importLocalSelection = React.useCallback((kind: WorkspaceKind, files: FileList | null, selectionKind: 'files' | 'folder') => {
    const snapshot = files ? Array.from(files) : []
    if (snapshot.length === 0) return
    const label = selectionKind === 'folder' ? 'folder' : 'files'
    if (kind === 'chatHistory') {
      setChatHistoryPathStatus(`Importing local ${label}...`)
      patchChatValues({ chatHistoryStorageMode: 'local', chatHistoryCloudUrl: '' })
    } else {
      setKnowgrphPathStatus(`Importing local ${label}...`)
      patchChatValues({ chatKnowgrphStorageMode: 'local', chatKnowgrphCloudUrl: '' })
    }
    if (selectionKind === 'folder') {
      if (typeof bridgeImportLocalFolder === 'function') bridgeImportLocalFolder(files)
      else void importLocalFolderFallbackImpl({ files, pushUiToast })
    } else if (typeof bridgeImportLocalFiles === 'function') bridgeImportLocalFiles(files)
    else void importLocalFilesFallbackImpl({ files, pushUiToast })
    syncPathFromActiveWorkspaceFile(kind)
  }, [bridgeImportLocalFiles, bridgeImportLocalFolder, importLocalFilesFallbackImpl, importLocalFolderFallbackImpl, patchChatValues, pushUiToast, syncPathFromActiveWorkspaceFile])

  const importCloudUrl = React.useCallback((kind: WorkspaceKind) => {
    const next = String(kind === 'chatHistory' ? chatHistoryCloudUrl : chatKnowgrphCloudUrl || '').trim()
    const setStatus = kind === 'chatHistory' ? setChatHistoryPathStatus : setKnowgrphPathStatus
    if (!next) {
      setStatus(kind === 'chatHistory' ? 'Set chatHistoryCloudUrl first.' : 'Set chatKnowgrphCloudUrl first.')
      return
    }
    if (kind === 'chatHistory') {
      patchChatValues({ chatHistoryStorageMode: 'cloud', chatHistoryCloudUrl: next })
    } else {
      patchChatValues({ chatKnowgrphStorageMode: 'cloud', chatKnowgrphCloudUrl: next })
    }
    setStatus(`Importing URL: ${next}`)
    if (typeof bridgeImportUrl === 'function') bridgeImportUrl(next)
    else void importUrlFallbackImpl({ urlRaw: next, pushUiToast })
  }, [bridgeImportUrl, chatHistoryCloudUrl, chatKnowgrphCloudUrl, importUrlFallbackImpl, patchChatValues, pushUiToast])

  return {
    chatHistoryPathStatus,
    createAndSelectChatHistoryFile: React.useCallback(async () => createWorkspaceBackedFile('chatHistory'), [createWorkspaceBackedFile]),
    createAndSelectKnowgrphFile: React.useCallback(async () => createWorkspaceBackedFile('knowgrph'), [createWorkspaceBackedFile]),
    applyActiveWorkspaceFileAsChatHistory: React.useCallback(() => applyActiveWorkspaceFile('chatHistory'), [applyActiveWorkspaceFile]),
    applyActiveWorkspaceFileAsKnowgrph: React.useCallback(() => applyActiveWorkspaceFile('knowgrph'), [applyActiveWorkspaceFile]),
    importCloudUrlForChatHistory: React.useCallback(() => importCloudUrl('chatHistory'), [importCloudUrl]),
    importCloudUrlForKnowgrph: React.useCallback(() => importCloudUrl('knowgrph'), [importCloudUrl]),
    importLocalFilesForChatHistory: React.useCallback((files: FileList | null) => importLocalSelection('chatHistory', files, 'files'), [importLocalSelection]),
    importLocalFilesForKnowgrph: React.useCallback((files: FileList | null) => importLocalSelection('knowgrph', files, 'files'), [importLocalSelection]),
    importLocalFolderForChatHistory: React.useCallback((files: FileList | null) => importLocalSelection('chatHistory', files, 'folder'), [importLocalSelection]),
    importLocalFolderForKnowgrph: React.useCallback((files: FileList | null) => importLocalSelection('knowgrph', files, 'folder'), [importLocalSelection]),
    isUpdatingChatHistoryPath,
    isUpdatingKnowgrphPath,
    kgcLocalImportInputRef,
    kgcLocalFolderImportInputRef,
    knowgrphPathStatus,
    localImportInputRef,
    localFolderImportInputRef,
    setChatHistoryPathStatus,
    setKnowgrphPathStatus,
    openFilePicker,
    openWorkspaceFile,
  }
}
