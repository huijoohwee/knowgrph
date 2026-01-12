import React from 'react'
import { createRoot } from 'react-dom/client'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testBottomPanelMarkdownFullscreenOpensOverlay() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdown = [
      '---',
      'title: Demo',
      '---',
      '',
      '# Slide 1',
      '',
      'Content',
      '',
    ].join('\n')

    const state = useGraphStore.getState()
    state.setMarkdownDocument('slides.md', markdown)

    root.render(React.createElement(BottomPanelMarkdownSection))

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

    await tick()
    await tick()

    const fullscreenTitle = UI_COPY.bottomPanelMarkdownFullscreenToggleTitle
    const findFullscreenButton = (): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        const label = btn.getAttribute('aria-label') || ''
        if (label === fullscreenTitle) return btn
      }
      return null
    }

    const fullscreenBtn = findFullscreenButton()
    if (!fullscreenBtn) {
      throw new Error('markdown fullscreen toggle button not found')
    }

    fullscreenBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    await tick()
    await tick()

    const overlay = doc.querySelector('.fixed.inset-0.z-[99999], .absolute.inset-0.z-[99999]') as HTMLDivElement | null
    if (!overlay) {
      throw new Error('expected PreviewOverlay to be open after fullscreen toggle')
    }

    const viewer = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLDivElement | null
    if (!viewer) {
      throw new Error('markdown presentation root not found')
    }

    const overlayContainsViewer = overlay.contains(viewer)
    if (!overlayContainsViewer) {
      throw new Error('expected overlay to contain markdown preview content')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
