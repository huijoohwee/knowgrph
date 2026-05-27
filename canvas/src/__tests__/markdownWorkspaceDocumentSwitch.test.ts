import { isMarkdownWorkspaceDocumentSwitchPending } from '@/lib/markdown-workspace-runtime/markdownWorkspaceDocumentSwitch'

export function testMarkdownWorkspaceDocumentSwitchPendingSuppressesInactiveOwner() {
  const pending = isMarkdownWorkspaceDocumentSwitchPending({
    activePath: '/docs/knowgrph-maps-readme.md' as never,
    markdownDocumentName: null,
    ownerActive: false,
  })
  if (pending !== false) {
    throw new Error(`expected inactive workspace owner to suppress document-switch pending state, got ${String(pending)}`)
  }
}

export function testMarkdownWorkspaceDocumentSwitchPendingPreservesActiveMismatchCheck() {
  const pending = isMarkdownWorkspaceDocumentSwitchPending({
    activePath: '/docs/knowgrph-maps-readme.md' as never,
    markdownDocumentName: '/docs/knowgrph-video-demo.md',
    ownerActive: true,
  })
  if (pending !== true) {
    throw new Error(`expected active workspace owner to keep mismatch pending detection, got ${String(pending)}`)
  }
}
