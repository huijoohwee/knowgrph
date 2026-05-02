import { resolveMarkdownWorkspaceSelectionWritebackSync } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionWriteback'

export function testMarkdownWorkspaceSelectionWritebackCentralizesGraphWritebackPreconditions() {
  const sync = resolveMarkdownWorkspaceSelectionWritebackSync({
    activeDocumentKey: ' docs/demo.md ',
    markdownDocumentName: '/docs/demo.md',
    markdownDocumentText: '# Demo',
  })

  if (!sync) {
    throw new Error('expected writeback helper to build sync args for matching markdown documents')
  }
  if (sync.docKey !== 'docs/demo.md') {
    throw new Error(`expected writeback helper to trim the active document key, got ${String(sync.docKey)}`)
  }
  if (sync.markdownName !== '/docs/demo.md') {
    throw new Error(`expected writeback helper to preserve markdown document name, got ${String(sync.markdownName)}`)
  }
  if (sync.nextText !== '# Demo') {
    throw new Error(`expected writeback helper to preserve markdown document text, got ${String(sync.nextText)}`)
  }

  const mismatch = resolveMarkdownWorkspaceSelectionWritebackSync({
    activeDocumentKey: 'docs/demo.md',
    markdownDocumentName: '/docs/other.md',
    markdownDocumentText: '# Demo',
  })
  if (mismatch !== null) {
    throw new Error('expected writeback helper to suppress sync args for non-matching markdown document paths')
  }

  const missing = resolveMarkdownWorkspaceSelectionWritebackSync({
    activeDocumentKey: 'docs/demo.md',
    markdownDocumentName: '/docs/demo.md',
    markdownDocumentText: 42,
  })
  if (missing !== null) {
    throw new Error('expected writeback helper to suppress sync args for non-string markdown document text')
  }
}
