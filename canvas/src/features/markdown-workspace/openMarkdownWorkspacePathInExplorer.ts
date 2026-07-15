import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { requestMarkdownExplorerSourceFilesOpen } from '@/features/markdown/ui/useMarkdownExplorerSectionCollapseState'
import { openMarkdownWorkspaceEditorPane } from '@/features/workspace-table/workspaceTableSsot'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS } from '@/lib/config'
import { emitMarkdownLayoutRequest } from '@/lib/markdown-workspace-runtime/markdownWorkspaceRuntime.shared'
import { normalizeMarkdownWorkspaceSelectionPath } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionPath'
import { lsSetJson } from '@/lib/persistence'
import { ancestorPathsForWorkspacePath } from '@/features/workspace-fs/path'
import {
  persistMarkdownSourceFolderPaths,
  readPersistedMarkdownSourceFolderPaths,
} from '@/features/markdown/ui/markdownSourceFilesPersistence'

export function openMarkdownWorkspacePathInExplorer(path: string): string | null {
  const normalized = normalizeMarkdownWorkspaceSelectionPath(path as never)
  if (!normalized) return null
  const expandedPaths = new Set(readPersistedMarkdownSourceFolderPaths())
  for (const ancestor of ancestorPathsForWorkspacePath(normalized)) expandedPaths.add(ancestor)
  persistMarkdownSourceFolderPaths(expandedPaths)
  openMarkdownWorkspaceEditorPane(useGraphStore.getState())
  requestMarkdownExplorerSourceFilesOpen(normalized)
  if (typeof window !== 'undefined') {
    window.setTimeout(() => requestMarkdownExplorerSourceFilesOpen(normalized), 0)
  }
  const explorer = useMarkdownExplorerStore.getState()
  if (explorer.activePath === normalized) explorer.setActivePath(null)
  useMarkdownExplorerStore.getState().setActivePath(normalized)
  lsSetJson<'split' | 'editor' | 'viewer'>(LS_KEYS.markdownLayoutMode, 'editor')
  emitMarkdownLayoutRequest('editor')
  return normalized
}
