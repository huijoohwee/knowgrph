import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { LS_KEYS } from '@/lib/config'
import { lsSetBool, lsSetJson } from '@/lib/persistence'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownSidebarSourceFilesTreeUsesSemanticDom() {
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
      name: 'src/index.ts',
      text: 'export const x = 1',
      enabled: true,
      status: 'idle',
      source: { kind: 'local' },
    })
    state.setMarkdownDocument('src/index.ts', 'export const x = 1')
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

    const refreshBtn = doc.querySelector('button[aria-label="Refresh files"]') as HTMLButtonElement | null
    if (!refreshBtn) throw new Error('Refresh files button not found in Markdown sidebar')

    const findPanel = (): HTMLElement | null => {
      const direct = doc.querySelector('section[aria-label="Source Files"]') as HTMLElement | null
      if (direct) return direct
      let el: HTMLElement | null = openFolderBtn
      while (el) {
        if (el.tagName === 'SECTION') {
          const label = String(el.getAttribute('aria-label') || '')
          if (label && label !== 'Source Files header') return el
        }
        el = el.parentElement
      }
      return null
    }

    const panel = findPanel()
    if (!panel) throw new Error('Source Files panel section not found')

    const divs = panel.querySelectorAll('div')
    if (divs.length > 0) {
      throw new Error(`expected Source Files panel to use no generic div elements, found ${divs.length}`)
    }

    const tree = panel.querySelector('ul[role="tree"]') as HTMLUListElement | null
    if (!tree) throw new Error('expected Source Files panel to render a tree (ul[role=tree])')

    const items = panel.querySelectorAll('[role="treeitem"]')
    if (items.length === 0) throw new Error('expected Source Files panel to render at least one treeitem')

    root.unmount()
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
