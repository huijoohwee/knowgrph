import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownFileTree } from '@/components/BottomPanel/MarkdownFileTree'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'

const tick = async () => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0)
  })
}

export async function testMarkdownFileTreeFolderClickDoesNotClearSelection() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)

  let root: ReturnType<typeof createRoot> | null = null
  try {
    const expandedCalls: WorkspacePath[] = []
    const selectFileCalls: WorkspacePath[] = []

    const entries: WorkspaceEntry[] = [
      { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
      { path: '/folder', parentPath: '/', kind: 'folder', name: 'folder', updatedAtMs: 1 },
      { path: '/folder/file.md', parentPath: '/folder', kind: 'file', name: 'file.md', text: '# ok', updatedAtMs: 1 },
    ]

    root = createRoot(container as unknown as HTMLElement)
    root.render(
      <MarkdownFileTree
        entries={entries}
        expandedPaths={new Set()}
        toggleExpanded={path => expandedCalls.push(path)}
        activePath={'/folder/file.md'}
        onSelectFile={path => selectFileCalls.push(path)}
        sourcesByPath={null}
      />,
    )
    await tick()

    let folderButton: HTMLButtonElement | null = null
    for (let i = 0; i < 50; i += 1) {
      folderButton = container.querySelector('section[aria-label="Folder folder"] button') as HTMLButtonElement | null
      if (folderButton) break
      await tick()
    }
    if (!folderButton) throw new Error('folder button not found')

    folderButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()

    if (expandedCalls.length !== 1 || expandedCalls[0] !== '/folder') {
      throw new Error(`expected toggleExpanded to be called once with /folder, got ${JSON.stringify(expandedCalls)}`)
    }
    if (selectFileCalls.length !== 0) {
      throw new Error(`expected onSelectFile not to be called, got ${JSON.stringify(selectFileCalls)}`)
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
  }
}
