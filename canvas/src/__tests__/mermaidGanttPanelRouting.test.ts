import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeSvgSurfaceWideTimelineFitTransform } from '@/components/GraphCanvas/hooks/useSvgSurfaceZoomRuntime'
import { annotateInteractiveMermaidSelectionRows } from '@/lib/diagram/InteractiveMermaidDiagram'
import {
  findMermaidDiagramRowKeyForSvgLabel,
  readMermaidDirectSelectionLabels,
} from '@/lib/mermaid/mermaidDiagramSelection'
import {
  MERMAID_GANTT_BAR_DRAG_COMMIT_MIN_DELTA_PX,
  MERMAID_GANTT_BAR_DRAG_EDGE_SCROLL_THRESHOLD_PX,
  buildMermaidGanttTimelineModel,
  buildMermaidGanttTimelineTicks,
  formatMermaidGanttTimelineOffset,
  isMermaidGanttBarDragMode,
  resolveMermaidGanttBarDragCommitted,
  resolveMermaidGanttBarDragPreview,
  resolveMermaidGanttTimelineDragEffectiveDelta,
  resolveMermaidGanttTimelineDragPreviewSpan,
  resolveMermaidGanttTimelineRowKeyAtPosition,
  replaceFirstMermaidGanttFrontmatterCode,
  shouldExposeMermaidGanttBarInteraction,
  updateMermaidGanttCodeRowTiming,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
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
    '    chronology_flow:',
    '      key: chronology_flow',
    '      type: mermaid_timeline',
    '      value: |-',
    '        timeline LR',
    '          title Dynamic compute chronology',
    '          section Inputs',
    '            Source fields : KTV values',
    '          section Compute',
    '            Inline compute : Summary output',
    '    system_architecture:',
    '      key: system_architecture',
    '      type: mermaid_architecture',
    '      value: |-',
    '        architecture-beta',
    '          group cloud(cloud)[Cloud]',
    '          service agent(server)[Agent API] in cloud',
    '          service mcp(server)[MCP Worker] in cloud',
    '          agent:R --> L:mcp',
    '    run_events:',
    '      key: run_events',
    '      type: mermaid_eventmodeling',
    '      value: |-',
    '        eventmodeling',
    '        tf 01 ui UserBrief',
    '        tf 02 cmd StartRun',
    '        tf 03 evt RunStarted',
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

  const timelineCode = resolveMermaidDiagramCode(
    readYamlFrontmatterMermaidDiagramCodes(markdown, 'timeline'),
    'timeline',
  )
  if (!timelineCode.includes('timeline LR')) {
    throw new Error('expected typed mermaid_timeline frontmatter to resolve Timeline code with direction')
  }

  const timelineModel = parseMermaidDiagramCodeModel(timelineCode, 'timeline')
  const computeEvent = timelineModel.rows.find(row => row.kind === 'event' && row.label === 'Inline compute')
  if (!computeEvent) {
    throw new Error('expected Timeline parser model to expose chronology event rows')
  }

  const architectureCode = resolveMermaidDiagramCode(
    readYamlFrontmatterMermaidDiagramCodes(markdown, 'architecture'),
    'architecture',
  )
  if (!architectureCode.includes('architecture-beta') || !architectureCode.includes('service agent')) {
    throw new Error('expected typed mermaid_architecture frontmatter to resolve Architecture code')
  }
  const architectureModel = parseMermaidDiagramCodeModel(architectureCode, 'architecture')
  const serviceRow = architectureModel.rows.find(row => row.kind === 'service' && row.label === 'agent')
  if (!serviceRow) {
    throw new Error('expected Architecture parser model to expose service rows')
  }

  const eventModelingCode = resolveMermaidDiagramCode(
    readYamlFrontmatterMermaidDiagramCodes(markdown, 'eventmodeling'),
    'eventmodeling',
  )
  if (!eventModelingCode.includes('eventmodeling') || !eventModelingCode.includes('RunStarted')) {
    throw new Error('expected typed mermaid_eventmodeling frontmatter to resolve Event Modeling code')
  }
  const eventModel = parseMermaidDiagramCodeModel(eventModelingCode, 'eventmodeling')
  const eventRow = eventModel.rows.find(row => row.kind === 'event' && row.label === 'RunStarted')
  if (!eventRow) {
    throw new Error('expected Event Modeling parser model to expose event rows')
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
            chronology_flow: {
              key: 'chronology_flow',
              type: 'mermaid_timeline',
              value: [
                'timeline LR',
                '  title Runtime chronology',
                '  section Panels',
                '    Render Timeline : BottomPanel route',
              ].join('\n'),
            },
            system_architecture: {
              key: 'system_architecture',
              type: 'mermaid_architecture',
              value: [
                'architecture-beta',
                '  group cloud(cloud)[Cloud]',
                '  service mcp(server)[MCP Worker] in cloud',
              ].join('\n'),
            },
            run_events: {
              key: 'run_events',
              type: 'mermaid_eventmodeling',
              value: [
                'eventmodeling',
                'tf 01 ui UserBrief',
                'tf 02 cmd StartRun',
                'tf 03 evt RunStarted',
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

  const timelineCode = resolveMermaidDiagramCode(
    readFrontmatterMermaidDiagramCodes(graphData, 'timeline'),
    'timeline',
  )
  if (!timelineCode.includes('Render Timeline')) {
    throw new Error('expected parsed graph frontmatter metadata to resolve typed Timeline code')
  }

  const architectureCode = resolveMermaidDiagramCode(
    readFrontmatterMermaidDiagramCodes(graphData, 'architecture'),
    'architecture',
  )
  if (!architectureCode.includes('MCP Worker')) {
    throw new Error('expected parsed graph frontmatter metadata to resolve typed Architecture code')
  }

  const eventModelingCode = resolveMermaidDiagramCode(
    readFrontmatterMermaidDiagramCodes(graphData, 'eventmodeling'),
    'eventmodeling',
  )
  if (!eventModelingCode.includes('RunStarted')) {
    throw new Error('expected parsed graph frontmatter metadata to resolve typed Event Modeling code')
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
  const canvasViewportText = readSource('components', 'CanvasViewport.tsx')
  const configRenderText = readSource('lib', 'config.render.ts')
  const uiCopyText = readSource('lib', 'config-copy', 'uiCopy.ts')
  const bottomPanelText = readSource('features', 'strybldr', 'StrybldrTimelineBottomPanel.tsx')
  const floatingTypeText = readSource('hooks', 'store', 'store-types', 'graph-state-chat-import.ts')
  const uiInitialStateText = readSource('hooks', 'store', 'uiSliceInitialState.ts')
  const bottomTypeText = readSource('hooks', 'store', 'store-types', 'core.ts')
  const iconText = readSource('features', 'panels', 'ui', 'mainPanelHelpIconLibrary.tsx')
  const panelText = readSource('features', 'gitgraph', 'MermaidDiagramPanelView.tsx')
  const gitGraphFloatingText = readSource('features', 'gitgraph', 'GitGraphFloatingPanelView.tsx')
  const gitGraphCanvasText = readSource('components', 'MermaidGitGraphCanvas.tsx')
  const ganttCanvasText = readSource('components', 'MermaidGanttCanvas.tsx')
  const ganttFloatingText = readSource('features', 'gitgraph', 'GanttFloatingPanelView.tsx')
  const timelineFloatingText = readSource('features', 'gitgraph', 'TimelineFloatingPanelView.tsx')
  const gitGraphBottomText = readSource('features', 'gitgraph', 'GitGraphBottomPanelView.tsx')
  const ganttBottomText = readSource('features', 'gitgraph', 'GanttBottomPanelView.tsx')
  const ganttTransportText = readSource('features', 'gitgraph', 'GanttTimelineTransportPanel.tsx')
  const timelineBottomText = readSource('features', 'gitgraph', 'TimelineBottomPanelView.tsx')
  const resolverText = readSource('lib', 'mermaid', 'mermaidDiagramCode.ts')
  const plainMermaidText = readSource('features', 'markdown', 'ui', 'PlainMermaidDiagram.tsx')
  const interactiveMermaidText = readSource('lib', 'diagram', 'InteractiveMermaidDiagram.tsx')
  const selectionHelperText = readSource('lib', 'diagram', 'diagramRowSelection.ts')
  const mermaidSelectionText = readSource('lib', 'mermaid', 'mermaidDiagramSelection.ts')
  const gitGraphSelectionText = readSource('lib', 'mermaid', 'mermaidGitGraphSelection.ts')
  const svgSurfaceZoomRuntimeText = readSource('components', 'GraphCanvas', 'hooks', 'useSvgSurfaceZoomRuntime.ts')
  const ganttBarInteractionText = readSource('lib', 'mermaid', 'mermaidGanttBarInteraction.ts')

  if (!floatingTypeText.includes("| 'gantt'") || !floatingTypeText.includes("| 'timeline'")) {
    throw new Error('expected FloatingPanelView to include first-class Gantt and Timeline views')
  }
  if (
    !floatingTypeText.includes('mermaidDiagramSelectedRowKeyByKind') ||
    !floatingTypeText.includes('setMermaidDiagramSelectedRowKey') ||
    !uiInitialStateText.includes('mermaidDiagramSelectedRowKeyByKind: {}') ||
    !uiInitialStateText.includes('setMermaidDiagramSelectedRowKey')
  ) {
    throw new Error('expected Mermaid GitGraph/Gantt/Timeline selected rows to live in shared store state for BottomPanel/FloatingPanel sync')
  }
  if (
    !bottomTypeText.includes("'gantt'") ||
    !bottomTypeText.includes("'timeline'") ||
    !bottomTypeText.includes("'architecture'") ||
    !bottomTypeText.includes("'eventModeling'") ||
    !bottomTypeText.includes("'documentVersionGraph'")
  ) {
    throw new Error('expected BottomSurfaceTab to keep document-version graph separate from first-class Mermaid tabs')
  }
  if (
    !configRenderText.includes("'gitGraph', 'gantt'") ||
    !configRenderText.includes("surfaceId: 'gantt'") ||
    !configRenderText.includes("animatic: {\n    surfaceId: 'gantt'") ||
    !configRenderText.includes("registryLabel: 'Gantt-timeline'") ||
    !configRenderText.includes('isGanttCanvas2dRenderer') ||
    !uiCopyText.includes('2D Renderer: Gantt-timeline') ||
    !canvasViewMenuText.includes('gantt: ChartGantt') ||
    !canvasViewMenuText.includes('canvasViewRendererGanttTitle') ||
    !canvasViewportText.includes('MermaidGanttCanvasLazy') ||
    !canvasViewportText.includes("active2dSurface === 'gantt'") ||
    canvasViewportText.includes('AnimaticCanvasLazy') ||
    canvasViewportText.includes("active2dSurface === 'animatic'")
  ) {
    throw new Error('expected Canvas 2D Renderer Gantt-timeline to replace the old Animatic canvas mount')
  }
  if (
    !canvasViewTypesText.includes("'control:gitGraph'") ||
    !canvasViewTypesText.includes("'control:gantt'") ||
    !canvasViewTypesText.includes("'control:timeline'") ||
    !canvasViewTypesText.includes("'control:architecture'") ||
    !canvasViewTypesText.includes("'control:eventModeling'") ||
    !canvasViewMenuText.includes("id: 'control:gitGraph'") ||
    !canvasViewMenuText.includes("id: 'control:gantt'") ||
    !canvasViewMenuText.includes("id: 'control:timeline'") ||
    !canvasViewMenuText.includes("id: 'control:architecture'") ||
    !canvasViewMenuText.includes("id: 'control:eventModeling'")
  ) {
    throw new Error('expected Canvas View Display Controls to expose BottomPanel GitGraph, Gantt, Timeline, Architecture, and Event Model controls')
  }
  if (
    !canvasViewActionsText.includes("const nextTab: BottomSurfaceTab = 'timeline'") ||
    !canvasViewActionsText.includes("id === 'control:gitGraph' || id === 'control:gantt' || id === 'control:architecture' || id === 'control:eventModeling'") ||
    !canvasViewActionsText.includes("? 'architecture'") ||
    !canvasViewActionsText.includes(": 'eventModeling'") ||
    !canvasViewActionsText.includes("setBottomSurfaceTab(nextTab)") ||
    !canvasViewActionsText.includes('setBottomSurfaceCollapsed(false)') ||
    !canvasViewSelectText.includes('setBottomSurfaceTab: s.setBottomSurfaceTab')
  ) {
    throw new Error('expected Canvas View Display Controls to route Mermaid diagrams through shared bottom-surface setters')
  }
  if (
    !toolbarText.includes('GanttFloatingPanelViewLazy') ||
    !toolbarText.includes('TimelineFloatingPanelViewLazy') ||
    !toolbarText.includes("{ view: 'gantt', title: UI_LABELS.gantt") ||
    !toolbarText.includes("{ view: 'timeline', title: UI_LABELS.timeline") ||
    !toolbarText.includes("floatingPanelView === 'gantt'") ||
    !toolbarText.includes("floatingPanelView === 'timeline'")
  ) {
    throw new Error('expected FloatingPanel toolbar to route Gantt and Timeline through the shared view registry')
  }
  if (
    !bottomPanelText.includes('GanttBottomPanelViewLazy') ||
    !bottomPanelText.includes('TimelineBottomPanelViewLazy') ||
    !bottomPanelText.includes('ArchitectureBottomPanelViewLazy') ||
    !bottomPanelText.includes('EventModelingBottomPanelViewLazy') ||
    !bottomPanelText.includes('GitGraphBottomPanelViewLazy') ||
    !bottomPanelText.includes('DocumentVersionGitGraphPanelLazy') ||
    !bottomPanelText.includes("bottomSurfaceTab === 'documentVersionGraph'") ||
    !bottomPanelText.includes("setBottomSurfaceTab('documentVersionGraph')") ||
    !bottomPanelText.includes("bottomSurfaceTab === 'gantt'") ||
    !bottomPanelText.includes("bottomSurfaceTab === 'timeline'") ||
    !bottomPanelText.includes("bottomSurfaceTab === 'architecture'") ||
    !bottomPanelText.includes("bottomSurfaceTab === 'eventModeling'") ||
    !bottomPanelText.includes("view === 'documentVersionGraph'") ||
    !bottomPanelText.includes("view === 'gitGraph'") ||
    !bottomPanelText.includes("view === 'gantt'") ||
    !bottomPanelText.includes("view === 'timeline'") ||
    !bottomPanelText.includes("view === 'architecture'") ||
    !bottomPanelText.includes("view === 'eventModeling'") ||
    !bottomPanelText.includes('data-kg-strybldr-bottom-timeline-document-version-graph-toggle') ||
    !bottomPanelText.includes('data-kg-strybldr-bottom-timeline-gantt-toggle') ||
    !bottomPanelText.includes('data-kg-strybldr-bottom-timeline-timeline-toggle') ||
    !bottomPanelText.includes('data-kg-strybldr-bottom-timeline-architecture-toggle') ||
    !bottomPanelText.includes('data-kg-strybldr-bottom-timeline-event-modeling-toggle')
  ) {
    throw new Error('expected BottomPanel to route separate Version Graph, GitGraph, Gantt, Timeline, Architecture, and Event Model tabs')
  }
  if (
    !iconText.includes("'floatingPanel.gantt'") ||
    !iconText.includes("'floatingPanel.timeline'") ||
    !iconText.includes("'floatingPanel.architecture'") ||
    !iconText.includes("'floatingPanel.eventModeling'") ||
    !iconText.includes('ChartGantt') ||
    !iconText.includes('HistoryIcon') ||
    !iconText.includes('Network') ||
    !iconText.includes('Workflow')
  ) {
    throw new Error('expected Mermaid diagram icon ownership to live in the shared FloatingPanel type icon registry')
  }
  if (
    !panelText.includes('InteractiveMermaidDiagram') ||
    !panelText.includes('StructuredMermaidFallbackPreview') ||
    !panelText.includes('data-kg-mermaid-diagram-renderer="structured-fallback"') ||
    !panelText.includes("kind === 'architecture' || kind === 'eventmodeling'") ||
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
    !mermaidSelectionText.includes('readDiagramSelectionLabels') ||
    !mermaidSelectionText.includes('findMermaidDiagramRowKeyForSvgLabel') ||
    !mermaidSelectionText.includes('buildMermaidInteractiveSelectionRows') ||
    !panelText.includes('buildMermaidInteractiveSelectionRows') ||
    !panelText.includes('findMermaidDiagramRowKeyForSvgLabel') ||
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
    !svgSurfaceZoomRuntimeText.includes('readSvgStoredIntrinsicBounds') ||
    !svgSurfaceZoomRuntimeText.includes('readSvgSurfaceFitViewportRect') ||
    !svgSurfaceZoomRuntimeText.includes('readSvgViewportRect') ||
    !svgSurfaceZoomRuntimeText.includes('viewportWidth = runtime?.viewport.width || dims.width') ||
    !svgSurfaceZoomRuntimeText.includes('fitAllTransform(visualGraphData.nodes, viewportWidth, viewportHeight') ||
    !svgSurfaceZoomRuntimeText.includes("group.removeAttribute('transform')") ||
    !svgSurfaceZoomRuntimeText.includes("data-kg-svg-fit-source', useIntrinsicBounds ? 'intrinsic' : contentBounds ? 'content' : 'root'") ||
    !svgSurfaceZoomRuntimeText.includes('{ notify: false }')
  ) {
    throw new Error('expected GitGraph, Gantt, and Timeline diagrams to reuse direct SVG canvas-to-row selection, interactive SVG dimming, and cached render output')
  }
  if (
    !ganttCanvasText.includes('InteractiveMermaidDiagram') ||
    !ganttCanvasText.includes('useMermaidGanttDocument') ||
    !ganttCanvasText.includes("from '@/lib/mermaid/mermaidGanttBarInteraction'") ||
    !ganttCanvasText.includes('shouldExposeMermaidGanttBarInteraction(selectedRow)') ||
    !ganttCanvasText.includes('buildMermaidGanttTimelineModel') ||
    !ganttCanvasText.includes('resolveMermaidGanttBarDragPreview') ||
    !ganttCanvasText.includes('resolveMermaidGanttBarDragCommitted') ||
    !ganttCanvasText.includes('resolveMermaidGanttTimelineDragEffectiveDelta') ||
    !ganttCanvasText.includes('readGanttMinutesPerPixel') ||
    !ganttCanvasText.includes('const timelineSpan = timelineModel.taskSpans.find(span => span.lineIndex === dragState.rowLineIndex)') ||
    !ganttCanvasText.includes('deltaMinutes: effectiveDeltaMinutes') ||
    !ganttCanvasText.includes('updateMermaidGanttCodeRowTiming') ||
    !ganttCanvasText.includes('replaceFirstMermaidGanttFrontmatterCode') ||
    !ganttCanvasText.includes('setMarkdownDocument(markdownDocumentName, nextMarkdownText, { applyViewPreset: false })') ||
    !ganttCanvasText.includes("setMermaidDiagramSelectedRowKey('gantt', `${dragState.rowLineIndex}:task:${nextLine}`)") ||
    !ganttCanvasText.includes("element.tagName.toLowerCase() === 'rect'") ||
    !ganttCanvasText.includes('isVerticalMilestoneRow') ||
    !ganttCanvasText.includes('setPointerCapture') ||
    !ganttCanvasText.includes("window.addEventListener('pointermove'") ||
    !ganttCanvasText.includes('let maxMovedPx = 0') ||
    !ganttCanvasText.includes('maxMovedPx = Math.max(maxMovedPx, Math.abs(preview.deltaPx))') ||
    !ganttCanvasText.includes('!resolveMermaidGanttBarDragCommitted(maxMovedPx)') ||
    !ganttCanvasText.includes('const onPointerCancel = (event: PointerEvent)') ||
    !ganttCanvasText.includes("window.addEventListener('pointercancel', onPointerCancel") ||
    !ganttCanvasText.includes('stopGanttHandleClick') ||
    !ganttCanvasText.includes('data-kg-gantt-bar-interaction-overlay="1"') ||
    !ganttCanvasText.includes('data-kg-gantt-bar-drag-mode="move"') ||
    !ganttCanvasText.includes('data-kg-gantt-bar-drag-mode="resize-start"') ||
    !ganttCanvasText.includes('data-kg-gantt-bar-drag-mode="resize-end"') ||
    !ganttCanvasText.includes('data-kg-canvas-pointer-ignore="true"') ||
    !ganttCanvasText.includes('state.mermaidDiagramSelectedRowKeyByKind.gantt') ||
    !ganttCanvasText.includes("setMermaidDiagramSelectedRowKey('gantt'") ||
    !ganttCanvasText.includes('buildMermaidInteractiveSelectionRows') ||
    !ganttCanvasText.includes('readMermaidDirectSelectionLabels') ||
    !ganttCanvasText.includes('findMermaidDiagramRowForRowKey') ||
    !ganttCanvasText.includes('rendererId="gantt"') ||
    !ganttCanvasText.includes('svgFitMode="wideTimeline"') ||
    !ganttCanvasText.includes('data-kg-gantt-canvas="1"') ||
    !ganttCanvasText.includes("setFloatingPanelView('gantt')")
  ) {
    throw new Error('expected Canvas Gantt-timeline to share row-key selection state, selected-bar drag handles, and interactive Mermaid selection utilities with BottomPanel and FloatingPanel Gantt-Timeline')
  }
  if (
    ganttCanvasText.includes('TimelineTransportControls') ||
    ganttCanvasText.includes('useTimelineTransportPlayback') ||
    ganttCanvasText.includes('data-kg-gantt-timeline-transport') ||
    ganttCanvasText.includes('data-kg-gantt-timeline-ruler')
  ) {
    throw new Error('expected Canvas Gantt-timeline to avoid duplicate bottom playback transport; BottomPanel Timeline owns the scrubber')
  }
  if (
    !ganttBarInteractionText.includes("export type MermaidGanttBarDragMode = 'move' | 'resize-start' | 'resize-end'") ||
    !ganttBarInteractionText.includes('MERMAID_GANTT_BAR_DRAG_COMMIT_MIN_DELTA_PX') ||
    !ganttBarInteractionText.includes('MERMAID_GANTT_BAR_DRAG_EDGE_SCROLL_THRESHOLD_PX') ||
    !ganttBarInteractionText.includes('resolveMermaidGanttBarDragPreview') ||
    !ganttBarInteractionText.includes('buildMermaidGanttTimelineModel') ||
    !ganttBarInteractionText.includes('buildMermaidGanttTimelineTicks') ||
    !ganttBarInteractionText.includes('resolveMermaidGanttTimelineRowKeyAtPosition') ||
    !ganttBarInteractionText.includes('updateMermaidGanttCodeRowTiming') ||
    !ganttBarInteractionText.includes('replaceFirstMermaidGanttFrontmatterCode') ||
    !ganttBarInteractionText.includes('shouldExposeMermaidGanttBarInteraction') ||
    ganttBarInteractionText.includes('knowgrph-animatic-demo') ||
    ganttBarInteractionText.includes('/Users/')
  ) {
    throw new Error('expected Gantt-timeline drag/resize bar behavior to live in neutral shared Mermaid utilities without fixture paths')
  }
  if (
    !interactiveMermaidText.includes('svgFitMode?: SvgSurfaceFitMode') ||
    !interactiveMermaidText.includes('svgFitMode,') ||
    !svgSurfaceZoomRuntimeText.includes("export type SvgSurfaceFitMode = 'auto' | 'wideTimeline'") ||
    !svgSurfaceZoomRuntimeText.includes('computeSvgSurfaceWideTimelineFitTransform') ||
    !svgSurfaceZoomRuntimeText.includes("prepareSvgForInteractiveViewport({ svgEl, fitMode: svgFitMode })") ||
    !svgSurfaceZoomRuntimeText.includes("svgFitMode === 'wideTimeline' ? 'wideTimeline:v2' : svgFitMode") ||
    !svgSurfaceZoomRuntimeText.includes('[data-kg-floating-panel-root="true"]') ||
    !svgSurfaceZoomRuntimeText.includes('[data-kg-strybldr-bottom-timeline-panel="1"]') ||
    !svgSurfaceZoomRuntimeText.includes('data-kg-svg-fit-viewport-w') ||
    !svgSurfaceZoomRuntimeText.includes('graphDataRevisionRef.current') ||
    !svgSurfaceZoomRuntimeText.includes("data-kg-svg-fit-policy', timelineFitted ? 'wideTimeline' : 'fitAll'") ||
    !svgSurfaceZoomRuntimeText.includes("`fit:${normalizedFitMode}`")
  ) {
    throw new Error('expected Gantt-timeline Canvas to reuse shared SVG fit policy for readable wide timelines')
  }
  if (
    panelText.includes('resolveDiagramPointerRowIndex') ||
    panelText.includes('resolveDiagramRowPositionPercent') ||
    panelText.includes('showRowMarkers') ||
    panelText.includes('data-kg-mermaid-diagram-row-marker')
  ) {
    throw new Error('expected BottomPanel Mermaid diagrams to select rows from rendered SVG elements instead of proxy row markers')
  }
  if (
    gitGraphFloatingText.includes('MermaidDiagramRenderPreview') ||
    !gitGraphFloatingText.includes('data-kg-mermaid-diagram-render-mode="list"') ||
    !gitGraphFloatingText.includes('mermaidDiagramSelectedRowKeyByKind.gitgraph') ||
    !gitGraphFloatingText.includes("setMermaidDiagramSelectedRowKey('gitgraph'") ||
    !gitGraphFloatingText.includes('resolveGitGraphCommandRowKey') ||
    !ganttFloatingText.includes('MermaidDiagramPanelView') ||
    !ganttFloatingText.includes('renderMode="list"') ||
    !timelineFloatingText.includes('MermaidDiagramPanelView') ||
    !timelineFloatingText.includes('kind="timeline"') ||
    !timelineFloatingText.includes('renderMode="list"')
  ) {
    throw new Error('expected FloatingPanel Mermaid diagrams to keep row-list/editor surfaces only and sync through shared selection')
  }
  if (
    !gitGraphSelectionText.includes('resolveGitGraphSelectedCommand') ||
    !gitGraphSelectionText.includes('findGitGraphCommandForRowKey') ||
    !gitGraphSelectionText.includes('findGitGraphCommandForExactLabel') ||
    !gitGraphCanvasText.includes('resolveGitGraphSelectedCommand') ||
    !gitGraphCanvasText.includes("setMermaidDiagramSelectedRowKey('gitgraph'") ||
    !gitGraphCanvasText.includes('handleDiagramSelectedRowKeyChange(rowKey') ||
    !gitGraphBottomText.includes('findGitGraphCommandForRowKey') ||
    !gitGraphBottomText.includes('setGitGraphSelectedCommandLineIndex(command?.lineIndex ?? null)') ||
    !gitGraphBottomText.includes("setMermaidDiagramSelectedRowKey('gitgraph', rowKey)") ||
    !gitGraphFloatingText.includes('findGitGraphCommandForRowKey') ||
    !gitGraphFloatingText.includes('return null')
  ) {
    throw new Error('expected Canvas GitGraph, BottomPanel GitGraph, and FloatingPanel GitGraph to share command row-key and line-index selection utilities without surface-local defaults')
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
  if (
    !timelineBottomText.includes('MermaidDiagramPanelView') ||
    !timelineBottomText.includes('kind="timeline"') ||
    !timelineBottomText.includes('renderMode="diagram"') ||
    !timelineBottomText.includes('GanttTimelineTransportPanel') ||
    !timelineBottomText.includes('<GanttTimelineTransportPanel code={ganttCode} compact={compact} />') ||
    timelineBottomText.includes('TimelineTransportControls') ||
    timelineBottomText.includes('useTimelineTransportPlayback') ||
    timelineBottomText.includes('buildMermaidGanttTimelineModel') ||
    timelineBottomText.includes('data-kg-gantt-timeline-transport')
  ) {
    throw new Error('expected BottomPanel Timeline to render Mermaid Timeline and delegate the Gantt-Timeline transport fallback to the shared Gantt transport owner')
  }
  if (
    !ganttTransportText.includes('TimelineTransportChrome') ||
    !ganttTransportText.includes('useTimelineTransportPlayback') ||
    !ganttTransportText.includes('buildMermaidGanttTimelineModel(code)') ||
    !ganttTransportText.includes('buildMermaidGanttTimelineTicks(timelineModel)') ||
    !ganttTransportText.includes('resolveMermaidGanttTimelineRowKeyAtPosition(timelineModel, nextPosition)') ||
    !ganttTransportText.includes('resolveMermaidGanttBarDragPreview') ||
    !ganttTransportText.includes('resolveMermaidGanttBarDragCommitted') ||
    !ganttTransportText.includes('resolveMermaidGanttTimelineDragEffectiveDelta') ||
    !ganttTransportText.includes('resolveMermaidGanttTimelineDragPreviewSpan') ||
    !ganttTransportText.includes('deltaMinutes: effectiveDeltaMinutes') ||
    !ganttTransportText.includes('updateMermaidGanttCodeRowTiming') ||
    !ganttTransportText.includes('replaceFirstMermaidGanttFrontmatterCode') ||
    !ganttTransportText.includes('isMermaidGanttTimelineVerticalMarker') ||
    !ganttTransportText.includes('TIMELINE_TRANSPORT_ZOOM_LEVELS') ||
    !ganttTransportText.includes('resolveTimelineTransportNextZoomIndex') ||
    !ganttTransportText.includes('resolveTimelineTransportPlayheadPercent') ||
    !ganttTransportText.includes('resolveTimelineTransportPlayheadScrollLeft') ||
    !ganttTransportText.includes('resolveTimelineTransportZoom') ||
    !ganttTransportText.includes('centerTimelinePlayhead') ||
    !ganttTransportText.includes('timeline-transport-chrome--mermaid-gantt') ||
    !ganttTransportText.includes('timeline-transport-track-clip--milestone') ||
    !ganttTransportText.includes('timeline-transport-chrome-actions') ||
    !ganttTransportText.includes('timeline-transport-playhead') ||
    !ganttTransportText.includes("top: verticalMarker ? '0px' : `${24 + (index % 2) * 16}px`") ||
    !ganttTransportText.includes("width: verticalMarker ? '14px'") ||
    !ganttTransportText.includes('data-kg-gantt-timeline-ruler-content="1"') ||
    !ganttTransportText.includes('data-kg-gantt-timeline-playhead="1"') ||
    !ganttTransportText.includes('data-kg-gantt-timeline-track-drag-mode="move"') ||
    !ganttTransportText.includes('data-kg-gantt-timeline-track-drag-mode="resize-start"') ||
    !ganttTransportText.includes('data-kg-gantt-timeline-track-drag-mode="resize-end"') ||
    !ganttTransportText.includes("setMermaidDiagramSelectedRowKey('gantt', rowKey)") ||
    !ganttTransportText.includes('const totalLabel = formatMermaidGanttTimelineOffset(maxMinutes)') ||
    !ganttTransportText.includes('totalLabel={totalLabel}') ||
    !ganttTransportText.includes("'data-kg-gantt-timeline-transport': 'bottomPanel'") ||
    !ganttTransportText.includes("'data-kg-gantt-timeline-ruler': 'bottomPanel'") ||
    !ganttTransportText.includes('timeline-transport-ruler-tick') ||
    !ganttTransportText.includes('timeline-transport-ruler-tick-line') ||
    ganttTransportText.includes('timeline-transport-chrome--capcut') ||
    ganttTransportText.includes('GANTT_TIMELINE_TRANSPORT_ZOOM_LEVELS') ||
    ganttTransportText.includes('aregrid/frame') ||
    ganttTransportText.includes('/Users/')
  ) {
    throw new Error('expected shared Gantt-Timeline transport to own playback/scrub state, row-key sync, and neutral BottomPanel markers without copied fixture/source tokens')
  }
  if (!resolverText.includes('readTypedMermaidDiagramCodes') || !resolverText.includes('mermaid_gantt')) {
    throw new Error('expected typed Mermaid diagram parsing to live in the shared resolver')
  }
  if (!resolverText.includes('mermaid_timeline') || !resolverText.includes('readTimelineRowKind')) {
    throw new Error('expected typed Timeline parsing to live in the shared resolver')
  }
  if (
    !resolverText.includes('mermaid_architecture') ||
    !resolverText.includes('mermaid_eventmodeling') ||
    !resolverText.includes('readArchitectureRowKind') ||
    !resolverText.includes('readEventModelingRowKind')
  ) {
    throw new Error('expected typed Architecture and Event Modeling parsing to live in the shared resolver')
  }
  const sharedGanttModel = parseMermaidDiagramCodeModel([
    'gantt',
    '  title Shared Gantt',
    '  section Compute',
    '  Compute summary :crit, compute_summary, 2026-06-07, 1d',
  ].join('\n'), 'gantt')
  const sharedGanttTask = sharedGanttModel.rows.find(row => row.kind === 'task')
  const sharedGanttRowKey = findMermaidDiagramRowKeyForSvgLabel(sharedGanttModel.rows, 'Compute summary')
  if (!sharedGanttTask || !sharedGanttRowKey || !readMermaidDirectSelectionLabels(sharedGanttTask).includes('Compute summary')) {
    throw new Error('expected shared Mermaid Gantt selection helper to resolve task labels into reusable row keys')
  }
  const wideTimelineTransform = computeSvgSurfaceWideTimelineFitTransform({
    bounds: { minX: 0, minY: 0, width: 11869, height: 194.5 },
    viewportWidth: 1349,
    viewportHeight: 936,
  })
  if (!wideTimelineTransform || wideTimelineTransform.k <= 1 || wideTimelineTransform.x < 20 || wideTimelineTransform.y < 200) {
    throw new Error(`expected wide Gantt timeline fit to keep readable scale and centered vertical placement, got ${JSON.stringify(wideTimelineTransform)}`)
  }
  const visibleFrameGanttTransform = computeSvgSurfaceWideTimelineFitTransform({
    bounds: { minX: 0, minY: 0, width: 1375, height: 196 },
    viewportWidth: 925,
    viewportHeight: 697,
  })
  if (
    !visibleFrameGanttTransform ||
    visibleFrameGanttTransform.k >= 0.7 ||
    visibleFrameGanttTransform.x < 20 ||
    visibleFrameGanttTransform.y < 250
  ) {
    throw new Error(`expected ordinary Gantt timeline fit to stay inside unobscured canvas frame, got ${JSON.stringify(visibleFrameGanttTransform)}`)
  }
  for (const forbidden of ['knowgrph-research-agent-demo', 'knowgrph-missalph-demo', '/Users/']) {
    if (resolverText.includes(forbidden) || panelText.includes(forbidden) || ganttBarInteractionText.includes(forbidden)) {
      throw new Error(`expected Mermaid panel path to avoid hardcoded fixture token ${forbidden}`)
    }
  }
  if (!isMermaidGanttBarDragMode('move') || !isMermaidGanttBarDragMode('resize-start') || isMermaidGanttBarDragMode('legacy')) {
    throw new Error('expected Gantt bar drag mode guard to accept only current move/resize modes')
  }
  if (!shouldExposeMermaidGanttBarInteraction({ kind: 'task' }) || shouldExposeMermaidGanttBarInteraction({ kind: 'config' })) {
    throw new Error('expected Gantt bar interaction helper to expose handles only for parsed task rows')
  }
  const movePreview = resolveMermaidGanttBarDragPreview({ mode: 'move', originClientX: 10, clientX: 18 })
  const resizeStartPreview = resolveMermaidGanttBarDragPreview({ mode: 'resize-start', originClientX: 10, clientX: 18 })
  const resizeEndPreview = resolveMermaidGanttBarDragPreview({ mode: 'resize-end', originClientX: 10, clientX: 18 })
  if (movePreview.offsetPx !== 8 || movePreview.widthDeltaPx !== 0) {
    throw new Error('expected Gantt move preview to translate without resizing')
  }
  if (resizeStartPreview.offsetPx !== 8 || resizeStartPreview.widthDeltaPx !== -8) {
    throw new Error('expected Gantt resize-start preview to move the leading edge')
  }
  if (resizeEndPreview.offsetPx !== 0 || resizeEndPreview.widthDeltaPx !== 8) {
    throw new Error('expected Gantt resize-end preview to extend the trailing edge')
  }
  if (
    MERMAID_GANTT_BAR_DRAG_COMMIT_MIN_DELTA_PX !== 4 ||
    MERMAID_GANTT_BAR_DRAG_EDGE_SCROLL_THRESHOLD_PX !== 72 ||
    resolveMermaidGanttBarDragCommitted(3) ||
    !resolveMermaidGanttBarDragCommitted(4)
  ) {
    throw new Error('expected Gantt drag thresholds to match the reused Animatic interaction contract')
  }
  const timelineModel = buildMermaidGanttTimelineModel([
    'gantt',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  Initial vert : vert, v1, 17:30, 2m',
    '  Task A : 3m',
    '  Task B : 8m',
    '  Final vert : vert, v2, 17:58, 4m',
  ].join('\n'))
  const taskARowKey = resolveMermaidGanttTimelineRowKeyAtPosition(timelineModel, 3)
  const ticks = buildMermaidGanttTimelineTicks(timelineModel)
  if (
    timelineModel.durationMinutes !== 32 ||
    timelineModel.taskSpans.length !== 4 ||
    !taskARowKey?.includes('Task A : 3m') ||
    ticks[0]?.label !== '0:00' ||
    ticks[ticks.length - 1]?.label !== '0:32' ||
    formatMermaidGanttTimelineOffset(125) !== '2:05'
  ) {
    throw new Error(`expected Gantt scrubber model to normalize HH:mm and relative rows into neutral timeline spans, got ${JSON.stringify({ timelineModel, ticks, taskARowKey })}`)
  }
  const editedGanttCode = updateMermaidGanttCodeRowTiming({
    code: [
      'gantt',
      '  dateFormat HH:mm',
      '  Initial vert : vert, v1, 17:30, 2m',
    ].join('\n'),
    rowLineIndex: 2,
    mode: 'move',
    deltaMinutes: 3,
  })
  if (!editedGanttCode?.includes('Initial vert : vert, v1, 17:33, 2m')) {
    throw new Error('expected Gantt move drag to update explicit HH:mm task timing')
  }
  const resizedGanttCode = updateMermaidGanttCodeRowTiming({
    code: [
      'gantt',
      '  dateFormat HH:mm',
      '  Initial vert : vert, v1, 17:30, 2m',
    ].join('\n'),
    rowLineIndex: 2,
    mode: 'resize-end',
    deltaMinutes: 2,
  })
  if (!resizedGanttCode?.includes('Initial vert : vert, v1, 17:30, 4m')) {
    throw new Error('expected Gantt resize-end drag to update explicit minute duration')
  }
  const initialSpan = timelineModel.taskSpans.find(span => span.label === 'Initial vert')
  if (!initialSpan) {
    throw new Error('expected Gantt timeline model to expose the initial milestone span')
  }
  const initialPreview = resolveMermaidGanttTimelineDragPreviewSpan({
    deltaMinutes: -5,
    maxMinutes: timelineModel.durationMinutes,
    mode: 'move',
    span: initialSpan,
  })
  const initialEffectiveDelta = resolveMermaidGanttTimelineDragEffectiveDelta({
    deltaMinutes: -5,
    maxMinutes: timelineModel.durationMinutes,
    mode: 'move',
    span: initialSpan,
  })
  if (initialPreview.startMinutes !== 0 || initialEffectiveDelta !== 0) {
    throw new Error('expected Gantt timeline transport to suppress source mutation when a start-boundary milestone cannot visually move')
  }
  const relativeMovedGanttCode = updateMermaidGanttCodeRowTiming({
    code: [
      'gantt',
      '  dateFormat HH:mm',
      '  Initial vert : vert, v1, 17:30, 2m',
      '  Task A : 3m',
    ].join('\n'),
    rowLineIndex: 3,
    mode: 'move',
    deltaMinutes: 4,
  })
  if (!relativeMovedGanttCode?.includes('Task A : 17:36, 3m')) {
    throw new Error('expected Gantt move drag to promote relative task rows to explicit HH:mm timing')
  }
  const markdownWithGantt = [
    '---',
    'flow_diagrams:',
    '  value:',
    '    time_flow:',
    '      type: mermaid_gantt',
    '      value: |-',
    '        gantt',
    '          dateFormat HH:mm',
    '          Initial vert : vert, v1, 17:30, 2m',
    '---',
    '',
  ].join('\n')
  const replacedMarkdown = replaceFirstMermaidGanttFrontmatterCode(markdownWithGantt, editedGanttCode || '')
  if (!replacedMarkdown?.includes('          Initial vert : vert, v1, 17:33, 2m')) {
    throw new Error('expected Gantt drag commit to rewrite the typed mermaid_gantt frontmatter block without fixture-specific paths')
  }
}
