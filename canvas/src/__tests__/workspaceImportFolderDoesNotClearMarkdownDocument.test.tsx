import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MarkdownWorkspace } from '@/lib/markdown-workspace-runtime'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export async function testWorkspaceFolderSelectionDoesNotClearMarkdownDocument() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const store = useGraphStore.getState()
    store.setMarkdownDocument('seed.md', '# Seed\n\nHello')

    root.render(React.createElement(MarkdownWorkspace))

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for initial render')), 750) as unknown as number
      const raf = (dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame
      if (typeof raf === 'function') {
        raf(() => {
          clearTimeout(timer)
          resolve()
        })
        return
      }
      setTimeout(() => {
        clearTimeout(timer)
        resolve()
      }, 0)
    })

    const before = useGraphStore.getState().markdownDocumentText || ''
    if (!before.includes('Hello')) {
      throw new Error(`expected seeded markdown before, got ${JSON.stringify(before)}`)
    }

    const after = useGraphStore.getState().markdownDocumentText || ''
    if (!after.includes('Hello')) {
      throw new Error(`expected markdown not to be cleared by workspace mount, got ${JSON.stringify(after)}`)
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
