import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownGlobalRenderToggleVisible() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const raf = (cb: () => void) => {
      const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
      if (anyWindow.requestAnimationFrame) {
        anyWindow.requestAnimationFrame(cb)
        return
      }
      setTimeout(cb, 0)
    }
    const tick = () => new Promise<void>(resolve => raf(() => resolve()))
    await tick()

    const renderBtn = doc.querySelector('button[name="annotate-display"][value="render"]') as HTMLButtonElement | null
    if (!renderBtn) {
      throw new Error('Global Render toggle button not found in Markdown header')
    }

    const state = useGraphStore.getState()
    state.setFrontmatterModeEnabled(false)
    state.setMarkdownDocument(
      'frontmatter-demo.md',
      ['---', 'title: Demo', 'mermaid: |', '  graph TD', '    A-->B', '---', '', '# Body', ''].join('\n'),
    )
    await tick()

    renderBtn.click()
    await tick()

    if (!useGraphStore.getState().frontmatterModeEnabled) {
      throw new Error('Expected clicking Render to enable frontmatter mode when frontmatter exists')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
