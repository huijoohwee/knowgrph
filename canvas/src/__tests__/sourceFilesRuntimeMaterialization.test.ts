import {
  buildActiveWorkspaceRuntimeSourceFilesSnapshot,
  reapplyClosedPaneActiveMarkdownDocument,
  shouldProactivelyReapplyClosedPaneActiveMarkdownDocument,
} from '@/features/source-files/sourceFilesRuntimeMaterialization'
import { resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import type { WorkspaceFs } from '@/features/workspace-fs/types'

const createMinimalFs = (textByPath: Record<string, string>): WorkspaceFs => ({
  ensureSeed: async () => false,
  listEntries: async () => [],
  readFileText: async path => textByPath[String(path || '').trim()] ?? null,
  writeFileText: async () => void 0,
  createFile: async () => '/docs/tmp.md',
  createFolder: async () => '/docs',
  deleteEntry: async () => void 0,
})

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

export function testShouldProactivelyReapplyClosedPaneActiveMarkdownDocumentDefersMatchingDocumentSuppressionUntilResolvedText() {
  const shouldReapply = shouldProactivelyReapplyClosedPaneActiveMarkdownDocument({
    activePath: '/docs/knowgrph-maps-readme.md' as never,
    markdownDocumentName: '/docs/knowgrph-maps-readme.md',
    markdownDocumentText: '# Maps Readme',
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
  })
  if (shouldReapply !== true) {
    throw new Error(`expected matching active markdown document to defer closed-pane reapply suppression until resolved text is known, got ${String(shouldReapply)}`)
  }
}

export function testShouldProactivelyReapplyClosedPaneActiveMarkdownDocumentWhenMatchingDocumentSuppressedViewPreset() {
  const shouldReapply = shouldProactivelyReapplyClosedPaneActiveMarkdownDocument({
    activePath: '/docs/runtime-surface-demo.md' as never,
    markdownDocumentName: '/docs/runtime-surface-demo.md',
    markdownDocumentText: '---\nkgCanvasSurfaceMode: "xr"\n---\n# XR Demo',
    markdownDocumentApplyViewPreset: false,
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
  })
  if (shouldReapply !== true) {
    throw new Error(`expected matching active markdown document with suppressed view preset to replay YAML canvas preset, got ${String(shouldReapply)}`)
  }
}

export async function testClosedPaneActiveMarkdownReapplyReplaysYamlWhenExistingDocumentSuppressedViewPreset() {
  const { restore } = initJsdomHarness()
  try {
    const activePath = '/docs/runtime-surface-demo.md'
    const text = [
      '---',
      'kgCanvasSurfaceMode: "xr"',
      'kgCanvas3dMode: "xr"',
      '---',
      '# Runtime Surface Demo',
      '',
      'Canvas state must come from YAML, not file identity.',
    ].join('\n')
    const store = useGraphStore.getState()
    store.resetAll()
    store.setWorkspaceViewMode('canvas')
    store.setWorkspaceCanvasPaneOpen(false)
    store.setCanvasRenderMode('2d')
    store.setCanvas3dMode('3d')
    store.setMarkdownDocument(activePath, text, {
      autoEnableFrontmatter: false,
      applyViewPreset: false,
    })
    useMarkdownExplorerStore.getState().setActivePath(activePath as never)

    await reapplyClosedPaneActiveMarkdownDocument({
      activePathOverride: activePath as never,
      fs: createMinimalFs({ [activePath]: text }),
      activeWorkspaceEntriesSnapshot: [{
        path: activePath as never,
        parentPath: '/docs' as never,
        kind: 'file',
        name: 'runtime-surface-demo.md',
        text,
        updatedAtMs: 1,
      }],
    })

    const next = useGraphStore.getState()
    if (next.markdownDocumentApplyViewPreset !== true) {
      throw new Error('expected active Source Files reapply to restore YAML view-preset ownership')
    }
    if (next.canvasRenderMode !== '3d' || next.canvas3dMode !== 'xr') {
      throw new Error(`expected active Source Files YAML to select XR canvas mode, got ${next.canvasRenderMode}/${next.canvas3dMode}`)
    }
  } finally {
    useMarkdownExplorerStore.getState().setActivePath(null)
    useGraphStore.getState().resetAll()
    restore()
  }
}

export function testBuildActiveWorkspaceRuntimeSourceFilesSnapshotIncludesFreshEmptyActiveWorkspaceFile() {
  const activePath = '/chat-log/kgc_20260527193000.md'
  const existingSidecarPath = '/chat-log/20260527T193000Z/chat-stream-log_20260527T193000Z.md'
  const snapshot = buildActiveWorkspaceRuntimeSourceFilesSnapshot({
    activePath: activePath as never,
    existingSourceFiles: [
      {
        id: 'old-doc',
        name: 'knowgrph-animatic-demo.md',
        text: '# old',
        enabled: true,
        source: { kind: 'local', path: resolveWorkspaceSourcePathKey('/docs/knowgrph-animatic-demo.md') },
        status: 'idle',
      },
      {
        id: 'existing-sidecar',
        name: 'chat-stream-log_20260527T193000Z.md',
        text: '# sidecar',
        enabled: false,
        source: { kind: 'local', path: resolveWorkspaceSourcePathKey(existingSidecarPath) },
        status: 'idle',
      },
    ],
    workspaceEntries: [{
      path: activePath as never,
      parentPath: '/chat-log' as never,
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
  const preservedSidecar = snapshot.runtimeSourceFiles.find(file => String(file?.source?.path || '') === resolveWorkspaceSourcePathKey(existingSidecarPath)) || null
  if (!preservedSidecar) {
    throw new Error('expected runtime source-file snapshot to preserve existing canonical chat sidecar files')
  }
  if (preservedSidecar.enabled !== false) {
    throw new Error(`expected preserved canonical chat sidecar file to remain disabled, got ${String(preservedSidecar.enabled)}`)
  }
}
