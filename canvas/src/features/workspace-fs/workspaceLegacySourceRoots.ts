import { normalizeWorkspacePath } from './path'
import type { WorkspaceEntry, WorkspacePath } from './types'

export const LEGACY_AGENTIC_OS_DOCS_ROOT_PATH = normalizeWorkspacePath('/agentic-os-docs')
const LEGACY_VIDEO_RUNS_ROOT_PATTERN = /^\/video-runs(?:-\d+)?(?:\/|$)/i

export const isLegacyAgenticOsDocsWorkspacePath = (
  path: WorkspacePath | string | null | undefined,
): boolean => {
  const normalizedPath = normalizeWorkspacePath(String(path || ''))
  return normalizedPath === LEGACY_AGENTIC_OS_DOCS_ROOT_PATH
    || normalizedPath.startsWith(`${LEGACY_AGENTIC_OS_DOCS_ROOT_PATH}/`)
}

export const isLegacyVideoRunsWorkspacePath = (
  path: WorkspacePath | string | null | undefined,
): boolean => LEGACY_VIDEO_RUNS_ROOT_PATTERN.test(normalizeWorkspacePath(String(path || '')))

export const isLegacyWorkspaceSourcePath = (
  path: WorkspacePath | string | null | undefined,
): boolean => isLegacyAgenticOsDocsWorkspacePath(path) || isLegacyVideoRunsWorkspacePath(path)

export const excludeLegacyWorkspaceSourceEntries = (
  entries: ReadonlyArray<WorkspaceEntry>,
): WorkspaceEntry[] => entries.filter(entry => !isLegacyWorkspaceSourcePath(entry?.path))
