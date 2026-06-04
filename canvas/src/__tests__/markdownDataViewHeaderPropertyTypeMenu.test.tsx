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

export async function testMarkdownDataViewHeaderPropertyTypeMenuCallsOnChangeColumnType() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  container.id = 'root'
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    const view: MarkdownDataView = {
      columns: [
        { id: 'col_0', name: 'Status', kind: 'text' },
        { id: 'col_1', name: 'Title', kind: 'text' },
      ],
      rows: [
        { id: 'row_0', cells: ['Todo', 'A'] },
        { id: 'row_1', cells: ['Doing', 'B'] },
      ],
      titleColumnId: 'col_1',
      groupByColumnId: null,
    }

    const calls: Array<{ columnId: string; nextType: MarkdownDataViewColumnType }> = []

    root.render(
      React.createElement(MarkdownDataViewTableView, {
        view,
        canMutate: true,
        onUpdateCell: () => void 0,
        onChangeColumnType: (args) => calls.push(args),
      }),
    )

    for (let i = 0; i < 30; i += 1) await tick()

    const summary = doc.querySelector('summary[aria-label="Column type: Status"]') as HTMLElement | null
    if (!summary) throw new Error('Expected Status header summary')

    const svg = summary.querySelector('svg') as SVGElement | null
    if (!svg) throw new Error('Expected chevron svg in summary')

    svg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    let columnMenu: HTMLElement | null = null
    for (let i = 0; i < 60; i += 1) {
      await tick()
      columnMenu = doc.querySelector('menu[aria-label="Column menu: Status"]') as HTMLElement | null
      if (columnMenu) break
    }
    if (!columnMenu) throw new Error('Expected Column menu to open')

    const typeDetails = columnMenu.querySelector('details') as HTMLDetailsElement | null
    if (!typeDetails) throw new Error('Expected Type details')
    const typeSummary = typeDetails.querySelector('summary') as HTMLElement | null
    if (!typeSummary) throw new Error('Expected Type summary')
    typeSummary.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()

    const typeMenu = doc.querySelector('menu[aria-label="Column type: Status"]') as HTMLElement | null
    if (!typeMenu) throw new Error('Expected Column type submenu to render')

    const buttons = Array.from(typeMenu.querySelectorAll('button')) as HTMLButtonElement[]
    const geodataBtn = buttons.find(b => String(b.textContent || '').trim() === 'Geodata') || null
    if (!geodataBtn) throw new Error('Expected Geodata option button')
    geodataBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const last = calls[calls.length - 1]
    if (!last) throw new Error('Expected onChangeColumnType to be called')
    if (last.columnId !== 'col_0' || last.nextType !== 'geodata') {
      throw new Error(`Unexpected change: ${JSON.stringify(last)}`)
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
