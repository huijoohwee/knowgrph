import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testHtmlExportPathsReuseSharedOverlaySizingContract() {
  const exportPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts')
  const viewerPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlViewer', 'buildGraphHtmlViewerMarkup.ts')
  const flowSnapshotsPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasSnapshots.ts')
  const htmlCanvasExportPath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'exports', 'exportHtmlCanvas.ts')
  const snapshotHandlersPath = resolve(process.cwd(), 'src', 'lib', 'panels', 'hooks', 'export-handlers', 'useSnapshotExportHandlers.impl.ts')
  const fallbackExportPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'exportHtmlFallback.ts')
  const overlaySizingHelperPath = resolve(process.cwd(), 'src', 'lib', 'render', 'overlaySizing2d.ts')

  const exportText = readFileSync(exportPath, 'utf8')
  const viewerText = readFileSync(viewerPath, 'utf8')
  const flowSnapshotsText = readFileSync(flowSnapshotsPath, 'utf8')
  const htmlCanvasExportText = readFileSync(htmlCanvasExportPath, 'utf8')
  const snapshotHandlersText = readFileSync(snapshotHandlersPath, 'utf8')
  const fallbackExportText = readFileSync(fallbackExportPath, 'utf8')
  const overlaySizingHelperText = readFileSync(overlaySizingHelperPath, 'utf8')

  if (!exportText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null')) {
    throw new Error('expected HTML canvas SVG export to accept the shared overlay sizing contract instead of six raw sizing fields')
  }
  if (!exportText.includes('overlaySizing,')) {
    throw new Error('expected HTML canvas SVG export to pass the shared overlay sizing contract through to the shared scene setup')
  }
  if (!overlaySizingHelperText.includes('export function readOverlaySizingInputFromStoreState')) {
    throw new Error('expected shared overlay sizing helper to expose the store-to-overlaySizing selector')
  }
  if (!viewerText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null')) {
    throw new Error('expected HTML viewer builder to accept the shared overlay sizing contract instead of legacy three-iframe sizing fields')
  }
  if (!viewerText.includes("const overlaySizingDefault = readOverlaySizingConfigForDensity({ density: 'default', sizing: args.overlaySizing || null })")) {
    throw new Error('expected HTML viewer builder to normalize default overlay sizing from the shared contract')
  }
  if (!viewerText.includes("const overlaySizingCompact = readOverlaySizingConfigForDensity({ density: 'compact', sizing: args.overlaySizing || null })")) {
    throw new Error('expected HTML viewer builder to normalize compact overlay sizing from the shared contract')
  }
  if (!flowSnapshotsText.includes('const overlaySizing = readOverlaySizingInputFromStoreState(store)')) {
    throw new Error('expected Flow canvas snapshot export to derive the shared overlay sizing contract from the shared store selector helper')
  }
  if (!htmlCanvasExportText.includes('overlaySizing: readOverlaySizingInputFromStoreState(store),')) {
    throw new Error('expected markdown workspace HTML export to pass shared overlay sizing derived by the shared store selector helper')
  }
  if (!snapshotHandlersText.includes('overlaySizing: readOverlaySizingInputFromStoreState(store),')) {
    throw new Error('expected snapshot export handlers to pass shared overlay sizing derived by the shared store selector helper')
  }
  if (!snapshotHandlersText.includes('overlaySizing: readOverlaySizingInputFromStoreState(store),')) {
    throw new Error('expected snapshot export handlers to pass shared overlay sizing into the HTML viewer builder')
  }
  if (!fallbackExportText.includes('overlaySizing: readOverlaySizingInputFromStoreState(store),')) {
    throw new Error('expected fallback HTML export to pass shared overlay sizing into the HTML viewer builder')
  }
}
