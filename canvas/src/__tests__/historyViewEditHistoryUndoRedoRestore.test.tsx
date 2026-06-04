import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  const store = useGraphStore.getState()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    store.resetAll()

    const baseGraph: GraphData = { type: 'Graph', nodes: [], edges: [], metadata: {} }
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

    const historyTab = dom.window.document.querySelector(
      'button[data-kg-history-section-tab="history"]',
    ) as HTMLButtonElement | null
    if (!historyTab) throw new Error('expected History option')
    await act(async () => {
      historyTab.click()
      await tick()
    })

    const undoBtn = dom.window.document.querySelector('button[aria-label="Undo"]') as HTMLButtonElement | null
    const redoBtn = dom.window.document.querySelector('button[aria-label="Redo"]') as HTMLButtonElement | null
    if (undoBtn) throw new Error('expected Undo button to stay hidden at historyIndex=0')
    if (!redoBtn) throw new Error('expected Redo button')

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
    if (!undoBtn2) throw new Error('expected Undo button after restore')
    if (redoBtn2) throw new Error('expected Redo button to stay hidden at the last history entry')
    if (undoBtn2.disabled) throw new Error('expected Undo to be enabled at historyIndex=1')
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

export function testHistoryViewUsesScopedStoreSelectionAndSemanticSignatures() {
  const p = resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'HistoryView.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('} = useGraphStore()')) {
    throw new Error('expected HistoryView to avoid subscribing to the entire graph store')
  }
  if (!text.includes('useGraphStore(\n    useShallow(')) {
    throw new Error('expected HistoryView to use a shallow scoped store selector')
  }
  if (!text.includes('buildHistoryEntriesSignature') || !text.includes('buildUiLogEntriesSignature') || !text.includes('buildChatExchangeLogsSignature')) {
    throw new Error('expected HistoryView to derive semantic signatures for chat, history, and log rows')
  }
  if (!text.includes('useSemanticSnapshot(historyRaw, historySignature)')) {
    throw new Error('expected HistoryView to stabilize history rows by semantic signature instead of raw array identity')
  }
  if (!text.includes('const historyIndexById = React.useMemo(() => {')) {
    throw new Error('expected HistoryView to precompute a history index lookup instead of rescanning history rows per render')
  }
  if (text.includes('<ToolbarDropdownSelect') || text.includes('kg-toolbar-dropdown-menu')) {
    throw new Error('expected HistoryView section switching to avoid the legacy dropdown menu')
  }
  if (!text.includes('data-kg-history-section-tabs="1"') || !text.includes('data-kg-history-section-tab={item.id}')) {
    throw new Error('expected HistoryView section switching to use the compact icon-only header tablist')
  }
  if (!text.includes('role="tablist"') || !text.includes('role="tab"') || !text.includes('showTooltip')) {
    throw new Error('expected HistoryView icon-only tabs to preserve tab semantics and tooltips')
  }
}
