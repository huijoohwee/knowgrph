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
  const container = doc.createElement('div')
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

    let menu: HTMLElement | null = null
    for (let i = 0; i < 60; i += 1) {
      await tick()
      menu = doc.querySelector('menu[aria-label="Column type: Status"]') as HTMLElement | null
      if (menu) break
    }
    if (!menu) throw new Error('Expected Column type menu to open')

    const buttons = Array.from(menu.querySelectorAll('button')) as HTMLButtonElement[]
    const selectBtn = buttons.find(b => String(b.textContent || '').trim() === 'Select') || null
    if (!selectBtn) throw new Error('Expected Select option button')
    selectBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const last = calls[calls.length - 1]
    if (!last) throw new Error('Expected onChangeColumnType to be called')
    if (last.columnId !== 'col_0' || last.nextType !== 'select') {
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

