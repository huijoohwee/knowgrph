import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testBottomPanelMarkdownFullscreenUsesBrowserFullscreenApi() {
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

    await act(async () => {
      root.render(React.createElement(BottomPanelMarkdownSection))
    })

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

    await act(async () => {
      await tick()
      await tick()
    })

    const findFullscreenButton = (): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        const title = btn.getAttribute('title') || ''
        if (title === 'Fullscreen') return btn
      }
      return null
    }

    const workspaceRoot = doc.querySelector('[aria-label="Markdown Workspace"]') as
      | (HTMLElement & { requestFullscreen?: () => Promise<void> })
      | null
    if (!workspaceRoot) {
      throw new Error('markdown workspace root not found')
    }

    const requestFullscreenCalls: HTMLElement[] = []
    workspaceRoot.requestFullscreen = async () => {
      requestFullscreenCalls.push(workspaceRoot)
    }

    const fullscreenBtn = findFullscreenButton()
    if (!fullscreenBtn) {
      throw new Error('markdown fullscreen toggle button not found')
    }

    await act(async () => {
      fullscreenBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await tick()
      await tick()
    })

    if (requestFullscreenCalls.length !== 1 || requestFullscreenCalls[0] !== workspaceRoot) {
      throw new Error('expected fullscreen toggle to request browser fullscreen on markdown workspace root')
    }

    const exitFullscreenCalls: number[] = []
    const fullscreenDoc = doc as Document & {
      fullscreenElement?: Element | null
      exitFullscreen?: () => Promise<void>
    }
    Object.defineProperty(fullscreenDoc, 'fullscreenElement', {
      configurable: true,
      get: () => workspaceRoot,
    })
    fullscreenDoc.exitFullscreen = async () => {
      exitFullscreenCalls.push(1)
    }

    await act(async () => {
      fullscreenBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await tick()
      await tick()
    })

    if (exitFullscreenCalls.length !== 1) {
      throw new Error('expected fullscreen toggle to exit browser fullscreen when workspace root is already fullscreen')
    }

    await act(async () => {
      root.unmount()
    })
  } finally {
    restoreDom()
    restoreWindow()
  }
}
