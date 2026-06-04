import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testGraphTableResponsiveMetricsOwnFixedChromeSizes() {
  const metricsText = readUtf8('src/features/graph-table/ui/graphTableResponsiveMetrics.ts')
  const gridModelText = readUtf8('src/features/graph-table/ui/fast-grid/useGraphTableGridModel.ts')
  const domTableText = readUtf8('src/features/graph-table/ui/GraphTableDomTableView.tsx')
  const dateCellEditorText = readUtf8('src/features/graph-table/ui/fast-grid/DateCellEditor.tsx')
  const fastGridText = readUtf8('src/features/graph-table/ui/GraphTableFastGrid.tsx')
  const inspectorText = readUtf8('src/features/graph-table/ui/GraphTableInspector.tsx')
  const graphTableCssText = readUtf8('src/styles/graph-table-responsive.css')
  const indexCssText = readUtf8('src/index.css')
  const responsiveElementClassesText = readUtf8('src/lib/ui/responsiveElementClasses.ts')

  for (const name of [
    'GRAPH_TABLE_SELECT_COLUMN_WIDTH_PX',
    'GRAPH_TABLE_ORDER_COLUMN_WIDTH_PX',
    'GRAPH_TABLE_DATA_COLUMN_MIN_WIDTH_PX',
    'GRAPH_TABLE_DATA_COLUMN_DEFAULT_WIDTH_PX',
    'GRAPH_TABLE_DATA_COLUMN_MAX_WIDTH_PX',
    'GRAPH_TABLE_DATE_PICKER_STYLE',
    'GRAPH_TABLE_GRID_SPACER_STYLE',
    'GRAPH_TABLE_INSPECTOR_DETAIL_GRID_CLASS_NAME',
  ]) {
    if (!metricsText.includes(name)) throw new Error(`expected graph-table responsive metrics owner to export ${name}`)
  }
  if (!metricsText.includes('100vw - var(--kg-safe-left) - var(--kg-safe-right)')) {
    throw new Error('expected graph-table date picker width to stay viewport-safe')
  }
  if (!gridModelText.includes('GRAPH_TABLE_SELECT_COLUMN_WIDTH_PX') || !gridModelText.includes('GRAPH_TABLE_DATA_COLUMN_DEFAULT_WIDTH_PX')) {
    throw new Error('expected graph-table grid model to consume shared responsive metrics')
  }
  if (!domTableText.includes('selectColumnWidth') || !domTableText.includes('orderColumnWidth')) {
    throw new Error('expected DOM graph table to read pinned column widths from the shared model')
  }
  if (!dateCellEditorText.includes('GRAPH_TABLE_DATE_PICKER_STYLE') || !fastGridText.includes('GRAPH_TABLE_GRID_SPACER_STYLE') || !fastGridText.includes('UI_RESPONSIVE_PASSIVE_BASE_LAYER_SURFACE_CLASSNAME')) {
    throw new Error('expected graph-table editor, spacer chrome, and passive base layer to consume shared responsive owners')
  }
  if (!inspectorText.includes('GRAPH_TABLE_INSPECTOR_DETAIL_GRID_CLASS_NAME') || inspectorText.includes('grid-cols-[minmax(0,120px)_minmax(0,1fr)]')) {
    throw new Error('expected graph-table inspector detail grid to consume the shared responsive graph-table owner')
  }
  if (!indexCssText.includes("@import './styles/graph-table-responsive.css';") || !graphTableCssText.includes('.kg-graph-table-inspector-detail-grid') || !graphTableCssText.includes('--kg-graph-table-inspector-label-width') || !graphTableCssText.includes('40vw')) {
    throw new Error('expected graph-table inspector detail grid sizing to stay viewport-safe in the graph-table responsive stylesheet')
  }
  if (!responsiveElementClassesText.includes("UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME = 'absolute inset-0 pointer-events-none'") || !responsiveElementClassesText.includes('`${UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME} z-0`') || domTableText.includes('width: 44') || domTableText.includes('width: 72') || dateCellEditorText.includes('width: 260') || fastGridText.includes('width: 1, height: 1') || fastGridText.includes('className="absolute inset-0 z-0 pointer-events-none"')) {
    throw new Error('expected graph-table component files to stay free of local fixed chrome size literals')
  }
}
