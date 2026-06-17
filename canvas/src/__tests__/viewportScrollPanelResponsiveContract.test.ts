import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testViewportScrollPanelsUseSharedResponsiveOwner() {
  const classText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const cssText = readUtf8('src/styles/responsive-toolbar.css')
  const contractsDiagnosticsText = readUtf8('src/pages/ContractsDiagnostics.tsx')
  const pdfDocumentViewerText = readUtf8('src/pages/PdfDocumentViewer.tsx')

  if (!classText.includes('UI_RESPONSIVE_VIEWPORT_SCROLL_PANEL_CLASSNAME') || !classText.includes('UI_RESPONSIVE_COMPACT_VIEWPORT_SCROLL_PANEL_CLASSNAME')) {
    throw new Error('expected viewport scroll panel class owners to be exported from the shared responsive class registry')
  }
  if (!cssText.includes('.kg-responsive-viewport-scroll-panel') || !cssText.includes('.kg-responsive-viewport-scroll-panel--compact') || !cssText.includes('--kg-responsive-viewport-scroll-panel-max-height')) {
    throw new Error('expected viewport scroll panel caps to live in shared responsive CSS')
  }
  if (!contractsDiagnosticsText.includes('UI_RESPONSIVE_COMPACT_VIEWPORT_SCROLL_PANEL_CLASSNAME') || !pdfDocumentViewerText.includes('UI_RESPONSIVE_VIEWPORT_SCROLL_PANEL_CLASSNAME')) {
    throw new Error('expected diagnostics and PDF viewer scroll panels to consume shared responsive owners')
  }
  if (contractsDiagnosticsText.includes('max-h-[60vh]') || pdfDocumentViewerText.includes('max-h-[70vh]')) {
    throw new Error('expected page-local viewport max-height literals to stay out of diagnostics and PDF viewer scroll panels')
  }
}

export function testPageLayoutsUseSharedResponsiveOwners() {
  const ownerText = readUtf8('src/pages/pageResponsiveClasses.ts')
  const cssText = readUtf8('src/styles/page-responsive.css')
  const indexCssText = readUtf8('src/index.css')
  const contractsDiagnosticsText = readUtf8('src/pages/ContractsDiagnostics.tsx')
  const pdfDocumentViewerText = readUtf8('src/pages/PdfDocumentViewer.tsx')

  for (const name of [
    'CONTRACTS_DIAGNOSTICS_PAGE_CONTENT_CLASS_NAME',
    'PDF_DOCUMENT_VIEWER_HEADER_ROW_CLASS_NAME',
    'PDF_DOCUMENT_VIEWER_GRID_CLASS_NAME',
    'PDF_DOCUMENT_VIEWER_READING_CONTAINER_CLASS_NAME',
  ]) {
    if (!ownerText.includes(name)) throw new Error(`expected page responsive owner to export ${name}`)
  }
  for (const snippet of [
    '.kg-contracts-diagnostics-page-content',
    '.kg-pdf-document-viewer-header-row',
    '.kg-pdf-document-viewer-grid',
    '.kg-pdf-document-viewer-reading-container',
    '--kg-pdf-document-viewer-content-width',
    '--kg-pdf-document-viewer-toc-width',
  ]) {
    if (!cssText.includes(snippet)) throw new Error(`expected page responsive CSS owner to include ${snippet}`)
  }
  if (!cssText.includes('grid-template-columns: minmax(0, 1fr)')) {
    throw new Error('expected page layout grids to stay mobile-first')
  }
  if (!indexCssText.includes("@import './styles/page-responsive.css';")) {
    throw new Error('expected app CSS to import page responsive layout owners')
  }
  if (!contractsDiagnosticsText.includes('CONTRACTS_DIAGNOSTICS_PAGE_CONTENT_CLASS_NAME') || !pdfDocumentViewerText.includes('PDF_DOCUMENT_VIEWER_GRID_CLASS_NAME')) {
    throw new Error('expected diagnostics and PDF viewer pages to consume page responsive owners')
  }
  for (const literal of [
    'mx-auto w-full max-w-5xl px-6 py-8',
    'max-w-6xl mx-auto px-4 py-3 flex items-center justify-between',
    'max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4',
    'max-w-3xl mx-auto px-6 py-6',
  ]) {
    if (contractsDiagnosticsText.includes(literal) || pdfDocumentViewerText.includes(literal)) {
      throw new Error(`expected page layout to avoid inline fixed layout literal: ${literal}`)
    }
  }
}

export function testDocumentVersionGitGraphUsesSharedResponsiveViewportOwner() {
  const classText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const cssText = readUtf8('src/styles/responsive-toolbar.css')
  const panelText = readUtf8('src/features/document-versioning/DocumentVersionGitGraphPanel.tsx')

  if (!classText.includes('UI_RESPONSIVE_DOCUMENT_VERSION_GITGRAPH_VIEWPORT_CLASSNAME') || !classText.includes('UI_RESPONSIVE_COMPACT_DOCUMENT_VERSION_GITGRAPH_VIEWPORT_CLASSNAME') || !classText.includes('UI_RESPONSIVE_DOCUMENT_VERSION_GITGRAPH_SURFACE_CLASSNAME')) {
    throw new Error('expected document version GitGraph viewport owners to be exported from the shared responsive class registry')
  }
  if (!cssText.includes('.kg-document-version-gitgraph-viewport') || !cssText.includes('.kg-document-version-gitgraph-viewport--compact') || !cssText.includes('--kg-document-version-gitgraph-viewport-max-height')) {
    throw new Error('expected document version GitGraph viewport caps to live in shared responsive CSS')
  }
  if (!panelText.includes('UI_RESPONSIVE_DOCUMENT_VERSION_GITGRAPH_VIEWPORT_CLASSNAME') || !panelText.includes('UI_RESPONSIVE_COMPACT_DOCUMENT_VERSION_GITGRAPH_VIEWPORT_CLASSNAME') || !panelText.includes('UI_RESPONSIVE_DOCUMENT_VERSION_GITGRAPH_SURFACE_CLASSNAME') || !panelText.includes('data-kg-document-version-gitgraph-direct-selection="1"')) {
    throw new Error('expected document version GitGraph panel to consume shared responsive owners')
  }
  if (
    classText.includes('UI_RESPONSIVE_DOCUMENT_VERSION_GITGRAPH_VERSION_NODE') ||
    panelText.includes('max-h-32') ||
    panelText.includes('max-h-56') ||
    panelText.includes('min-h-[4rem]') ||
    panelText.includes('min-h-[5rem]') ||
    panelText.includes('border-blue-600 bg-blue-500/20') ||
    panelText.includes('hover:border-blue-500/70') ||
    panelText.includes('data-kg-document-version-gitgraph-version-node')
  ) {
    throw new Error('expected document version GitGraph sizing to stay in shared viewport owners and selection to stay on rendered SVG elements')
  }
}

export function testWorkspaceAndGraphTablePanelsUseSharedViewportScrollOwner() {
  const explorerText = readUtf8('src/features/markdown-workspace/MarkdownWorkspaceExplorer.tsx')
  const domTableText = readUtf8('src/features/graph-data-table/ui/GraphDataTableDomTableView.tsx')
  const inspectorText = readUtf8('src/features/graph-inspector/ui/GraphRecordInspector.tsx')

  if (!explorerText.includes('UI_RESPONSIVE_MARKDOWN_WORKSPACE_EXPLORER_CONTENT_CLASSNAME') || !domTableText.includes('UI_RESPONSIVE_VIEWPORT_SCROLL_PANEL_CLASSNAME') || !inspectorText.includes('UI_RESPONSIVE_VIEWPORT_SCROLL_PANEL_CLASSNAME')) {
    throw new Error('expected Explorer to consume the shared section-scroll stack owner and Graph Table panels to consume the shared viewport scroll owner')
  }
  if (explorerText.includes('UI_RESPONSIVE_VIEWPORT_SCROLL_PANEL_CLASSNAME') || explorerText.includes('kg-responsive-viewport-scroll-panel') || explorerText.includes('flex-1 min-h-0 overflow-auto') || domTableText.includes('flex-1 min-h-0 min-w-0 max-w-full overflow-auto') || inspectorText.includes("'flex-1 min-h-0 overflow-auto'")) {
    throw new Error('expected Explorer and Graph Table panels to stay free of local or stale viewport scroll literals')
  }
}
