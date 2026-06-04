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

export async function testMarkdownDataViewHeaderPropertyTypeMenuOpensInReadOnly() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
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

    let called = false
    root.render(
      React.createElement(MarkdownDataViewTableView, {
        view,
        canMutate: false,
        onUpdateCell: () => void 0,
        onChangeColumnType: () => {
          called = true
        },
      }),
    )

    for (let i = 0; i < 30; i += 1) await tick()

    const summary = doc.querySelector('summary[aria-label="Column type: Status"]') as HTMLElement | null
    if (!summary) throw new Error('Expected Status header summary')
    const svg = summary.querySelector('svg') as SVGElement | null
    if (!svg) throw new Error('Expected svg in summary')

    svg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    let columnMenu: HTMLElement | null = null
    for (let i = 0; i < 60; i += 1) {
      await tick()
      columnMenu = doc.querySelector('menu[aria-label="Column menu: Status"]') as HTMLElement | null
      if (columnMenu) break
    }
    if (!columnMenu) throw new Error('Expected menu to open in read-only')

    const typeDetails = columnMenu.querySelector('details') as HTMLDetailsElement | null
    if (!typeDetails) throw new Error('Expected Type details')
    const typeSummary = typeDetails.querySelector('summary') as HTMLElement | null
    if (!typeSummary) throw new Error('Expected Type summary')
    typeSummary.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()

    const typeMenu = doc.querySelector('menu[aria-label="Column type: Status"]') as HTMLElement | null
    if (!typeMenu) throw new Error('Expected Column type submenu to render')

    const buttons = Array.from(typeMenu.querySelectorAll('button')) as HTMLButtonElement[]
    const selectBtn = buttons.find(b => String(b.textContent || '').trim() === 'Select') || null
    if (!selectBtn) throw new Error('Expected Select option button')
    if (!selectBtn.disabled) throw new Error('Expected options to be disabled in read-only')

    selectBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    if (called) throw new Error('Expected onChangeColumnType not to run in read-only')
  } finally {
    try {
      root.unmount()
    } catch {
      void 0
    }
    restoreDom()
  }
}
