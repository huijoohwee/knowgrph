import { resolveMarkdownWorkspaceSelectionWritebackSync } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionWriteback'

export function testMarkdownWorkspaceSelectionWritebackCentralizesGraphWritebackPreconditions() {
  const sync = resolveMarkdownWorkspaceSelectionWritebackSync({
    activePath: '/docs/demo.md',
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
    activePath: '/docs/demo.md',
    activeDocumentKey: 'docs/demo.md',
    markdownDocumentName: '/docs/other.md',
    markdownDocumentText: '# Demo',
  })
  if (mismatch !== null) {
    throw new Error('expected writeback helper to suppress sync args for non-matching markdown document paths')
  }

  const missing = resolveMarkdownWorkspaceSelectionWritebackSync({
    activePath: '/docs/demo.md',
    activeDocumentKey: 'docs/demo.md',
    markdownDocumentName: '/docs/demo.md',
    markdownDocumentText: 42,
  })
  if (missing !== null) {
    throw new Error('expected writeback helper to suppress sync args for non-string markdown document text')
  }
}

export function testMarkdownWorkspaceSelectionWritebackSuppressesPendingDocumentSwitchOverwrite() {
  const pendingSwitch = resolveMarkdownWorkspaceSelectionWritebackSync({
    activePath: '/docs_/6706219f-f8d2-418a-90a9-aae18de752a7/6706219f-f8d2-418a-90a9-aae18de752a7.md',
    activeDocumentKey: '/chat-log/20260527T152931Z/chat-stream-log_20260527T152931Z.md',
    markdownDocumentName: '/chat-log/20260527T152931Z/chat-stream-log_20260527T152931Z.md',
    markdownDocumentText: '# Chat Stream Log\n\n- Provider: Agnes AI API · Global · agnes-2.0-flash\n',
  })
  if (pendingSwitch !== null) {
    throw new Error('expected writeback helper to suppress stale graph/editor writeback while the next workspace document owner is still switching')
  }
}

export function testMarkdownWorkspaceSelectionWritebackSuppressesNonMarkdownSources() {
  const csvSync = resolveMarkdownWorkspaceSelectionWritebackSync({
    activePath: '/docs/table.csv',
    activeDocumentKey: 'docs/table.csv',
    markdownDocumentName: '/docs/table.csv',
    markdownDocumentText: '| Column |\n|---|\n| Value |',
  })
  if (csvSync !== null) {
    throw new Error('expected writeback helper to avoid mutating CSV source text with markdown table text')
  }

  const jsonSync = resolveMarkdownWorkspaceSelectionWritebackSync({
    activePath: '/docs/data.json',
    activeDocumentKey: 'docs/data.json',
    markdownDocumentName: '/docs/data.json',
    markdownDocumentText: '# Derived JSON preview',
  })
  if (jsonSync !== null) {
    throw new Error('expected writeback helper to avoid mutating JSON source text with derived markdown text')
  }
}
