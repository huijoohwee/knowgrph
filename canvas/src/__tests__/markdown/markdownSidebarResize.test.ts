import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { LS_KEYS } from '@/lib/config'
import { lsSetBool, lsSetInt } from '@/lib/persistence'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownSidebarResizeHandleUpdatesWidthAndPersists() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      MouseEvent?: typeof MouseEvent
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number

    lsSetBool(LS_KEYS.markdownSidebarOpen, true)
    lsSetInt(LS_KEYS.markdownSidebarWidthPx, 220, { min: 160, max: 560 })

    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.addSourceFile({
      id: 'sf-1',
      name: 'a.md',
      text: '# A',
      enabled: true,
      status: 'idle',
      source: { kind: 'local' },
    })
    state.setMarkdownDocument('a.md', '# A')
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

    const sidebar = doc.querySelector('aside[aria-label="Markdown sidebar"]') as HTMLElement | null
    if (!sidebar) throw new Error('Markdown sidebar not found')
    if (!String(sidebar.style.width || '').includes('220')) {
      throw new Error(`expected sidebar width to start near 220px, got ${sidebar.style.width}`)
    }

    const handle = doc.querySelector('[role="separator"][aria-label="Resize sidebar"]') as HTMLElement | null
    if (!handle) throw new Error('Resize sidebar separator not found')

    const win = dom.window as unknown as {
      PointerEvent?: typeof PointerEvent
      MouseEvent?: typeof MouseEvent
    }
    const PointerEvt = win.PointerEvent ?? win.MouseEvent
    if (!PointerEvt) throw new Error('PointerEvent or MouseEvent not available')
    handle.dispatchEvent(new PointerEvt('pointerdown', { bubbles: true, clientX: 200, button: 0 }))
    dom.window.dispatchEvent(new PointerEvt('pointermove', { bubbles: true, clientX: 260 }))
    dom.window.dispatchEvent(new PointerEvt('pointerup', { bubbles: true, clientX: 260 }))
    await tick()

    const nextWidth = String(sidebar.style.width || '')
    if (!nextWidth.includes('280')) {
      throw new Error(`expected sidebar width to update to ~280px, got ${nextWidth}`)
    }

    const persisted = dom.window.localStorage.getItem(LS_KEYS.markdownSidebarWidthPx)
    if (!persisted) throw new Error('expected sidebar width to be persisted to localStorage')

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
