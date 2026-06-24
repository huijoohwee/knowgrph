import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeSvgSurfaceWideTimelineFitTransform } from '@/components/GraphCanvas/hooks/useSvgSurfaceZoomRuntime'
import { buildVideoSequenceExportPlan } from '@/components/timeline/videoSequenceExport'
import {
  readVideoSequenceSourcePlayableUrl,
  readVideoSequenceTimelineModelFromMarkdown,
} from '@/components/timeline/videoSequenceTimeline'
import { buildVideoSequenceSourceRegistryKeys } from '@/components/timeline/videoSequenceSourceRegistry'
import { buildVideoSequenceTimelineImportMarkdown } from '@/features/markdown-workspace/workspaceImport/videoSequenceTimelineImport'
import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport/urlContent'
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
  insertMermaidGanttVideoSequenceOperationRow,
  isMermaidGanttBarDragMode,
  resolveMermaidGanttBarDragCommitted,
  resolveMermaidGanttBarDragPreview,
  resolveMermaidGanttTimelineDragEffectiveDelta,
  resolveMermaidGanttTimelineDragPreviewSpan,
  resolveMermaidGanttTimelineRowKeyAtPosition,
  replaceFirstMermaidGanttFrontmatterCode,
  splitMermaidGanttCodeRowAtOffset,
  splitMermaidGanttVideoSequenceClipGroupAtOffset,
  shouldExposeMermaidGanttBarInteraction,
  updateMermaidGanttCodeRowTiming,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  parseMermaidDiagramCodeModel,
  readFrontmatterMermaidDiagramCodes,
  readYamlFrontmatterMermaidDiagramCodes,
  resolveMermaidDiagramCode,
} from '@/lib/mermaid/mermaidDiagramCode'
import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'
import { normalizeWorkspaceImportUrlInput } from '@/lib/url'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'

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

export async function testGanttPanelRoutingUsesSharedGitGraphMermaidUtilities() {
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
  const mediaCanvasText = readSource('components', 'MediaCanvas.tsx')
  const ganttFloatingText = readSource('features', 'gitgraph', 'GanttFloatingPanelView.tsx')
  const timelineFloatingText = readSource('features', 'gitgraph', 'TimelineFloatingPanelView.tsx')
  const gitGraphBottomText = readSource('features', 'gitgraph', 'GitGraphBottomPanelView.tsx')
  const ganttBottomText = readSource('features', 'gitgraph', 'GanttBottomPanelView.tsx')
  const ganttTransportText = readSource('features', 'gitgraph', 'GanttTimelineTransportPanel.tsx')
  const timelineBottomText = readSource('features', 'gitgraph', 'TimelineBottomPanelView.tsx')
  const videoSequenceExportText = readSource('components', 'timeline', 'videoSequenceExport.ts')
  const videoSequenceSourceRegistryText = readSource('components', 'timeline', 'videoSequenceSourceRegistry.ts')
  const localImportText = readSource('features', 'markdown-workspace', 'workspaceImport', 'localImport.ts')
  const importActionsText = readSource('features', 'markdown-workspace', 'useWorkspaceFileActions', 'importActions.ts')
  const launchFallbackText = readSource('features', 'toolbar', 'launchDropdownFallbacks.ts')
  const urlImportText = readSource('features', 'markdown-workspace', 'workspaceImport', 'urlImport.ts')
  const urlContentText = readSource('features', 'markdown-workspace', 'workspaceImport', 'urlContent.ts')
  const videoSequenceImportText = readSource('features', 'markdown-workspace', 'workspaceImport', 'videoSequenceTimelineImport.ts')
  const canvasFrontmatterPresetText = readSource('features', 'parsers', 'canvasFrontmatterPreset.ts')
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
    !bottomPanelText.includes('data-kg-strybldr-bottom-timeline-event-modeling-toggle') ||
    !bottomPanelText.includes('data-kg-strybldr-bottom-timeline-scroll="body"') ||
    !bottomPanelText.includes('overflow-y-auto')
  ) {
    throw new Error('expected BottomPanel to route separate Version Graph, GitGraph, Gantt, Timeline, Architecture, Event Model tabs, and retain a scrollable body for tall Timeline editors')
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
    !ganttCanvasText.includes('readVideoSequenceTimelineModelFromMarkdown(markdownText)') ||
    !ganttCanvasText.includes('isVideoSequenceTimeline') ||
    ganttCanvasText.includes(['VideoSequenceCanvas', 'Preview'].join('')) ||
    ganttCanvasText.includes(['data-kg-video-sequence', 'canvas'].join('-')) ||
    !canvasFrontmatterPresetText.includes("current.setBottomSurfaceTab('timeline')") ||
    !canvasFrontmatterPresetText.includes("current.setFloatingPanelView('timeline')") ||
    !canvasFrontmatterPresetText.includes('current.setFloatingPanelOpen(true)') ||
    !videoSequenceSourceRegistryText.includes('registerVideoSequenceSourceFiles') ||
    !videoSequenceSourceRegistryText.includes('URL.createObjectURL(file)') ||
    !videoSequenceSourceRegistryText.includes('resolveVideoSequenceSourceRuntimeUrl') ||
    !importActionsText.includes('registerVideoSequenceSourceFiles(snapshot)') ||
    !launchFallbackText.includes('registerVideoSequenceSourceFiles(snapshot)')
  ) {
    throw new Error('expected video sequence docs to render playback through Media Canvas while BottomPanel/FloatingPanel Timeline own editing and rows')
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
    !ganttBarInteractionText.includes('splitMermaidGanttVideoSequenceClipGroupAtOffset') ||
    !ganttBarInteractionText.includes('resolveVideoSequenceClipGroupKey') ||
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
    !timelineFloatingText.includes('kind="gantt"') ||
    !timelineFloatingText.includes('renderMode="list"') ||
    !timelineFloatingText.includes('useMermaidGanttDocument') ||
    !timelineFloatingText.includes('model={ganttModel}') ||
    !timelineFloatingText.includes('rootThemeMode={ganttThemeMode}') ||
    timelineFloatingText.includes('GanttTimelineTransportPanel') ||
    timelineFloatingText.includes('TimelineVideoSequenceEmptyState') ||
    timelineFloatingText.includes('TimelineTransportControls') ||
    timelineFloatingText.includes('useTimelineTransportPlayback') ||
    timelineFloatingText.includes('data-kg-gantt-timeline-transport')
  ) {
    throw new Error('expected FloatingPanel Mermaid diagrams to keep Timeline video sequences as row lists without duplicating the BottomPanel Gantt transport')
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
    !ganttTransportText.includes('rulerScrubState') ||
    !ganttTransportText.includes('replaceFirstMermaidGanttFrontmatterCode') ||
    !ganttTransportText.includes('TIMELINE_TRANSPORT_ZOOM_LEVELS') ||
    !ganttTransportText.includes('resolveTimelineTransportNextZoomIndex') ||
    !ganttTransportText.includes('resolveTimelineTransportPlayheadPercent') ||
    !ganttTransportText.includes('resolveTimelineTransportPlayheadScrollLeft') ||
    !ganttTransportText.includes('resolveTimelineTransportZoom') ||
    !ganttTransportText.includes('ganttTimelineTransportPositionMinutes') ||
    !ganttTransportText.includes('ganttTimelineTransportPlaying') ||
    !ganttTransportText.includes('setGanttTimelineTransportState') ||
    !ganttTransportText.includes('centerTimelinePlayhead') ||
    !ganttTransportText.includes('handleRulerPointerScrub') ||
    !ganttTransportText.includes('showRange={false}') ||
    !ganttTransportText.includes('shellClassName="timeline-transport-shell--video-sequence"') ||
    !ganttTransportText.includes('VideoSequenceTimelineRuler') ||
    !ganttTransportText.includes('scopes={monitorScopes}') ||
    ganttTransportText.includes('VideoSequenceMonitorPanel') ||
    ganttTransportText.includes('rulerBelow={(') ||
    !ganttTransportText.includes('VIDEO_SEQUENCE_TIMELINE_TOOLS') ||
    !ganttTransportText.includes('VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS') ||
    !ganttTransportText.includes('buildVideoSequenceTimelineToolStatus') ||
    !ganttTransportText.includes('buildVideoSequenceTimelineScopes') ||
    !ganttTransportText.includes('buildVideoSequenceExportPlan') ||
    !ganttTransportText.includes('downloadVideoSequenceExport') ||
    !ganttTransportText.includes('resolveVideoSequenceExportPlanDurationSeconds') ||
    !ganttTransportText.includes('resolveVideoSequenceTimelineMediaSeconds') ||
    !ganttTransportText.includes('resolveVideoSequenceTimelineUnitsPerMs') ||
    !ganttTransportText.includes('playbackUnitsPerMs') ||
    !ganttTransportText.includes('readVideoSequenceTimelineModelFromMarkdown') ||
    !ganttTransportText.includes('upsertUiToast') ||
    !ganttTransportText.includes('data-kg-video-sequence-export="video"') ||
    !ganttTransportText.includes('data-kg-video-sequence-export="audio"') ||
    !ganttTransportText.includes('Download edited video') ||
    !ganttTransportText.includes('Download edited audio') ||
    !ganttTransportText.includes('splitMermaidGanttVideoSequenceClipGroupAtOffset') ||
    !ganttTransportText.includes('insertMermaidGanttVideoSequenceOperationRow') ||
    !ganttTransportText.includes('data-kg-video-sequence-timeline') ||
    !ganttTransportText.includes('timeline-transport-chrome--mermaid-gantt') ||
    !ganttTransportText.includes('timeline-video-sequence-tool-strip') ||
    !ganttTransportText.includes('timeline-transport-chrome-actions') ||
    !ganttTransportText.includes("setMermaidDiagramSelectedRowKey('gantt', rowKey)") ||
    !ganttTransportText.includes('formatMermaidGanttTimelineOffset(maxMinutes)') ||
    !ganttTransportText.includes('formatVideoSequenceTimelineSecondsOffset(mediaDurationSeconds)') ||
    !ganttTransportText.includes('totalLabel={totalLabel}') ||
    !ganttTransportText.includes("'data-kg-gantt-timeline-transport': 'bottomPanel'") ||
    !ganttTransportText.includes("'data-kg-gantt-timeline-ruler': 'bottomPanel'") ||
    ganttTransportText.includes('timeline-transport-chrome--capcut') ||
    ganttTransportText.includes('GANTT_TIMELINE_TRANSPORT_ZOOM_LEVELS') ||
    ganttTransportText.includes('aregrid/frame') ||
    ganttTransportText.includes('/Users/')
  ) {
    throw new Error('expected shared Gantt-Timeline transport to own playback/scrub state, row-key sync, and neutral BottomPanel markers without copied fixture/source tokens')
  }
  if (
    !videoSequenceExportText.includes('buildVideoSequenceExportPlan') ||
    !videoSequenceExportText.includes('buildVideoSequencePreviewSyncPlan') ||
    !videoSequenceExportText.includes('selectedRowKey') ||
    !videoSequenceExportText.includes('renderVideoSequenceExport') ||
    !videoSequenceExportText.includes('downloadVideoSequenceExport') ||
    !videoSequenceExportText.includes('MediaRecorder') ||
    !videoSequenceExportText.includes('captureStream') ||
    !videoSequenceExportText.includes('createMediaElementSource') ||
    !videoSequenceExportText.includes('downloadBlob') ||
    !videoSequenceExportText.includes('resolveVideoSequenceSourceRuntimeUrl') ||
    !videoSequenceExportText.includes('hasMask') ||
    !videoSequenceExportText.includes('hasGrade') ||
    videoSequenceExportText.includes('/Users/') ||
    videoSequenceExportText.includes(['blender', 'blender'].join('/'))
  ) {
    throw new Error('expected video sequence export to render source-backed edited video/audio downloads through neutral browser media APIs without hardcoded fixture paths')
  }
  if (
    !floatingTypeText.includes('ganttTimelineTransportPositionMinutes') ||
    !floatingTypeText.includes('setGanttTimelineTransportState') ||
    !uiInitialStateText.includes('ganttTimelineTransportPositionMinutes: 0') ||
    !uiInitialStateText.includes('setGanttTimelineTransportState') ||
    !mediaCanvasText.includes('MediaCanvasSyncedPanel') ||
    !mediaCanvasText.includes('data-kg-video-sequence-media-sync') ||
    !mediaCanvasText.includes('resolveVideoSequenceTimelineMediaSeconds') ||
    !mediaCanvasText.includes('resolveVideoSequenceTimelinePositionMinutes') ||
    !mediaCanvasText.includes('buildVideoSequencePreviewSyncPlan') ||
    !mediaCanvasText.includes('selectedGanttRowKey') ||
    !mediaCanvasText.includes('videoSequencePreviewSyncPlan || videoSequenceExportPlan') ||
    !mediaCanvasText.includes('setGanttTimelineTransportState') ||
    !mediaCanvasText.includes('videoControls={syncEnabled ? false : undefined}') ||
    !mediaCanvasText.includes("querySelector('video')")
  ) {
    throw new Error('expected Media Canvas video playback and BottomPanel Timeline slider to share the neutral Gantt transport state')
  }
  if (
    !timelineBottomText.includes('TimelineVideoSequenceEmptyState') ||
    !timelineBottomText.includes('<TimelineVideoSequenceEmptyState compact={compact} />')
  ) {
    throw new Error('expected empty BottomPanel Timeline to render the shared video sequence editor shell instead of a blank Mermaid-only panel')
  }
  if (
    !localImportText.includes('materializeVideoSequenceTimelineImportDocument') ||
    !localImportText.includes('pushLocalVideoSequenceImportAsset') ||
    !localImportText.includes('pruneVideoSequenceSourceDocuments') ||
    !localImportText.includes('args.fs.deleteEntry(path)') ||
    !localImportText.includes("inferCorpusMediaKind(args.originalName || args.relativePath, args.file.type) !== 'video'") ||
    !localImportText.includes('applyToGraph: true') ||
    !urlImportText.includes('materializeVideoSequenceTimelineImportDocument') ||
    !urlImportText.includes("sourceUnit.mediaKind === 'video'") ||
    !urlImportText.includes('removedVideoSourcePaths') ||
    !urlImportText.includes('args.fs.deleteEntry(normalized)') ||
    !urlContentText.includes('looksLikeVideo') ||
    !urlContentText.includes('buildCorpusMediaMetadataMarkdown') ||
    !urlContentText.includes("sourceMediaKind: 'video'") ||
    !videoSequenceImportText.includes('kgVideoSequenceTimeline: true') ||
    !videoSequenceImportText.includes('type: mermaid_gantt') ||
    !videoSequenceImportText.includes('section Mask') ||
    !videoSequenceImportText.includes('section Grade')
  ) {
    throw new Error('expected local-file and URL video imports to materialize a shared source-backed video sequence Timeline document')
  }
  for (const forbidden of ['/Users/', 'knowgrph-research-agent-demo', 'knowgrph-missalph-demo']) {
    if (
      localImportText.includes(forbidden) ||
      urlImportText.includes(forbidden) ||
      urlContentText.includes(forbidden) ||
      videoSequenceImportText.includes(forbidden)
    ) {
      throw new Error(`expected video sequence import projection to avoid hardcoded fixture token ${forbidden}`)
    }
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
  const sequenceCode = [
    'gantt',
    '  title Sequence',
    '  section Edit',
    '  Opening shot : clip_opening, 09:00, 6m',
  ].join('\n')
  const cutCode = splitMermaidGanttCodeRowAtOffset({ code: sequenceCode, rowLineIndex: 3, splitOffsetMinutes: 2 })
  if (!cutCode?.includes('Opening shot : clip_opening, kgsrc_0_2, 09:00, 2m') || !cutCode.includes('Opening shot splice : clip_opening_splice, kgsrc_2_6, 09:02, 4m')) {
    throw new Error(`expected video sequence cut to split selected Gantt row at playhead, got ${cutCode}`)
  }
  const maskCode = insertMermaidGanttVideoSequenceOperationRow({ code: sequenceCode, rowLineIndex: 3, operation: 'mask' })
  if (!maskCode?.includes('Opening shot mask : clip_opening_mask, kgsrc_0_6, 09:00, 6m')) {
    throw new Error(`expected video sequence mask to insert a source-backed operation lane, got ${maskCode}`)
  }
  const gradeCode = insertMermaidGanttVideoSequenceOperationRow({ code: sequenceCode, rowLineIndex: 3, operation: 'grade' })
  if (!gradeCode?.includes('Opening shot grade : clip_opening_grade, kgsrc_0_6, 09:00, 6m')) {
    throw new Error(`expected video sequence grade to insert a source-backed operation lane, got ${gradeCode}`)
  }
  const groupedSequenceCode = [
    'gantt',
    '  title Sequence',
    '  section Video',
    '  Opening shot : clip_opening, 09:00, 6m',
    '  section Mask',
    '  Opening shot mask : clip_opening_mask, 09:00, 6m',
    '  section Grade',
    '  Opening shot grade : clip_opening_grade, 09:00, 6m',
    '  section Audio',
    '  Opening shot audio : clip_opening_audio, 09:00, 6m',
  ].join('\n')
  const groupedCutCode = splitMermaidGanttVideoSequenceClipGroupAtOffset({
    code: groupedSequenceCode,
    rowLineIndex: 3,
    splitOffsetMinutes: 2,
  })
  if (
    !groupedCutCode?.includes('Opening shot : clip_opening, kgsrc_0_2, 09:00, 2m') ||
    !groupedCutCode.includes('Opening shot splice : clip_opening_splice, kgsrc_2_6, 09:02, 4m') ||
    !groupedCutCode.includes('Opening shot mask : clip_opening_mask, kgsrc_0_2, 09:00, 2m') ||
    !groupedCutCode.includes('Opening shot mask splice : clip_opening_mask_splice, kgsrc_2_6, 09:02, 4m') ||
    !groupedCutCode.includes('Opening shot grade splice : clip_opening_grade_splice, kgsrc_2_6, 09:02, 4m') ||
    !groupedCutCode.includes('Opening shot audio splice : clip_opening_audio_splice, kgsrc_2_6, 09:02, 4m')
  ) {
    throw new Error(`expected video sequence cut to split every source-backed clip lane, got ${groupedCutCode}`)
  }
  const decoupledMovedCode = updateMermaidGanttCodeRowTiming({
    code: groupedSequenceCode,
    rowLineIndex: 3,
    mode: 'move',
    deltaMinutes: 1,
  })
  if (
    !decoupledMovedCode?.includes('Opening shot : clip_opening, kgsrc_0_6, 09:01, 6m') ||
    !decoupledMovedCode.includes('Opening shot mask : clip_opening_mask, 09:00, 6m') ||
    !decoupledMovedCode.includes('Opening shot grade : clip_opening_grade, 09:00, 6m') ||
    !decoupledMovedCode.includes('Opening shot audio : clip_opening_audio, 09:00, 6m')
  ) {
    throw new Error(`expected video sequence bar move to edit only the selected source-backed strip, got ${decoupledMovedCode}`)
  }
  const duplicateGradeCode = insertMermaidGanttVideoSequenceOperationRow({
    code: groupedSequenceCode,
    rowLineIndex: 3,
    operation: 'grade',
  })
  if (duplicateGradeCode !== groupedSequenceCode) {
    throw new Error(`expected video sequence grade to reuse the existing operation lane without duplication, got ${duplicateGradeCode}`)
  }
  const spliceOnlyMovedCode = groupedCutCode
    ? updateMermaidGanttCodeRowTiming({
      code: groupedCutCode,
      rowLineIndex: 4,
      mode: 'move',
      deltaMinutes: 1,
    })
    : null
  if (
    !spliceOnlyMovedCode?.includes('Opening shot : clip_opening, kgsrc_0_2, 09:00, 2m') ||
    !spliceOnlyMovedCode.includes('Opening shot splice : clip_opening_splice, kgsrc_2_6, 09:03, 4m') ||
    !spliceOnlyMovedCode.includes('Opening shot mask : clip_opening_mask, kgsrc_0_2, 09:00, 2m') ||
    !spliceOnlyMovedCode.includes('Opening shot mask splice : clip_opening_mask_splice, kgsrc_2_6, 09:02, 4m')
  ) {
    throw new Error(`expected video sequence splice segment edits to avoid mutating other split strips, got ${spliceOnlyMovedCode}`)
  }
  const groupedExportPlan = buildVideoSequenceExportPlan({
    code: groupedCutCode || '',
    filenameHint: 'Sequence.md',
    sources: [{
      id: 'clip_opening',
      originalName: 'opening.mp4',
      relativePath: 'opening.mp4',
      workspacePath: '',
      sourceUrl: 'https://media.example.test/opening.mp4',
      mimeHint: 'video/mp4',
      byteSize: 100,
      importMode: 'url',
    }],
  })
  if (
    groupedExportPlan?.segments.length !== 2 ||
    groupedExportPlan.segments[0]?.sourceStartRatio !== 0 ||
    Math.abs((groupedExportPlan.segments[0]?.sourceEndRatio || 0) - (2 / 6)) > 0.0001 ||
    Math.abs((groupedExportPlan.segments[1]?.sourceStartRatio || 0) - (2 / 6)) > 0.0001 ||
    groupedExportPlan.segments[1]?.sourceEndRatio !== 1 ||
    groupedExportPlan.segments.some(segment => !segment.hasMask || !segment.hasGrade) ||
    groupedExportPlan.filenameBase !== 'sequence'
  ) {
    throw new Error(`expected edited video export plan to preserve cut source ranges and mask/grade operations, got ${JSON.stringify(groupedExportPlan)}`)
  }
  const importedSequenceMarkdown = buildVideoSequenceTimelineImportMarkdown([{
    workspacePath: '/workspace/clip-alpha.mp4.source.md',
    relativePath: 'clips/clip-alpha.mp4',
    originalName: 'clip-alpha.mp4',
    mimeHint: 'video/mp4',
    byteSize: 100,
    importMode: 'file',
  }, {
    workspacePath: '/workspace/clip-beta.webm.source.md',
    relativePath: 'clips/clip-beta.webm',
    originalName: 'clip-beta.webm',
    mimeHint: 'video/webm',
    byteSize: 200,
    importMode: 'folder',
  }])
  const importedSequenceCode = resolveMermaidDiagramCode(
    readYamlFrontmatterMermaidDiagramCodes(importedSequenceMarkdown, 'gantt'),
    'gantt',
  )
  const importedSequenceModel = buildMermaidGanttTimelineModel(importedSequenceCode)
  const importedVideoSequenceModel = readVideoSequenceTimelineModelFromMarkdown(importedSequenceMarkdown)
  const importedSequencePreset = parseCanvasWorkspaceFrontmatterPreset(importedSequenceMarkdown)
  const legacySequencePreset = parseCanvasWorkspaceFrontmatterPreset(importedSequenceMarkdown.replace('kgCanvas2dRenderer: "media"', 'kgCanvas2dRenderer: "gantt"'))
  if (
    !importedSequenceMarkdown.includes('kgCanvas2dRenderer: "media"') ||
    !importedSequenceMarkdown.includes('kgVideoSequenceTimeline: true') ||
    !importedSequenceCode.includes('section Video') ||
    !importedSequenceCode.includes('section Mask') ||
    !importedSequenceCode.includes('section Grade') ||
    !importedSequenceCode.includes('section Audio') ||
    !/clip-alpha\.mp4\s*:\s*clip_[a-z0-9]+,\s*00:00,\s*5m/.test(importedSequenceCode) ||
    !/clip-beta\.webm grade\s*:\s*clip_[a-z0-9]+_grade,\s*00:05,\s*5m/.test(importedSequenceCode) ||
    /\s:\s(?:video|mask|grade|audio|splice),/.test(importedSequenceCode) ||
    importedSequenceModel.durationMinutes !== 10 ||
    importedSequenceModel.taskSpans.length !== 8 ||
    importedSequencePreset?.canvas2dRenderer !== 'media' ||
    importedSequencePreset?.videoSequenceTimelineEnabled !== true ||
    legacySequencePreset?.canvas2dRenderer !== 'media'
  ) {
    throw new Error(`expected video import projection to emit runtime-ready typed Gantt sequence frontmatter, got ${JSON.stringify({ importedSequenceCode, importedSequenceModel })}`)
  }
  if (
    !importedVideoSequenceModel?.enabled ||
    importedVideoSequenceModel.sources.length !== 2 ||
    importedVideoSequenceModel.sources[0]?.originalName !== 'clip-alpha.mp4' ||
    importedVideoSequenceModel.sources[0]?.byteSize !== 100 ||
    readVideoSequenceSourcePlayableUrl(importedVideoSequenceModel.sources[0]!) !== '' ||
    !buildVideoSequenceSourceRegistryKeys(importedVideoSequenceModel.sources[0]!).some(key => key.includes('clip-alpha.mp4|100'))
  ) {
    throw new Error(`expected video sequence frontmatter parser to expose neutral local-source metadata without persisted object URLs, got ${JSON.stringify(importedVideoSequenceModel)}`)
  }
  const importedUrlSequenceMarkdown = buildVideoSequenceTimelineImportMarkdown([{
    sourceUrl: 'https://media.example.test/clip.mp4',
    relativePath: 'https://media.example.test/clip.mp4',
    originalName: 'clip.mp4',
    mimeHint: 'video/mp4',
    importMode: 'url',
  }])
  const importedUrlVideoSequenceModel = readVideoSequenceTimelineModelFromMarkdown(importedUrlSequenceMarkdown)
  const importedUrlSource = importedUrlVideoSequenceModel?.sources[0] || null
  if (!importedUrlSource || readVideoSequenceSourcePlayableUrl(importedUrlSource) !== 'https://media.example.test/clip.mp4') {
    throw new Error(`expected URL video sequence sources to resolve direct playable video URLs, got ${JSON.stringify(importedUrlVideoSequenceModel)}`)
  }
  const localVideoImportInput = '/tmp/knowgrph-video/clip.mp4'
  if (normalizeWorkspaceImportUrlInput(localVideoImportInput) !== localVideoImportInput) {
    throw new Error('expected workspace Import URL to accept local absolute video paths without hardcoding fixture paths in source')
  }
  const localVideoContent = await fetchWorkspaceUrlContent(localVideoImportInput)
  if (
    localVideoContent.name !== 'clip.mp4.source.md' ||
    localVideoContent.sourceMediaKind !== 'video' ||
    !localVideoContent.text.includes('originalName: "clip.mp4"') ||
    !localVideoContent.text.includes('relativePath: "tmp/knowgrph-video/clip.mp4"')
  ) {
    throw new Error(`expected local absolute video path import to preserve source basename metadata before binary fetch, got ${JSON.stringify(localVideoContent)}`)
  }
  const store = useGraphStore.getState()
  store.resetAll()
  store.setGanttTimelineTransportState({
    documentKey: 'sequence-a.md',
    positionMinutes: 2.5,
    playing: true,
    playbackRate: 1.5,
  })
  const afterTransportSet = useGraphStore.getState()
  if (
    afterTransportSet.ganttTimelineTransportDocumentKey !== 'sequence-a.md' ||
    afterTransportSet.ganttTimelineTransportPositionMinutes !== 2.5 ||
    afterTransportSet.ganttTimelineTransportPlaying !== true ||
    afterTransportSet.ganttTimelineTransportPlaybackRate !== 1.5
  ) {
    throw new Error(`expected shared Gantt transport state to update atomically, got ${JSON.stringify({
      documentKey: afterTransportSet.ganttTimelineTransportDocumentKey,
      position: afterTransportSet.ganttTimelineTransportPositionMinutes,
      playing: afterTransportSet.ganttTimelineTransportPlaying,
      rate: afterTransportSet.ganttTimelineTransportPlaybackRate,
    })}`)
  }
  store.setGanttTimelineTransportState({ documentKey: 'sequence-b.md' })
  const afterTransportDocumentSwitch = useGraphStore.getState()
  if (
    afterTransportDocumentSwitch.ganttTimelineTransportDocumentKey !== 'sequence-b.md' ||
    afterTransportDocumentSwitch.ganttTimelineTransportPositionMinutes !== 0 ||
    afterTransportDocumentSwitch.ganttTimelineTransportPlaying !== false ||
    afterTransportDocumentSwitch.ganttTimelineTransportPlaybackRate !== 1
  ) {
    throw new Error(`expected shared Gantt transport state to reset on document switch, got ${JSON.stringify({
      documentKey: afterTransportDocumentSwitch.ganttTimelineTransportDocumentKey,
      position: afterTransportDocumentSwitch.ganttTimelineTransportPositionMinutes,
      playing: afterTransportDocumentSwitch.ganttTimelineTransportPlaying,
      rate: afterTransportDocumentSwitch.ganttTimelineTransportPlaybackRate,
    })}`)
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
