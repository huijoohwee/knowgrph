import type { WorkspacePath } from '@/features/workspace-fs/types'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  resolveWorkspaceStartupActivePath,
  TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
} from '@/features/workspace-fs/workspaceFs'
import { hasWorkspaceEntry, type WorkspaceEntriesIndex } from './workspaceEntriesIndex'

export type MarkdownWorkspaceActivePathRequest = { path: WorkspacePath; atMs: number } | null

export function resolveMarkdownWorkspaceBootstrapActivePath(args: {
  entriesIndex: WorkspaceEntriesIndex
  activePath: WorkspacePath | null
  lastSetActivePath: MarkdownWorkspaceActivePathRequest
  lastRequestedActivePath: MarkdownWorkspaceActivePathRequest
  nowMs?: number
}): WorkspacePath | null {
  if (!args.entriesIndex.byPath.size) return null

  const preferCustomValidationSeed =
    CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE &&
    TEST_VALIDATION_WORKSPACE_SEED_REL_PATH !== DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH

  if (!args.lastSetActivePath || preferCustomValidationSeed) {
    const startupPath = resolveWorkspaceStartupActivePath({
      workspaceFilePaths: args.entriesIndex.filePaths,
      activePath: args.activePath,
      preferValidationSeedForDefaultFamily: true,
      forceValidationSeedIfPresent: preferCustomValidationSeed,
    })
    if (startupPath && startupPath !== args.activePath) return startupPath
  }

  if (args.activePath && hasWorkspaceEntry(args.entriesIndex, args.activePath)) return null

  const nowMs = typeof args.nowMs === 'number' ? args.nowMs : Date.now()
  const isRecentlyRequested = (request: MarkdownWorkspaceActivePathRequest) =>
    !!(args.activePath && request?.path === args.activePath && nowMs - request.atMs < 2000)

  if (isRecentlyRequested(args.lastRequestedActivePath) || isRecentlyRequested(args.lastSetActivePath)) {
    return null
  }

  return args.entriesIndex.firstFilePath
}
