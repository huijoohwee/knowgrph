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

    let menu: HTMLElement | null = null
    for (let i = 0; i < 60; i += 1) {
      await tick()
      menu = doc.querySelector('menu[aria-label="Column type: Status"]') as HTMLElement | null
      if (menu) break
    }
    if (!menu) throw new Error('Expected menu to open in read-only')

    const buttons = Array.from(menu.querySelectorAll('button')) as HTMLButtonElement[]
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

