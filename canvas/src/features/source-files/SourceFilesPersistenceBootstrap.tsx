import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { __canvasStartupDebug } from '@/features/canvas/canvasStartupDebug'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import {
  loadPersistedSourceFiles,
  loadPersistedSourceFilesWorkspace,
  persistSourceFiles,
  persistSourceFilesWorkspace,
} from '@/features/source-files/sourceFilesDb'
import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { hydratePendingUrlSourceFiles, refreshPersistedSourceFilesForCurrentParseIdentity } from '@/features/source-files/sourceFilesIngestIntegration'
import { loadWorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import { scheduleWorkspaceSyncTask, cancelWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_SOURCE_FILES_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_SOURCE_FILES_PERSIST,
  WORKSPACE_SYNC_TASK_SOURCE_FILES_WORKSPACE,
} from '@/lib/async/workspaceSyncKeys'
import {
  buildMaterializedWorkspaceActivePathKey,
  buildMaterializedWorkspaceForceIncludePaths,
  materializeActiveWorkspaceEntryIntoSourceFiles,
  readReusableWorkspaceEntriesSnapshot,
  resolveMaterializedWorkspaceActivePath,
  resolveInitialWorkspaceStartupState,
} from '@/features/source-files/sourceFilesRuntimeShared'
import {
  areSourceFilesEqualByIdAndHash,
  buildSourceFilesCompositionSignature,
  buildSourceFilesPersistenceSignature,
} from '@/features/source-files/sourceFilesSignatures'
import {
  areSourceFilesWorkspaceStatesEqual,
  buildSourceFilesWorkspaceStateSignature,
  normalizeSourceFilesWorkspaceState,
  type SourceFilesWorkspaceState,
} from '@/features/source-files/sourceFilesWorkspaceState'

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
  const lastComposeSignatureRef = React.useRef('')
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
          const startupActivePath = resolveMaterializedWorkspaceActivePath({
            activePathOverride: startup.activePath,
          })
          const startupSourcesByPath = loadWorkspaceSourceIndex()
          const store = useGraphStore.getState()
          const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
          const merged = mergeWorkspaceEntriesIntoSourceFiles({
            existing,
            workspaceEntries: startup.workspaceEntries,
            sourcesByPath: startupSourcesByPath,
            forceIncludePaths: buildMaterializedWorkspaceForceIncludePaths({
              activePathOverride: startupActivePath,
            }),
          })
          if (merged !== existing) {
            store.setSourceFiles(merged)
          }
          await materializeActiveWorkspaceEntryIntoSourceFiles({
            activePathOverride: startupActivePath,
            workspaceEntries: readReusableWorkspaceEntriesSnapshot(startup.workspaceEntries),
            sourcesByPath: startupSourcesByPath,
            applyToGraph: true,
          })
          lastMaterializedActivePathRef.current = buildMaterializedWorkspaceActivePathKey({
            activePathOverride: startupActivePath,
          })
        } catch {
          void 0
        }
        lastComposeSignatureRef.current = buildSourceFilesCompositionSignature(useGraphStore.getState().sourceFiles)
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
      const activePath = resolveMaterializedWorkspaceActivePath({
        explorerActivePath: useMarkdownExplorerStore.getState().activePath,
      })
      if (!activePath) {
        lastMaterializedActivePathRef.current = ''
        return
      }
      const activePathKey = buildMaterializedWorkspaceActivePathKey({
        activePathOverride: activePath,
      })
      if (lastMaterializedActivePathRef.current === activePathKey) return
      lastMaterializedActivePathRef.current = activePathKey
      void materializeActiveWorkspaceEntryIntoSourceFiles({ applyToGraph: false }).catch(() => {
        if (lastMaterializedActivePathRef.current === activePathKey) {
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
        if (areSourceFilesEqualByIdAndHash(next, lastPersistedRef.current)) return

        const compositionSignature = buildSourceFilesCompositionSignature(next)
        if (compositionSignature !== lastComposeSignatureRef.current) {
          lastComposeSignatureRef.current = compositionSignature
          try {
            scheduleApplyComposedGraphFromSourceFiles()
          } catch {
            void 0
          }
        }

        const signature = buildSourceFilesPersistenceSignature(next)
        scheduleWorkspaceSyncTask(taskKey, () => {
          const snapshot = useGraphStore.getState().sourceFiles
          if (areSourceFilesEqualByIdAndHash(snapshot, lastPersistedRef.current)) return
          lastPersistedRef.current = snapshot
          void persistSourceFiles(snapshot)
        }, 600, { signature, scopeKey: runtimePersistenceScopeKey })
      },
      { equalityFn: areSourceFilesEqualByIdAndHash },
    )
    return () => {
      cancelWorkspaceSyncTask(taskKey)
      unsubscribe()
    }
  }, [runtimePersistenceScopeKey])

  const getWorkspaceSnapshot = React.useCallback((): SourceFilesWorkspaceState => {
    const s = useGraphStore.getState()
    return normalizeSourceFilesWorkspaceState({
      folderName: s.localMarkdownFolderName,
      accessMode: s.localMarkdownFolderAccessMode,
      folderCacheId: s.localMarkdownFolderCacheId,
      selectedFolderPath: s.localMarkdownSelectedFolderPath,
    })
  }, [])

  React.useEffect(() => {
    const taskKey = WORKSPACE_SYNC_TASK_SOURCE_FILES_WORKSPACE
    const unsubscribe = useGraphStore.subscribe(
      s =>
        normalizeSourceFilesWorkspaceState({
          folderName: s.localMarkdownFolderName,
          accessMode: s.localMarkdownFolderAccessMode,
          folderCacheId: s.localMarkdownFolderCacheId,
          selectedFolderPath: s.localMarkdownSelectedFolderPath,
        }),
      snapshot => {
        if (!workspaceHydratedRef.current) return
        const prev = lastWorkspacePersistedRef.current as SourceFilesWorkspaceState | null
        if (prev && areSourceFilesWorkspaceStatesEqual(prev, snapshot)) {
          return
        }
        const signature = buildSourceFilesWorkspaceStateSignature(snapshot)
        scheduleWorkspaceSyncTask(taskKey, () => {
          const nextSnapshot = getWorkspaceSnapshot()
          const prevSnapshot = lastWorkspacePersistedRef.current as SourceFilesWorkspaceState | null
          if (prevSnapshot && areSourceFilesWorkspaceStatesEqual(prevSnapshot, nextSnapshot)) {
            return
          }
          lastWorkspacePersistedRef.current = nextSnapshot
          void persistSourceFilesWorkspace(nextSnapshot)
        }, 600, { signature, scopeKey: runtimePersistenceScopeKey })
      },
      {
        equalityFn: areSourceFilesWorkspaceStatesEqual,
      },
    )
    return () => {
      cancelWorkspaceSyncTask(taskKey)
      unsubscribe()
    }
  }, [getWorkspaceSnapshot, runtimePersistenceScopeKey])

  return null
}
