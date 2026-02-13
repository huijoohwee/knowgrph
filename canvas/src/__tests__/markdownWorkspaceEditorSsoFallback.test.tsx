import React from 'react'
import { createRoot } from 'react-dom/client'
import { MarkdownWorkspace } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspace'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { LS_KEYS } from '@/lib/config'
import { workspaceDocumentKey } from '@/features/workspace-fs/path'

const tick = async (dom: { window: Window }) => {
  await new Promise<void>(resolve => {
    const raf = (dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame
    if (typeof raf === 'function') {
      raf(() => resolve())
      return
    }
    setTimeout(() => resolve(), 0)
  })
}

export async function testMarkdownWorkspaceEditorUsesGraphStoreFallbackWhenActiveTextEmpty() {
  const storage = new MemoryStorage()
  storage.setItem(LS_KEYS.markdownLayoutMode, JSON.stringify('editor'))
  storage.setItem(LS_KEYS.markdownWorkspaceUserClearedAllFiles, 'true')

  const { dom, restore: restoreDom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const { restore: restoreWindow } = initWindowHarness({ storage })
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const doc = dom.window.document

    const activePath = '/ComfyUI/repo.sitemap.md'
    useMarkdownExplorerStore.getState().setActivePath(activePath)

    const docKey = workspaceDocumentKey(activePath)
    useGraphStore.getState().setMarkdownDocument(docKey, '# Fallback\n\nHello')

    root = createRoot(doc.getElementById('root') as unknown as HTMLElement)
    root.render(React.createElement(MarkdownWorkspace))
    await tick(dom)
    await tick(dom)

    const textarea = doc.querySelector('textarea[aria-label="Markdown Editor Text"]') as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected markdown editor textarea')
    const v = String(textarea.value || '')
    if (!v.includes('Fallback')) {
      throw new Error(`expected fallback text in editor, got ${JSON.stringify(v.slice(0, 120))}`)
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
