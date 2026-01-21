export const UI_LAYOUT = {
  toolbarOffsetPx: 36,
} as const;

export const UI_ANCHORS = {
  graphFields: 'graph-fields',
  graphFieldsIcons: 'graph-fields:icons',
  searchPanel: 'search-panel',
  schemaPanel: 'schema-panel',
  settingsPanel: 'settings-panel',
  settingsUiIconScale: 'settings:uiIconScale',
  ragEmbedding: 'rag:Embedding',
  ragGraphRAGWorkflow: 'rag:GraphRAGWorkflow',
  searchNode: 'search:node',
  searchEdge: 'search:edge',
  helpGraphLayers: 'help:graphLayers',
} as const;

export type UiAnchorId = (typeof UI_ANCHORS)[keyof typeof UI_ANCHORS];

export const UI_SELECTORS = {
  draggablePanelIgnorePointerDown: [
    'button',
    '[role="button"]',
    'input',
    'textarea',
    'select',
    'a',
    '[role="textbox"]',
    '[contenteditable="true"]',
    '[data-no-drag="true"]',
    '[data-floating-panel-no-drag="true"]',
    '[data-main-panel-no-drag="true"]',
  ].join(', '),
} as const;

export const UI_LABELS = {
  sourceFiles: 'Source Files',
  csv: 'CSV',
  graphFields: 'Graph Fields',
  previewPanel: 'Preview Panel',
  search: 'Graph Search',
  chat: 'Chat',
  schema: 'Schema',
  settings: 'Settings',
  markdown: 'Markdown',
  html: 'HTML',
  pdf: 'PDF',
  youtube: 'YouTube',
  jsonLd: 'JSON-LD',
  json: 'JSON',
  openData: 'Open Data',
  loadStatus: 'Load Status',
  globalFields: 'Global Fields',
  baseFields: 'Base Fields',
  floatingPanel: 'Floating panel',
  workspaceActions: 'Workspace Actions',
  graphTraversal: 'Graph Traversal',
  dragToResize: 'Drag to resize',
  data: 'Data',
  parser: 'Parser',
  schemaConfigurator: 'Schema Configurator',
  orchestrator: 'Orchestrator',
  renderer: 'Renderer',
  history: 'History',
  help: 'Help',
  sidebar: 'Sidebar',
  propsPanel: 'Props Panel',
  samples: 'Samples',
  close: 'Close',
  save: 'Save',
  reset: 'Reset',
  restore: 'Restore',
  clear: 'Clear',
  cancel: 'Cancel',
  create: 'Create',
  add: 'Add',
  apply: 'Apply',
  format: 'Format',
  undo: 'Undo',
  redo: 'Redo',
  edit: 'Edit',
  delete: 'Delete',
  copy: 'Copy',
  selectAll: 'Select all',
  collapseAll: 'Collapse all',
  expandAll: 'Expand all',
  view: 'View',
  menu: 'Menu',
  documentStructureMode: 'Document Structure Mode',
  keywordMode: 'Keyword Mode',
  name: 'Name',
  scope: 'Scope',
  type: 'Type',
  hidden: 'Hidden',
  options: 'Options',
  defaultValue: 'Default value',
  newField: 'New Field',
  showAll: 'Show all',
  hideAll: 'Hide all',
  customFields: 'Custom Fields',
  derivedFields: 'Derived Fields',
  globalSchema: 'Global Schema',
  base: 'Base',
  moving: 'Moving…',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  fitToView: 'Fit to View',
  fitToScreen: 'Fit to Screen',
  pinToView: 'Pin to View',
  zoomToSelection: 'Zoom to Selection',
  multiSelectMode: 'Multi-select Mode',
  layerMode: 'Layer Mode',
  graphLayersMode: 'Clusters',
  portHandles: 'Port Handles',
  radialLayoutMode: 'Radial Layout',
  treeLayoutMode: 'Tree Layout',
  dragToReorder: 'Drag to reorder',
  removeOption: 'Remove option',
  fieldSettings: 'Field Settings',
  ragEmbedding: 'Embedding (AgenticRAG)',
  ragGraphRAGWorkflow: 'GraphRAG Workflow (AgenticRAG)',
  createNode: 'Create Node',
  addToChat: 'Add to chat',
  localSchemaProperties: 'Local schema · Properties',
  localSchemaTemplate: 'Local schema · Template',
  localSchemaValidation: 'Local schema · Validation',
  localSchemaLocalRules: 'Local schema · Local rules',
  mermaidFocus: 'Mermaid Focus',
  status: 'Status',
  nodeShapeMode: 'Node Shape',
  groupShapeRect: 'Cluster Shape: Rect',
  groupShapePolygon: 'Cluster Shape: Polygon',
  frontmatterMode: 'Frontmatter Mode',
  frontmatterModeMermaidFocus: 'Frontmatter Mode (Mermaid focus)',
  mermaidLayout: 'Mermaid Layout',
  renderMediaAsNodes: 'Render Media as Nodes',
  renderMediaAsNodesOn: 'Render Media as Nodes (On)',
  renderMediaAsNodesOff: 'Render Media as Nodes (Off)',
  threeDMode: '3D Mode',
  threeDModeOn: '3D Mode (On)',
  threeDModeOff: '3D Mode (Off)',
  launch: 'Launch',
  theme: 'Theme',
  resizeBottomPanel: 'Resize bottom panel',
  layerModeDescriptorSchema: 'Schema (entities)',
  layerModeDescriptorDocument: 'Layered structure (document)',
  layerModeDescriptorSemantic: 'Similarity clusters (semantic)',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  dataTableAriaLabel: 'Data Table',
  nodesLabel: 'Nodes:',
  edgesLabel: 'Edges:',
  selectedLabel: 'Selected:',
  noneLabel: 'None',
  perfButtonLabel: 'Perf',
  statusBarAriaLabel: 'Status Bar',
} as const;

export type UiLabelId = (typeof UI_LABELS)[keyof typeof UI_LABELS];

export const SCHEMA_KEYS = {
  globalSchema: 'global:schema',
  localSchemaProperties: 'local:schema:properties',
  localSchemaTemplate: 'local:schema:template',
  localSchemaValidation: 'local:schema:validation',
  localSchemaLocalRules: 'local:schema:localRules',
} as const;

export const ZERO_TO_ONE_GRAPH_TRAVERSAL_LABEL = 'Zero-to-one graph traversal';

export const HTML_IMPORT_GUARDS = {
  viteDevIndexMarkers: [
    '<div id="root"></div>',
    'src="/src/main.tsx"',
    'src="/@vite/client"',
    '"/@react-refresh"',
  ],
  viteDevIndexMinMarkerMatches: 2,
} as const;

export function looksLikeViteDevIndexHtml(htmlText: string): boolean {
  const text = String(htmlText || '')
  const markers = HTML_IMPORT_GUARDS.viteDevIndexMarkers || []
  const threshold = HTML_IMPORT_GUARDS.viteDevIndexMinMarkerMatches || 0
  if (!text.trim() || markers.length === 0 || threshold <= 0) return false
  let matches = 0
  for (const m of markers) {
    if (m && text.includes(m)) matches += 1
    if (matches >= threshold) return true
  }
  return false
}
