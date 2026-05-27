import { shouldProactivelyReapplyClosedPaneActiveMarkdownDocument } from '@/features/source-files/sourceFilesRuntimeMaterialization'

export function testShouldProactivelyReapplyClosedPaneActiveMarkdownDocumentWhenCanvasOwnsClosedPane() {
  const shouldReapply = shouldProactivelyReapplyClosedPaneActiveMarkdownDocument({
    activePath: '/docs/knowgrph-maps-readme.md' as never,
    markdownDocumentName: null,
    markdownDocumentText: '',
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
  })
  if (shouldReapply !== true) {
    throw new Error(`expected closed-pane canvas to proactively reapply the active markdown document, got ${String(shouldReapply)}`)
  }
}

export function testShouldNotProactivelyReapplyClosedPaneActiveMarkdownDocumentWhenOwnerAlreadyActive() {
  const shouldReapply = shouldProactivelyReapplyClosedPaneActiveMarkdownDocument({
    activePath: '/docs/knowgrph-maps-readme.md' as never,
    markdownDocumentName: null,
    markdownDocumentText: '',
    workspaceViewMode: 'editor',
    workspaceCanvasPaneOpen: true,
  })
  if (shouldReapply !== false) {
    throw new Error(`expected active workspace owner to keep markdown reapply responsibility, got ${String(shouldReapply)}`)
  }
}

export function testShouldNotProactivelyReapplyClosedPaneActiveMarkdownDocumentWhenDocumentAlreadyMatches() {
  const shouldReapply = shouldProactivelyReapplyClosedPaneActiveMarkdownDocument({
    activePath: '/docs/knowgrph-maps-readme.md' as never,
    markdownDocumentName: '/docs/knowgrph-maps-readme.md',
    markdownDocumentText: '# Maps Readme',
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
  })
  if (shouldReapply !== false) {
    throw new Error(`expected matching active markdown document to suppress closed-pane reapply, got ${String(shouldReapply)}`)
  }
}
