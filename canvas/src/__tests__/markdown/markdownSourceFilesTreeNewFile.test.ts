import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { LS_KEYS } from '@/lib/config'
import { lsSetBool, lsSetJson } from '@/lib/persistence'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownSidebarNewSourceFileButtonCreatesFile() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number

    lsSetJson(LS_KEYS.markdownLayoutMode, 'viewer')
    lsSetBool(LS_KEYS.markdownSidebarOpen, true)

    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.addSourceFile({
      id: 'sf-1',
      name: 'a.md',
      text: 'hello',
      enabled: true,
      status: 'idle',
      source: { kind: 'local' },
    })
    state.setMarkdownDocument('a.md', 'hello')
    state.setBottomPanelCurationView('markdown')

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
    await tick()
    await tick()

    const openFolderBtn = doc.querySelector('button[aria-label="Open folder"]') as HTMLButtonElement | null
    if (!openFolderBtn) throw new Error('Open folder button not found in Markdown sidebar')

    const newFolderBtn = doc.querySelector('button[aria-label="New folder"]') as HTMLButtonElement | null
    if (!newFolderBtn) throw new Error('New folder button not found in Markdown sidebar')

    const newFileBtn = doc.querySelector('button[aria-label="New source file"]') as HTMLButtonElement | null
    if (!newFileBtn) throw new Error('New source file button not found in Markdown sidebar')
    if (!newFileBtn.disabled) throw new Error('expected New source file button to be disabled when no folder is opened')
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
