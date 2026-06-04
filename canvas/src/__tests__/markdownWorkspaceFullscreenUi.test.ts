import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MarkdownWorkspace } from '@/lib/markdown-workspace-runtime'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownWorkspaceFullscreenUsesBrowserFullscreenApi() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
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
      root.render(React.createElement(MarkdownWorkspace))
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
      fullscreenBtn.click()
      await tick()
    })

    if (requestFullscreenCalls.length !== 1) {
      throw new Error(`expected requestFullscreen to be called once, got ${requestFullscreenCalls.length}`)
    }

    await act(async () => {
      root.unmount()
    })
  } finally {
    restoreDom()
    restoreWindow()
  }
}
