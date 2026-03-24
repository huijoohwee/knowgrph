import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import HistoryView from '@/features/panels/views/HistoryView'
import type { GraphData } from '@/lib/graph/types'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testHistoryViewEditHistoryUndoRedoRestoreWiring() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const store = useGraphStore.getState()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    store.resetAll()

    const baseGraph: GraphData = { type: 'application/json', nodes: [], edges: [] }
    store.replaceHistoryState(
      [
        { id: 'h-0', label: 'A', timestamp: Date.now() - 2000, graphData: baseGraph },
        { id: 'h-1', label: 'B', timestamp: Date.now() - 1000, graphData: baseGraph },
      ],
      0,
    )

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    root = createRoot(container)

    await act(async () => {
      root!.render(<HistoryView searchQuery="" />)
    })
    await tick()

    const undoBtn = dom.window.document.querySelector('button[aria-label="Undo"]') as HTMLButtonElement | null
    const redoBtn = dom.window.document.querySelector('button[aria-label="Redo"]') as HTMLButtonElement | null
    if (!undoBtn) throw new Error('expected Undo button')
    if (!redoBtn) throw new Error('expected Redo button')

    if (!undoBtn.disabled) throw new Error('expected Undo to be disabled at historyIndex=0')
    if (redoBtn.disabled) throw new Error('expected Redo to be enabled at historyIndex=0 with 2 entries')

    const restoreButtons = Array.from(dom.window.document.querySelectorAll('button[aria-label="Restore"]')) as HTMLButtonElement[]
    if (restoreButtons.length < 2) throw new Error('expected at least 2 Restore buttons')

    await act(async () => {
      restoreButtons[1]!.click()
      await tick()
    })
    if (useGraphStore.getState().historyIndex !== 1) throw new Error('expected restore to set historyIndex=1')

    const undoBtn2 = dom.window.document.querySelector('button[aria-label="Undo"]') as HTMLButtonElement | null
    const redoBtn2 = dom.window.document.querySelector('button[aria-label="Redo"]') as HTMLButtonElement | null
    if (!undoBtn2 || !redoBtn2) throw new Error('expected Undo/Redo buttons after restore')
    if (undoBtn2.disabled) throw new Error('expected Undo to be enabled at historyIndex=1')
    if (!redoBtn2.disabled) throw new Error('expected Redo to be disabled at last history entry')
  } finally {
    try {
      await act(async () => {
        root?.unmount()
      })
      await tick()
    } catch {
      void 0
    }
    restore()
    restoreWindow()
  }
}
