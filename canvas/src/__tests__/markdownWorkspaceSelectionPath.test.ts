import path from 'node:path'

import { normalizeMarkdownWorkspaceSelectionPath } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionPath'

const normalizeFsPath = (value: string): string => String(value || '').replace(/\\/g, '/')
const ABSOLUTE_DOCS_VIDEO_DEMO_PATH = normalizeFsPath(
  path.resolve(process.cwd(), '..', '..', 'huijoohwee', 'docs', 'knowgrph-video-demo.md'),
)

export function testMarkdownWorkspaceSelectionPathCentralizesNormalizationAndCanonicalization() {
  const canonicalKgc = normalizeMarkdownWorkspaceSelectionPath('sandbox/chat-log/kgc-trace_20260419180222.md' as never)
  if (canonicalKgc !== '/sandbox/chat-log/kgc_20260419180222.md') {
    throw new Error(`expected shared selection path helper to normalize and canonicalize KGC trace paths, got ${String(canonicalKgc)}`)
  }

  const unchanged = normalizeMarkdownWorkspaceSelectionPath('/docs/note.md' as never)
  if (unchanged !== '/docs/note.md') {
    throw new Error(`expected ordinary workspace paths to stay stable, got ${String(unchanged)}`)
  }

  const absoluteDocsPath = normalizeMarkdownWorkspaceSelectionPath(
    ABSOLUTE_DOCS_VIDEO_DEMO_PATH as never,
  )
  if (absoluteDocsPath !== '/docs/knowgrph-video-demo.md') {
    throw new Error(`expected absolute docs-backed selection paths to canonicalize to workspace /docs path, got ${String(absoluteDocsPath)}`)
  }

  const empty = normalizeMarkdownWorkspaceSelectionPath(null)
  if (empty !== null) {
    throw new Error(`expected null selection paths to stay null, got ${String(empty)}`)
  }
}
