import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testGraphDataTableResponsiveMetricsOwnFixedChromeSizes() {
  const metricsText = readUtf8('src/features/graph-data-table/ui/graphDataTableResponsiveMetrics.ts')
  const graphInspectorMetricsText = readUtf8('src/features/graph-inspector/ui/graphInspectorResponsiveMetrics.ts')
  const gridModelText = readUtf8('src/features/graph-data-table/ui/fast-grid/useGraphDataTableGridModel.ts')
  const domTableText = readUtf8('src/features/graph-data-table/ui/GraphDataTableDomTableView.tsx')
  const dateCellEditorText = readUtf8('src/features/graph-data-table/ui/fast-grid/DateCellEditor.tsx')
  const fastGridText = readUtf8('src/features/graph-data-table/ui/GraphDataTableFastGrid.tsx')
  const toolbarText = readUtf8('src/features/graph-data-table/ui/GraphDataTableToolbar.tsx')
  const viewStateText = readUtf8('src/features/graph-data-table/ui/graphDataTableViewState.ts')
  const inspectorText = readUtf8('src/features/graph-inspector/ui/GraphRecordInspector.tsx')
  const graphInspectorCssText = readUtf8('src/styles/graph-inspector-responsive.css')
  const indexCssText = readUtf8('src/index.css')
  const responsiveElementClassesText = readUtf8('src/lib/ui/responsiveElementClasses.ts')

  for (const name of [
    'GRAPH_DATA_TABLE_SELECT_COLUMN_WIDTH_PX',
    'GRAPH_DATA_TABLE_ORDER_COLUMN_WIDTH_PX',
    'GRAPH_DATA_TABLE_DATA_COLUMN_MIN_WIDTH_PX',
    'GRAPH_DATA_TABLE_DATA_COLUMN_DEFAULT_WIDTH_PX',
    'GRAPH_DATA_TABLE_DATA_COLUMN_MAX_WIDTH_PX',
    'GRAPH_DATA_TABLE_DATE_PICKER_STYLE',
    'GRAPH_DATA_TABLE_GRID_SPACER_STYLE',
  ]) {
    if (!metricsText.includes(name)) throw new Error(`expected graph-table responsive metrics owner to export ${name}`)
  }
  for (const name of ['GRAPH_RECORD_INSPECTOR_ROOT_CLASS_NAME', 'GRAPH_RECORD_INSPECTOR_DETAIL_GRID_CLASS_NAME']) {
    if (!graphInspectorMetricsText.includes(name)) throw new Error(`expected graph-inspector responsive metrics owner to export ${name}`)
  }
  if (!metricsText.includes('100vw - var(--kg-safe-left) - var(--kg-safe-right)')) {
    throw new Error('expected graph-table date picker width to stay viewport-safe')
  }
  if (!gridModelText.includes('GRAPH_DATA_TABLE_SELECT_COLUMN_WIDTH_PX') || !gridModelText.includes('GRAPH_DATA_TABLE_DATA_COLUMN_DEFAULT_WIDTH_PX')) {
    throw new Error('expected graph-table grid model to consume shared responsive metrics')
  }
  if (!fastGridText.includes('readDataViewRowPixelHeight') || !domTableText.includes('readDataViewRowPixelHeight') || !toolbarText.includes('DATA_VIEW_ROW_HEIGHT_OPTIONS') || !viewStateText.includes('parseDataViewRowHeightPreset')) {
    throw new Error('expected graph-table row-height controls and renderers to consume the shared data-view density owner')
  }
  if (!domTableText.includes('selectColumnWidth') || !domTableText.includes('orderColumnWidth')) {
    throw new Error('expected DOM graph table to read pinned column widths from the shared model')
  }
  if (!dateCellEditorText.includes('GRAPH_DATA_TABLE_DATE_PICKER_STYLE') || !fastGridText.includes('GRAPH_DATA_TABLE_GRID_SPACER_STYLE') || !fastGridText.includes('UI_RESPONSIVE_PASSIVE_BASE_LAYER_SURFACE_CLASSNAME')) {
    throw new Error('expected graph-table editor, spacer chrome, and passive base layer to consume shared responsive owners')
  }
  if (!inspectorText.includes('GRAPH_RECORD_INSPECTOR_ROOT_CLASS_NAME') || !inspectorText.includes('GRAPH_RECORD_INSPECTOR_DETAIL_GRID_CLASS_NAME') || inspectorText.includes('grid-cols-[minmax(0,120px)_minmax(0,1fr)]')) {
    throw new Error('expected graph-record inspector detail grid to consume the shared responsive graph-inspector owner')
  }
  if (!indexCssText.includes("@import './styles/graph-inspector-responsive.css';") || !graphInspectorCssText.includes('.kg-graph-record-inspector-detail-grid') || !graphInspectorCssText.includes('--kg-graph-record-inspector-label-width') || !graphInspectorCssText.includes('40vw')) {
    throw new Error('expected graph-record inspector detail grid sizing to stay viewport-safe in the graph-inspector responsive stylesheet')
  }
  if (!responsiveElementClassesText.includes("UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME = 'absolute inset-0 pointer-events-none'") || !responsiveElementClassesText.includes('`${UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME} z-0`') || domTableText.includes('width: 44') || domTableText.includes('width: 72') || dateCellEditorText.includes('width: 260') || fastGridText.includes('width: 1, height: 1') || fastGridText.includes('className="absolute inset-0 z-0 pointer-events-none"') || fastGridText.includes("props.rowHeightPreset === 'compact' ? 22 : 28") || domTableText.includes("props.rowHeightPreset === 'compact' ? 22 : 28")) {
    throw new Error('expected graph-table component files to stay free of local fixed chrome size literals')
  }
}
