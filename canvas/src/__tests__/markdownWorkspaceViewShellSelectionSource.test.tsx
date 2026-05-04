import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownWorkspaceViewShell } from '@/lib/markdown-workspace-runtime/useMarkdownWorkspaceViewShell'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownWorkspaceViewShellFileSelectionClearsCanvasSelectionAuthority() {
  const harness = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const store = useGraphStore.getState()
    store.resetAll()
    store.setSelectionSource('canvas')

    const entries: WorkspaceEntry[] = [
      { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
      { path: '/knowgrph-maps-readme.md', parentPath: '/', kind: 'file', name: 'knowgrph-maps-readme.md', text: '# readme', updatedAtMs: 2 },
      { path: '/knowgrph-maps-places.md', parentPath: '/', kind: 'file', name: 'knowgrph-maps-places.md', text: '# places', updatedAtMs: 3 },
    ]

    const container = harness.dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    function TestHarness() {
      const [, forceRender] = React.useReducer((n: number) => n + 1, 0)
      const [selectionPath, setSelectionPath] = React.useState<WorkspacePath | null>(null)
      const [activePath, setActivePath] = React.useState<WorkspacePath | null>('/knowgrph-maps-places.md')
      const [, setExpandedPaths] = React.useState<Set<string>>(() => new Set())

      const viewShell = useMarkdownWorkspaceViewShell({
        entries,
        sourcesByPath: {},
        folderModeContract: 'sitemap',
        setFolderModeContract: () => {},
        selectionPath,
        selectionEntryKind: 'file',
        setActivePathSafe: path => setActivePath(path),
        setSelectionPathSafe: path => setSelectionPath(path),
        setSelectionSource: source => {
          useGraphStore.getState().setSelectionSource(source)
          forceRender()
        },
        setExpandedPaths,
        resolveFolderContractDocPath: folderPath => folderPath,
        pickFolderContractTargetPath: () => null,
        youtubeWorkspaceMeta: null,
        switchActiveYoutubeWorkspaceFormat: async () => {},
        revealLineInEditor: () => {},
        setStatusWithAutoClear: () => {},
      })

      return (
        <button
          id="select-readme"
          type="button"
          data-active-path={activePath || ''}
          data-selection-path={selectionPath || ''}
          data-selection-source={String(useGraphStore.getState().selectionSource || '')}
          onClick={() => viewShell.onSelectFile('/knowgrph-maps-readme.md')}
        >
          Select readme
        </button>
      )
    }

    root = createRoot(container as unknown as HTMLElement)
    await act(async () => {
      root.render(<TestHarness />)
      await tick()
    })

    const button = container.querySelector('#select-readme') as HTMLButtonElement | null
    if (!button) throw new Error('missing select-readme button')
    if (button.dataset.selectionSource !== 'canvas') {
      throw new Error(`expected initial selection source to stay canvas, got ${String(button.dataset.selectionSource || '')}`)
    }

    await act(async () => {
      button.dispatchEvent(new harness.dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await tick()
    })

    if (button.dataset.activePath !== '/knowgrph-maps-readme.md') {
      throw new Error(`expected workspace file selection to activate readme, got ${String(button.dataset.activePath || '')}`)
    }
    if (button.dataset.selectionPath !== '/knowgrph-maps-readme.md') {
      throw new Error(`expected workspace file selection to update selection path, got ${String(button.dataset.selectionPath || '')}`)
    }
    if (button.dataset.selectionSource !== 'editor') {
      throw new Error(`expected workspace file selection to override stale canvas selection authority, got ${String(button.dataset.selectionSource || '')}`)
    }
  } finally {
    try {
      useGraphStore.getState().resetAll()
    } catch {
      void 0
    }
    try {
      await act(async () => {
        root?.unmount()
        await tick()
      })
    } catch {
      void 0
    }
    harness.restore()
  }
}
