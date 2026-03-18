import React from 'react'
import { createRoot } from 'react-dom/client'

import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownDataViewTableView } from '@/features/markdown/ui/MarkdownDataViewTableView'
import type { MarkdownDataView } from '@/features/markdown/ui/markdownDataViewModel'
import type { MarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'

const tick = async () => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0)
  })
}

export async function testMarkdownDataViewAddColumnPlusMenuOpensAndAddsColumn() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('div')
  container.id = 'root'
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    const view: MarkdownDataView = {
      columns: [{ id: 'col_0', name: 'Title', kind: 'text' }],
      rows: [{ id: 'row_0', cells: ['Hello'] }],
      titleColumnId: 'col_0',
      groupByColumnId: null,
    }

    const adds: Array<{ name: string; columnType: MarkdownDataViewColumnType }> = []
    root.render(
      React.createElement(MarkdownDataViewTableView, {
        view,
        canMutate: true,
        onUpdateCell: () => void 0,
        onAddColumn: (args) => adds.push(args),
      }),
    )

    let summary: HTMLElement | null = null
    for (let i = 0; i < 40; i += 1) {
      await tick()
      summary = container.querySelector('summary[aria-label="Add column"]') as HTMLElement | null
      if (summary) break
    }
    if (!summary) throw new Error('Add column summary not found')

    summary.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    let menu: HTMLElement | null = null
    for (let i = 0; i < 40; i += 1) {
      await tick()
      menu = container.querySelector('menu[aria-label="Add column menu"]') as HTMLElement | null
      if (menu) break
    }
    if (!menu) throw new Error('Add column menu did not open')

    const addBtn = Array.from(menu.querySelectorAll('button')).find(b => String(b.textContent || '').trim() === 'Add') as
      | HTMLButtonElement
      | undefined
    if (!addBtn) throw new Error('Add button not found')
    addBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const last = adds[adds.length - 1]
    if (!last) throw new Error('Expected onAddColumn to be called')
    if (!String(last.name || '').trim()) throw new Error('Expected column name to be non-empty')
  } finally {
    try {
      root.unmount()
    } catch {
      void 0
    }
    restoreDom()
  }
}
