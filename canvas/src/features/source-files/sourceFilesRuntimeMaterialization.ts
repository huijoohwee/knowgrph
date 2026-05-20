import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import type { SourceFile } from '@/hooks/store/types'
import {
  resolveWorkspaceSourceIndexSnapshot,
  type WorkspaceSourceIndex,
} from '@/features/workspace-fs/sourceIndex'
import { mergeWorkspaceEntriesIntoSourceFiles, resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import {
  isInitializationWorkspacePath,
} from '@/features/workspace-fs/workspaceFs'
import { readWorkspaceSourceFilesDocsOnlySetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import {
  readActiveWorkspaceSourceFileFallbackText,
  resolveActiveWorkspaceEntriesSnapshot,
} from '@/features/source-files/sourceFilesRuntimeActive'

function normalizeWorkspaceSourceFilesToSingleActive(args: {
  sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  activeSourcePath: string
}): ReturnType<typeof useGraphStore.getState>['sourceFiles'] {
  const list = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (list.length === 0) return list
  let changed = false
  const next = list.map(file => {
    if (!file) return file
    const sourcePath = String(file.source?.path || '')
    if (!sourcePath.startsWith('workspace:')) return file
    const shouldEnable = sourcePath === args.activeSourcePath
    if (file.enabled === shouldEnable) return file
    changed = true
    return { ...file, enabled: shouldEnable }
  })
  return changed ? next : list
}

function pruneWorkspaceSourceFilesToActive(args: {
  sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  activeSourcePath: string
}): ReturnType<typeof useGraphStore.getState>['sourceFiles'] {
  const list = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (list.length === 0) return list
  const next = list.filter(file => {
    if (!file) return false
    const sourcePath = String(file.source?.path || '')
    if (!sourcePath.startsWith('workspace:')) return true
    return sourcePath === args.activeSourcePath
  })
  if (next.length === 0) return next
  const activeIndex = next.findIndex(file => String(file?.source?.path || '') === args.activeSourcePath)
  if (activeIndex < 0) return next
  const activeFile = next[activeIndex]
  if (!activeFile || activeFile.enabled === true) return next
  const normalized = next.slice()
  normalized[activeIndex] = { ...activeFile, enabled: true }
  return normalized
}

function canSkipActiveWorkspaceSourceFilesRematerialization(args: {
  sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  activeSourcePath: string
}): boolean {
  const list = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (!args.activeSourcePath || list.length === 0) return false
  for (let i = 0; i < list.length; i += 1) {
    const file = list[i]
    if (!file) continue
    if (String(file.source?.path || '') !== args.activeSourcePath) continue
    return file.enabled === true && String(file.text || '').trim().length > 0
  }
  return false
}

export function resolveMaterializedWorkspaceActivePath(args?: {
  activePathOverride?: WorkspacePath | null
  explorerActivePath?: WorkspacePath | null
}): WorkspacePath | null {
  const raw = args?.activePathOverride ?? args?.explorerActivePath ?? null
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  const withoutWorkspacePrefix = trimmed.startsWith('workspace:') ? trimmed.slice('workspace:'.length) : trimmed
  const normalized = normalizeWorkspacePath(withoutWorkspacePrefix)
  return normalized === '/' ? null : normalized
}

export function buildMaterializedWorkspaceActivePathKey(args?: {
  activePathOverride?: WorkspacePath | null
  explorerActivePath?: WorkspacePath | null
}): string {
  return String(resolveMaterializedWorkspaceActivePath(args) || '')
}

export function buildMaterializedWorkspaceForceIncludePaths(args?: {
  activePathOverride?: WorkspacePath | null
  explorerActivePath?: WorkspacePath | null
}): WorkspacePath[] {
  const activePath = resolveMaterializedWorkspaceActivePath(args)
  return activePath ? [activePath] : []
}

export function buildActiveWorkspaceRuntimeSourceFilesSnapshot(args: {
  activePath: WorkspacePath
  existingSourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  workspaceEntries: WorkspaceEntry[]
  sourcesByPath?: WorkspaceSourceIndex | null
  workspaceDocsOnly?: boolean
}): {
  activeSourcePath: string
  mergedSourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  runtimeSourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  canSkipActiveRematerialization: boolean
} {
  const activePath = normalizeWorkspacePath(args.activePath)
  const activeSourcePath = resolveWorkspaceSourcePathKey(activePath)
  const mergedSourceFiles = mergeWorkspaceEntriesIntoSourceFiles({
    existing: Array.isArray(args.existingSourceFiles) ? args.existingSourceFiles : [],
    workspaceEntries: Array.isArray(args.workspaceEntries) ? args.workspaceEntries : [],
    sourcesByPath: resolveWorkspaceSourceIndexSnapshot(args.sourcesByPath || undefined),
    forceIncludePaths: buildMaterializedWorkspaceForceIncludePaths({
      activePathOverride: activePath,
    }),
    forceIncludeOnly: true,
    workspaceDocsOnly: args.workspaceDocsOnly,
  })
  const runtimeSourceFiles = pruneWorkspaceSourceFilesToActive({
    sourceFiles: mergedSourceFiles,
    activeSourcePath,
  })
  return {
    activeSourcePath,
    mergedSourceFiles,
    runtimeSourceFiles,
    canSkipActiveRematerialization: canSkipActiveWorkspaceSourceFilesRematerialization({
      sourceFiles: runtimeSourceFiles,
      activeSourcePath,
    }),
  }
}

async function resolveNonGraphActiveWorkspaceSourceFiles(args: {
  activePath: WorkspacePath
  activeSourcePath: string
  sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  activeWorkspaceEntriesSnapshot?: WorkspaceEntry[]
  fs?: Awaited<ReturnType<typeof getWorkspaceFs>>
}): Promise<ReturnType<typeof useGraphStore.getState>['sourceFiles'] | null> {
  const materializedSourceFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (materializedSourceFiles.length === 0) return null
  const activeIndex = materializedSourceFiles.findIndex(file => String(file?.source?.path || '') === args.activeSourcePath)
  if (activeIndex < 0) return null
  let nextSourceFiles = materializedSourceFiles
  const activeFile = materializedSourceFiles[activeIndex] || null
  const activeText = String(activeFile?.text || '')
  if (!activeText.trim()) {
    const fallbackText = await readActiveWorkspaceSourceFileFallbackText({
      activePath: args.activePath,
      activeFile,
      activeWorkspaceEntriesSnapshot: args.activeWorkspaceEntriesSnapshot,
      fs: args.fs,
    })
    if (fallbackText.trim()) {
      nextSourceFiles = materializedSourceFiles.slice()
      nextSourceFiles[activeIndex] = {
        ...activeFile,
        text: fallbackText,
      }
    }
  }
  return pruneWorkspaceSourceFilesToActive({
    sourceFiles: nextSourceFiles,
    activeSourcePath: args.activeSourcePath,
  })
}

async function materializeGraphOwningActiveWorkspaceSourceFiles(args: {
  activePath: WorkspacePath
  fs: WorkspaceFs
  existingSourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  workspaceEntries: WorkspaceEntry[]
  sourcesByPath?: WorkspaceSourceIndex | null
  premergedSourceFiles?: SourceFile[] | null
}): Promise<void> {
  const store = useGraphStore.getState()
  const mergedSourceFiles = args.premergedSourceFiles || mergeWorkspaceEntriesIntoSourceFiles({
    existing: args.existingSourceFiles,
    workspaceEntries: args.workspaceEntries,
    sourcesByPath: resolveWorkspaceSourceIndexSnapshot(args.sourcesByPath || undefined),
    forceIncludePaths: buildMaterializedWorkspaceForceIncludePaths({
      activePathOverride: args.activePath,
    }),
    forceIncludeOnly: true,
    workspaceDocsOnly: readWorkspaceSourceFilesDocsOnlySetting(),
  })
  if (mergedSourceFiles !== args.existingSourceFiles) {
    store.setSourceFiles(mergedSourceFiles)
  }
  const preserveFrontmatterDrivenLanding = isInitializationWorkspacePath(args.activePath)
  await applyWorkspaceImportToCanvas({
    fs: args.fs,
    createdPaths: [args.activePath],
    opts: {
      workspaceEntries: args.workspaceEntries,
      sourcesByPath: resolveWorkspaceSourceIndexSnapshot(args.sourcesByPath || undefined),
      premergedSourceFiles: mergedSourceFiles,
      applyToGraph: true,
      skipComposedGraphApply: preserveFrontmatterDrivenLanding,
    },
  })
}

export async function materializeActiveWorkspaceEntryIntoSourceFiles(args?: {
  activePathOverride?: WorkspacePath | null
  fs?: Awaited<ReturnType<typeof getWorkspaceFs>>
  workspaceEntries?: WorkspaceEntry[]
  activeWorkspaceEntriesSnapshot?: WorkspaceEntry[]
  sourceFilesSnapshot?: SourceFile[]
  sourcesByPath?: WorkspaceSourceIndex
  premergedSourceFiles?: SourceFile[]
  applyToGraph?: boolean
}): Promise<void> {
  const activePath = resolveMaterializedWorkspaceActivePath({
    activePathOverride: args?.activePathOverride ?? null,
    explorerActivePath: useMarkdownExplorerStore.getState().activePath,
  })
  if (!activePath) return
  const shouldApplyToGraph = args?.applyToGraph === true
  const store = useGraphStore.getState()
  const activeSourcePath = resolveWorkspaceSourcePathKey(activePath)
  const existing = Array.isArray(args?.sourceFilesSnapshot) ? args.sourceFilesSnapshot : (Array.isArray(store.sourceFiles) ? store.sourceFiles : [])
  const premergedSourceFiles = Array.isArray(args?.premergedSourceFiles) ? args.premergedSourceFiles : null
  const materializedSourceFiles = premergedSourceFiles || existing
  if (!shouldApplyToGraph && materializedSourceFiles.length > 0) {
    const next = await resolveNonGraphActiveWorkspaceSourceFiles({
      activePath,
      activeSourcePath,
      sourceFiles: materializedSourceFiles,
      activeWorkspaceEntriesSnapshot: args?.activeWorkspaceEntriesSnapshot,
      fs: args?.fs,
    })
    if (next) {
      if (next !== existing) {
        store.setSourceFiles(normalizeWorkspaceSourceFilesToSingleActive({
          sourceFiles: next,
          activeSourcePath,
        }))
      }
      return
    }
  }
  const fs = args?.fs || (await getWorkspaceFs())
  const workspaceEntries = await resolveActiveWorkspaceEntriesSnapshot({
    activePath,
    fs,
    workspaceEntries: args?.workspaceEntries,
    activeWorkspaceEntriesSnapshot: args?.activeWorkspaceEntriesSnapshot,
  })
  if (!shouldApplyToGraph) return
  await materializeGraphOwningActiveWorkspaceSourceFiles({
    activePath,
    fs,
    existingSourceFiles: existing,
    workspaceEntries,
    sourcesByPath: resolveWorkspaceSourceIndexSnapshot(args?.sourcesByPath),
    premergedSourceFiles,
  })
}
