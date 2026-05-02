import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import { resolveMarkdownWorkspaceCanonicalSelection } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionCanonicalPath'

const buildFileEntry = (path: string): WorkspaceEntry => ({
  path,
  parentPath: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) || '/' : '/',
  kind: 'file',
  name: path.split('/').pop() || '',
  text: '',
  updatedAtMs: 1,
})

export function testMarkdownWorkspaceSelectionCanonicalPathCentralizesLegacyPathUpgrade() {
  const tracePath = '/sandbox/chat-log/kgc-trace_20260419180222.md'
  const canonicalPath = '/sandbox/chat-log/kgc_20260419180222.md'

  const mirrored = resolveMarkdownWorkspaceCanonicalSelection({
    activePath: tracePath as never,
    selectionPath: tracePath as never,
    entries: [buildFileEntry(canonicalPath)],
  })
  if (!mirrored || mirrored.activePath !== canonicalPath || mirrored.selectionPath !== canonicalPath) {
    throw new Error(`expected legacy trace path to upgrade active and mirrored selection paths, got ${JSON.stringify(mirrored)}`)
  }

  const activeOnly = resolveMarkdownWorkspaceCanonicalSelection({
    activePath: tracePath as never,
    selectionPath: '/docs/other.md' as never,
    entries: [buildFileEntry(canonicalPath), buildFileEntry('/docs/other.md')],
  })
  if (!activeOnly || activeOnly.activePath !== canonicalPath || activeOnly.selectionPath !== null) {
    throw new Error(`expected canonical upgrade without unrelated selection mirroring, got ${JSON.stringify(activeOnly)}`)
  }

  const missingCanonical = resolveMarkdownWorkspaceCanonicalSelection({
    activePath: tracePath as never,
    selectionPath: tracePath as never,
    entries: [buildFileEntry('/docs/other.md')],
  })
  if (missingCanonical !== null) {
    throw new Error(`expected no canonical upgrade when target file is absent, got ${JSON.stringify(missingCanonical)}`)
  }
}
