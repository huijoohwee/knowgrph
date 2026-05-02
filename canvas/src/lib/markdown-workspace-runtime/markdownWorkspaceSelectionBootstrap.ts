import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  resolveWorkspaceStartupActivePath,
  TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
} from '@/features/workspace-fs/workspaceFs'

export type MarkdownWorkspaceActivePathRequest = { path: WorkspacePath; atMs: number } | null

export function resolveMarkdownWorkspaceBootstrapActivePath(args: {
  entries: WorkspaceEntry[]
  activePath: WorkspacePath | null
  lastSetActivePath: MarkdownWorkspaceActivePathRequest
  lastRequestedActivePath: MarkdownWorkspaceActivePathRequest
  nowMs?: number
}): WorkspacePath | null {
  if (!args.entries.length) return null

  const workspaceFilePaths = args.entries
    .filter((entry): entry is WorkspaceEntry & { kind: 'file' } => entry.kind === 'file')
    .map(entry => entry.path)

  const preferCustomValidationSeed =
    CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE &&
    TEST_VALIDATION_WORKSPACE_SEED_REL_PATH !== DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH

  if (!args.lastSetActivePath || preferCustomValidationSeed) {
    const startupPath = resolveWorkspaceStartupActivePath({
      workspaceFilePaths,
      activePath: args.activePath,
      preferValidationSeedForDefaultFamily: preferCustomValidationSeed,
      forceValidationSeedIfPresent: preferCustomValidationSeed,
    })
    if (startupPath && startupPath !== args.activePath) return startupPath
  }

  if (args.activePath && args.entries.some(entry => entry.path === args.activePath)) return null

  const nowMs = typeof args.nowMs === 'number' ? args.nowMs : Date.now()
  const isRecentlyRequested = (request: MarkdownWorkspaceActivePathRequest) =>
    !!(args.activePath && request?.path === args.activePath && nowMs - request.atMs < 2000)

  if (isRecentlyRequested(args.lastRequestedActivePath) || isRecentlyRequested(args.lastSetActivePath)) {
    return null
  }

  const firstFile = args.entries.find(entry => entry.kind === 'file')
  return firstFile ? firstFile.path : null
}
