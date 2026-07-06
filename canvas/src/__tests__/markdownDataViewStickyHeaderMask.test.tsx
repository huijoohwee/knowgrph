import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownDataViewTableView } from '@/features/markdown/ui/MarkdownDataViewTableView'
import type { MarkdownDataView } from '@/features/markdown/ui/markdownDataViewModel'
import { MARKDOWN_DATA_VIEW_TABLE_STICKY_HEADER_CLASSNAME } from '@/features/markdown/ui/markdownDataViewTableClasses'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownDataViewStickyHeadersUseOpaqueMaskClass() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="rows"></section><section id="columns"></section></body></html>')
  try {
    const reactDomClient = await import('react-dom/client')
    const view: MarkdownDataView = {
      columns: [
        { id: 'key', name: 'Key', kind: 'text' },
        { id: 'type', name: 'Type', kind: 'text' },
        { id: 'value', name: 'Scalar Value', kind: 'text' },
      ],
      rows: Array.from({ length: 12 }, (_, index) => ({
        id: `r${index}`,
        cells: [`schema_${index}`, 'scalar', `value_${index}`],
      })),
      titleColumnId: 'key',
      groupByColumnId: null,
    }
    const rowsContainer = dom.window.document.getElementById('rows')
    const columnsContainer = dom.window.document.getElementById('columns')
    if (!rowsContainer || !columnsContainer) throw new Error('missing test containers')

    const rowsRoot = reactDomClient.createRoot(rowsContainer)
    const columnsRoot = reactDomClient.createRoot(columnsContainer)
    rowsRoot.render(<MarkdownDataViewTableView view={view} canMutate={false} onUpdateCell={() => {}} />)
    columnsRoot.render(<MarkdownDataViewTableView view={view} canMutate={false} onUpdateCell={() => {}} orientation="columns" />)
    await tick()
    await tick()

    const headers = Array.from(dom.window.document.querySelectorAll('thead')) as HTMLElement[]
    if (headers.length !== 2) throw new Error(`expected rows and columns table headers, got ${headers.length}`)
    for (const header of headers) {
      if (!header.className.includes(MARKDOWN_DATA_VIEW_TABLE_STICKY_HEADER_CLASSNAME)) {
        throw new Error(`expected sticky header to use shared opaque mask class, got ${header.className}`)
      }
      if (!header.className.includes('sticky top-0 z-30 isolate')) {
        throw new Error(`expected sticky header positioning contract to remain intact, got ${header.className}`)
      }
    }

    rowsRoot.unmount()
    columnsRoot.unmount()
  } finally {
    restore()
  }
}
