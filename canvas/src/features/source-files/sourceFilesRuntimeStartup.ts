import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  WORKSPACE_README_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'
import { readWorkspaceSourceRootEntriesSnapshot } from '@/features/source-files/sourceFilesRuntimeActive'
import { resolveMaterializedWorkspaceActivePath } from '@/features/source-files/sourceFilesRuntimeMaterialization'
import { resolveMarkdownWorkspaceCanonicalSelection } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionCanonicalPath'
import { buildWorkspaceEntriesIndex, hasWorkspaceFileEntry } from '@/lib/markdown-workspace-runtime/workspaceEntriesIndex'

export function buildInitialWorkspaceStartupSnapshot(args: {
  currentActivePath: WorkspacePath | null
  desiredActivePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
  lastSetActivePath?: unknown
  preferCustomValidationSeed?: boolean
  sourceFilesMaterialized?: boolean
}): {
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
} {
  if (args.lastSetActivePath && args.sourceFilesMaterialized !== false && !args.preferCustomValidationSeed) {
    if (!args.desiredActivePath || args.desiredActivePath === args.currentActivePath) {
      return {
        activePath: args.currentActivePath,
        workspaceEntries: [],
      }
    }
  }
  return {
    activePath: args.desiredActivePath,
    workspaceEntries: args.workspaceEntries,
  }
}

function hasMaterializedWorkspaceSourceFiles(): boolean {
  const list = useGraphStore.getState().sourceFiles
  return Array.isArray(list) && list.some(file => String(file?.source?.path || '').startsWith('workspace:'))
}

export function resolveWorkspaceStartupCanonicalPath(args: {
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
}): WorkspacePath | null {
  const activePath = args.activePath
  if (!activePath) return null
  const canonicalSelection = resolveMarkdownWorkspaceCanonicalSelection({
    activePath,
    selectionPath: null,
    entriesIndex: buildWorkspaceEntriesIndex(Array.isArray(args.workspaceEntries) ? args.workspaceEntries : []),
  })
  return canonicalSelection?.activePath || activePath
}

export function resolveExistingWorkspaceStartupCanonicalPath(args: {
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
}): WorkspacePath | null {
  const canonicalPath = resolveWorkspaceStartupCanonicalPath(args)
  if (!canonicalPath) return null
  return hasWorkspaceFileEntry(buildWorkspaceEntriesIndex(args.workspaceEntries), canonicalPath)
    ? canonicalPath
    : null
}

export function resolveWorkspaceStartupActivePathToApply(args: {
  currentActivePath: WorkspacePath | null
  latestActivePath: WorkspacePath | null
  snapshotActivePath: WorkspacePath | null
  preferCustomValidationSeed?: boolean
}): WorkspacePath | null {
  if (!args.snapshotActivePath) return null
  if (
    !args.preferCustomValidationSeed &&
    args.latestActivePath &&
    args.latestActivePath !== args.currentActivePath &&
    args.latestActivePath !== args.snapshotActivePath
  ) {
    return null
  }
  return args.snapshotActivePath === args.latestActivePath ? null : args.snapshotActivePath
}

export function shouldFallbackWorkspaceStartupToReadme(args: {
  activePath: WorkspacePath | null
  hasDesiredActiveText: boolean
  preferCustomValidationSeed?: boolean
}): boolean {
  return !args.activePath && !args.hasDesiredActiveText && !args.preferCustomValidationSeed
}

export async function resolveInitialWorkspaceStartupState(): Promise<{
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
}> {
  const explorer = useMarkdownExplorerStore.getState()
  const preferCustomValidationSeed =
    CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE &&
    TEST_VALIDATION_WORKSPACE_SEED_REL_PATH !== DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const startupWorkspaceEntries = await fs.listEntries()
  const currentActivePath = resolveExistingWorkspaceStartupCanonicalPath({
    activePath: resolveMaterializedWorkspaceActivePath({ explorerActivePath: explorer.activePath }),
    workspaceEntries: startupWorkspaceEntries,
  })
  let desiredActivePath = preferCustomValidationSeed
    ? TEST_VALIDATION_WORKSPACE_SEED_PATH
    : currentActivePath
  desiredActivePath = resolveWorkspaceStartupCanonicalPath({
    activePath: desiredActivePath,
    workspaceEntries: startupWorkspaceEntries,
  })
  let workspaceEntries = desiredActivePath
    ? await readWorkspaceSourceRootEntriesSnapshot({ fs, activePath: desiredActivePath, workspaceEntries: startupWorkspaceEntries })
    : startupWorkspaceEntries
  const hasDesiredActiveText = workspaceEntries.some(entry => entry?.kind === 'file' && entry.path === desiredActivePath && String(entry.text || '').trim())
  if (shouldFallbackWorkspaceStartupToReadme({
    activePath: currentActivePath,
    hasDesiredActiveText,
    preferCustomValidationSeed,
  })) {
    desiredActivePath = resolveWorkspaceStartupCanonicalPath({
      activePath: WORKSPACE_README_SEED_PATH,
      workspaceEntries: startupWorkspaceEntries,
    })
    workspaceEntries = desiredActivePath
      ? await readWorkspaceSourceRootEntriesSnapshot({ fs, activePath: desiredActivePath, workspaceEntries: startupWorkspaceEntries })
      : startupWorkspaceEntries
  }
  const latestExplorer = useMarkdownExplorerStore.getState()
  const latestActivePath = resolveExistingWorkspaceStartupCanonicalPath({
    activePath: resolveMaterializedWorkspaceActivePath({ explorerActivePath: latestExplorer.activePath }),
    workspaceEntries: startupWorkspaceEntries,
  })
  if (!preferCustomValidationSeed && latestActivePath && latestActivePath !== currentActivePath) {
    const latestWorkspaceEntries = latestActivePath === desiredActivePath
      ? workspaceEntries
      : await readWorkspaceSourceRootEntriesSnapshot({ fs, activePath: latestActivePath, workspaceEntries: startupWorkspaceEntries })
    return buildInitialWorkspaceStartupSnapshot({
      currentActivePath: latestActivePath,
      desiredActivePath: latestActivePath,
      workspaceEntries: latestWorkspaceEntries,
      lastSetActivePath: latestExplorer.lastSetActivePath,
      preferCustomValidationSeed,
      sourceFilesMaterialized: hasMaterializedWorkspaceSourceFiles(),
    })
  }
  const snapshot = buildInitialWorkspaceStartupSnapshot({
    currentActivePath,
    desiredActivePath,
    workspaceEntries,
    lastSetActivePath: explorer.lastSetActivePath,
    preferCustomValidationSeed,
    sourceFilesMaterialized: hasMaterializedWorkspaceSourceFiles(),
  })
  const activePathToApply = resolveWorkspaceStartupActivePathToApply({
    currentActivePath,
    latestActivePath,
    snapshotActivePath: snapshot.activePath,
    preferCustomValidationSeed,
  })
  if (activePathToApply) {
    useMarkdownExplorerStore.getState().setActivePath(activePathToApply)
  }
  return snapshot
}
