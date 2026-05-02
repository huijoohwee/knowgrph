import { resolveMarkdownWorkspaceSelectionRestoreApply } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionRestoreApply'

export function testMarkdownWorkspaceSelectionRestoreApplyCentralizesEditorAndDocumentRestoreCommit() {
  const restored = resolveMarkdownWorkspaceSelectionRestoreApply({
    text: '# Demo',
    activeDocumentKey: ' docs/demo.md ',
    activeDocumentSourceUrl: 'https://example.com/demo',
  })

  if (restored.text !== '# Demo') {
    throw new Error(`expected restore/apply helper to preserve restored editor text, got ${String(restored.text)}`)
  }
  if (!restored.restoredActiveDocumentArgs) {
    throw new Error('expected restore/apply helper to build active document args for non-empty document keys')
  }
  if (restored.restoredActiveDocumentArgs.name !== 'docs/demo.md') {
    throw new Error(`expected restore/apply helper to trim active document keys, got ${String(restored.restoredActiveDocumentArgs.name)}`)
  }
  if (restored.restoredActiveDocumentArgs.text !== '# Demo') {
    throw new Error(`expected restore/apply helper to preserve payload text, got ${String(restored.restoredActiveDocumentArgs.text)}`)
  }

  const withoutDocument = resolveMarkdownWorkspaceSelectionRestoreApply({
    text: '# Demo',
    activeDocumentKey: ' ',
    activeDocumentSourceUrl: null,
  })
  if (withoutDocument.text !== '# Demo') {
    throw new Error('expected restore/apply helper to preserve editor text even without an active document payload')
  }
  if (withoutDocument.restoredActiveDocumentArgs !== null) {
    throw new Error('expected restore/apply helper to suppress active document args for blank document keys')
  }
}
