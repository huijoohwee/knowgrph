import React from 'react'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { LS_KEYS, WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { lsSetBool, lsSetInt, lsSetJson } from '@/lib/persistence'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { loadWorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { subscribeWorkspaceFsChanged } from '@/features/workspace-fs/workspaceFsEvents'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import { useGraphStore } from '@/hooks/useGraphStore'
import { SIDEBAR_MAX_PX, SIDEBAR_MIN_PX } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceUtils'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import type { WorkspaceRefreshSnapshot } from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/types'
import {
  cancelMarkdownWorkspacePrefsSync,
  cancelMarkdownWorkspaceRefreshSync,
  scheduleMarkdownWorkspacePrefsSync,
  scheduleMarkdownWorkspaceRefreshSync,
} from './markdownWorkspaceRuntime.stateSync'
import { areWorkspaceEntriesEqual, areWorkspaceSourcesEqual, type FolderModeContract } from './markdownWorkspaceRuntime.shared'

export function useMarkdownWorkspaceExplorerState(args: {
  active: boolean
  activePathRef: React.MutableRefObject<WorkspacePath | null>
  activeTextRef: React.MutableRefObject<string>
  viewerInlineEditActiveRef: React.MutableRefObject<boolean>
  lastLoadedRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>
  entries: WorkspaceEntry[]
  setEntries: React.Dispatch<React.SetStateAction<WorkspaceEntry[]>>
  setSourcesByPath: React.Dispatch<React.SetStateAction<WorkspaceSourceIndex>>
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  setLoadError: React.Dispatch<React.SetStateAction<string>>
  setStatusInfo: (label: string, opts?: { ttlMs?: number }) => void
  setStatusError: (label: string) => void
  setStatusProgress: (
    label: string,
    value?: number,
    max?: number,
    bytesDone?: number,
    bytesTotal?: number,
    opts?: { ttlMs?: number },
  ) => void
  sidebarWidthPx: number
  explorerOpen: boolean
  sourceFilesCollapsed: boolean
  tocCollapsed: boolean
  backlinksCollapsed: boolean
  markdownWordWrap: boolean
  markdownTextHighlight: boolean
  folderModeContract: FolderModeContract
  layoutMode: MarkdownWorkspaceLayoutMode
  expandedPaths: Set<string>
  resizeHandleEl: HTMLHRElement | null
  setSidebarWidthPx: React.Dispatch<React.SetStateAction<number>>
  search: string
}) {
  const workspaceFsRef = React.useRef<Awaited<ReturnType<typeof getWorkspaceFs>> | null>(null)
  const refreshInFlightRef = React.useRef(false)
  const refreshQueuedRef = React.useRef(false)

  const getFs = React.useCallback(async () => {
    const existing = workspaceFsRef.current
    if (existing) return existing
    const fs = await getWorkspaceFs()
    workspaceFsRef.current = fs
    return fs
  }, [])

  const runtimeRef = React.useRef(args)
  runtimeRef.current = args

  const scheduleApplyComposedFromSourceFiles = React.useCallback(async () => {
    try {
      const mod = (await import('@/features/source-files/applyComposedGraphFromSourceFiles')) as typeof import('@/features/source-files/applyComposedGraphFromSourceFiles')
      mod.scheduleApplyComposedGraphFromSourceFiles()
    } catch {
      void 0
    }
  }, [])

  const refreshOnce = React.useCallback(async (): Promise<WorkspaceRefreshSnapshot> => {
    const runtime = runtimeRef.current
    runtime.setStatusProgress('Refreshing')
    runtime.setLoading(true)
    runtime.setLoadError('')
    try {
      const currentActivePath = runtime.activePathRef.current
      const fs = await getFs()
      await fs.ensureSeed()
      const list = await fs.listEntries()
      const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
      const pruned = list.map((entry: WorkspaceEntry) => {
        if (!entry || entry.kind !== 'file') return entry
        if (typeof entry.text !== 'string') return entry
        if (entry.text.length <= maxInline) return entry
        return { ...entry, text: undefined }
      })
      runtime.setEntries(prev => (areWorkspaceEntriesEqual(prev, pruned) ? prev : pruned))
      const sources = loadWorkspaceSourceIndex()
      runtime.setSourcesByPath(prev => (areWorkspaceSourcesEqual(prev, sources) ? prev : sources))
      try {
        const store = useGraphStore.getState()
        const merged = mergeWorkspaceEntriesIntoSourceFiles({
          existing: store.sourceFiles,
          workspaceEntries: pruned,
          sourcesByPath: sources,
          forceIncludePaths: currentActivePath ? [currentActivePath] : [],
        })
        if (merged !== store.sourceFiles) {
          store.setSourceFiles(merged)
          await scheduleApplyComposedFromSourceFiles()
        }
      } catch {
        void 0
      }
      runtime.setLoading(false)
      runtime.setStatusInfo('Ready')
      return { entries: pruned, sourcesByPath: sources }
    } catch (e) {
      const currentRuntime = runtimeRef.current
      currentRuntime.setLoading(false)
      currentRuntime.setLoadError(String((e as { message?: unknown })?.message ?? e))
      currentRuntime.setStatusError('Refresh failed')
      return { entries: [] as WorkspaceEntry[], sourcesByPath: loadWorkspaceSourceIndex() }
    }
  }, [getFs, scheduleApplyComposedFromSourceFiles])

  const refresh = React.useCallback(async (): Promise<WorkspaceRefreshSnapshot> => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true
      return { entries: runtimeRef.current.entries, sourcesByPath: loadWorkspaceSourceIndex() }
    }
    refreshInFlightRef.current = true
    let snapshot: WorkspaceRefreshSnapshot = { entries: runtimeRef.current.entries, sourcesByPath: loadWorkspaceSourceIndex() }
    try {
      do {
        refreshQueuedRef.current = false
        snapshot = await refreshOnce()
      } while (refreshQueuedRef.current)
      return snapshot
    } finally {
      refreshInFlightRef.current = false
    }
  }, [refreshOnce])

  React.useEffect(() => {
    if (!args.active) return
    const unsubscribe = subscribeWorkspaceFsChanged(detail => {
      const runtime = runtimeRef.current
      if (runtime.viewerInlineEditActiveRef.current) return
      const activePath = runtime.activePathRef.current
      const last = runtime.lastLoadedRef.current
      const isDirty = !!(activePath && last?.path === activePath && last.text !== runtime.activeTextRef.current)
      const changedPath = typeof detail?.path === 'string' && detail.path ? detail.path : null
      const operation = typeof detail?.op === 'string' ? detail.op : ''
      if (isDirty && (!changedPath || changedPath === activePath)) return
      if (operation === 'writeFileText' && activePath && changedPath && changedPath !== activePath) return
      scheduleMarkdownWorkspaceRefreshSync(() => {
        void refresh()
      }, {
        activePath,
        changedPath,
        operation,
        isDirty,
      })
    })
    return () => {
      cancelMarkdownWorkspaceRefreshSync()
      unsubscribe()
    }
  }, [args.active, refresh])

  const persistWorkspacePrefsPendingRef = React.useRef<{
    sidebarWidthPx: number
    explorerOpen: boolean
    sourceFilesCollapsed: boolean
    tocCollapsed: boolean
    backlinksCollapsed: boolean
    markdownWordWrap: boolean
    markdownTextHighlight: boolean
    folderModeContract: FolderModeContract
    layoutMode: MarkdownWorkspaceLayoutMode
    expandedPaths: string[]
  } | null>(null)

  React.useEffect(() => {
    persistWorkspacePrefsPendingRef.current = {
      sidebarWidthPx: args.sidebarWidthPx,
      explorerOpen: args.explorerOpen,
      sourceFilesCollapsed: args.sourceFilesCollapsed,
      tocCollapsed: args.tocCollapsed,
      backlinksCollapsed: args.backlinksCollapsed,
      markdownWordWrap: args.markdownWordWrap,
      markdownTextHighlight: args.markdownTextHighlight,
      folderModeContract: args.folderModeContract,
      layoutMode: args.layoutMode,
      expandedPaths: [...args.expandedPaths],
    }
    scheduleMarkdownWorkspacePrefsSync(() => {
      const pending = persistWorkspacePrefsPendingRef.current
      if (!pending) return
      lsSetInt(LS_KEYS.markdownSidebarWidthPx, pending.sidebarWidthPx, { min: SIDEBAR_MIN_PX, max: SIDEBAR_MAX_PX })
      lsSetBool(LS_KEYS.markdownSidebarOpen, pending.explorerOpen)
      lsSetBool(LS_KEYS.markdownExplorerSourceFilesCollapsed, pending.sourceFilesCollapsed)
      lsSetBool(LS_KEYS.markdownExplorerOutlineCollapsed, pending.tocCollapsed)
      lsSetBool(LS_KEYS.markdownExplorerBacklinksCollapsed, pending.backlinksCollapsed)
      lsSetBool(LS_KEYS.markdownWordWrap, pending.markdownWordWrap)
      lsSetBool(LS_KEYS.markdownTextHighlight, pending.markdownTextHighlight)
      lsSetJson<FolderModeContract>(LS_KEYS.markdownExplorerFolderModeContract, pending.folderModeContract)
      lsSetJson<MarkdownWorkspaceLayoutMode>(LS_KEYS.markdownLayoutMode, pending.layoutMode)
      lsSetJson(LS_KEYS.markdownExplorerSourceFilesExpandedPaths, pending.expandedPaths)
    }, {
      sidebarWidthPx: args.sidebarWidthPx,
      explorerOpen: args.explorerOpen,
      sourceFilesCollapsed: args.sourceFilesCollapsed,
      tocCollapsed: args.tocCollapsed,
      backlinksCollapsed: args.backlinksCollapsed,
      markdownWordWrap: args.markdownWordWrap,
      markdownTextHighlight: args.markdownTextHighlight,
      folderModeContract: args.folderModeContract as unknown as Record<string, unknown>,
      layoutMode: String(args.layoutMode || ''),
      expandedPaths: args.expandedPaths,
    })
    return () => {
      cancelMarkdownWorkspacePrefsSync()
    }
  }, [
    args.backlinksCollapsed,
    args.expandedPaths,
    args.explorerOpen,
    args.folderModeContract,
    args.layoutMode,
    args.markdownTextHighlight,
    args.markdownWordWrap,
    args.sidebarWidthPx,
    args.sourceFilesCollapsed,
    args.tocCollapsed,
  ])

  const sidebarWidthPxRef = React.useRef(args.sidebarWidthPx)
  React.useEffect(() => {
    sidebarWidthPxRef.current = args.sidebarWidthPx
  }, [args.sidebarWidthPx])

  const resizeHandleEl = args.resizeHandleEl
  const setSidebarWidthPx = args.setSidebarWidthPx
  React.useEffect(() => {
    const el = resizeHandleEl
    if (!el) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      const startX = ev.clientX
      const startWidth = sidebarWidthPxRef.current
      let pending = startWidth
      startPointerDrag({
        ev,
        cursor: 'col-resize',
        shouldStart: down => (down.button === undefined || down.button === 0),
        onMove: mv => {
          const dx = mv.clientX - startX
          const next = Math.max(SIDEBAR_MIN_PX, Math.min(SIDEBAR_MAX_PX, Math.round(startWidth + dx)))
          pending = next
          setSidebarWidthPx(next)
        },
        onEnd: () => setSidebarWidthPx(pending),
        onCancel: () => setSidebarWidthPx(pending),
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [resizeHandleEl, setSidebarWidthPx])

  const filteredEntries = React.useMemo(() => {
    const q = String(args.search || '').trim().toLowerCase()
    if (!q) return args.entries
    const searchText = q.length >= 3
    const keepPaths = new Set<string>()
    for (const entry of args.entries) {
      if (entry.kind !== 'file') continue
      const nameHit = String(entry.name || '').toLowerCase().includes(q)
      if (nameHit) {
        keepPaths.add(entry.path)
        continue
      }
      if (!searchText) continue
      const rawText = typeof entry.text === 'string' ? entry.text : ''
      if (!rawText || rawText.length > 250_000) continue
      if (rawText.toLowerCase().includes(q)) keepPaths.add(entry.path)
    }
    const result: WorkspaceEntry[] = []
    for (const entry of args.entries) {
      if (entry.kind === 'folder' || keepPaths.has(entry.path)) result.push(entry)
    }
    return result
  }, [args.entries, args.search])

  const resolveFolderContractDocPath = React.useCallback(
    (folderPath: WorkspacePath, mode: FolderModeContract): WorkspacePath => {
      const normalized = normalizeWorkspacePath(folderPath)
      const leaf = mode === 'user-journey' ? 'repo.user-journey.md' : 'repo.sitemap.md'
      return normalizeWorkspacePath(`${normalized.replace(/\/+$/, '')}/${leaf}`)
    },
    [],
  )

  const pickFolderContractTargetPath = React.useCallback(
    (folderPath: WorkspacePath, preferredMode: FolderModeContract): WorkspacePath | null => {
      const folder = normalizeWorkspacePath(folderPath)
      const preferred = resolveFolderContractDocPath(folder, preferredMode)
      if (args.entries.some(entry => entry.kind === 'file' && entry.path === preferred)) return preferred

      const alternateMode: FolderModeContract = preferredMode === 'sitemap' ? 'user-journey' : 'sitemap'
      const alternate = resolveFolderContractDocPath(folder, alternateMode)
      if (args.entries.some(entry => entry.kind === 'file' && entry.path === alternate)) return alternate

      const prefix = folder === '/' ? '/' : `${folder}/`
      const firstDescendantFile = args.entries.find(entry => entry.kind === 'file' && entry.path.startsWith(prefix)) || null
      return firstDescendantFile ? firstDescendantFile.path : null
    },
    [args.entries, resolveFolderContractDocPath],
  )

  return {
    getFs,
    refresh,
    filteredEntries,
    resolveFolderContractDocPath,
    pickFolderContractTargetPath,
  }
}
