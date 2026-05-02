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
import { scheduleWorkspaceSyncTask, cancelWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_SOURCE_FILES_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_SOURCE_FILES_PERSIST,
  WORKSPACE_SYNC_TASK_SOURCE_FILES_WORKSPACE,
} from '@/lib/async/workspaceSyncKeys'
import {
  buildMaterializedWorkspaceActivePathKey,
  materializeActiveWorkspaceEntryIntoSourceFiles,
  resolveMaterializedWorkspaceActivePath,
} from '@/features/source-files/sourceFilesRuntimeShared'
import {
  materializeBootstrapWorkspaceSourceFiles,
  restoreBootstrapPersistedSourceFiles,
  restoreBootstrapWorkspaceState,
  runBootstrapSourceFileHydration,
  scheduleBootstrapComposedGraphSync,
} from '@/features/source-files/sourceFilesBootstrapStartup'
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

const SOURCE_FILES_PERSIST_DELAY_MS = 600

function schedulePersistedSnapshotIfChanged<Snapshot>(args: {
  taskKey: string
  scopeKey: string
  signature: string
  lastPersistedRef: React.MutableRefObject<Snapshot | null>
  equalityFn: (left: Snapshot | null, right: Snapshot | null) => boolean
  readSnapshot: () => Snapshot
  persist: (snapshot: Snapshot) => Promise<void>
}): void {
  scheduleWorkspaceSyncTask(args.taskKey, () => {
    const nextSnapshot = args.readSnapshot()
    const prevSnapshot = args.lastPersistedRef.current
    if (args.equalityFn(prevSnapshot, nextSnapshot)) return
    args.lastPersistedRef.current = nextSnapshot
    void args.persist(nextSnapshot)
  }, SOURCE_FILES_PERSIST_DELAY_MS, { signature: args.signature, scopeKey: args.scopeKey })
}

function subscribeCoalescedStorePersistence<Snapshot>(args: {
  taskKey: string
  scopeKey: string
  hydratedRef: React.MutableRefObject<boolean>
  lastPersistedRef: React.MutableRefObject<Snapshot | null>
  selector: (state: ReturnType<typeof useGraphStore.getState>) => Snapshot
  equalityFn: (left: Snapshot | null, right: Snapshot | null) => boolean
  buildSignature: (snapshot: Snapshot) => string
  persist: (snapshot: Snapshot) => Promise<void>
  onSnapshot?: (snapshot: Snapshot) => void
}): () => void {
  return useGraphStore.subscribe(
    args.selector,
    snapshot => {
      if (!args.hydratedRef.current) return
      const prevSnapshot = args.lastPersistedRef.current
      if (args.equalityFn(prevSnapshot, snapshot)) return
      args.onSnapshot?.(snapshot)
      schedulePersistedSnapshotIfChanged({
        taskKey: args.taskKey,
        scopeKey: args.scopeKey,
        signature: args.buildSignature(snapshot),
        lastPersistedRef: args.lastPersistedRef,
        equalityFn: args.equalityFn,
        readSnapshot: () => args.selector(useGraphStore.getState()),
        persist: args.persist,
      })
    },
    { equalityFn: args.equalityFn },
  )
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
        lastPersistedRef.current = restoreBootstrapPersistedSourceFiles({
          persistedSourceFiles: persisted,
        })
        hydratedRef.current = true

        try {
          await runBootstrapSourceFileHydration()
        } catch {
          void 0
        }
        try {
          lastMaterializedActivePathRef.current = await materializeBootstrapWorkspaceSourceFiles()
        } catch {
          void 0
        }
        lastComposeSignatureRef.current = scheduleBootstrapComposedGraphSync()
        restoreBootstrapWorkspaceState(persistedWorkspace)
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
    const unsubscribe = subscribeCoalescedStorePersistence({
      taskKey,
      scopeKey: runtimePersistenceScopeKey,
      hydratedRef,
      lastPersistedRef: lastPersistedRef as React.MutableRefObject<unknown[] | null>,
      selector: s => s.sourceFiles,
      equalityFn: areSourceFilesEqualByIdAndHash,
      buildSignature: next => buildSourceFilesPersistenceSignature(next),
      persist: next => persistSourceFiles(next as never),
      onSnapshot: next => {
        const compositionSignature = buildSourceFilesCompositionSignature(next)
        if (compositionSignature !== lastComposeSignatureRef.current) {
          lastComposeSignatureRef.current = compositionSignature
          try {
            scheduleApplyComposedGraphFromSourceFiles()
          } catch {
            void 0
          }
        }
      },
    })
    return () => {
      cancelWorkspaceSyncTask(taskKey)
      unsubscribe()
    }
  }, [runtimePersistenceScopeKey])

  React.useEffect(() => {
    const taskKey = WORKSPACE_SYNC_TASK_SOURCE_FILES_WORKSPACE
    const unsubscribe = subscribeCoalescedStorePersistence({
      taskKey,
      scopeKey: runtimePersistenceScopeKey,
      hydratedRef: workspaceHydratedRef,
      lastPersistedRef: lastWorkspacePersistedRef as React.MutableRefObject<SourceFilesWorkspaceState | null>,
      selector: s =>
        normalizeSourceFilesWorkspaceState({
          folderName: s.localMarkdownFolderName,
          accessMode: s.localMarkdownFolderAccessMode,
          folderCacheId: s.localMarkdownFolderCacheId,
          selectedFolderPath: s.localMarkdownSelectedFolderPath,
        }),
      equalityFn: areSourceFilesWorkspaceStatesEqual,
      buildSignature: snapshot => buildSourceFilesWorkspaceStateSignature(snapshot),
      persist: nextSnapshot => persistSourceFilesWorkspace(nextSnapshot),
    })
    return () => {
      cancelWorkspaceSyncTask(taskKey)
      unsubscribe()
    }
  }, [runtimePersistenceScopeKey])

  return null
}
