import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { loadWorkspaceSourceIndex, type WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  resolveWorkspaceStartupActivePath,
} from '@/features/workspace-fs/workspaceFs'

export async function materializeActiveWorkspaceEntryIntoSourceFiles(args?: {
  activePathOverride?: WorkspacePath | null
  fs?: Awaited<ReturnType<typeof getWorkspaceFs>>
  workspaceEntries?: WorkspaceEntry[]
  sourcesByPath?: WorkspaceSourceIndex
  applyToGraph?: boolean
}): Promise<void> {
  const activePath = String(args?.activePathOverride ?? useMarkdownExplorerStore.getState().activePath ?? '').trim()
  if (!activePath) return
  const fs = args?.fs || (await getWorkspaceFs())
  await fs.ensureSeed()
  const workspaceEntries = Array.isArray(args?.workspaceEntries) ? args.workspaceEntries : await fs.listEntries()
  const sourcesByPath = args?.sourcesByPath || loadWorkspaceSourceIndex()
  const store = useGraphStore.getState()
  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const merged = mergeWorkspaceEntriesIntoSourceFiles({
    existing,
    workspaceEntries,
    sourcesByPath,
    forceIncludePaths: [activePath],
  })
  if (merged !== existing) {
    store.setSourceFiles(merged)
  }
  const materialized = await applyWorkspaceImportToCanvas({
    fs,
    createdPaths: [activePath],
    opts: {
      workspaceEntries,
      sourcesByPath,
      applyToGraph: args?.applyToGraph === true,
    },
  })
  if (args?.applyToGraph === true && (materialized.parsedCount > 0 || materialized.enabledCount > 0)) {
    scheduleApplyComposedGraphFromSourceFiles()
  }
}

export async function resolveInitialWorkspaceStartupState(): Promise<{
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
}> {
  const explorer = useMarkdownExplorerStore.getState()
  const store = useGraphStore.getState()
  const preferValidationSeedForRenderer = store.canvas2dRenderer === 'flowEditor'
  const preferCustomValidationSeed =
    CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE &&
    TEST_VALIDATION_WORKSPACE_SEED_REL_PATH !== DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const workspaceEntries = await fs.listEntries()
  const workspaceFilePaths = workspaceEntries
    .filter((entry): entry is { path: WorkspacePath; kind: 'file' } => entry.kind === 'file')
    .map(entry => entry.path)
  const desiredActivePath = resolveWorkspaceStartupActivePath({
    workspaceFilePaths,
    activePath: explorer.activePath,
    preferValidationSeedForDefaultFamily: preferCustomValidationSeed || preferValidationSeedForRenderer,
    forceValidationSeedIfPresent: preferCustomValidationSeed,
  })
  if (explorer.lastSetActivePath && !preferCustomValidationSeed) {
    if (!desiredActivePath || desiredActivePath === explorer.activePath) {
      return { activePath: explorer.activePath, workspaceEntries: [] }
    }
  }
  if (desiredActivePath && desiredActivePath !== explorer.activePath) {
    explorer.setActivePath(desiredActivePath)
  }
  return { activePath: desiredActivePath, workspaceEntries }
}
