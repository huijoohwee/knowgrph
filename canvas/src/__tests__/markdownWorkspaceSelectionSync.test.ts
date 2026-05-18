import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import {
  resolveInitialMarkdownWorkspaceSelectionPath,
  resolveInvalidatedMarkdownWorkspaceSelectionPath,
} from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionSync'
import { buildWorkspaceEntriesIndex } from '@/lib/markdown-workspace-runtime/workspaceEntriesIndex'

const buildFileEntry = (path: string): WorkspaceEntry => ({
  path,
  parentPath: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) || '/' : '/',
  kind: 'file',
  name: path.split('/').pop() || '',
  text: '',
  updatedAtMs: 1,
})

export function testMarkdownWorkspaceSelectionSyncCentralizesHydrationAndInvalidation() {
  const initial = resolveInitialMarkdownWorkspaceSelectionPath({
    selectionPath: null,
    activePath: '/docs/a.md' as never,
  })
  if (initial !== '/docs/a.md') {
    throw new Error(`expected empty selection state to hydrate from active path, got ${String(initial)}`)
  }

  const preserveMatching = resolveInitialMarkdownWorkspaceSelectionPath({
    selectionPath: '/docs/a.md' as never,
    activePath: '/docs/a.md' as never,
  })
  if (preserveMatching !== null) {
    throw new Error(`expected matching selection state to avoid redundant hydration, got ${String(preserveMatching)}`)
  }

  const syncExternalActiveChange = resolveInitialMarkdownWorkspaceSelectionPath({
    selectionPath: '/docs/b.md' as never,
    activePath: '/docs/a.md' as never,
  })
  if (syncExternalActiveChange !== '/docs/a.md') {
    throw new Error(`expected external active path changes to update selection, got ${String(syncExternalActiveChange)}`)
  }

  const loadingNoop = resolveInvalidatedMarkdownWorkspaceSelectionPath({
    selectionPath: '/docs/missing.md' as never,
    activePath: '/docs/a.md' as never,
    entriesIndex: buildWorkspaceEntriesIndex([buildFileEntry('/docs/a.md')]),
    loading: true,
  })
  if (typeof loadingNoop !== 'undefined') {
    throw new Error(`expected loading invalidation check to noop, got ${String(loadingNoop)}`)
  }

  const fallbackToActive = resolveInvalidatedMarkdownWorkspaceSelectionPath({
    selectionPath: '/docs/missing.md' as never,
    activePath: '/docs/a.md' as never,
    entriesIndex: buildWorkspaceEntriesIndex([buildFileEntry('/docs/a.md')]),
    loading: false,
  })
  if (fallbackToActive !== '/docs/a.md') {
    throw new Error(`expected missing selection to fall back to active path, got ${String(fallbackToActive)}`)
  }

  const clearMissing = resolveInvalidatedMarkdownWorkspaceSelectionPath({
    selectionPath: '/docs/missing.md' as never,
    activePath: '/docs/also-missing.md' as never,
    entriesIndex: buildWorkspaceEntriesIndex([buildFileEntry('/docs/a.md')]),
    loading: false,
  })
  if (clearMissing !== null) {
    throw new Error(`expected missing selection with missing active path to clear, got ${String(clearMissing)}`)
  }
}
