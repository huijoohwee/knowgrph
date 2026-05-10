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
  WORKSPACE_SYNC_SCOPE_KNOWGRPH_STORAGE_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_KNOWGRPH_STORAGE_QUEUE,
  WORKSPACE_SYNC_TASK_SOURCE_FILES_PERSIST,
  WORKSPACE_SYNC_TASK_SOURCE_FILES_WORKSPACE,
} from '@/lib/async/workspaceSyncKeys'
import {
  buildMaterializedWorkspaceActivePathKey,
  buildMaterializedWorkspaceForceIncludePaths,
  hydrateWorkspaceEntriesInlineText,
  materializeActiveWorkspaceEntryIntoSourceFiles,
  readReusableWorkspaceEntriesSnapshot,
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
import {
  buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState,
  syncSourceFilesToKnowgrphStorage,
} from '@/features/source-files/sourceFilesStorageSync'
import { applyPulledKnowgrphStorageChangesToSourceFiles } from '@/features/source-files/sourceFilesInboundStorageApply'
import {
  cancelKnowgrphStorageSync,
  scheduleKnowgrphStorageSync,
  startKnowgrphStorageSyncLoop,
} from '@/lib/storage/knowgrphStorageClientSync'
import { notifyKnowgrphStorageConflictUx } from '@/lib/storage/knowgrphStorageConflictUx'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { subscribeWorkspaceFsChanged } from '@/features/workspace-fs/workspaceFsEvents'
import { readEnvString } from '@/lib/config.env'
import { resolveWorkspaceSourceIndexSnapshot } from '@/features/workspace-fs/sourceIndex'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import { buildWorkspaceEntriesSemanticKey } from '@/features/workspace-fs/workspaceEntriesSemanticKey'
import {
  readWorkspaceSeedSyncEnabledSetting,
  readWorkspaceSeedSyncIdleMaxMsSetting,
  readWorkspaceSeedSyncPollMsSetting,
  readWorkspaceSourceFilesDocsOnlySetting,
  readWorkspaceSourceFilesSyncDebounceMsSetting,
  subscribeWorkspaceStoreSyncSettingsChanged,
} from '@/lib/workspace/workspaceStoreSyncSettings'
import { computeWorkspaceSeedSyncNextDelayMs } from '@/lib/workspace/workspaceSeedSyncBackoff'

const SOURCE_FILES_PERSIST_DELAY_MS = 600
const KNOWGRPH_STORAGE_BASE_URL = (() => {
  const raw = String(readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', '') || '').trim()
  return raw || null
})()
const markWorkspaceSeedSyncDebug = (source: string): void => {
  __canvasStartupDebug.workspaceSeedLastSyncAtMs = Date.now()
  __canvasStartupDebug.workspaceSeedLastSyncSource = String(source || '').trim()
}

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

const readCurrentSourceFilesWorkspaceState = (): SourceFilesWorkspaceState =>
  normalizeSourceFilesWorkspaceState({
    folderName: useGraphStore.getState().localMarkdownFolderName,
    accessMode: useGraphStore.getState().localMarkdownFolderAccessMode,
    folderCacheId: useGraphStore.getState().localMarkdownFolderCacheId,
    selectedFolderPath: useGraphStore.getState().localMarkdownSelectedFolderPath,
  })

export function SourceFilesPersistenceBootstrap() {
  const runtimePersistenceScopeKey = WORKSPACE_SYNC_SCOPE_SOURCE_FILES_RUNTIME_PERSISTENCE
  const knowgrphStorageScopeKey = WORKSPACE_SYNC_SCOPE_KNOWGRPH_STORAGE_RUNTIME_PERSISTENCE
  const hydratedRef = React.useRef(false)
  const lastPersistedRef = React.useRef<unknown>(null)
  const lastComposeSignatureRef = React.useRef('')
  const workspaceHydratedRef = React.useRef(false)
  const lastWorkspacePersistedRef = React.useRef<unknown>(null)
  const lastMaterializedActivePathRef = React.useRef('')
  const lastQueuedKnowgrphStorageSignatureRef = React.useRef('')
  const lastQueuedKnowgrphStorageSourceFilesRef = React.useRef<ReturnType<typeof useGraphStore.getState>['sourceFiles']>([])
  const activeKnowgrphWorkspaceIdRef = React.useRef('')
  const knowgrphStorageLoopCleanupRef = React.useRef<(() => void) | null>(null)
  const workspaceMaterializeInFlightRef = React.useRef(false)
  const workspaceMaterializeQueuedRef = React.useRef(false)
  const workspaceMaterializeTimerRef = React.useRef<number | null>(null)
  const lastWorkspaceEntriesSignatureRef = React.useRef('')
  const [workspaceSyncSettingsRev, setWorkspaceSyncSettingsRev] = React.useState(0)

  React.useEffect(() => {
    return subscribeWorkspaceStoreSyncSettingsChanged(() => {
      setWorkspaceSyncSettingsRev(prev => prev + 1)
    })
  }, [])

  const [workspaceSeedSyncEnabled, setWorkspaceSeedSyncEnabled] = React.useState(() => readWorkspaceSeedSyncEnabledSetting())
  const [workspaceSeedSyncPollMs, setWorkspaceSeedSyncPollMs] = React.useState(() => readWorkspaceSeedSyncPollMsSetting())
  const [workspaceSeedSyncIdleMaxMs, setWorkspaceSeedSyncIdleMaxMs] = React.useState(() => readWorkspaceSeedSyncIdleMaxMsSetting())
  const [workspaceSourceFilesDocsOnly, setWorkspaceSourceFilesDocsOnly] = React.useState(() => readWorkspaceSourceFilesDocsOnlySetting())
  const [workspaceSourceFilesSyncDebounceMs, setWorkspaceSourceFilesSyncDebounceMs] = React.useState(() => readWorkspaceSourceFilesSyncDebounceMsSetting())

  React.useEffect(() => {
    setWorkspaceSeedSyncEnabled(readWorkspaceSeedSyncEnabledSetting())
    setWorkspaceSeedSyncPollMs(readWorkspaceSeedSyncPollMsSetting())
    setWorkspaceSeedSyncIdleMaxMs(readWorkspaceSeedSyncIdleMaxMsSetting())
    setWorkspaceSourceFilesDocsOnly(readWorkspaceSourceFilesDocsOnlySetting())
    setWorkspaceSourceFilesSyncDebounceMs(readWorkspaceSourceFilesSyncDebounceMsSetting())
  }, [workspaceSyncSettingsRev])

  const scheduleKnowgrphStorageQueueSync = React.useCallback((sourceFiles?: ReturnType<typeof useGraphStore.getState>['sourceFiles']) => {
    const workspaceId =
      activeKnowgrphWorkspaceIdRef.current ||
      buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState(readCurrentSourceFilesWorkspaceState())
    if (!workspaceId) return
    const taskKey = WORKSPACE_SYNC_TASK_KNOWGRPH_STORAGE_QUEUE
    const nextSourceFiles = Array.isArray(sourceFiles) ? sourceFiles : useGraphStore.getState().sourceFiles
    const signature = `${workspaceId}:${buildSourceFilesPersistenceSignature(nextSourceFiles)}`
    scheduleWorkspaceSyncTask(
      taskKey,
      () => {
        const latestWorkspaceId =
          activeKnowgrphWorkspaceIdRef.current ||
          buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState(readCurrentSourceFilesWorkspaceState())
        const latestSourceFiles = useGraphStore.getState().sourceFiles
        const latestSignature = `${latestWorkspaceId}:${buildSourceFilesPersistenceSignature(latestSourceFiles)}`
        if (lastQueuedKnowgrphStorageSignatureRef.current === latestSignature) return
        void syncSourceFilesToKnowgrphStorage({
          workspaceId: latestWorkspaceId,
          sourceFiles: latestSourceFiles,
          previousSourceFiles: lastQueuedKnowgrphStorageSourceFilesRef.current,
        })
          .then(result => {
            lastQueuedKnowgrphStorageSignatureRef.current = latestSignature
            lastQueuedKnowgrphStorageSourceFilesRef.current = latestSourceFiles
            if (result.queuedMutationCount > 0) {
              scheduleKnowgrphStorageSync({
                workspaceId: latestWorkspaceId,
                delayMs: 0,
                signature: `${latestSignature}:${result.queuedMutationCount}`,
                onSyncCompleted: syncResult => {
                  if (activeKnowgrphWorkspaceIdRef.current !== syncResult.workspaceId) return
                  notifyKnowgrphStorageConflictUx(syncResult)
                },
              })
            }
          })
          .catch(() => {
            if (lastQueuedKnowgrphStorageSignatureRef.current === latestSignature) {
              lastQueuedKnowgrphStorageSignatureRef.current = ''
            }
          })
      },
      SOURCE_FILES_PERSIST_DELAY_MS,
      { signature, scopeKey: knowgrphStorageScopeKey },
    )
  }, [knowgrphStorageScopeKey])
  React.useEffect(() => {
    __canvasStartupDebug.sourceBootstrapMounted = true
    return () => {
      __canvasStartupDebug.sourceBootstrapMounted = false
    }
  }, [])

  React.useEffect(() => {
    if (!workspaceSeedSyncEnabled) return
    let cancelled = false
    let timer: ReturnType<typeof window.setTimeout> | null = null
    let idleStreak = 0
    const ensureSeed = async (source: string) => {
      if (cancelled) return
      try {
        const fs = await getWorkspaceFs()
        const changed = await fs.ensureSeed()
        if (changed) markWorkspaceSeedSyncDebug(source)
        const next = computeWorkspaceSeedSyncNextDelayMs({
          basePollMs: workspaceSeedSyncPollMs,
          idleMaxMs: workspaceSeedSyncIdleMaxMs,
          docsOnly: workspaceSourceFilesDocsOnly,
          changed,
          idleStreak,
        })
        idleStreak = next.nextIdleStreak
        if (!cancelled) {
          timer = window.setTimeout(() => {
            timer = null
            void ensureSeed('bootstrap:poll')
          }, next.nextDelayMs)
        }
      } catch {
        const next = computeWorkspaceSeedSyncNextDelayMs({
          basePollMs: workspaceSeedSyncPollMs,
          idleMaxMs: workspaceSeedSyncIdleMaxMs,
          docsOnly: workspaceSourceFilesDocsOnly,
          changed: false,
          idleStreak,
        })
        idleStreak = next.nextIdleStreak
        if (!cancelled) {
          timer = window.setTimeout(() => {
            timer = null
            void ensureSeed('bootstrap:poll')
          }, next.nextDelayMs)
        }
      }
    }
    const onWake = () => {
      if (document.visibilityState === 'hidden') return
      idleStreak = 0
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
      void ensureSeed('bootstrap:wake')
    }
    void ensureSeed('bootstrap:mount')
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [workspaceSeedSyncEnabled, workspaceSeedSyncPollMs, workspaceSeedSyncIdleMaxMs, workspaceSourceFilesDocsOnly])

  React.useEffect(() => {
    const startForWorkspaceState = (workspaceState: SourceFilesWorkspaceState) => {
      const nextWorkspaceId = buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState(workspaceState)
      if (!nextWorkspaceId) return
      if (activeKnowgrphWorkspaceIdRef.current === nextWorkspaceId) return
      if (activeKnowgrphWorkspaceIdRef.current) {
        cancelKnowgrphStorageSync(activeKnowgrphWorkspaceIdRef.current)
      }
      if (knowgrphStorageLoopCleanupRef.current) {
        knowgrphStorageLoopCleanupRef.current()
        knowgrphStorageLoopCleanupRef.current = null
      }
      activeKnowgrphWorkspaceIdRef.current = nextWorkspaceId
      lastQueuedKnowgrphStorageSignatureRef.current = ''
      lastQueuedKnowgrphStorageSourceFilesRef.current = []
      knowgrphStorageLoopCleanupRef.current = startKnowgrphStorageSyncLoop({
        workspaceId: nextWorkspaceId,
        baseUrl: KNOWGRPH_STORAGE_BASE_URL,
        initialDelayMs: 0,
        onSyncCompleted: result => {
          if (activeKnowgrphWorkspaceIdRef.current !== result.workspaceId) return
          notifyKnowgrphStorageConflictUx(result)
        },
        onPulledChangesApplied: ({ workspaceId, changes }) => {
          if (activeKnowgrphWorkspaceIdRef.current !== workspaceId) return
          const result = applyPulledKnowgrphStorageChangesToSourceFiles({ workspaceId, changes })
          if (!result.applied) return
          const nextSourceFiles = useGraphStore.getState().sourceFiles
          lastQueuedKnowgrphStorageSourceFilesRef.current = nextSourceFiles
          lastQueuedKnowgrphStorageSignatureRef.current = `${workspaceId}:${buildSourceFilesPersistenceSignature(nextSourceFiles)}`
        },
      })
      scheduleKnowgrphStorageQueueSync(useGraphStore.getState().sourceFiles)
    }
    startForWorkspaceState(readCurrentSourceFilesWorkspaceState())
    const unsubscribe = useGraphStore.subscribe(
      s =>
        normalizeSourceFilesWorkspaceState({
          folderName: s.localMarkdownFolderName,
          accessMode: s.localMarkdownFolderAccessMode,
          folderCacheId: s.localMarkdownFolderCacheId,
          selectedFolderPath: s.localMarkdownSelectedFolderPath,
        }),
      snapshot => {
        startForWorkspaceState(snapshot)
      },
      { equalityFn: areSourceFilesWorkspaceStatesEqual },
    )
    return () => {
      unsubscribe()
      cancelWorkspaceSyncTask(WORKSPACE_SYNC_TASK_KNOWGRPH_STORAGE_QUEUE)
      if (knowgrphStorageLoopCleanupRef.current) {
        knowgrphStorageLoopCleanupRef.current()
        knowgrphStorageLoopCleanupRef.current = null
      }
      if (activeKnowgrphWorkspaceIdRef.current) {
        cancelKnowgrphStorageSync(activeKnowgrphWorkspaceIdRef.current)
      }
      activeKnowgrphWorkspaceIdRef.current = ''
      lastQueuedKnowgrphStorageSignatureRef.current = ''
      lastQueuedKnowgrphStorageSourceFilesRef.current = []
    }
  }, [scheduleKnowgrphStorageQueueSync])

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
    const rematerializeWorkspaceBackedSourceFiles = async () => {
      if (!workspaceHydratedRef.current) return
      if (workspaceMaterializeInFlightRef.current) {
        workspaceMaterializeQueuedRef.current = true
        return
      }
      workspaceMaterializeInFlightRef.current = true
      try {
        do {
          workspaceMaterializeQueuedRef.current = false
          const fs = await getWorkspaceFs()
          const workspaceEntries = await fs.listEntries()
          const hydratedWorkspaceEntries = await hydrateWorkspaceEntriesInlineText({
            fs,
            workspaceEntries,
          })
          const signature = buildWorkspaceEntriesSemanticKey({
            entries: hydratedWorkspaceEntries,
            docsOnly: workspaceSourceFilesDocsOnly,
          })
          if (signature === lastWorkspaceEntriesSignatureRef.current) continue
          lastWorkspaceEntriesSignatureRef.current = signature
          const sourcesByPath = resolveWorkspaceSourceIndexSnapshot(undefined)
          const activePath = resolveMaterializedWorkspaceActivePath({
            explorerActivePath: useMarkdownExplorerStore.getState().activePath,
          })
          const store = useGraphStore.getState()
          const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
          const merged = mergeWorkspaceEntriesIntoSourceFiles({
            existing,
            workspaceEntries: hydratedWorkspaceEntries,
            sourcesByPath,
            forceIncludePaths: buildMaterializedWorkspaceForceIncludePaths({
              activePathOverride: activePath,
            }),
            workspaceDocsOnly: workspaceSourceFilesDocsOnly,
          })
          if (merged !== existing) {
            store.setSourceFiles(merged)
          }
          await materializeActiveWorkspaceEntryIntoSourceFiles({
            activePathOverride: activePath,
            fs,
            workspaceEntries: readReusableWorkspaceEntriesSnapshot(hydratedWorkspaceEntries),
            sourcesByPath,
          })
        } while (workspaceMaterializeQueuedRef.current)
      } catch {
        void 0
      } finally {
        workspaceMaterializeInFlightRef.current = false
      }
    }
    const scheduleRematerialize = () => {
      if (workspaceMaterializeTimerRef.current != null) {
        window.clearTimeout(workspaceMaterializeTimerRef.current)
        workspaceMaterializeTimerRef.current = null
      }
      const delayMs = Math.max(0, Number(workspaceSourceFilesSyncDebounceMs || 0))
      if (delayMs === 0) {
        void rematerializeWorkspaceBackedSourceFiles()
        return
      }
      workspaceMaterializeTimerRef.current = window.setTimeout(() => {
        workspaceMaterializeTimerRef.current = null
        void rematerializeWorkspaceBackedSourceFiles()
      }, delayMs)
    }
    lastWorkspaceEntriesSignatureRef.current = ''
    scheduleRematerialize()
    const unsubscribe = subscribeWorkspaceFsChanged(detail => {
      const op = String(detail?.op || '')
      if (!op) return
      if (op !== 'ensureSeed' && op !== 'batch' && op !== 'writeFileText' && op !== 'createFile' && op !== 'deleteEntry') return
      const changedPath = String(detail?.path || '').trim()
      const activePath = resolveMaterializedWorkspaceActivePath({
        explorerActivePath: useMarkdownExplorerStore.getState().activePath,
      })
      if (op === 'writeFileText' && !!changedPath && !!activePath && changedPath === activePath) return
      if (workspaceSourceFilesDocsOnly) {
        const hasPath = !!changedPath
        const isDocsPath = hasPath && changedPath.startsWith('/docs/')
        if (hasPath && !isDocsPath) return
      }
      markWorkspaceSeedSyncDebug(`workspace-fs:${op}`)
      scheduleRematerialize()
    })
    return () => {
      if (workspaceMaterializeTimerRef.current != null) {
        window.clearTimeout(workspaceMaterializeTimerRef.current)
        workspaceMaterializeTimerRef.current = null
      }
      unsubscribe()
    }
  }, [workspaceSourceFilesDocsOnly, workspaceSourceFilesSyncDebounceMs])

  React.useEffect(() => {
    const syncNow = (activePathSnapshot?: string | null) => {
      if (!workspaceHydratedRef.current) return
      const activePath = resolveMaterializedWorkspaceActivePath({
        activePathOverride: activePathSnapshot ?? null,
        explorerActivePath: activePathSnapshot == null ? useMarkdownExplorerStore.getState().activePath : null,
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
      void materializeActiveWorkspaceEntryIntoSourceFiles().catch(() => {
        if (lastMaterializedActivePathRef.current === activePathKey) {
          lastMaterializedActivePathRef.current = ''
        }
      })
    }
    const unsubscribeActivePath = useMarkdownExplorerStore.subscribe(
      s => s.activePath,
      activePath => {
        syncNow(activePath)
      },
      { equalityFn: Object.is },
    )
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
        scheduleKnowgrphStorageQueueSync(next as never)
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
  }, [runtimePersistenceScopeKey, scheduleKnowgrphStorageQueueSync])

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
