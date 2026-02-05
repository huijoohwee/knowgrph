import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MarkdownWorkspace } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspace'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { loadWorkspaceSourceIndex, setWorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'

export async function testMarkdownWorkspaceSyncsSourceUrlFromWorkspaceIndex() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const createdPath = await fs.createFile({ parentPath: '/', name: 'url-note.md', text: '# Hello\n' })

    const sourceUrl = 'https://example.com/source'
    setWorkspaceEntrySource(createdPath, { kind: 'url', url: sourceUrl })
    const index = loadWorkspaceSourceIndex()
    const indexed = index[createdPath]
    if (!indexed || indexed.kind !== 'url' || indexed.url !== sourceUrl) {
      throw new Error('workspace source index did not persist url source')
    }
    useMarkdownExplorerStore.getState().setActivePath(createdPath)

    const state = useGraphStore.getState()
    state.setMarkdownDocument(null, null)
    state.setMarkdownDocumentSourceUrl(null)

    root.render(React.createElement(MarkdownWorkspace))

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    let nextUrl: string | null = null
    for (let i = 0; i < 24; i += 1) {
      await tick()
      nextUrl = useGraphStore.getState().markdownDocumentSourceUrl
      if (nextUrl === sourceUrl) break
    }
    if (nextUrl !== sourceUrl) {
      throw new Error(`Expected markdownDocumentSourceUrl to be ${sourceUrl}, got ${String(nextUrl)}`)
    }

    root.unmount()
  } finally {
    restoreDom()
  }
}
