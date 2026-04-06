import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownDataViewTableView } from '@/features/markdown/ui/MarkdownDataViewTableView'
import type { MarkdownDataView } from '@/features/markdown/ui/markdownDataViewModel'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownDataViewInlineEditTextCellPreservesTdSurfaceAndCommits() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const reactDomClient = await import('react-dom/client')
    const createRoot = reactDomClient.createRoot
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const view: MarkdownDataView = {
      columns: [
        { id: 'c1', name: 'Name', kind: 'text' },
        { id: 'c2', name: 'Notes', kind: 'text' },
      ],
      rows: [
        { id: 'r1', cells: ['Alpha', 'One'] },
        { id: 'r2', cells: ['Beta', 'Two'] },
      ],
      titleColumnId: 'c1',
      groupByColumnId: null,
    }

    const updates: Array<{ rowId: string; columnId: string; nextValue: string }> = []

    const root = createRoot(container)
    root.render(
      <MarkdownDataViewTableView
        view={view}
        canMutate
        onUpdateCell={(args) => {
          updates.push(args)
        }}
      />,
    )
    await tick()
    await tick()

    const cells = Array.from(dom.window.document.querySelectorAll('tbody td')) as HTMLTableCellElement[]
    const targetTd = cells.find(td => String(td.textContent || '').includes('Alpha')) || null
    if (!targetTd) throw new Error('expected Alpha cell')

    const classBefore = targetTd.className
    targetTd.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()
    await tick()

    if (targetTd.className !== classBefore) {
      throw new Error('expected td surface classes to remain stable when entering edit')
    }

    const editor = targetTd.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected inline contentEditable editor')
    if (editor.tagName !== 'SPAN') throw new Error(`expected editor span, got ${editor.tagName}`)

    editor.textContent = 'Alpha updated'
    editor.dispatchEvent(new dom.window.Event('input', { bubbles: true, cancelable: true }))
    editor.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }))
    await tick()
    await tick()

    const last = updates[updates.length - 1] || null
    if (!last) throw new Error('expected an update commit')
    if (last.rowId !== 'r1' || last.columnId !== 'c1' || last.nextValue !== 'Alpha updated') {
      throw new Error(`unexpected commit payload: ${JSON.stringify(last)}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

