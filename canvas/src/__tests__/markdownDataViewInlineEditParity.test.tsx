import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  MARKDOWN_DATA_VIEW_TABLE_INITIAL_RENDER_ROW_LIMIT,
  MARKDOWN_DATA_VIEW_TABLE_RENDER_ROW_INCREMENT,
  MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT,
  MarkdownDataViewTableView,
} from '@/features/markdown/ui/MarkdownDataViewTableView'
import type { MarkdownDataView } from '@/features/markdown/ui/markdownDataViewModel'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownDataViewInlineEditLargeTablesRenderProgressiveRowWindow() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const reactDomClient = await import('react-dom/client')
    const createRoot = reactDomClient.createRoot
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const totalRows = MARKDOWN_DATA_VIEW_TABLE_INITIAL_RENDER_ROW_LIMIT + MARKDOWN_DATA_VIEW_TABLE_RENDER_ROW_INCREMENT + 3
    const view: MarkdownDataView = {
      columns: [
        { id: 'c1', name: 'Name', kind: 'text' },
        { id: 'c2', name: 'Description', kind: 'text' },
      ],
      rows: Array.from({ length: totalRows }, (_, index) => ({
        id: `r${index + 1}`,
        cells: [`Row ${index + 1}`, `Description ${index + 1}`],
      })),
      titleColumnId: 'c1',
      groupByColumnId: null,
    }

    const root = createRoot(container)
    root.render(
      <MarkdownDataViewTableView
        view={view}
        canMutate
        onUpdateCell={() => {}}
      />,
    )
    await tick()
    await tick()

    let renderedRows = Array.from(dom.window.document.querySelectorAll('tbody tr')) as HTMLElement[]
    const initialDataRows = renderedRows.filter(row => String(row.textContent || '').includes('Row ')).length
    if (initialDataRows !== MARKDOWN_DATA_VIEW_TABLE_INITIAL_RENDER_ROW_LIMIT) {
      throw new Error(`expected initial progressive row window ${MARKDOWN_DATA_VIEW_TABLE_INITIAL_RENDER_ROW_LIMIT}, got ${initialDataRows}`)
    }
    if (String(container.textContent || '').includes(`Row ${totalRows}`)) {
      throw new Error('expected rows beyond the initial window not to be mounted')
    }

    const showMoreButton = (Array.from(dom.window.document.querySelectorAll('button')) as HTMLButtonElement[])
      .find(button => String(button.textContent || '').includes('more rows')) as HTMLButtonElement | null
    if (!showMoreButton) throw new Error('expected show-more rows control for large data view')
    showMoreButton.click()
    await tick()
    await tick()

    renderedRows = Array.from(dom.window.document.querySelectorAll('tbody tr')) as HTMLElement[]
    const nextDataRows = renderedRows.filter(row => String(row.textContent || '').includes('Row ')).length
    const expectedNextRows = MARKDOWN_DATA_VIEW_TABLE_INITIAL_RENDER_ROW_LIMIT + MARKDOWN_DATA_VIEW_TABLE_RENDER_ROW_INCREMENT
    if (nextDataRows !== expectedNextRows) {
      throw new Error(`expected progressive row window ${expectedNextRows}, got ${nextDataRows}`)
    }
    if (!String(container.textContent || '').includes(`Row ${expectedNextRows}`)) {
      throw new Error('expected show-more control to mount the next row window')
    }
    if (String(container.textContent || '').includes(`Row ${totalRows}`)) {
      throw new Error('expected final rows to remain unmounted until requested')
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownDataViewInlineEditLongTextCellsRenderBoundedPreviewAndEditFullValue() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const reactDomClient = await import('react-dom/client')
    const createRoot = reactDomClient.createRoot
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const longValue = `Long cell ${'description '.repeat(80)}end`
    const view: MarkdownDataView = {
      columns: [
        { id: 'c1', name: 'Name', kind: 'text' },
        { id: 'c2', name: 'Description', kind: 'text' },
      ],
      rows: [
        { id: 'r1', cells: ['Alpha', longValue] },
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
    const longCell = cells.find(td => String(td.textContent || '').includes('Long cell')) || null
    if (!longCell) throw new Error('expected long text cell')
    const renderedText = String(longCell.textContent || '')
    if (renderedText.length > MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT + 3) {
      throw new Error(`expected bounded read-cell preview text, got length ${renderedText.length}`)
    }
    if (renderedText === longValue) {
      throw new Error('expected read-cell preview not to mount the full long value')
    }

    longCell.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()
    await tick()

    const editor = longCell.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected full-value inline editor for long text cell')
    if (String(editor.textContent || '') !== longValue) {
      throw new Error('expected long text cell editor to receive the full underlying value')
    }

    editor.textContent = `${longValue} updated`
    editor.dispatchEvent(new dom.window.Event('input', { bubbles: true, cancelable: true }))
    editor.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }))
    await tick()
    await tick()

    const last = updates[updates.length - 1] || null
    if (!last || last.rowId !== 'r1' || last.columnId !== 'c2' || last.nextValue !== `${longValue} updated`) {
      throw new Error(`unexpected long text commit payload: ${JSON.stringify(last)}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownDataViewInlineEditAppliesDensityClassesFromViewControls() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
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
        { id: 'r1', cells: ['Alpha', 'This is a longer note that should stay readable across two preview lines.'] },
      ],
      titleColumnId: 'c1',
      groupByColumnId: null,
    }

    const root = createRoot(container)
    root.render(
      <MarkdownDataViewTableView
        view={view}
        canMutate
        onUpdateCell={() => {}}
        rowHeightPreset="compact"
        fieldLineMode="double"
      />,
    )
    await tick()
    await tick()

    const noteCell = (Array.from(dom.window.document.querySelectorAll('tbody td')) as HTMLTableCellElement[]).find(td =>
      String(td.textContent || '').includes('longer note'),
    ) || null
    if (!noteCell) throw new Error('expected note cell')
    if (!noteCell.className.includes('py-1.5')) {
      throw new Error(`expected compact row-height class, got ${noteCell.className}`)
    }

    const noteValue = noteCell.querySelector('span')
    if (!noteValue) throw new Error('expected note preview span')
    if (!noteValue.className.includes('line-clamp-2')) {
      throw new Error(`expected field-line clamp class, got ${noteValue.className}`)
    }
    if (noteValue.className.includes('truncate')) {
      throw new Error('expected double-line field mode not to use single-line truncation')
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownDataViewInlineEditTextCellPreservesTdSurfaceAndCommits() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
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
