import { useEffect, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type {
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  RowClickedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import type { GraphColumnDoc, GraphTableId } from '@/features/graph-table-db/graphTableDb'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { PanelTypography } from '@/lib/ui/panelTypography'
import { tailwindTextSizeClassToPx } from 'grph-shared/ui/tailwindTextSize'

export type GraphTableGridRow = {
  id: string
  __order: number
} & Record<string, unknown>

type GraphTableGridProps = {
  tableId: GraphTableId
  columns: GraphColumnDoc[]
  rows: GraphTableGridRow[]
  focusRowId?: string | null
  themeMode?: 'light' | 'dark'
  autoScrollToFocusRow?: boolean
  panelTypography?: PanelTypography
  onCellValueChanged: (rowId: string, columnId: string, next: unknown) => void
  onRowClicked: (rowId: string) => void
  onSelectionChanged: (selectedRowIds: string[]) => void
}

export function GraphTableGrid({
  tableId,
  columns,
  rows,
  focusRowId,
  themeMode = 'light',
  autoScrollToFocusRow = true,
  panelTypography,
  onCellValueChanged,
  onRowClicked,
  onSelectionChanged,
}: GraphTableGridProps) {
  const gridApiRef = useRef<GridApi | null>(null)
  const lastFocusedRowIdRef = useRef<string | null>(null)

  const columnDefs = useMemo((): ColDef<GraphTableGridRow>[] => {
    const base: ColDef<GraphTableGridRow>[] = [
      {
        colId: '__select',
        headerName: '',
        width: 44,
        pinned: 'left',
        checkboxSelection: true,
        headerCheckboxSelection: true,
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
      },
      {
        colId: '__order',
        headerName: '#',
        width: 72,
        pinned: 'left',
        valueGetter: params => params.data?.__order ?? 0,
        sortable: true,
        filter: true,
        editable: false,
      },
    ]

    const dynamic = columns
      .filter(c => !c.hidden)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((c): ColDef<GraphTableGridRow> => {
        const field = c.columnId
        const isCoreId = field === 'id'
        return {
          colId: field,
          field,
          headerName: c.name,
          editable: !isCoreId,
          flex: 1,
        }
      })
    return base.concat(dynamic)
  }, [columns])

  const defaultColDef = useMemo<ColDef<GraphTableGridRow>>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      headerClass: 'font-semibold',
      cellClass: '',
    }),
    [],
  )

  const onGridReady = (ev: GridReadyEvent) => {
    gridApiRef.current = ev.api
    if (!autoScrollToFocusRow) return
    const id = typeof focusRowId === 'string' ? focusRowId : null
    if (!id) return
    try {
      lastFocusedRowIdRef.current = id
      const node = ev.api.getRowNode(id)
      if (node) ev.api.ensureNodeVisible(node, 'middle')
    } catch {
      void 0
    }
  }

  useEffect(() => {
    const api = gridApiRef.current
    if (!api) return
    if (!autoScrollToFocusRow) return
    const id = typeof focusRowId === 'string' ? focusRowId : null
    if (!id || id === lastFocusedRowIdRef.current) return
    lastFocusedRowIdRef.current = id
    try {
      const node = api.getRowNode(id)
      if (node) api.ensureNodeVisible(node, 'middle')
    } catch {
      void 0
    }
  }, [autoScrollToFocusRow, focusRowId])

  const handleCellValueChanged = (ev: CellValueChangedEvent<GraphTableGridRow>) => {
    const rowId = String(ev.data?.id || '')
    const columnId = String(ev.colDef.field || '')
    if (!rowId || !columnId) return
    onCellValueChanged(rowId, columnId, ev.newValue)
  }

  const handleRowClicked = (ev: RowClickedEvent<GraphTableGridRow>) => {
    const anyEv = ev as unknown as { column?: { getColId?: () => string } }
    if (anyEv.column?.getColId?.() === '__select') return
    const id = String(ev.data?.id || '')
    if (!id) return
    onRowClicked(id)
  }

  const handleSelectionChanged = (ev: SelectionChangedEvent<GraphTableGridRow>) => {
    const api = ev.api
    const selected = api.getSelectedRows().map(r => String(r.id)).filter(Boolean)
    onSelectionChanged(selected)
  }

  const containerStyle = useMemo<Record<string, string>>(
    () => ({
      ['--ag-font-family' as never]: 'inherit',
      width: '100%',
      height: '100%',
      colorScheme: themeMode === 'dark' ? 'dark' : 'light',
      ['--ag-font-size' as never]: `${tailwindTextSizeClassToPx(panelTypography?.textSizeClass) || 12}px`,
      ['--ag-row-height' as never]: '28px',
      ['--ag-header-height' as never]: '28px',
      ['--ag-grid-size' as never]: '4px',
      ['--ag-background-color' as never]: 'var(--kg-panel-bg)',
      ['--ag-foreground-color' as never]: 'var(--kg-text-primary)',
      ['--ag-secondary-foreground-color' as never]: 'var(--kg-text-secondary)',
      ['--ag-header-foreground-color' as never]: 'var(--kg-text-secondary)',
      ['--ag-border-color' as never]: 'var(--kg-divider)',
      ['--ag-row-border-color' as never]: 'var(--kg-border)',
      ['--ag-header-background-color' as never]:
        themeMode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
      ['--ag-odd-row-background-color' as never]:
        themeMode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      ['--ag-row-hover-color' as never]: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      ['--ag-selected-row-background-color' as never]: themeMode === 'dark' ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.10)',
      ['--ag-range-selection-background-color' as never]: themeMode === 'dark' ? 'rgba(59,130,246,0.28)' : 'rgba(59,130,246,0.14)',
      ['--ag-input-border-color' as never]: 'var(--kg-border)',
      ['--ag-control-panel-background-color' as never]: 'var(--kg-panel-bg)',
      ['--ag-modal-overlay-background-color' as never]: themeMode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)',
    }),
    [panelTypography?.textSizeClass, themeMode],
  )

  return (
    <section className="flex-1 min-h-0 overflow-hidden" aria-label={`${tableId} grid`}>
      <section
        className={`h-full min-h-0 ${
          themeMode === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'
        } ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.panel.bg} ${panelTypography?.panelTextClass || ''}`}
        aria-label="AG Grid"
      >
        <AgGridReact<GraphTableGridRow>
          onGridReady={onGridReady}
          containerStyle={containerStyle}
          theme="legacy"
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={params => String(params.data.id)}
          onCellValueChanged={handleCellValueChanged}
          onRowClicked={handleRowClicked}
          onSelectionChanged={handleSelectionChanged}
          suppressRowClickSelection
          rowSelection="multiple"
          animateRows={false}
          suppressScrollOnNewData
          rowHeight={28}
          headerHeight={28}
        />
      </section>
    </section>
  )
}
