import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { __canvasStartupDebug } from '@/features/canvas/canvasStartupDebug'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import {
  loadPersistedSourceFiles,
  loadPersistedSourceFilesWorkspace,
  persistSourceFiles,
  persistSourceFilesWorkspace,
  type SourceFilesWorkspaceState,
} from '@/features/source-files/sourceFilesDb'
import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { hydratePendingUrlSourceFiles, refreshPersistedSourceFilesForCurrentParseIdentity } from '@/features/source-files/sourceFilesIngestIntegration'
import { loadWorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { scheduleWorkspaceSyncTask, cancelWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_SOURCE_FILES_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_SOURCE_FILES_PERSIST,
  WORKSPACE_SYNC_TASK_SOURCE_FILES_WORKSPACE,
} from '@/lib/async/workspaceSyncKeys'
import {
  materializeActiveWorkspaceEntryIntoSourceFiles,
  resolveInitialWorkspaceStartupState,
} from '@/features/source-files/sourceFilesRuntimeShared'

const sourceFileTextHashCache = new WeakMap<object, string>()

const getSourceFileTextHash = (entry: unknown): string => {
  if (!entry || typeof entry !== 'object') return hashStringToHex('')
  const cached = sourceFileTextHashCache.get(entry as object)
  if (cached) return cached
  const item = entry as { text?: unknown }
  const next = hashStringToHex(String(item?.text || ''))
  sourceFileTextHashCache.set(entry as object, next)
  return next
}

const arraysEqualByIdAndHash = (a: unknown, b: unknown): boolean => {
  const aa = Array.isArray(a) ? a : []
  const bb = Array.isArray(b) ? b : []
  if (aa.length !== bb.length) return false
  for (let i = 0; i < aa.length; i += 1) {
    const x = aa[i] as { id?: unknown; parsedTextHash?: unknown; text?: unknown; enabled?: unknown }
    const y = bb[i] as { id?: unknown; parsedTextHash?: unknown; text?: unknown; enabled?: unknown }
    if (String(x?.id || '') !== String(y?.id || '')) return false
    if (String(x?.parsedTextHash || '') !== String(y?.parsedTextHash || '')) return false
    if (String(x?.enabled || '') !== String(y?.enabled || '')) return false
    const xTextHash = getSourceFileTextHash(x)
    const yTextHash = getSourceFileTextHash(y)
    if (xTextHash !== yTextHash) return false
  }
  return true
}

const sourceFilesSignature = (value: unknown): string => {
  const items = Array.isArray(value) ? value : []
  if (items.length < 1) return '[]'
  return items
    .map(entry => {
      const item = entry as { id?: unknown; parsedTextHash?: unknown; text?: unknown; enabled?: unknown }
      const id = String(item?.id || '')
      const parsedTextHash = String(item?.parsedTextHash || '')
      const enabled = String(item?.enabled || '')
      const textHash = getSourceFileTextHash(item)
      return `${id}:${parsedTextHash}:${enabled}:${textHash}`
    })
    .join('|')
}

function stripPersistedWorkspaceBackedSourceFiles(value: unknown) {
  const items = Array.isArray(value) ? value : []
  return items.filter(entry => {
    const sourcePath = String((entry as { source?: { path?: unknown } } | null)?.source?.path || '')
    return !sourcePath.startsWith('workspace:')
  })
}

export function SourceFilesPersistenceBootstrap() {
  const runtimePersistenceScopeKey = WORKSPACE_SYNC_SCOPE_SOURCE_FILES_RUNTIME_PERSISTENCE
  const hydratedRef = React.useRef(false)
  const lastPersistedRef = React.useRef<unknown>(null)
  const workspaceHydratedRef = React.useRef(false)
  const lastWorkspacePersistedRef = React.useRef<unknown>(null)
  const lastMaterializedActivePathRef = React.useRef('')
  React.useEffect(() => {
    __canvasStartupDebug.sourceBootstrapMounted = true
    return () => {
      __canvasStartupDebug.sourceBootstrapMounted = false
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [persistedRaw, persistedWorkspace] = await Promise.all([
          loadPersistedSourceFiles(),
          loadPersistedSourceFilesWorkspace(),
        ])
        const persisted = stripPersistedWorkspaceBackedSourceFiles(persistedRaw)
        if (cancelled) return
        const current = useGraphStore.getState().sourceFiles
        if (Array.isArray(current) && current.length > 0) {
          hydratedRef.current = true
          lastPersistedRef.current = current
        } else {
          if (persisted.length > 0) {
            useGraphStore.getState().setSourceFiles(persisted)
            lastPersistedRef.current = persisted
          }
          hydratedRef.current = true
        }

        try {
          __canvasStartupDebug.sourceBootstrapHydrateRuns += 1
          await refreshPersistedSourceFilesForCurrentParseIdentity()
          await hydratePendingUrlSourceFiles()
          __canvasStartupDebug.sourceBootstrapLastHydrateFinishedAtMs = Date.now()
        } catch {
          void 0
        }
        try {
          const startup = await resolveInitialWorkspaceStartupState()
          const startupSourcesByPath = loadWorkspaceSourceIndex()
          const store = useGraphStore.getState()
          const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
          const merged = mergeWorkspaceEntriesIntoSourceFiles({
            existing,
            workspaceEntries: startup.workspaceEntries,
            sourcesByPath: startupSourcesByPath,
            forceIncludePaths: startup.activePath ? [startup.activePath] : [],
          })
          if (merged !== existing) {
            store.setSourceFiles(merged)
          }
          await materializeActiveWorkspaceEntryIntoSourceFiles({
            activePathOverride: startup.activePath,
            workspaceEntries: startup.workspaceEntries.length > 0 ? startup.workspaceEntries : undefined,
            sourcesByPath: startupSourcesByPath,
            applyToGraph: true,
          })
          lastMaterializedActivePathRef.current = String(startup.activePath || '').trim()
        } catch {
          void 0
        }
        try {
          scheduleApplyComposedGraphFromSourceFiles()
        } catch {
          void 0
        }

        const store = useGraphStore.getState()
        const hasLiveFolderAccess = !!store.localMarkdownFolderHandle || !!store.localMarkdownFolderCacheId
        if (!hasLiveFolderAccess) {
          if (!store.localMarkdownFolderCacheId && persistedWorkspace.folderCacheId) {
            store.setLocalMarkdownFolderCacheId(persistedWorkspace.folderCacheId, persistedWorkspace.folderName)
          }
          if (!store.localMarkdownFolderName && persistedWorkspace.folderName) {
            store.setLocalMarkdownFolderCachedMetadata({
              name: persistedWorkspace.folderName,
              accessMode: persistedWorkspace.accessMode,
            })
          }
        }
        if (!store.localMarkdownSelectedFolderPath && persistedWorkspace.selectedFolderPath) {
          store.setLocalMarkdownSelectedFolderPath(persistedWorkspace.selectedFolderPath)
        }
        workspaceHydratedRef.current = true
        lastWorkspacePersistedRef.current = persistedWorkspace
      } catch {
        hydratedRef.current = true
        workspaceHydratedRef.current = true
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    const syncNow = () => {
      const activePath = String(useMarkdownExplorerStore.getState().activePath || '').trim()
      if (!activePath) {
        lastMaterializedActivePathRef.current = ''
        return
      }
      if (lastMaterializedActivePathRef.current === activePath) return
      lastMaterializedActivePathRef.current = activePath
      void materializeActiveWorkspaceEntryIntoSourceFiles({ applyToGraph: false }).catch(() => {
        if (lastMaterializedActivePathRef.current === activePath) {
          lastMaterializedActivePathRef.current = ''
        }
      })
    }
    const unsubscribeActivePath = useMarkdownExplorerStore.subscribe(s => s.activePath && syncNow())
    return () => {
      unsubscribeActivePath()
    }
  }, [])

  React.useEffect(() => {
    const taskKey = WORKSPACE_SYNC_TASK_SOURCE_FILES_PERSIST
    const unsubscribe = useGraphStore.subscribe(
      s => s.sourceFiles,
      next => {
        if (!hydratedRef.current) return
        if (arraysEqualByIdAndHash(next, lastPersistedRef.current)) return

        try {
          scheduleApplyComposedGraphFromSourceFiles()
        } catch {
          void 0
        }

        const signature = sourceFilesSignature(next)
        scheduleWorkspaceSyncTask(taskKey, () => {
          const snapshot = useGraphStore.getState().sourceFiles
          if (arraysEqualByIdAndHash(snapshot, lastPersistedRef.current)) return
          lastPersistedRef.current = snapshot
          void persistSourceFiles(snapshot)
        }, 600, { signature, scopeKey: runtimePersistenceScopeKey })
      },
      { equalityFn: arraysEqualByIdAndHash },
    )
    return () => {
      cancelWorkspaceSyncTask(taskKey)
      unsubscribe()
    }
  }, [runtimePersistenceScopeKey])

  const getWorkspaceSnapshot = React.useCallback((): SourceFilesWorkspaceState => {
    const s = useGraphStore.getState()
    return {
      folderName: s.localMarkdownFolderName,
      accessMode: s.localMarkdownFolderAccessMode,
      folderCacheId: s.localMarkdownFolderCacheId,
      selectedFolderPath: s.localMarkdownSelectedFolderPath,
    }
  }, [])

  React.useEffect(() => {
    const taskKey = WORKSPACE_SYNC_TASK_SOURCE_FILES_WORKSPACE
    const unsubscribe = useGraphStore.subscribe(
      s => [s.localMarkdownFolderName, s.localMarkdownFolderAccessMode, s.localMarkdownFolderCacheId, s.localMarkdownSelectedFolderPath],
      () => {
        if (!workspaceHydratedRef.current) return
        const snapshot = getWorkspaceSnapshot()
        const prev = lastWorkspacePersistedRef.current as SourceFilesWorkspaceState | null
        if (
          prev &&
          prev.folderName === snapshot.folderName &&
          prev.accessMode === snapshot.accessMode &&
          prev.folderCacheId === snapshot.folderCacheId &&
          prev.selectedFolderPath === snapshot.selectedFolderPath
        ) {
          return
        }
        const signature = hashStringToHex(
          [
            String(snapshot.folderName || ''),
            String(snapshot.accessMode || ''),
            String(snapshot.folderCacheId || ''),
            String(snapshot.selectedFolderPath || ''),
          ].join('|'),
        )
        scheduleWorkspaceSyncTask(taskKey, () => {
          const nextSnapshot = getWorkspaceSnapshot()
          const prevSnapshot = lastWorkspacePersistedRef.current as SourceFilesWorkspaceState | null
          if (
            prevSnapshot &&
            prevSnapshot.folderName === nextSnapshot.folderName &&
            prevSnapshot.accessMode === nextSnapshot.accessMode &&
            prevSnapshot.folderCacheId === nextSnapshot.folderCacheId &&
            prevSnapshot.selectedFolderPath === nextSnapshot.selectedFolderPath
          ) {
            return
          }
          lastWorkspacePersistedRef.current = nextSnapshot
          void persistSourceFilesWorkspace(nextSnapshot)
        }, 600, { signature, scopeKey: runtimePersistenceScopeKey })
      },
      {
        equalityFn: (a, b) => {
          const aa = Array.isArray(a) ? a : []
          const bb = Array.isArray(b) ? b : []
          return (
            String(aa[0] || '') === String(bb[0] || '') &&
            String(aa[1] || '') === String(bb[1] || '') &&
            String(aa[2] || '') === String(bb[2] || '') &&
            String(aa[3] || '') === String(bb[3] || '')
          )
        },
      },
    )
    return () => {
      cancelWorkspaceSyncTask(taskKey)
      unsubscribe()
    }
  }, [getWorkspaceSnapshot, runtimePersistenceScopeKey])

  return null
}
