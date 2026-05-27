import {
  buildActiveWorkspaceRuntimeSourceFilesSnapshot,
  shouldProactivelyReapplyClosedPaneActiveMarkdownDocument,
} from '@/features/source-files/sourceFilesRuntimeMaterialization'
import { resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'

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

export function testBuildActiveWorkspaceRuntimeSourceFilesSnapshotIncludesFreshEmptyActiveWorkspaceFile() {
  const activePath = '/sandbox/chat-log/kgc_20260527193000.md'
  const snapshot = buildActiveWorkspaceRuntimeSourceFilesSnapshot({
    activePath: activePath as never,
    existingSourceFiles: [{
      id: 'old-doc',
      name: 'knowgrph-animatic-demo.md',
      text: '# old',
      enabled: true,
      source: { kind: 'local', path: resolveWorkspaceSourcePathKey('/docs/knowgrph-animatic-demo.md') },
      status: 'idle',
    }],
    workspaceEntries: [{
      path: activePath as never,
      parentPath: '/sandbox/chat-log' as never,
      kind: 'file',
      name: 'kgc_20260527193000.md',
      text: '',
      updatedAtMs: 1,
    }],
    sourcesByPath: {},
    workspaceDocsOnly: false,
  })
  const activeSourcePath = resolveWorkspaceSourcePathKey(activePath)
  const activeFile = snapshot.runtimeSourceFiles.find(file => String(file?.source?.path || '') === activeSourcePath) || null
  if (!activeFile) {
    throw new Error('expected runtime source-file snapshot to include a fresh empty active workspace file')
  }
  if (activeFile.enabled !== true) {
    throw new Error(`expected fresh empty active workspace file to be enabled, got ${String(activeFile.enabled)}`)
  }
}
