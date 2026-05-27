import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  WORKSPACE_README_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'
import { readWorkspaceActiveEntrySnapshot } from '@/features/source-files/sourceFilesRuntimeActive'
import { resolveMaterializedWorkspaceActivePath } from '@/features/source-files/sourceFilesRuntimeMaterialization'
import { resolveMarkdownWorkspaceCanonicalSelection } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionCanonicalPath'
import { buildWorkspaceEntriesIndex } from '@/lib/markdown-workspace-runtime/workspaceEntriesIndex'

export function buildInitialWorkspaceStartupSnapshot(args: {
  currentActivePath: WorkspacePath | null
  desiredActivePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
  lastSetActivePath?: unknown
  preferCustomValidationSeed?: boolean
}): {
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
} {
  if (args.lastSetActivePath && !args.preferCustomValidationSeed) {
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
  const currentActivePath = resolveWorkspaceStartupCanonicalPath({
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
    ? await readWorkspaceActiveEntrySnapshot({ fs, activePath: desiredActivePath, workspaceEntries: startupWorkspaceEntries })
    : []
  const hasDesiredActiveText = workspaceEntries.some(entry => entry?.kind === 'file' && String(entry.text || '').trim())
  if (!hasDesiredActiveText && !preferCustomValidationSeed) {
    desiredActivePath = resolveWorkspaceStartupCanonicalPath({
      activePath: WORKSPACE_README_SEED_PATH,
      workspaceEntries: startupWorkspaceEntries,
    })
    workspaceEntries = desiredActivePath
      ? await readWorkspaceActiveEntrySnapshot({ fs, activePath: desiredActivePath, workspaceEntries: startupWorkspaceEntries })
      : []
  }
  const snapshot = buildInitialWorkspaceStartupSnapshot({
    currentActivePath,
    desiredActivePath,
    workspaceEntries,
    lastSetActivePath: explorer.lastSetActivePath,
    preferCustomValidationSeed,
  })
  if (desiredActivePath && desiredActivePath !== currentActivePath) {
    explorer.setActivePath(desiredActivePath)
  }
  return snapshot
}
