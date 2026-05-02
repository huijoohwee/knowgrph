import {
  readMarkdownWorkspaceRestoreTextForPath,
  resolveMarkdownWorkspaceRestoreTextCandidate,
} from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionRestore'

export function testMarkdownWorkspaceSelectionRestoreCentralizesPathMatchedTextRecovery() {
  const path = '/docs/demo.md' as never

  const fromSnapshot = resolveMarkdownWorkspaceRestoreTextCandidate({
    path,
    collapsedSnapshot: { path, text: '# Snapshot' },
    lastLoaded: { path, text: '# Last loaded' },
  })
  if (fromSnapshot !== '# Snapshot') {
    throw new Error(`expected restore candidate to prefer collapsed snapshot text, got ${String(fromSnapshot)}`)
  }

  const fallback = resolveMarkdownWorkspaceRestoreTextCandidate({
    path,
    collapsedSnapshot: { path, text: '   ' },
    lastLoaded: { path, text: '# Last loaded' },
  })
  if (fallback !== '# Last loaded') {
    throw new Error(`expected restore candidate to fall back to last loaded text when snapshot is blank, got ${String(fallback)}`)
  }

  const mismatch = readMarkdownWorkspaceRestoreTextForPath(
    { path: '/docs/other.md' as never, text: '# Other' },
    path,
  )
  if (mismatch !== '') {
    throw new Error(`expected restore helper to ignore snapshots for other paths, got ${String(mismatch)}`)
  }

  const blank = readMarkdownWorkspaceRestoreTextForPath({ path, text: ' ' }, path)
  if (blank !== '') {
    throw new Error('expected restore helper to suppress blank restore text')
  }
}
