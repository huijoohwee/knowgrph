import { useGraphStore } from '@/hooks/useGraphStore'
import { __canvasStartupDebug } from '@/features/canvas/canvasStartupDebug'
import { hydratePendingUrlSourceFiles, refreshPersistedSourceFilesForCurrentParseIdentity } from '@/features/source-files/sourceFilesIngestIntegration'
import {
  buildMaterializedWorkspaceActivePathKey,
  buildMaterializedWorkspaceForceIncludePaths,
  hydrateWorkspaceEntriesInlineText,
  materializeActiveWorkspaceEntryIntoSourceFiles,
  readReusableWorkspaceEntriesSnapshot,
  resolveMaterializedWorkspaceActivePath,
  resolveInitialWorkspaceStartupState,
} from '@/features/source-files/sourceFilesRuntimeShared'
import { buildSourceFilesCompositionSignature } from '@/features/source-files/sourceFilesSignatures'
import { resolveWorkspaceSourceIndexSnapshot } from '@/features/workspace-fs/sourceIndex'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import type { SourceFilesWorkspaceState } from '@/features/source-files/sourceFilesWorkspaceState'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'

export function restoreBootstrapPersistedSourceFiles(args: {
  persistedSourceFiles: unknown[]
}): unknown[] {
  const store = useGraphStore.getState()
  const current = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  if (current.length > 0) return current
  const persisted = Array.isArray(args.persistedSourceFiles) ? args.persistedSourceFiles : []
  if (persisted.length > 0) {
    store.setSourceFiles(persisted as never)
  }
  return persisted
}

export async function runBootstrapSourceFileHydration(): Promise<void> {
  __canvasStartupDebug.sourceBootstrapHydrateRuns += 1
  await refreshPersistedSourceFilesForCurrentParseIdentity()
  await hydratePendingUrlSourceFiles()
  __canvasStartupDebug.sourceBootstrapLastHydrateFinishedAtMs = Date.now()
}

export async function materializeBootstrapWorkspaceSourceFiles(): Promise<string> {
  const startup = await resolveInitialWorkspaceStartupState()
  const fs = await getWorkspaceFs()
  const hydratedEntries = await hydrateWorkspaceEntriesInlineText({
    fs,
    workspaceEntries: startup.workspaceEntries,
  })
  const startupActivePath = resolveMaterializedWorkspaceActivePath({
    activePathOverride: startup.activePath,
  })
  const startupSourcesByPath = resolveWorkspaceSourceIndexSnapshot(undefined)
  const store = useGraphStore.getState()
  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const merged = mergeWorkspaceEntriesIntoSourceFiles({
    existing,
    workspaceEntries: hydratedEntries,
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
    workspaceEntries: readReusableWorkspaceEntriesSnapshot(hydratedEntries),
    sourcesByPath: startupSourcesByPath,
    applyToGraph: true,
  })
  return buildMaterializedWorkspaceActivePathKey({
    activePathOverride: startupActivePath,
  })
}

export function scheduleBootstrapComposedGraphSync(): string {
  const compositionSignature = buildSourceFilesCompositionSignature(useGraphStore.getState().sourceFiles)
  try {
    scheduleApplyComposedGraphFromSourceFiles()
  } catch {
    void 0
  }
  return compositionSignature
}

export function restoreBootstrapWorkspaceState(
  persistedWorkspace: SourceFilesWorkspaceState,
): void {
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
}
