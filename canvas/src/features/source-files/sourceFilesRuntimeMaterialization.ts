import { useGraphStore } from '@/hooks/useGraphStore'
import { isMarkdownLikeFileName } from 'grph-shared/markdown/mermaidInput'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { applyActiveMarkdownDocumentPayload } from '@/features/markdown/activeMarkdownDocument'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'
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
import { resolveWorkspaceSourceRootPaths } from '@/features/workspace-fs/workspaceSourceRoots'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
import {
  isInitializationWorkspacePath,
} from '@/features/workspace-fs/workspaceFs'
import { readWorkspaceSourceFilesDocsOnlySetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import {
  readActiveWorkspaceSourceFileFallbackText,
  readWorkspaceActiveDocumentResolvedText,
  resolveActiveWorkspaceEntriesSnapshot,
} from '@/features/source-files/sourceFilesRuntimeActive'

function ensureActiveWorkspaceSourceFileEnabled(args: {
  sourceFiles: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  activeSourcePath: string
}): ReturnType<typeof useGraphStore.getState>['sourceFiles'] {
  const list = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  if (list.length === 0) return list
  let changed = false
  const next = list.map(file => {
    if (!file) return file
    const sourcePath = String(file.source?.path || '')
    if (!sourcePath.startsWith('workspace:') || sourcePath !== args.activeSourcePath) return file
    if (file.enabled === true) return file
    changed = true
    return { ...file, enabled: true }
  })
  return changed ? next : list
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

export function shouldProactivelyReapplyClosedPaneActiveMarkdownDocument(args: {
  activePath: WorkspacePath | null
  markdownDocumentName: string | null | undefined
  markdownDocumentText: string | null | undefined
  markdownDocumentApplyViewPreset?: boolean
  workspaceViewMode: 'canvas' | 'editor'
  workspaceCanvasPaneOpen: boolean
}): boolean {
  const activePath = normalizeWorkspacePath(args.activePath)
  if (!activePath || !isMarkdownLikeFileName(activePath)) return false
  if (isWorkspaceEditorOverlayOpen({
    workspaceViewMode: args.workspaceViewMode,
    workspaceCanvasPaneOpen: args.workspaceCanvasPaneOpen,
  })) {
    return false
  }
  return true
}

const readActiveWorkspaceEntryInlineText = (args: {
  activePath: WorkspacePath
  activeWorkspaceEntriesSnapshot?: WorkspaceEntry[]
}): string => {
  const activePath = normalizeWorkspacePath(args.activePath)
  if (!activePath) return ''
  const entries = Array.isArray(args.activeWorkspaceEntriesSnapshot) ? args.activeWorkspaceEntriesSnapshot : []
  const activeEntry = entries.find(entry => entry?.kind === 'file' && normalizeWorkspacePath(entry.path) === activePath) || null
  return typeof activeEntry?.text === 'string' ? activeEntry.text : ''
}

export function shouldCommitResolvedActiveMarkdownText(args: {
  activePath: WorkspacePath | null
  resolvedText: string
  activeWorkspaceEntriesSnapshot?: WorkspaceEntry[]
}): boolean {
  if (String(args.resolvedText || '').trim()) return true
  const activePath = normalizeWorkspacePath(args.activePath)
  if (!activePath) return false
  const entries = Array.isArray(args.activeWorkspaceEntriesSnapshot) ? args.activeWorkspaceEntriesSnapshot : []
  return entries.some(entry => entry?.kind === 'file' && normalizeWorkspacePath(entry.path) === activePath)
}

export async function reapplyClosedPaneActiveMarkdownDocument(args?: {
  activePathOverride?: WorkspacePath | null
  fs?: Awaited<ReturnType<typeof getWorkspaceFs>>
  activeWorkspaceEntriesSnapshot?: WorkspaceEntry[]
}): Promise<boolean> {
  const activePath = resolveMaterializedWorkspaceActivePath({
    activePathOverride: args?.activePathOverride ?? null,
    explorerActivePath: useMarkdownExplorerStore.getState().activePath,
  })
  const store = useGraphStore.getState()
  if (!shouldProactivelyReapplyClosedPaneActiveMarkdownDocument({
    activePath,
    markdownDocumentName: store.markdownDocumentName,
    markdownDocumentText: store.markdownDocumentText,
    markdownDocumentApplyViewPreset: store.markdownDocumentApplyViewPreset,
    workspaceViewMode: store.workspaceViewMode,
    workspaceCanvasPaneOpen: store.workspaceCanvasPaneOpen,
  })) {
    return false
  }
  if (!activePath) return false
  const currentText = readActiveWorkspaceEntryInlineText({
    activePath,
    activeWorkspaceEntriesSnapshot: args?.activeWorkspaceEntriesSnapshot,
  })
  const nextText = await readWorkspaceActiveDocumentResolvedText({
    activePath,
    currentText,
    fs: args?.fs,
  })
  if (!shouldCommitResolvedActiveMarkdownText({
    activePath,
    resolvedText: nextText,
    activeWorkspaceEntriesSnapshot: args?.activeWorkspaceEntriesSnapshot,
  })) {
    return false
  }
  const latestActivePath = resolveMaterializedWorkspaceActivePath({
    explorerActivePath: useMarkdownExplorerStore.getState().activePath,
  })
  if (normalizeWorkspacePath(latestActivePath) !== activePath) return false
  if (
    matchesMarkdownDocumentPath(activePath, store.markdownDocumentName) &&
    String(store.markdownDocumentText || '') === nextText &&
    store.markdownDocumentApplyViewPreset !== false
  ) {
    return false
  }
  return !!(await applyActiveMarkdownDocumentPayload({
    setActiveMarkdownDocument: store.setActiveMarkdownDocument,
    name: activePath,
    text: nextText,
    autoEnableFrontmatter: true,
    applyViewPreset: true,
    applyToGraph: true,
    forceApplyToGraph: true,
    normalizeWebpageFrontmatterToMarkdown: false,
  }))
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
  workspaceSourceRootPaths?: WorkspacePath[]
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
    preserveExistingWorkspaceEntries: true,
    workspaceDocsOnly: args.workspaceDocsOnly,
    workspaceSourceRootPaths: args.workspaceSourceRootPaths,
  })
  const runtimeSourceFiles = ensureActiveWorkspaceSourceFileEnabled({
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
  return ensureActiveWorkspaceSourceFileEnabled({
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
    preserveExistingWorkspaceEntries: true,
    workspaceDocsOnly: readWorkspaceSourceFilesDocsOnlySetting(),
    workspaceSourceRootPaths: resolveWorkspaceSourceRootPaths({
      chatLocalStorageRootPath: store.chatLocalStorageRootPath,
    }),
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
        store.setSourceFiles(ensureActiveWorkspaceSourceFileEnabled({
          sourceFiles: next,
          activeSourcePath,
        }))
      }
      await reapplyClosedPaneActiveMarkdownDocument({
        activePathOverride: activePath,
        fs: args?.fs,
        activeWorkspaceEntriesSnapshot: args?.activeWorkspaceEntriesSnapshot,
      })
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
  if (!shouldApplyToGraph) {
    const runtimeSnapshot = buildActiveWorkspaceRuntimeSourceFilesSnapshot({
      activePath,
      existingSourceFiles: existing,
      workspaceEntries,
      sourcesByPath: resolveWorkspaceSourceIndexSnapshot(args?.sourcesByPath),
      workspaceDocsOnly: readWorkspaceSourceFilesDocsOnlySetting(),
      workspaceSourceRootPaths: resolveWorkspaceSourceRootPaths({
        chatLocalStorageRootPath: store.chatLocalStorageRootPath,
      }),
    })
    if (runtimeSnapshot.runtimeSourceFiles !== existing) {
      store.setSourceFiles(runtimeSnapshot.runtimeSourceFiles)
    }
    await reapplyClosedPaneActiveMarkdownDocument({
      activePathOverride: activePath,
      fs,
      activeWorkspaceEntriesSnapshot: workspaceEntries,
    })
    return
  }
  await materializeGraphOwningActiveWorkspaceSourceFiles({
    activePath,
    fs,
    existingSourceFiles: existing,
    workspaceEntries,
    sourcesByPath: resolveWorkspaceSourceIndexSnapshot(args?.sourcesByPath),
    premergedSourceFiles,
  })
  await reapplyClosedPaneActiveMarkdownDocument({
    activePathOverride: activePath,
    fs,
    activeWorkspaceEntriesSnapshot: workspaceEntries,
  })
}
