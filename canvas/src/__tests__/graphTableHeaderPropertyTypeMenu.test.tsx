import React from 'react'
import { createRoot } from 'react-dom/client'

import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { GraphTableFastGridHeader } from '@/features/graph-table/ui/GraphTableFastGridHeader'
import { useGraphTableGridModel } from '@/features/graph-table/ui/fast-grid/useGraphTableGridModel'
import type { GraphColumnDoc } from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'

const tick = async () => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0)
  })
}

function Harness(props: {
  columns: GraphColumnDoc[]
  rows: GraphTableGridRow[]
  onColumnKindChanged: (columnId: string, nextKind: GraphColumnDoc['kind']) => void
}) {
  const viewportRef = React.useRef<HTMLElement | null>(null)
  const headerScrollableContentRef = React.useRef<HTMLElement | null>(null)
  const selectAllRef = React.useRef<HTMLInputElement | null>(null)
  const scrollRef = React.useRef({ left: 0, top: 0 })
  const reorderFromRef = React.useRef<string | null>(null)
  const reorderHintRef = React.useRef<{ columnId: string; side: 'left' | 'right' } | null>(null)
  const selectedColumnIdRef = React.useRef<string | null>(null)
  const [selectedColumnId, setSelectedColumnId] = React.useState<string | null>(null)
  void selectedColumnId

  const model = useGraphTableGridModel({
    columns: props.columns,
    rows: props.rows,
    columnVisibilityById: {},
    filterMatch: 'all',
    filterClauses: [],
    groupBy: '',
    sortRules: [],
    columnWidthsPxById: {},
    headerHeight: 28,
    rowHeight: 28,
    selectedRowIds: [],
  })

  return (
    <section>
      <section
        ref={viewportRef}
        style={{ position: 'relative', width: '640px', height: '240px', overflow: 'auto' }}
      />
      <GraphTableFastGridHeader
        headerHeight={28}
        viewportClientWidth={640}
        panelTextClass=""
        model={model}
        viewportRef={viewportRef}
        headerScrollableContentRef={headerScrollableContentRef}
        selectAllRef={selectAllRef}
        scrollRef={scrollRef}
        reorderFromRef={reorderFromRef}
        reorderHintRef={reorderHintRef}
        selectedColumnIdRef={selectedColumnIdRef}
        setSelectedColumnId={setSelectedColumnId}
        syncHeaderScroll={() => void 0}
        scheduleDraw={() => void 0}
        onSelectionChanged={() => void 0}
        onRequestReorderColumn={() => void 0}
        onColumnWidthChanged={() => void 0}
        onColumnKindChanged={props.onColumnKindChanged}
      />
    </section>
  )
}

export async function testGraphTableFastGridHeaderPropertyTypeMenuCallsOnSelect() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  container.id = 'root'
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    const columns: GraphColumnDoc[] = [
      {
        pk: 'nodes:label',
        tableId: 'nodes',
        columnId: 'label',
        name: 'label',
        kind: 'text',
        order: 1,
        hidden: false,
        createdAtMs: 1,
        updatedAtMs: 1,
      },
    ]
    const rows: GraphTableGridRow[] = [{ id: 'n1', __order: 1, label: 'Hello' } as unknown as GraphTableGridRow]
    const calls: Array<{ columnId: string; nextKind: GraphColumnDoc['kind'] }> = []

    root.render(React.createElement(Harness, { columns, rows, onColumnKindChanged: (columnId, nextKind) => calls.push({ columnId, nextKind }) }))
    for (let i = 0; i < 40; i += 1) await tick()

    const summaries = Array.from(doc.querySelectorAll('summary')) as HTMLElement[]
    const ariaLabels = summaries.map(s => String(s.getAttribute('aria-label') || '')).filter(Boolean)

    const summary = doc.querySelector('summary[aria-label="Property type: label"]') as HTMLElement | null
    if (!summary) throw new Error(`Property type summary not found. Seen summaries: ${ariaLabels.join(', ')}`)
    const toggle = summary.querySelector('[data-kg-menu-toggle]') as HTMLElement | null
    if (!toggle) throw new Error('Property type toggle not found')

    toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    let columnMenu: HTMLElement | null = null
    for (let i = 0; i < 60; i += 1) {
      await tick()
      columnMenu = doc.querySelector('menu[aria-label="Column menu: label"]') as HTMLElement | null
      if (columnMenu) break
    }
    if (!columnMenu) throw new Error('Expected column menu to render')

    const typeDetails = columnMenu.querySelector('details') as HTMLDetailsElement | null
    if (!typeDetails) throw new Error('Expected Type details')
    const typeSummary = typeDetails.querySelector('summary') as HTMLElement | null
    if (!typeSummary) throw new Error('Expected Type summary')
    typeSummary.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()

    const typeMenu = doc.querySelector('menu[aria-label="Property type for label"]') as HTMLElement | null
    if (!typeMenu) throw new Error('Expected property type submenu to render')

    const buttons = Array.from(typeMenu.querySelectorAll('button')) as HTMLButtonElement[]
    const geodataBtn = buttons.find(b => String(b.textContent || '').trim() === 'Geodata') || null
    if (!geodataBtn) throw new Error('Expected Geodata option button')
    geodataBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const last = calls[calls.length - 1]
    if (!last) throw new Error('Expected onColumnKindChanged to be called')
    if (last.columnId !== 'label' || last.nextKind !== 'geodata') {
      throw new Error(`Unexpected call: ${JSON.stringify(last)}`)
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
