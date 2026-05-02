import { buildMarkdownWorkspaceRestoredActiveDocumentArgs } from '@/lib/markdown-workspace-runtime/markdownWorkspaceActiveDocumentRestore'

export function testMarkdownWorkspaceActiveDocumentRestoreCentralizesRestorePayloadArgs() {
  const restored = buildMarkdownWorkspaceRestoredActiveDocumentArgs({
    activeDocumentKey: ' docs/demo.md ',
    text: '# Demo',
    activeDocumentSourceUrl: 'https://example.com/demo',
  })

  if (!restored) {
    throw new Error('expected restore helper to build payload args for non-empty active document keys')
  }
  if (restored.name !== 'docs/demo.md') {
    throw new Error(`expected restore helper to trim the active document key, got ${String(restored.name)}`)
  }
  if (restored.text !== '# Demo') {
    throw new Error(`expected restore helper to preserve restore text, got ${String(restored.text)}`)
  }
  if (restored.sourceUrl !== 'https://example.com/demo') {
    throw new Error(`expected restore helper to preserve source URL, got ${String(restored.sourceUrl)}`)
  }
  if (restored.autoEnableFrontmatter !== false) {
    throw new Error('expected restore helper to keep frontmatter auto-enable disabled during selection restore')
  }
  if (restored.normalizeWebpageFrontmatterToMarkdown !== true) {
    throw new Error('expected restore helper to normalize webpage frontmatter when restoring active markdown documents')
  }

  const missing = buildMarkdownWorkspaceRestoredActiveDocumentArgs({
    activeDocumentKey: '  ',
    text: '# Demo',
    activeDocumentSourceUrl: null,
  })
  if (missing !== null) {
    throw new Error('expected restore helper to suppress payload args when the active document key is blank')
  }
}
