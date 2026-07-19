import { normalizeWorkspacePath } from './path'
import type { WorkspaceEntry, WorkspacePath } from './types'

export const LEGACY_AGENTIC_OS_DOCS_ROOT_PATH = normalizeWorkspacePath('/agentic-os-docs')

export const isLegacyAgenticOsDocsWorkspacePath = (
  path: WorkspacePath | string | null | undefined,
): boolean => {
  const normalizedPath = normalizeWorkspacePath(String(path || ''))
  return normalizedPath === LEGACY_AGENTIC_OS_DOCS_ROOT_PATH
    || normalizedPath.startsWith(`${LEGACY_AGENTIC_OS_DOCS_ROOT_PATH}/`)
}

export const excludeLegacyAgenticOsDocsWorkspaceEntries = (
  entries: ReadonlyArray<WorkspaceEntry>,
): WorkspaceEntry[] => entries.filter(entry => !isLegacyAgenticOsDocsWorkspacePath(entry?.path))
