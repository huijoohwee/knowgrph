import { joinWorkspacePath, normalizeWorkspacePath, workspaceBasename } from './path'
import type { WorkspaceEntrySource, WorkspaceSourceIndex } from './sourceIndex'
import type { WorkspacePath } from './types'
import { WORKSPACE_AUTHORED_NOTES_SOURCE_ROOT_PATH, WORKSPACE_DOCS_SOURCE_ROOT_PATH } from './workspaceSourceRoots'

const LEGACY_AUTHORED_NOTE_BASENAME = /^note_\d{8}T\d{6}Z(?:-\d+)?\.md$/i

const isLegacyAuthoredNoteBasename = (path: WorkspacePath): boolean => (
  LEGACY_AUTHORED_NOTE_BASENAME.test(workspaceBasename(path))
)

export function isLegacyAuthoredMarkdownNotePath(
  path: WorkspacePath,
  sourceIndex: WorkspaceSourceIndex,
): boolean {
  const normalizedPath = normalizeWorkspacePath(path)
  const source = sourceIndex[normalizedPath]
  if (!source || source.kind !== 'local') return false
  if (!normalizedPath.startsWith(`${WORKSPACE_DOCS_SOURCE_ROOT_PATH}/`)) return false
  const relativePath = normalizedPath.slice(WORKSPACE_DOCS_SOURCE_ROOT_PATH.length + 1)
  if (relativePath.includes('/')) return false
  return isLegacyAuthoredNoteBasename(normalizedPath)
}

export function isMigratedAuthoredMarkdownNoteMirrorPath(
  path: WorkspacePath,
  sourceIndex: WorkspaceSourceIndex,
): boolean {
  const normalizedPath = normalizeWorkspacePath(path)
  if (!normalizedPath.startsWith(`${WORKSPACE_DOCS_SOURCE_ROOT_PATH}/`)) return false
  const relativePath = normalizedPath.slice(WORKSPACE_DOCS_SOURCE_ROOT_PATH.length + 1)
  if (relativePath.includes('/') || !isLegacyAuthoredNoteBasename(normalizedPath)) return false
  const authoredPath = joinWorkspacePath(WORKSPACE_AUTHORED_NOTES_SOURCE_ROOT_PATH, workspaceBasename(normalizedPath))
  return sourceIndex[authoredPath]?.kind === 'local'
}

export function resolveAuthoredMarkdownNotePath(args: {
  legacyPath: WorkspacePath
  occupiedPaths: ReadonlySet<string>
}): WorkspacePath {
  const basename = workspaceBasename(args.legacyPath)
  const extensionIndex = basename.lastIndexOf('.')
  const stem = extensionIndex > 0 ? basename.slice(0, extensionIndex) : basename
  const extension = extensionIndex > 0 ? basename.slice(extensionIndex) : ''
  let candidate = joinWorkspacePath(WORKSPACE_AUTHORED_NOTES_SOURCE_ROOT_PATH, basename)
  for (let suffix = 2; args.occupiedPaths.has(candidate); suffix += 1) {
    candidate = joinWorkspacePath(WORKSPACE_AUTHORED_NOTES_SOURCE_ROOT_PATH, `${stem}-${suffix}${extension}`)
  }
  return normalizeWorkspacePath(candidate)
}

export function preserveAuthoredMarkdownNoteSource(source: WorkspaceEntrySource): WorkspaceEntrySource {
  return source.kind === 'local'
    ? { kind: 'local', originalName: source.originalName ?? null }
    : source
}
