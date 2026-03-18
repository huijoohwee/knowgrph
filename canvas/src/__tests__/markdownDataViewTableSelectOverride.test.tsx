import React from 'react'
import { createRoot } from 'react-dom/client'

import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownDataViewTableView } from '@/features/markdown/ui/MarkdownDataViewTableView'
import type { MarkdownDataView } from '@/features/markdown/ui/markdownDataViewModel'

const tick = async () => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0)
  })
}

export async function testMarkdownDataViewTableViewSelectOverrideRendersSingleSelect() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('div')
  container.id = 'root'
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    const view: MarkdownDataView = {
      columns: [{ id: 'col_0', name: 'Status', kind: 'text' }],
      rows: [
        { id: 'row_0', cells: ['Todo'] },
        { id: 'row_1', cells: ['Doing'] },
      ],
      titleColumnId: 'col_0',
      groupByColumnId: null,
    }

    const updates: Array<{ rowId: string; columnId: string; nextValue: string }> = []
    root.render(
      React.createElement(MarkdownDataViewTableView, {
        view,
        canMutate: true,
        columnTypesById: { col_0: 'select' },
        onUpdateCell: (args) => updates.push(args),
      }),
    )

    let cell: HTMLTableCellElement | null = null
    for (let i = 0; i < 40; i += 1) {
      await tick()
      cell = container.querySelector('tbody td') as HTMLTableCellElement | null
      if (cell) break
    }
    if (!cell) throw new Error('Expected at least one table cell')
    cell.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }))
    await tick()

    let singleSelect: HTMLElement | null = null
    for (let i = 0; i < 20; i += 1) {
      await tick()
      singleSelect = container.querySelector('section[aria-label="Single select"]') as HTMLElement | null
      if (singleSelect) break
    }
    if (!singleSelect) throw new Error('Expected single-select editor to render for select override')

    const optionButtons = Array.from(singleSelect.querySelectorAll('button')) as HTMLButtonElement[]
    const todoBtn = optionButtons.find(b => String(b.textContent || '').trim() === 'Todo') || null
    if (!todoBtn) throw new Error('Expected Todo option button')
    todoBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const last = updates[updates.length - 1]
    if (!last) throw new Error('Expected onUpdateCell to be called')
    if (last.rowId !== 'row_0' || last.columnId !== 'col_0' || last.nextValue !== 'Todo') {
      throw new Error(`Unexpected update: ${JSON.stringify(last)}`)
    }
  } finally {
    try {
      root.unmount()
    } catch {
      void 0
    }
    restoreDom()
  }
}
