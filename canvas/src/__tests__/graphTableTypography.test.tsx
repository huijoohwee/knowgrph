import React from 'react'
import { createRoot } from 'react-dom/client'
import { GraphTableFastGrid } from '@/features/graph-table/ui/GraphTableFastGrid'
import type { GraphColumnDoc } from '@/features/graph-table-db/graphTableDb'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import type { PanelTypography } from '@/lib/ui/panelTypography'

export async function testGraphTableTypographyUsesUiSettings() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const panelTypography: PanelTypography = {
      fontClass: 'font-serif',
      textSizeClass: 'text-[15px]',
      microLabelTextSizeClass: 'text-[10px]',
      monospaceTextClass: 'font-mono text-[13px]',
      keyValueInputClass: 'text-[15px]',
      keyLabelClass: 'font-serif text-[15px]',
      panelTextClass: 'font-serif text-[15px]',
      microLabelClass: 'font-serif text-[10px]',
    }

    const columns: GraphColumnDoc[] = [
      {
        pk: 'nodes:label',
        tableId: 'nodes',
        columnId: 'label',
        name: 'Label',
        kind: 'text',
        order: 1,
        hidden: false,
        createdAtMs: 0,
        updatedAtMs: 0,
      },
    ]

    root.render(
      React.createElement(GraphTableFastGrid, {
        tableId: 'nodes',
        columns,
        rows: [{ id: 'n1', __order: 0, label: 'Hello' }],
        selectedRowIds: [],
        focusRowId: null,
        autoScrollToFocusRow: false,
        columnVisibilityById: {},
        filterMatch: 'all',
        filterClauses: [],
        groupBy: '',
        sortRules: [{ id: 's1', columnId: 'label', direction: 'asc' }],
        rowHeightPreset: 'comfortable',
        columnWidthsPxById: {},
        onColumnWidthChanged: () => void 0,
        onRequestReorderColumn: () => void 0,
        onCellValueChanged: () => void 0,
        onRowClicked: () => void 0,
        onSelectionChanged: () => void 0,
        panelTypography,
      } as never),
    )

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })

    await tick()
    await tick()

    const viewport = container.querySelector('section[aria-label="Grid viewport"]')
    if (!viewport) throw new Error('expected graph table to render a Grid viewport')
    const cls = String(viewport.getAttribute('class') || '')
    if (!cls.includes('font-serif') || !cls.includes('text-[15px]')) {
      throw new Error(`expected grid viewport to inherit panel text typography, got ${JSON.stringify(cls)}`)
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
