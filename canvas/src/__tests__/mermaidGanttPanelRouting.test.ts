import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { annotateInteractiveMermaidSelectionRows } from '@/lib/diagram/InteractiveMermaidDiagram'
import {
  parseMermaidDiagramCodeModel,
  readFrontmatterMermaidDiagramCodes,
  readYamlFrontmatterMermaidDiagramCodes,
  resolveMermaidDiagramCode,
} from '@/lib/mermaid/mermaidDiagramCode'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const root = () => resolve(process.cwd(), 'src')
const readSource = (...parts: string[]) => readFileSync(resolve(root(), ...parts), 'utf8')

export function testTypedMermaidDiagramResolverReadsGitGraphAndGanttFrontmatter() {
  const markdown = [
    '---',
    'flow_diagrams:',
    '  key: flow_diagrams',
    '  type: object',
    '  value:',
    '    source_flow:',
    '      key: source_flow',
    '      type: mermaid_gitgraph',
    '      value: |-',
    '        gitGraph',
    '          commit id:"source_input"',
    '          branch compute',
    '          checkout compute',
    '          commit id:"inline_compute"',
    '    time_flow:',
    '      key: time_flow',
    '      type: mermaid_gantt',
    '      value: |-',
    '        gantt',
    '          title Dynamic compute flow',
    '          section Critical path',
    '          Inline compute :crit, compute, 2026-06-05, 1d',
    '---',
    '',
    '# Flow diagrams',
  ].join('\n')

  const gitGraphCode = resolveMermaidDiagramCode(
    readYamlFrontmatterMermaidDiagramCodes(markdown, 'gitgraph'),
    'gitgraph',
  )
  if (!gitGraphCode.includes('commit id:"source_input"')) {
    throw new Error('expected typed mermaid_gitgraph frontmatter to resolve GitGraph code')
  }

  const ganttCode = resolveMermaidDiagramCode(
    readYamlFrontmatterMermaidDiagramCodes(markdown, 'gantt'),
    'gantt',
  )
  if (!ganttCode.includes('Inline compute :crit')) {
    throw new Error('expected typed mermaid_gantt frontmatter to resolve Gantt code')
  }

  const model = parseMermaidDiagramCodeModel(ganttCode, 'gantt')
  const criticalTask = model.rows.find(row => row.kind === 'task' && row.label === 'Inline compute')
  if (!criticalTask) {
    throw new Error('expected Gantt parser model to expose task rows')
  }
}

export function testTypedMermaidDiagramResolverReadsParsedGraphMetadata() {
  const graphData = {
    type: 'Graph',
    nodes: [],
    edges: [],
    metadata: {
      frontmatterMeta: {
        flow_diagrams: {
          key: 'flow_diagrams',
          type: 'object',
          value: {
            time_flow: {
              key: 'time_flow',
              type: 'mermaid_gantt',
              value: [
                'gantt',
                '  title Runtime graph',
                '  section Panels',
                '  Render Gantt :crit, render, 2026-06-05, 1d',
              ].join('\n'),
            },
          },
        },
      },
    },
  }

  const ganttCode = resolveMermaidDiagramCode(
    readFrontmatterMermaidDiagramCodes(graphData, 'gantt'),
    'gantt',
  )
  if (!ganttCode.includes('Render Gantt :crit')) {
    throw new Error('expected parsed graph frontmatter metadata to resolve typed Gantt code')
  }
}

export function testInteractiveMermaidSelectionAnnotatesSiblingChartGeometry() {
  const { dom, restore } = initJsdomHarness()
  const globalWithSerializer = globalThis as typeof globalThis & { XMLSerializer?: typeof XMLSerializer }
  const originalXmlSerializer = globalWithSerializer.XMLSerializer
  globalWithSerializer.XMLSerializer = dom.window.XMLSerializer as unknown as typeof XMLSerializer
  try {
    const backgroundRows = Array.from({ length: 20 }, (_, index) =>
      `<g class="background-row"><circle cx="${index}" cy="${index}" r="1"/><text>background ${index}</text></g>`,
    ).join('')
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">',
      `<g id="whole-chart">${backgroundRows}`,
      '<g id="target-commit"><path id="target-lane" d="M10 40H160"/><circle id="target-dot" cx="80" cy="40" r="8"/><text x="86" y="44">source_input</text></g>',
      '</g>',
      '</svg>',
    ].join('')
    const annotated = annotateInteractiveMermaidSelectionRows(svg, [{
      key: 'line:1',
      labels: ['commit id:"source_input"', 'source_input'],
      kind: 'commit',
      lineNumber: 2,
    }])
    const doc = new DOMParser().parseFromString(annotated, 'image/svg+xml')
    const targetDot = doc.querySelector('#target-dot')
    const targetLane = doc.querySelector('#target-lane')
    const targetGroup = doc.querySelector('#target-commit')
    const broadGroup = doc.querySelector('#whole-chart')
    if (targetDot?.getAttribute('data-kg-mermaid-row-key') !== 'line:1') {
      throw new Error('expected direct click target circle to carry the matched Mermaid row key')
    }
    if (targetLane?.getAttribute('data-kg-mermaid-row-key') !== 'line:1') {
      throw new Error('expected direct click target path to carry the matched Mermaid row key')
    }
    if (targetGroup?.getAttribute('data-kg-mermaid-row-target') !== '1') {
      throw new Error('expected bounded chart group to be selectable from rendered SVG geometry')
    }
    if (broadGroup?.getAttribute('data-kg-mermaid-row-key')) {
      throw new Error('expected broad aggregate chart group not to inherit a row key from descendant text')
    }
    if (annotated.includes('data-kg-mermaid-diagram-row-marker')) {
      throw new Error('expected direct SVG selection annotation without proxy row markers')
    }
  } finally {
    if (typeof originalXmlSerializer === 'undefined') {
      delete globalWithSerializer.XMLSerializer
    } else {
      globalWithSerializer.XMLSerializer = originalXmlSerializer
    }
    restore()
  }
}

export function testGanttPanelRoutingUsesSharedGitGraphMermaidUtilities() {
  const toolbarText = readSource('lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const canvasViewMenuText = readSource('components', 'toolbar', 'canvasViewMenu.ts')
  const canvasViewActionsText = readSource('components', 'toolbar', 'canvasViewActions.ts')
  const canvasViewSelectText = readSource('components', 'toolbar', 'Canvas2dRendererSelect.tsx')
  const canvasViewTypesText = readSource('components', 'toolbar', 'canvasViewTypes.ts')
  const bottomPanelText = readSource('features', 'strybldr', 'StrybldrTimelineBottomPanel.tsx')
  const floatingTypeText = readSource('hooks', 'store', 'store-types', 'graph-state-chat-import.ts')
  const uiInitialStateText = readSource('hooks', 'store', 'uiSliceInitialState.ts')
  const bottomTypeText = readSource('hooks', 'store', 'store-types', 'core.ts')
  const iconText = readSource('features', 'panels', 'ui', 'mainPanelHelpIconLibrary.tsx')
  const panelText = readSource('features', 'gitgraph', 'MermaidDiagramPanelView.tsx')
  const gitGraphFloatingText = readSource('features', 'gitgraph', 'GitGraphFloatingPanelView.tsx')
  const ganttFloatingText = readSource('features', 'gitgraph', 'GanttFloatingPanelView.tsx')
  const gitGraphBottomText = readSource('features', 'gitgraph', 'GitGraphBottomPanelView.tsx')
  const ganttBottomText = readSource('features', 'gitgraph', 'GanttBottomPanelView.tsx')
  const resolverText = readSource('lib', 'mermaid', 'mermaidDiagramCode.ts')
  const plainMermaidText = readSource('features', 'markdown', 'ui', 'PlainMermaidDiagram.tsx')
  const interactiveMermaidText = readSource('lib', 'diagram', 'InteractiveMermaidDiagram.tsx')
  const selectionHelperText = readSource('lib', 'diagram', 'diagramRowSelection.ts')
  const svgSurfaceZoomRuntimeText = readSource('components', 'GraphCanvas', 'hooks', 'useSvgSurfaceZoomRuntime.ts')

  if (!floatingTypeText.includes("| 'gantt'")) {
    throw new Error('expected FloatingPanelView to include a first-class Gantt view')
  }
  if (
    !floatingTypeText.includes('mermaidDiagramSelectedRowKeyByKind') ||
    !floatingTypeText.includes('setMermaidDiagramSelectedRowKey') ||
    !uiInitialStateText.includes('mermaidDiagramSelectedRowKeyByKind: {}') ||
    !uiInitialStateText.includes('setMermaidDiagramSelectedRowKey')
  ) {
    throw new Error('expected Mermaid GitGraph/Gantt selected rows to live in shared store state for BottomPanel/FloatingPanel sync')
  }
  if (!bottomTypeText.includes("'gantt'") || !bottomTypeText.includes("'documentVersionGraph'")) {
    throw new Error('expected BottomSurfaceTab to keep document-version graph separate from first-class Gantt and GitGraph tabs')
  }
  if (
    !canvasViewTypesText.includes("'control:gitGraph'") ||
    !canvasViewTypesText.includes("'control:gantt'") ||
    !canvasViewMenuText.includes("id: 'control:gitGraph'") ||
    !canvasViewMenuText.includes("id: 'control:gantt'")
  ) {
    throw new Error('expected Canvas View Display Controls to expose BottomPanel GitGraph and Gantt controls')
  }
  if (
    !canvasViewActionsText.includes("id === 'control:gitGraph' || id === 'control:gantt'") ||
    !canvasViewActionsText.includes("setBottomSurfaceTab(nextTab)") ||
    !canvasViewActionsText.includes('setBottomSurfaceCollapsed(false)') ||
    !canvasViewSelectText.includes('setBottomSurfaceTab: s.setBottomSurfaceTab')
  ) {
    throw new Error('expected Canvas View Display Controls to route GitGraph and Gantt through shared bottom-surface setters')
  }
  if (
    !toolbarText.includes('GanttFloatingPanelViewLazy') ||
    !toolbarText.includes("{ view: 'gantt', title: UI_LABELS.gantt") ||
    !toolbarText.includes("floatingPanelView === 'gantt'")
  ) {
    throw new Error('expected FloatingPanel toolbar to route Gantt through the shared view registry')
  }
  if (
    !bottomPanelText.includes('GanttBottomPanelViewLazy') ||
    !bottomPanelText.includes('GitGraphBottomPanelViewLazy') ||
    !bottomPanelText.includes('DocumentVersionGitGraphPanelLazy') ||
    !bottomPanelText.includes("bottomSurfaceTab === 'documentVersionGraph'") ||
    !bottomPanelText.includes("setBottomSurfaceTab('documentVersionGraph')") ||
    !bottomPanelText.includes("bottomSurfaceTab === 'gantt'") ||
    !bottomPanelText.includes("view === 'documentVersionGraph'") ||
    !bottomPanelText.includes("view === 'gitGraph'") ||
    !bottomPanelText.includes("view === 'gantt'") ||
    !bottomPanelText.includes('data-kg-strybldr-bottom-timeline-document-version-graph-toggle') ||
    !bottomPanelText.includes('data-kg-strybldr-bottom-timeline-gantt-toggle')
  ) {
    throw new Error('expected BottomPanel to route separate Version Graph, GitGraph, and Gantt tabs')
  }
  if (!iconText.includes("'floatingPanel.gantt'") || !iconText.includes('ChartGantt')) {
    throw new Error('expected Gantt icon ownership to live in the shared FloatingPanel type icon registry')
  }
  if (
    !panelText.includes('InteractiveMermaidDiagram') ||
    !panelText.includes('data-kg-mermaid-diagram-kind') ||
    !interactiveMermaidText.includes('useSvgSurfaceZoomRuntime({') ||
    !interactiveMermaidText.includes('renderPlainMermaidSvgCached') ||
    !interactiveMermaidText.includes('data-kg-interactive-svg-diagram-surface') ||
    !interactiveMermaidText.includes('data-kg-interactive-svg-diagram-key')
  ) {
    throw new Error('expected BottomPanel Mermaid rendering to reuse the shared interactive SVG diagram surface')
  }
  if (
    !panelText.includes("export type MermaidDiagramPanelRenderMode = 'diagram' | 'list' | 'split'") ||
    !panelText.includes("renderMode = surface === 'bottomPanel' ? 'diagram' : 'list'") ||
    !panelText.includes("const showDiagram = renderMode !== 'list'") ||
    !panelText.includes("const showRowList = renderMode !== 'diagram'") ||
    !panelText.includes('state.mermaidDiagramSelectedRowKeyByKind[kind]') ||
    !panelText.includes('setMermaidDiagramSelectedRowKey(kind, rowKey)') ||
    !panelText.includes('data-kg-mermaid-diagram-render-mode={renderMode}') ||
    !panelText.includes('data-kg-mermaid-diagram-command-list="1"')
  ) {
    throw new Error('expected Mermaid panels to split BottomPanel diagrams from FloatingPanel row lists while sharing selected-row state')
  }
  if (
    !selectionHelperText.includes('resolveDiagramRowKey') ||
    !panelText.includes('readDiagramSelectionLabels') ||
    !panelText.includes('selectionRows={selectionRows}') ||
    !panelText.includes('selectedRowKey={selectedRowKey}') ||
    !panelText.includes('onSelectedRowKeyChange={onSelectRowKey}') ||
    !panelText.includes('data-kg-mermaid-diagram-direct-selection="1"') ||
    !panelText.includes('svgSurfaceKey={`mermaid:${kind}`}') ||
    !plainMermaidText.includes('selectedLabels') ||
    !plainMermaidText.includes('baseSvg') ||
    !plainMermaidText.includes('setBaseSvg(processed.svg)') ||
    !plainMermaidText.includes('data-kg-mermaid-row-selected') ||
    !plainMermaidText.includes('data-kg-mermaid-row-dimmed') ||
    !plainMermaidText.includes('data-kg-mermaid-selection-active') ||
    !interactiveMermaidText.includes('annotateInteractiveMermaidSelectionRows') ||
    !interactiveMermaidText.includes('propagateInteractiveMermaidRowAnnotations') ||
    !interactiveMermaidText.includes('deriveInteractiveMermaidClassAliases') ||
    !interactiveMermaidText.includes('data-kg-mermaid-row-key') ||
    !interactiveMermaidText.includes('data-kg-mermaid-row-target') ||
    !interactiveMermaidText.includes('readSelectedElementPeers') ||
    !interactiveMermaidText.includes('onSelectedElementLabelChange') ||
    !interactiveMermaidText.includes('svgSurfaceKey,') ||
    !interactiveMermaidText.includes('data-kg-svg-dimmed') ||
    !interactiveMermaidText.includes('data-kg-svg-selected') ||
    !svgSurfaceZoomRuntimeText.includes('SVG_DIRECT_SELECTION_TARGET_SELECTOR') ||
    !svgSurfaceZoomRuntimeText.includes('findNearestSvgSelectionTarget') ||
    !svgSurfaceZoomRuntimeText.includes('resolveSvgSelectionClickCandidate') ||
    !svgSurfaceZoomRuntimeText.includes('readSvgContentClientBounds') ||
    !svgSurfaceZoomRuntimeText.includes('readSvgViewportRect') ||
    !svgSurfaceZoomRuntimeText.includes('viewportWidth = runtime?.viewport.width || dims.width') ||
    !svgSurfaceZoomRuntimeText.includes('fitAllTransform(visualGraphData.nodes, viewportWidth, viewportHeight') ||
    !svgSurfaceZoomRuntimeText.includes("group.removeAttribute('transform')") ||
    !svgSurfaceZoomRuntimeText.includes("data-kg-svg-fit-source', contentBounds ? 'content' : 'root'") ||
    !svgSurfaceZoomRuntimeText.includes('{ notify: false }')
  ) {
    throw new Error('expected GitGraph and Gantt diagrams to reuse direct SVG canvas-to-row selection, interactive SVG dimming, and cached render output')
  }
  if (
    panelText.includes('resolveDiagramPointerRowIndex') ||
    panelText.includes('resolveDiagramRowPositionPercent') ||
    panelText.includes('showRowMarkers') ||
    panelText.includes('data-kg-mermaid-diagram-row-marker')
  ) {
    throw new Error('expected BottomPanel GitGraph and Gantt to select rows from rendered SVG elements instead of proxy row markers')
  }
  if (
    gitGraphFloatingText.includes('MermaidDiagramRenderPreview') ||
    !gitGraphFloatingText.includes('data-kg-mermaid-diagram-render-mode="list"') ||
    !gitGraphFloatingText.includes('mermaidDiagramSelectedRowKeyByKind.gitgraph') ||
    !gitGraphFloatingText.includes("setMermaidDiagramSelectedRowKey('gitgraph'") ||
    !gitGraphFloatingText.includes('resolveDiagramRowKey') ||
    !ganttFloatingText.includes('MermaidDiagramPanelView') ||
    !ganttFloatingText.includes('renderMode="list"')
  ) {
    throw new Error('expected FloatingPanel GitGraph and Gantt to keep row-list/editor surfaces only and sync through shared selection')
  }
  if (
    !gitGraphBottomText.includes('MermaidDiagramPanelView') ||
    !gitGraphBottomText.includes("kind=\"gitgraph\"") ||
    !gitGraphBottomText.includes('renderMode="diagram"') ||
    gitGraphBottomText.includes('DocumentVersionGitGraphPanel') ||
    gitGraphBottomText.includes('fallbackToLatest')
  ) {
    throw new Error('expected BottomPanel GitGraph to render only typed Mermaid GitGraph and forbid document-version fallback')
  }
  if (
    !ganttBottomText.includes('MermaidDiagramPanelView') ||
    !ganttBottomText.includes('kind="gantt"') ||
    !ganttBottomText.includes('renderMode="diagram"')
  ) {
    throw new Error('expected BottomPanel Gantt to reuse the shared Mermaid panel utility as the diagram surface')
  }
  if (!resolverText.includes('readTypedMermaidDiagramCodes') || !resolverText.includes('mermaid_gantt')) {
    throw new Error('expected typed Mermaid diagram parsing to live in the shared resolver')
  }
  for (const forbidden of ['knowgrph-research-agent-demo', 'knowgrph-missalph-demo', '/Users/']) {
    if (resolverText.includes(forbidden) || panelText.includes(forbidden)) {
      throw new Error(`expected Mermaid panel path to avoid hardcoded fixture token ${forbidden}`)
    }
  }
}
