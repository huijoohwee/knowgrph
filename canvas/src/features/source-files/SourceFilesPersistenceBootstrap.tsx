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
  buildActiveWorkspaceRuntimeSourceFilesSnapshot,
  buildMaterializedWorkspaceActivePathKey,
  buildMaterializedWorkspaceForceIncludePaths,
  hydrateWorkspaceEntriesInlineText,
  materializeActiveWorkspaceEntryIntoSourceFiles,
  readReusableWorkspaceEntriesSnapshot,
  readWorkspaceActiveEntrySnapshot,
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
  buildSourceFilesStorageSyncSignature,
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
import { resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import { buildWorkspaceEntriesSemanticKey } from '@/features/workspace-fs/workspaceEntriesSemanticKey'
import { invalidateCachedWorkspaceActiveEntrySnapshot } from '@/features/source-files/workspaceActiveEntryCache'
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
const ACTIVE_PATH_SWITCH_COMPOSE_SUPPRESS_MS = 800
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

const hasEnabledNonWorkspaceSourceFile = (sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']): boolean => {
  const list = Array.isArray(sourceFiles) ? sourceFiles : []
  return list.some(file => {
    if (!file?.enabled) return false
    const sourcePath = String(file.source?.path || '')
    return !sourcePath.startsWith('workspace:')
  })
}

const hasNonWorkspaceSourceFile = (sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']): boolean => {
  const list = Array.isArray(sourceFiles) ? sourceFiles : []
  return list.some(file => {
    if (!file) return false
    const sourcePath = String(file.source?.path || '')
    return !sourcePath.startsWith('workspace:')
  })
}

const hasWorkspaceSourceFile = (sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']): boolean => {
  const list = Array.isArray(sourceFiles) ? sourceFiles : []
  return list.some(file => {
    if (!file) return false
    const sourcePath = String(file.source?.path || '')
    return sourcePath.startsWith('workspace:')
  })
}

const pruneWorkspaceSourceFilesToActive = (args: {
  sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  activePath: string | null
}): ReturnType<typeof useGraphStore.getState>['sourceFiles'] => {
  const list = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  const activeSourcePath = args.activePath ? resolveWorkspaceSourcePathKey(args.activePath) : ''
  return list.filter(file => {
    if (!file) return false
    const sourcePath = String(file.source?.path || '')
    if (!sourcePath.startsWith('workspace:')) return true
    return !!activeSourcePath && sourcePath === activeSourcePath
  })
}

type ActivePathMaterializationRequest = {
  activePath: string
  activePathKey: string
  sourceFilesSnapshot: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  workspaceEntriesSnapshot: ReturnType<typeof readReusableWorkspaceEntriesSnapshot>
}

type WorkspaceFsMutationRequest = {
  op: string
  changedPath: string
  sourceFilesSnapshot: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  activePathRequest: ActivePathMaterializationRequest | null
}

type WorkspaceRematerializeRequest = {
  sourceFilesSnapshot: ReturnType<typeof useGraphStore.getState>['sourceFiles']
}

type BootstrapMountRequest = {
  persistedWorkspace: SourceFilesWorkspaceState
  bootstrapMaterialization: Awaited<ReturnType<typeof materializeBootstrapWorkspaceSourceFiles>> | null
  initialRematerializeRequest: WorkspaceRematerializeRequest | null
  initialActivePathRequest: ActivePathMaterializationRequest | null
}

type WorkspaceSeedSyncRequest = {
  source: string
}

type KnowgrphStorageQueueRequest = {
  workspaceId: string
  sourceFilesSnapshot: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  signature: string
}

type KnowgrphStorageWorkspaceRequest = {
  workspaceId: string
  workspaceState: SourceFilesWorkspaceState
  sourceFilesSnapshot: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  initialQueueRequest: KnowgrphStorageQueueRequest | null
}

type KnowgrphStorageWorkspaceSelection = {
  workspaceState: SourceFilesWorkspaceState
  sourceFilesSnapshot: ReturnType<typeof useGraphStore.getState>['sourceFiles']
}

type SourceFilesPersistenceEffectRequest = {
  sourceFilesSnapshot: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  knowgrphStorageQueueRequest: KnowgrphStorageQueueRequest | null
  shouldScheduleCompose: boolean
  compositionSignature: string
}

type ActivePathMaterializationSelection = {
  activePathSnapshot: string | null
  sourceFilesSnapshot: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  workspaceEntriesSnapshot: ReturnType<typeof readReusableWorkspaceEntriesSnapshot>
}

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
  const latestSourceFilesSnapshotRef = React.useRef<ReturnType<typeof useGraphStore.getState>['sourceFiles']>([])
  const pendingKnowgrphStorageQueueRequestRef = React.useRef<KnowgrphStorageQueueRequest | null>(null)
  const activeKnowgrphWorkspaceIdRef = React.useRef('')
  const knowgrphStorageLoopCleanupRef = React.useRef<(() => void) | null>(null)
  const knowgrphInboundApplyInFlightRef = React.useRef(false)
  const workspaceMaterializeInFlightRef = React.useRef(false)
  const workspaceMaterializeQueuedRef = React.useRef(false)
  const workspaceMaterializeTimerRef = React.useRef<number | null>(null)
  const pendingWorkspaceRematerializeRequestRef = React.useRef<WorkspaceRematerializeRequest | null>(null)
  const scheduleWorkspaceRematerializeRef = React.useRef<((sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']) => void) | null>(null)
  const activePathMaterializeInFlightRef = React.useRef(false)
  const queuedActivePathMaterializeRef = React.useRef<ActivePathMaterializationRequest | null>(null)
  const pendingEnsureSeedMutationRequestRef = React.useRef<WorkspaceFsMutationRequest | null>(null)
  const suppressComposeUntilMsRef = React.useRef(0)
  const lastWorkspaceEntriesSignatureRef = React.useRef('')
  const reusableWorkspaceFsRef = React.useRef<Awaited<ReturnType<typeof getWorkspaceFs>> | null>(null)
  const reusableWorkspaceEntriesRef = React.useRef<ReturnType<typeof readReusableWorkspaceEntriesSnapshot>>(undefined)
  const reusableWorkspaceSourcesByPathRef = React.useRef<ReturnType<typeof resolveWorkspaceSourceIndexSnapshot> | null>(null)
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

  const readReusableWorkspaceSourceIndexSnapshot = React.useCallback(() => {
    const cached = reusableWorkspaceSourcesByPathRef.current
    if (cached) return cached
    const snapshot = resolveWorkspaceSourceIndexSnapshot(undefined)
    reusableWorkspaceSourcesByPathRef.current = snapshot
    return snapshot
  }, [])

  const readReusableWorkspaceFs = React.useCallback(async () => {
    const cached = reusableWorkspaceFsRef.current
    if (cached) return cached
    const fs = await getWorkspaceFs()
    reusableWorkspaceFsRef.current = fs
    return fs
  }, [])

  const readCurrentSourceFilesSnapshot = React.useCallback((
    sourceFiles?: ReturnType<typeof useGraphStore.getState>['sourceFiles'],
  ): ReturnType<typeof useGraphStore.getState>['sourceFiles'] => {
    return Array.isArray(sourceFiles) ? sourceFiles : (Array.isArray(useGraphStore.getState().sourceFiles) ? useGraphStore.getState().sourceFiles : [])
  }, [])

  React.useEffect(() => {
    latestSourceFilesSnapshotRef.current = readCurrentSourceFilesSnapshot()
    const unsubscribe = useGraphStore.subscribe(
      state => state.sourceFiles,
      sourceFiles => {
        latestSourceFilesSnapshotRef.current = readCurrentSourceFilesSnapshot(sourceFiles)
      },
      { equalityFn: areSourceFilesEqualByIdAndHash },
    )
    return () => {
      latestSourceFilesSnapshotRef.current = []
      unsubscribe()
    }
  }, [readCurrentSourceFilesSnapshot])

  const readCallerOwnedSourceFilesSnapshot = React.useCallback((
    sourceFiles?: ReturnType<typeof useGraphStore.getState>['sourceFiles'],
  ): ReturnType<typeof useGraphStore.getState>['sourceFiles'] => {
    if (Array.isArray(sourceFiles)) return sourceFiles
    if (Array.isArray(latestSourceFilesSnapshotRef.current)) return latestSourceFilesSnapshotRef.current
    return readCurrentSourceFilesSnapshot(sourceFiles)
  }, [readCurrentSourceFilesSnapshot])

  const hasWorkspaceRematerializeCandidates = React.useCallback((
    sourceFiles?: ReturnType<typeof useGraphStore.getState>['sourceFiles'],
  ): boolean => {
    const snapshot = readCurrentSourceFilesSnapshot(sourceFiles)
    return hasNonWorkspaceSourceFile(snapshot) || hasWorkspaceSourceFile(snapshot)
  }, [readCurrentSourceFilesSnapshot])

  const resolveWorkspaceRematerializeRequest = React.useCallback((args?: {
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  }): WorkspaceRematerializeRequest | null => {
    if (!workspaceHydratedRef.current) {
      workspaceMaterializeQueuedRef.current = true
      return null
    }
    const sourceFilesSnapshot = readCurrentSourceFilesSnapshot(args?.sourceFilesSnapshot)
    if (!hasWorkspaceRematerializeCandidates(sourceFilesSnapshot)) {
      workspaceMaterializeQueuedRef.current = true
      return null
    }
    return {
      sourceFilesSnapshot,
    }
  }, [hasWorkspaceRematerializeCandidates, readCurrentSourceFilesSnapshot])

  const rematerializeWorkspaceBackedSourceFilesOnce = React.useCallback(async (args?: {
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  }): Promise<ReturnType<typeof useGraphStore.getState>['sourceFiles']> => {
    const sourceFilesSnapshot = readCurrentSourceFilesSnapshot(args?.sourceFilesSnapshot)
    const fs = await readReusableWorkspaceFs()
    const activePath = resolveMaterializedWorkspaceActivePath({ explorerActivePath: useMarkdownExplorerStore.getState().activePath })
    if (!activePath) return sourceFilesSnapshot
    const forceIncludePaths = buildMaterializedWorkspaceForceIncludePaths({ activePathOverride: activePath })
    const workspaceEntries = await readWorkspaceActiveEntrySnapshot({
      fs,
      activePath,
      workspaceEntries: reusableWorkspaceEntriesRef.current,
    })
    const hydratedWorkspaceEntries = await hydrateWorkspaceEntriesInlineText({ fs, workspaceEntries, forceIncludePaths })
    const signature = buildWorkspaceEntriesSemanticKey({ entries: hydratedWorkspaceEntries, docsOnly: workspaceSourceFilesDocsOnly, forceIncludePaths, forceIncludeOnly: true })
    if (signature === lastWorkspaceEntriesSignatureRef.current) return sourceFilesSnapshot
    lastWorkspaceEntriesSignatureRef.current = signature
    const sourcesByPath = readReusableWorkspaceSourceIndexSnapshot()
    reusableWorkspaceEntriesRef.current = readReusableWorkspaceEntriesSnapshot(hydratedWorkspaceEntries)
    reusableWorkspaceSourcesByPathRef.current = sourcesByPath
    const existing = sourceFilesSnapshot
    const {
      runtimeSourceFiles,
      canSkipActiveRematerialization,
    } = buildActiveWorkspaceRuntimeSourceFilesSnapshot({
      activePath,
      existingSourceFiles: existing,
      workspaceEntries: hydratedWorkspaceEntries,
      sourcesByPath: sourcesByPath || undefined,
      workspaceDocsOnly: workspaceSourceFilesDocsOnly,
    })
    const runtimeMerged = runtimeSourceFiles
    if (runtimeMerged !== existing) {
      useGraphStore.getState().setSourceFiles(runtimeMerged)
    }
    if (!canSkipActiveRematerialization) {
      await materializeActiveWorkspaceEntryIntoSourceFiles({
        activePathOverride: activePath,
        fs,
        activeWorkspaceEntriesSnapshot: readReusableWorkspaceEntriesSnapshot(hydratedWorkspaceEntries),
        sourceFilesSnapshot: runtimeMerged,
        sourcesByPath,
        premergedSourceFiles: runtimeMerged,
      })
    }
    return runtimeMerged
  }, [readCurrentSourceFilesSnapshot, readReusableWorkspaceFs, readReusableWorkspaceSourceIndexSnapshot, workspaceSourceFilesDocsOnly])

  const runWorkspaceRematerializeRequest = React.useCallback(async (request: WorkspaceRematerializeRequest) => {
    return rematerializeWorkspaceBackedSourceFilesOnce({
      sourceFilesSnapshot: request.sourceFilesSnapshot,
    })
  }, [rematerializeWorkspaceBackedSourceFilesOnce])

  const drainWorkspaceRematerializeRequests = React.useCallback(async (initialRequest?: WorkspaceRematerializeRequest | null) => {
    if (workspaceMaterializeInFlightRef.current) {
      if (initialRequest) {
        pendingWorkspaceRematerializeRequestRef.current = initialRequest
      }
      return
    }
    workspaceMaterializeInFlightRef.current = true
    try {
      let request = initialRequest || pendingWorkspaceRematerializeRequestRef.current || resolveWorkspaceRematerializeRequest()
      pendingWorkspaceRematerializeRequestRef.current = null
      while (request) {
        workspaceMaterializeQueuedRef.current = false
        await runWorkspaceRematerializeRequest(request)
        request = pendingWorkspaceRematerializeRequestRef.current
        pendingWorkspaceRematerializeRequestRef.current = null
      }
    } catch {
      void 0
    } finally {
      workspaceMaterializeInFlightRef.current = false
    }
  }, [resolveWorkspaceRematerializeRequest, runWorkspaceRematerializeRequest])

  const scheduleWorkspaceRematerialize = React.useCallback((args?: {
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  }) => {
    const request = resolveWorkspaceRematerializeRequest(args)
    if (!request) return
    pendingWorkspaceRematerializeRequestRef.current = request
    if (workspaceMaterializeTimerRef.current != null) {
      window.clearTimeout(workspaceMaterializeTimerRef.current)
      workspaceMaterializeTimerRef.current = null
    }
    const delayMs = Math.max(0, Number(workspaceSourceFilesSyncDebounceMs || 0))
    if (delayMs === 0) {
      const nextRequest = pendingWorkspaceRematerializeRequestRef.current
      pendingWorkspaceRematerializeRequestRef.current = null
      void drainWorkspaceRematerializeRequests(nextRequest)
      return
    }
    workspaceMaterializeTimerRef.current = window.setTimeout(() => {
      workspaceMaterializeTimerRef.current = null
      const nextRequest = pendingWorkspaceRematerializeRequestRef.current
      pendingWorkspaceRematerializeRequestRef.current = null
      void drainWorkspaceRematerializeRequests(nextRequest)
    }, delayMs)
  }, [drainWorkspaceRematerializeRequests, resolveWorkspaceRematerializeRequest, workspaceSourceFilesSyncDebounceMs])

  const resolveActivePathMaterializationRequest = React.useCallback((args?: {
    activePathSnapshot?: string | null
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
    workspaceEntriesSnapshot?: ReturnType<typeof readReusableWorkspaceEntriesSnapshot>
  }): ActivePathMaterializationRequest | null => {
    const activePath = resolveMaterializedWorkspaceActivePath({
      activePathOverride: args?.activePathSnapshot ?? null,
      explorerActivePath: args?.activePathSnapshot == null ? useMarkdownExplorerStore.getState().activePath : null,
    })
    if (!activePath) return null
    return {
      activePath,
      activePathKey: buildMaterializedWorkspaceActivePathKey({
        activePathOverride: activePath,
      }),
      sourceFilesSnapshot: readCurrentSourceFilesSnapshot(args?.sourceFilesSnapshot),
      workspaceEntriesSnapshot: args?.workspaceEntriesSnapshot === undefined
        ? reusableWorkspaceEntriesRef.current
        : args.workspaceEntriesSnapshot,
    }
  }, [readCurrentSourceFilesSnapshot])

  const runActivePathMaterialization = React.useCallback((request: ActivePathMaterializationRequest) => {
    activePathMaterializeInFlightRef.current = true
    suppressComposeUntilMsRef.current = Date.now() + ACTIVE_PATH_SWITCH_COMPOSE_SUPPRESS_MS
    lastMaterializedActivePathRef.current = request.activePathKey
    void materializeActiveWorkspaceEntryIntoSourceFiles({
      activePathOverride: request.activePath,
      fs: reusableWorkspaceFsRef.current || undefined,
      activeWorkspaceEntriesSnapshot: request.workspaceEntriesSnapshot,
      sourceFilesSnapshot: request.sourceFilesSnapshot,
      workspaceEntries: request.workspaceEntriesSnapshot,
      sourcesByPath: reusableWorkspaceSourcesByPathRef.current || undefined,
    }).catch(() => {
      if (lastMaterializedActivePathRef.current === request.activePathKey) {
        lastMaterializedActivePathRef.current = ''
      }
    }).finally(() => {
      activePathMaterializeInFlightRef.current = false
      const queuedRequest = queuedActivePathMaterializeRef.current
      queuedActivePathMaterializeRef.current = null
      if (queuedRequest && queuedRequest.activePathKey !== request.activePathKey) {
        runActivePathMaterialization(queuedRequest)
      }
    })
  }, [])

  const syncActivePathMaterialization = React.useCallback((args?: {
    activePathSnapshot?: string | null
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
    workspaceEntriesSnapshot?: ReturnType<typeof readReusableWorkspaceEntriesSnapshot>
  }) => {
    if (!workspaceHydratedRef.current) return
    const request = resolveActivePathMaterializationRequest(args)
    if (!request) {
      lastMaterializedActivePathRef.current = ''
      queuedActivePathMaterializeRef.current = null
      return
    }
    if (activePathMaterializeInFlightRef.current) {
      queuedActivePathMaterializeRef.current = request
      return
    }
    if (lastMaterializedActivePathRef.current === request.activePathKey) return
    runActivePathMaterialization(request)
  }, [resolveActivePathMaterializationRequest, runActivePathMaterialization])

  const resolveWorkspaceFsMutationRequest = React.useCallback((detail?: {
    op?: unknown
    path?: unknown
  }, args?: {
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
    activePathRequest?: ActivePathMaterializationRequest | null
  }): WorkspaceFsMutationRequest | null => {
    if (!workspaceHydratedRef.current) {
      workspaceMaterializeQueuedRef.current = true
      return null
    }
    const sourceFilesSnapshot = readCallerOwnedSourceFilesSnapshot(args?.sourceFilesSnapshot)
    if (!hasWorkspaceRematerializeCandidates(sourceFilesSnapshot)) {
      workspaceMaterializeQueuedRef.current = true
      return null
    }
    const op = String(detail?.op || '')
    if (!op) return null
    const changedPath = String(detail?.path || '').trim()
    if (op !== 'ensureSeed' && op !== 'batch' && op !== 'writeFileText' && op !== 'createFile' && op !== 'deleteEntry') {
      return null
    }
    if (op === 'ensureSeed' && !changedPath) {
      const preparedRequest = pendingEnsureSeedMutationRequestRef.current
      if (preparedRequest) {
        pendingEnsureSeedMutationRequestRef.current = null
        return preparedRequest
      }
    }
    return {
      op,
      changedPath,
      sourceFilesSnapshot,
      activePathRequest: args?.activePathRequest === undefined
        ? resolveActivePathMaterializationRequest({
            sourceFilesSnapshot,
            workspaceEntriesSnapshot: reusableWorkspaceEntriesRef.current,
          })
        : args.activePathRequest,
    }
  }, [hasWorkspaceRematerializeCandidates, readCallerOwnedSourceFilesSnapshot, resolveActivePathMaterializationRequest])

  const handleWorkspaceFsMutation = React.useCallback((request: WorkspaceFsMutationRequest) => {
    if (request.op === 'batch' || (request.op === 'ensureSeed' && !request.changedPath)) {
      invalidateCachedWorkspaceActiveEntrySnapshot()
    } else if (request.changedPath) {
      invalidateCachedWorkspaceActiveEntrySnapshot(request.changedPath)
    }
    reusableWorkspaceSourcesByPathRef.current = null
    const activePath = request.activePathRequest?.activePath || ''
    if ((request.op === 'writeFileText' || request.op === 'batch') && !!request.changedPath && !!activePath && request.changedPath === activePath) {
      return
    }
    if (workspaceSourceFilesDocsOnly) {
      const hasPath = !!request.changedPath
      const isDocsPath = hasPath && request.changedPath.startsWith('/docs/')
      if (hasPath && !isDocsPath) return
    }
    const sourcesByPathSnapshot = readReusableWorkspaceSourceIndexSnapshot()
    if (request.op === 'ensureSeed') {
      void materializeActiveWorkspaceEntryIntoSourceFiles({
        activePathOverride: request.activePathRequest?.activePath,
        fs: reusableWorkspaceFsRef.current || undefined,
        activeWorkspaceEntriesSnapshot: request.activePathRequest?.workspaceEntriesSnapshot,
        sourceFilesSnapshot: request.sourceFilesSnapshot,
        workspaceEntries: request.activePathRequest?.workspaceEntriesSnapshot,
        sourcesByPath: sourcesByPathSnapshot,
      }).catch(() => {
        void 0
      })
    }
    markWorkspaceSeedSyncDebug(`workspace-fs:${request.op}`)
    scheduleWorkspaceRematerializeRef.current?.(request.sourceFilesSnapshot)
  }, [readReusableWorkspaceSourceIndexSnapshot, workspaceSourceFilesDocsOnly])

  const prepareEnsureSeedMutationRequest = React.useCallback((args?: {
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  }): WorkspaceFsMutationRequest | null => {
    const sourceFilesSnapshot = readCurrentSourceFilesSnapshot(args?.sourceFilesSnapshot)
    const activePathRequest = resolveActivePathMaterializationRequest({
      sourceFilesSnapshot,
      workspaceEntriesSnapshot: reusableWorkspaceEntriesRef.current,
    })
    pendingEnsureSeedMutationRequestRef.current = null
    const request = resolveWorkspaceFsMutationRequest(
      { op: 'ensureSeed' },
      { sourceFilesSnapshot, activePathRequest },
    )
    pendingEnsureSeedMutationRequestRef.current = request
    return request
  }, [readCurrentSourceFilesSnapshot, resolveActivePathMaterializationRequest, resolveWorkspaceFsMutationRequest])

  const resolveBootstrapMountRequest = React.useCallback((args: {
    persistedWorkspace: SourceFilesWorkspaceState
    bootstrapMaterialization: Awaited<ReturnType<typeof materializeBootstrapWorkspaceSourceFiles>> | null
  }): BootstrapMountRequest => {
    const sourceFilesSnapshot = args.bootstrapMaterialization?.sourceFiles
      || readCurrentSourceFilesSnapshot(lastPersistedRef.current as ReturnType<typeof useGraphStore.getState>['sourceFiles'])
    const workspaceEntriesSnapshot = args.bootstrapMaterialization?.workspaceEntries
      ?? reusableWorkspaceEntriesRef.current
    return {
      persistedWorkspace: args.persistedWorkspace,
      bootstrapMaterialization: args.bootstrapMaterialization,
      initialRematerializeRequest: resolveWorkspaceRematerializeRequest({
        sourceFilesSnapshot,
      }),
      initialActivePathRequest: resolveActivePathMaterializationRequest({
        sourceFilesSnapshot,
        workspaceEntriesSnapshot,
      }),
    }
  }, [readCurrentSourceFilesSnapshot, resolveActivePathMaterializationRequest, resolveWorkspaceRematerializeRequest])

  const applyBootstrapMountRequest = React.useCallback((request: BootstrapMountRequest) => {
    const bootstrapMaterialization = request.bootstrapMaterialization
    if (bootstrapMaterialization) {
      reusableWorkspaceFsRef.current = bootstrapMaterialization.workspaceFs
      reusableWorkspaceEntriesRef.current = bootstrapMaterialization.workspaceEntries
      reusableWorkspaceSourcesByPathRef.current = bootstrapMaterialization.sourcesByPath
      lastMaterializedActivePathRef.current = bootstrapMaterialization.activePathKey
      lastComposeSignatureRef.current = scheduleBootstrapComposedGraphSync({
        sourceFiles: bootstrapMaterialization.sourceFiles,
      })
    }
    restoreBootstrapWorkspaceState(request.persistedWorkspace)
    workspaceHydratedRef.current = true
    lastWorkspacePersistedRef.current = request.persistedWorkspace
    if (request.initialActivePathRequest) {
      queuedActivePathMaterializeRef.current = request.initialActivePathRequest
    }
    if (request.initialRematerializeRequest) {
      pendingWorkspaceRematerializeRequestRef.current = request.initialRematerializeRequest
      scheduleWorkspaceRematerializeRef.current?.(request.initialRematerializeRequest.sourceFilesSnapshot)
      return
    }
    scheduleWorkspaceRematerializeRef.current?.()
  }, [scheduleBootstrapComposedGraphSync])

  React.useEffect(() => {
    setWorkspaceSeedSyncEnabled(readWorkspaceSeedSyncEnabledSetting())
    setWorkspaceSeedSyncPollMs(readWorkspaceSeedSyncPollMsSetting())
    setWorkspaceSeedSyncIdleMaxMs(readWorkspaceSeedSyncIdleMaxMsSetting())
    setWorkspaceSourceFilesDocsOnly(readWorkspaceSourceFilesDocsOnlySetting())
    setWorkspaceSourceFilesSyncDebounceMs(readWorkspaceSourceFilesSyncDebounceMsSetting())
    reusableWorkspaceSourcesByPathRef.current = null
  }, [workspaceSyncSettingsRev])

  const resolveKnowgrphStorageQueueRequest = React.useCallback((args?: {
    workspaceId?: string
    workspaceState?: SourceFilesWorkspaceState
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  }): KnowgrphStorageQueueRequest | null => {
    const workspaceId =
      String(args?.workspaceId || '').trim() ||
      activeKnowgrphWorkspaceIdRef.current ||
      buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState(args?.workspaceState || readCurrentSourceFilesWorkspaceState())
    if (!workspaceId) return null
    const sourceFilesSnapshot = readCurrentSourceFilesSnapshot(args?.sourceFilesSnapshot)
    if (!hasNonWorkspaceSourceFile(sourceFilesSnapshot)) return null
    return {
      workspaceId,
      sourceFilesSnapshot,
      signature: `${workspaceId}:${buildSourceFilesStorageSyncSignature(sourceFilesSnapshot)}`,
    }
  }, [readCurrentSourceFilesSnapshot])

  const rememberKnowgrphStorageQueuedSnapshot = React.useCallback((request: KnowgrphStorageQueueRequest) => {
    lastQueuedKnowgrphStorageSignatureRef.current = request.signature
    lastQueuedKnowgrphStorageSourceFilesRef.current = request.sourceFilesSnapshot
  }, [])

  const applyKnowgrphStorageQueueTransition = React.useCallback((args?: {
    workspaceId?: string
    workspaceState?: SourceFilesWorkspaceState
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  }): KnowgrphStorageQueueRequest | null => {
    const request = resolveKnowgrphStorageQueueRequest(args)
    if (!request) return null
    rememberKnowgrphStorageQueuedSnapshot(request)
    return request
  }, [rememberKnowgrphStorageQueuedSnapshot, resolveKnowgrphStorageQueueRequest])

  const clearKnowgrphStorageQueueState = React.useCallback(() => {
    pendingKnowgrphStorageQueueRequestRef.current = null
    lastQueuedKnowgrphStorageSignatureRef.current = ''
    lastQueuedKnowgrphStorageSourceFilesRef.current = []
  }, [])

  const scheduleKnowgrphStorageQueueSyncFollowUp = React.useCallback((args: {
    request: KnowgrphStorageQueueRequest
    queuedMutationCount: number
  }) => {
    const { request, queuedMutationCount } = args
    if (queuedMutationCount <= 0) return
    scheduleKnowgrphStorageSync({
      workspaceId: request.workspaceId,
      delayMs: 0,
      signature: `${request.signature}:${queuedMutationCount}`,
      onSyncCompleted: syncResult => {
        if (activeKnowgrphWorkspaceIdRef.current !== syncResult.workspaceId) return
        notifyKnowgrphStorageConflictUx(syncResult)
      },
    })
  }, [])

  const handleKnowgrphStorageQueueRequestSuccess = React.useCallback((args: {
    request: KnowgrphStorageQueueRequest
    queuedMutationCount: number
  }) => {
    const { request, queuedMutationCount } = args
    rememberKnowgrphStorageQueuedSnapshot(request)
    scheduleKnowgrphStorageQueueSyncFollowUp({
      request,
      queuedMutationCount,
    })
  }, [rememberKnowgrphStorageQueuedSnapshot, scheduleKnowgrphStorageQueueSyncFollowUp])

  const handleKnowgrphStorageQueueRequestFailure = React.useCallback((request: KnowgrphStorageQueueRequest) => {
    if (lastQueuedKnowgrphStorageSignatureRef.current === request.signature) {
      lastQueuedKnowgrphStorageSignatureRef.current = ''
    }
  }, [])

  const runKnowgrphStorageQueueRequest = React.useCallback((request: KnowgrphStorageQueueRequest) => {
    if (!request.workspaceId) return
    if (activeKnowgrphWorkspaceIdRef.current && activeKnowgrphWorkspaceIdRef.current !== request.workspaceId) return
    if (lastQueuedKnowgrphStorageSignatureRef.current === request.signature) return
    void syncSourceFilesToKnowgrphStorage({
      workspaceId: request.workspaceId,
      sourceFiles: request.sourceFilesSnapshot,
      previousSourceFiles: lastQueuedKnowgrphStorageSourceFilesRef.current,
    })
      .then(result => {
        handleKnowgrphStorageQueueRequestSuccess({
          request,
          queuedMutationCount: result.queuedMutationCount,
        })
      })
      .catch(() => {
        handleKnowgrphStorageQueueRequestFailure(request)
      })
  }, [handleKnowgrphStorageQueueRequestFailure, handleKnowgrphStorageQueueRequestSuccess])

  const scheduleKnowgrphStorageQueueRequest = React.useCallback((request: KnowgrphStorageQueueRequest | null) => {
    if (!request) return
    if (lastQueuedKnowgrphStorageSignatureRef.current === request.signature) return
    if (pendingKnowgrphStorageQueueRequestRef.current?.signature === request.signature) return
    pendingKnowgrphStorageQueueRequestRef.current = request
    const taskKey = WORKSPACE_SYNC_TASK_KNOWGRPH_STORAGE_QUEUE
    scheduleWorkspaceSyncTask(
      taskKey,
      () => {
        const nextRequest = pendingKnowgrphStorageQueueRequestRef.current
        pendingKnowgrphStorageQueueRequestRef.current = null
        if (!nextRequest) return
        runKnowgrphStorageQueueRequest(nextRequest)
      },
      SOURCE_FILES_PERSIST_DELAY_MS,
      { signature: request.signature, scopeKey: knowgrphStorageScopeKey },
    )
  }, [knowgrphStorageScopeKey, runKnowgrphStorageQueueRequest])

  const scheduleKnowgrphStorageQueueSync = React.useCallback((args?: {
    workspaceId?: string
    workspaceState?: SourceFilesWorkspaceState
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  }) => {
    const request = resolveKnowgrphStorageQueueRequest(args)
    scheduleKnowgrphStorageQueueRequest(request)
  }, [resolveKnowgrphStorageQueueRequest, scheduleKnowgrphStorageQueueRequest])

  const resolveSourceFilesPersistenceEffectRequest = React.useCallback((
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles'],
  ): SourceFilesPersistenceEffectRequest => {
    const snapshot = readCurrentSourceFilesSnapshot(sourceFilesSnapshot)
    const shouldScheduleCompose = hasEnabledNonWorkspaceSourceFile(snapshot)
    return {
      sourceFilesSnapshot: snapshot,
      knowgrphStorageQueueRequest: resolveKnowgrphStorageQueueRequest({
        sourceFilesSnapshot: snapshot,
      }),
      shouldScheduleCompose,
      compositionSignature: shouldScheduleCompose ? buildSourceFilesCompositionSignature(snapshot) : '',
    }
  }, [readCurrentSourceFilesSnapshot, resolveKnowgrphStorageQueueRequest])

  const applySourceFilesPersistenceEffectRequest = React.useCallback((request: SourceFilesPersistenceEffectRequest) => {
    if (!knowgrphInboundApplyInFlightRef.current) {
      scheduleKnowgrphStorageQueueRequest(request.knowgrphStorageQueueRequest)
    }
    if (!request.shouldScheduleCompose) return
    const compositionSignature = request.compositionSignature
    if (Date.now() < suppressComposeUntilMsRef.current) {
      lastComposeSignatureRef.current = compositionSignature
      return
    }
    if (compositionSignature !== lastComposeSignatureRef.current) {
      lastComposeSignatureRef.current = compositionSignature
      try {
        scheduleApplyComposedGraphFromSourceFiles({ precomputedSignature: compositionSignature })
      } catch {
        void 0
      }
    }
  }, [scheduleKnowgrphStorageQueueRequest])

  const readActivePathMaterializationSelection = React.useCallback((
    state?: ReturnType<typeof useMarkdownExplorerStore.getState>,
  ): ActivePathMaterializationSelection => {
    const snapshot = state || useMarkdownExplorerStore.getState()
    return {
      activePathSnapshot: snapshot.activePath ?? null,
      sourceFilesSnapshot: latestSourceFilesSnapshotRef.current,
      workspaceEntriesSnapshot: reusableWorkspaceEntriesRef.current,
    }
  }, [])

  const readKnowgrphStorageWorkspaceSelection = React.useCallback((
    state?: ReturnType<typeof useGraphStore.getState>,
  ): KnowgrphStorageWorkspaceSelection => {
    const snapshot = state || useGraphStore.getState()
    return {
      workspaceState: normalizeSourceFilesWorkspaceState({
        folderName: snapshot.localMarkdownFolderName,
        accessMode: snapshot.localMarkdownFolderAccessMode,
        folderCacheId: snapshot.localMarkdownFolderCacheId,
        selectedFolderPath: snapshot.localMarkdownSelectedFolderPath,
      }),
      sourceFilesSnapshot: latestSourceFilesSnapshotRef.current,
    }
  }, [])

  const resolveKnowgrphStorageWorkspaceRequest = React.useCallback((args: {
    workspaceState: SourceFilesWorkspaceState
    sourceFilesSnapshot?: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  }): KnowgrphStorageWorkspaceRequest | null => {
    const workspaceId = buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState(args.workspaceState)
    if (!workspaceId) return null
    const sourceFilesSnapshot = readCurrentSourceFilesSnapshot(args.sourceFilesSnapshot)
    return {
      workspaceId,
      workspaceState: args.workspaceState,
      sourceFilesSnapshot,
      initialQueueRequest: resolveKnowgrphStorageQueueRequest({
        workspaceId,
        workspaceState: args.workspaceState,
        sourceFilesSnapshot,
      }),
    }
  }, [readCurrentSourceFilesSnapshot, resolveKnowgrphStorageQueueRequest])

  const stopKnowgrphStorageWorkspaceRuntime = React.useCallback((args?: {
    clearActiveWorkspaceId?: boolean
  }) => {
    cancelWorkspaceSyncTask(WORKSPACE_SYNC_TASK_KNOWGRPH_STORAGE_QUEUE)
    if (knowgrphStorageLoopCleanupRef.current) {
      knowgrphStorageLoopCleanupRef.current()
      knowgrphStorageLoopCleanupRef.current = null
    }
    if (activeKnowgrphWorkspaceIdRef.current) {
      cancelKnowgrphStorageSync(activeKnowgrphWorkspaceIdRef.current)
    }
    if (args?.clearActiveWorkspaceId !== false) {
      activeKnowgrphWorkspaceIdRef.current = ''
    }
    clearKnowgrphStorageQueueState()
  }, [clearKnowgrphStorageQueueState])

  const handleKnowgrphStorageSyncCompleted = React.useCallback((result: {
    workspaceId: string
  }) => {
    if (activeKnowgrphWorkspaceIdRef.current !== result.workspaceId) return
    notifyKnowgrphStorageConflictUx(result as Parameters<typeof notifyKnowgrphStorageConflictUx>[0])
  }, [])

  const handleKnowgrphStoragePulledChangesApplied = React.useCallback((args: {
    workspaceId: string
    changes: Parameters<typeof applyPulledKnowgrphStorageChangesToSourceFiles>[0]['changes']
  }) => {
    if (activeKnowgrphWorkspaceIdRef.current !== args.workspaceId) return
    knowgrphInboundApplyInFlightRef.current = true
    try {
      const result = applyPulledKnowgrphStorageChangesToSourceFiles({
        workspaceId: args.workspaceId,
        changes: args.changes,
      })
      if (!result.applied) return
      applyKnowgrphStorageQueueTransition({
        workspaceId: args.workspaceId,
        sourceFilesSnapshot: result.sourceFilesSnapshot,
      })
    } finally {
      knowgrphInboundApplyInFlightRef.current = false
    }
  }, [applyKnowgrphStorageQueueTransition])

  const startKnowgrphStorageWorkspaceRuntime = React.useCallback((request: KnowgrphStorageWorkspaceRequest) => {
    knowgrphStorageLoopCleanupRef.current = startKnowgrphStorageSyncLoop({
      workspaceId: request.workspaceId,
      baseUrl: KNOWGRPH_STORAGE_BASE_URL,
      initialDelayMs: 0,
      onSyncCompleted: handleKnowgrphStorageSyncCompleted,
      onPulledChangesApplied: handleKnowgrphStoragePulledChangesApplied,
    })
  }, [handleKnowgrphStoragePulledChangesApplied, handleKnowgrphStorageSyncCompleted])

  const applyKnowgrphStorageWorkspaceRequest = React.useCallback((request: KnowgrphStorageWorkspaceRequest) => {
    if (activeKnowgrphWorkspaceIdRef.current === request.workspaceId) return
    stopKnowgrphStorageWorkspaceRuntime({
      clearActiveWorkspaceId: false,
    })
    activeKnowgrphWorkspaceIdRef.current = request.workspaceId
    startKnowgrphStorageWorkspaceRuntime(request)
    scheduleKnowgrphStorageQueueRequest(request.initialQueueRequest)
  }, [
    scheduleKnowgrphStorageQueueRequest,
    startKnowgrphStorageWorkspaceRuntime,
    stopKnowgrphStorageWorkspaceRuntime,
  ])
  React.useEffect(() => {
    __canvasStartupDebug.sourceBootstrapMounted = true
    return () => {
      __canvasStartupDebug.sourceBootstrapMounted = false
    }
  }, [])

  React.useEffect(() => {
    if (!workspaceSeedSyncEnabled) return
    let cancelled = false
    let timer: number | null = null
    let idleStreak = 0
    const scheduleNextWorkspaceSeedSync = (args: {
      changed: boolean
      nextRequest: WorkspaceSeedSyncRequest
    }) => {
      const next = computeWorkspaceSeedSyncNextDelayMs({
        basePollMs: workspaceSeedSyncPollMs,
        idleMaxMs: workspaceSeedSyncIdleMaxMs,
        docsOnly: workspaceSourceFilesDocsOnly,
        changed: args.changed,
        idleStreak,
      })
      idleStreak = next.nextIdleStreak
      if (!cancelled) {
        timer = window.setTimeout(() => {
          timer = null
          void runWorkspaceSeedSync(args.nextRequest)
        }, next.nextDelayMs)
      }
    }
    const runWorkspaceSeedSync = async (request: WorkspaceSeedSyncRequest) => {
      if (cancelled) return
      try {
        const fs = await readReusableWorkspaceFs()
        const changed = await fs.ensureSeed()
        if (changed) {
          markWorkspaceSeedSyncDebug(request.source)
          prepareEnsureSeedMutationRequest()
        }
        scheduleNextWorkspaceSeedSync({
          changed,
          nextRequest: { source: 'bootstrap:poll' },
        })
      } catch {
        pendingEnsureSeedMutationRequestRef.current = null
        scheduleNextWorkspaceSeedSync({
          changed: false,
          nextRequest: { source: 'bootstrap:poll' },
        })
      }
    }
    const handleWorkspaceSeedSyncWake = () => {
      if (document.visibilityState === 'hidden') return
      idleStreak = 0
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
      void runWorkspaceSeedSync({ source: 'bootstrap:wake' })
    }
    void runWorkspaceSeedSync({ source: 'bootstrap:mount' })
    window.addEventListener('focus', handleWorkspaceSeedSyncWake)
    document.addEventListener('visibilitychange', handleWorkspaceSeedSyncWake)
    return () => {
      cancelled = true
      pendingEnsureSeedMutationRequestRef.current = null
      if (timer != null) window.clearTimeout(timer)
      window.removeEventListener('focus', handleWorkspaceSeedSyncWake)
      document.removeEventListener('visibilitychange', handleWorkspaceSeedSyncWake)
    }
  }, [
    prepareEnsureSeedMutationRequest,
    readReusableWorkspaceFs,
    workspaceSeedSyncEnabled,
    workspaceSeedSyncPollMs,
    workspaceSeedSyncIdleMaxMs,
    workspaceSourceFilesDocsOnly,
  ])

  React.useEffect(() => {
    const startForWorkspaceSelection = (selection: KnowgrphStorageWorkspaceSelection) => {
      const request = resolveKnowgrphStorageWorkspaceRequest({
        workspaceState: selection.workspaceState,
        sourceFilesSnapshot: selection.sourceFilesSnapshot,
      })
      if (!request) return
      applyKnowgrphStorageWorkspaceRequest(request)
    }
    startForWorkspaceSelection(readKnowgrphStorageWorkspaceSelection())
    const unsubscribe = useGraphStore.subscribe(
      s => readKnowgrphStorageWorkspaceSelection(s),
      selection => {
        startForWorkspaceSelection(selection)
      },
      {
        equalityFn: (left, right) => areSourceFilesWorkspaceStatesEqual(left?.workspaceState, right?.workspaceState),
      },
    )
    return () => {
      unsubscribe()
      stopKnowgrphStorageWorkspaceRuntime()
    }
  }, [applyKnowgrphStorageWorkspaceRequest, readKnowgrphStorageWorkspaceSelection, resolveKnowgrphStorageWorkspaceRequest, stopKnowgrphStorageWorkspaceRuntime])

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
        let bootstrapMaterialization: Awaited<ReturnType<typeof materializeBootstrapWorkspaceSourceFiles>> | null = null
        try {
          bootstrapMaterialization = await materializeBootstrapWorkspaceSourceFiles({
            existingSourceFiles: lastPersistedRef.current,
            sourcesByPath: readReusableWorkspaceSourceIndexSnapshot(),
          })
        } catch {
          void 0
        }
        const bootstrapMountRequest = resolveBootstrapMountRequest({
          persistedWorkspace,
          bootstrapMaterialization,
        })
        applyBootstrapMountRequest(bootstrapMountRequest)
      } catch {
        hydratedRef.current = true
        workspaceHydratedRef.current = true
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applyBootstrapMountRequest, resolveBootstrapMountRequest])

  React.useEffect(() => {
    scheduleWorkspaceRematerializeRef.current = sourceFilesSnapshot => {
      scheduleWorkspaceRematerialize({
        sourceFilesSnapshot,
      })
    }
    lastWorkspaceEntriesSignatureRef.current = ''
    scheduleWorkspaceRematerialize()
    const unsubscribe = subscribeWorkspaceFsChanged(detail => {
      const request = resolveWorkspaceFsMutationRequest(detail)
      if (!request) return
      handleWorkspaceFsMutation(request)
    })
    return () => {
      if (scheduleWorkspaceRematerializeRef.current) {
        scheduleWorkspaceRematerializeRef.current = null
      }
      if (workspaceMaterializeTimerRef.current != null) {
        window.clearTimeout(workspaceMaterializeTimerRef.current)
        workspaceMaterializeTimerRef.current = null
      }
      pendingWorkspaceRematerializeRequestRef.current = null
      unsubscribe()
    }
  }, [handleWorkspaceFsMutation, resolveWorkspaceFsMutationRequest, scheduleWorkspaceRematerialize])

  React.useEffect(() => {
    let lastObservedActivePath = useMarkdownExplorerStore.getState().activePath
    const syncForActivePathSelection = (selection: ActivePathMaterializationSelection) => {
      syncActivePathMaterialization({
        activePathSnapshot: selection.activePathSnapshot,
        sourceFilesSnapshot: selection.sourceFilesSnapshot,
        workspaceEntriesSnapshot: selection.workspaceEntriesSnapshot,
      })
    }
    const unsubscribeActivePath = useMarkdownExplorerStore.subscribe(state => {
      const activePath = state.activePath
      if (Object.is(activePath, lastObservedActivePath)) return
      lastObservedActivePath = activePath
      syncForActivePathSelection(readActivePathMaterializationSelection(state))
    })
    return () => {
      unsubscribeActivePath()
    }
  }, [readActivePathMaterializationSelection, syncActivePathMaterialization])

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
        const request = resolveSourceFilesPersistenceEffectRequest(next as never)
        applySourceFilesPersistenceEffectRequest(request)
      },
    })
    return () => {
      cancelWorkspaceSyncTask(taskKey)
      unsubscribe()
    }
  }, [applySourceFilesPersistenceEffectRequest, resolveSourceFilesPersistenceEffectRequest, runtimePersistenceScopeKey])

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
