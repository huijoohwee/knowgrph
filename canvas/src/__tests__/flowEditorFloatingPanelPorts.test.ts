import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import { resolveFlowEditorFloatingPanelSplitResize } from '@/lib/flowEditor/flowEditorFloatingPanelSplit'
import { buildFlowEditorPortRows, resolveFlowEditorFocusedEdgeIds } from '@/lib/flowEditor/flowEditorPortRows'
import {
  buildFlowEditorDiagramSelectionBridge,
  resolveDiagramRowKeyForFlowEditorPortRow,
  resolveFlowEditorPortRowKeyForDiagramRow,
} from '@/lib/flowEditor/flowEditorDiagramSelection'
import { parseMermaidDiagramCodeModel } from '@/lib/mermaid/mermaidDiagramCode'

export function testFlowEditorFloatingPanelPortRowsUseTypedHandles() {
  const graphData: GraphData = {
    type: 'flow',
    nodes: [
      {
        id: 'input_query',
        label: 'Input Query',
        type: 'Input',
        x: 0,
        y: 0,
        properties: {
          'flow:portTypes': {
            out: {
              query: 'string',
            },
          },
        },
      },
      {
        id: 'compute_summary',
        label: 'Compute Summary',
        type: 'LLM',
        x: 200,
        y: 80,
        properties: {
          'flow:portTypes': {
            in: {
              query: 'string',
              context: 'markdown',
            },
            out: {
              summary: 'markdown',
            },
          },
        },
      },
    ],
    edges: [
      {
        id: 'edge_query_to_summary',
        source: 'input_query',
        target: 'compute_summary',
        label: 'query',
        properties: {
          'flow:sourcePortKey': 'query',
          'flow:targetPortKey': 'query',
        },
      },
    ],
  }

  const summary = buildFlowEditorPortRows(graphData)
  if (summary.inputCount !== 2 || summary.outputCount !== 2) {
    throw new Error(`expected typed Flow Editor ports to derive 2 inputs and 2 outputs, got ${summary.inputCount}/${summary.outputCount}`)
  }
  const queryInput = summary.rows.find(row => row.nodeId === 'compute_summary' && row.direction === 'input' && row.portKey === 'query')
  if (!queryInput || queryInput.socketType !== 'string' || queryInput.connectedEdgeCount !== 1 || queryInput.connectedEdgeIds[0] !== 'edge_query_to_summary') {
    throw new Error('expected compute_summary query input row to preserve socket type and connected edge identity')
  }
  const focused = resolveFlowEditorFocusedEdgeIds(graphData, queryInput.key)
  if (focused.active !== true || focused.edgeIds.length !== 1 || focused.edgeIds[0] !== 'edge_query_to_summary') {
    throw new Error('expected selected Flow Editor port row to resolve its connected edge ids')
  }
  const contextInput = summary.rows.find(row => row.nodeId === 'compute_summary' && row.direction === 'input' && row.portKey === 'context')
  if (!contextInput || contextInput.connectedEdgeCount !== 0) {
    throw new Error('expected unconnected typed input rows to remain visible with zero connected edges')
  }
  const unconnectedFocused = resolveFlowEditorFocusedEdgeIds(graphData, contextInput.key)
  if (unconnectedFocused.active !== true || unconnectedFocused.edgeIds.length !== 0) {
    throw new Error('expected unconnected selected Flow Editor port row to be active with no focused edges')
  }
  const resized = resolveFlowEditorFloatingPanelSplitResize({
    startHeightsPx: { rows: 300, details: 180 },
    deltaY: 80,
    minRowsHeightPx: 144,
    minDetailsHeightPx: 112,
  })
  if (resized.rows !== 368 || resized.details !== 112) {
    throw new Error(`expected FlowEditor floating panel split resize to clamp bottom details pane, got ${resized.rows}/${resized.details}`)
  }
}

export function testFlowEditorDiagramSelectionBridgeMatchesSemanticRows() {
  const graphData: GraphData = {
    type: 'flow',
    nodes: [
      {
        id: 'node_alpha_screener',
        label: 'Non-Consensus Alpha Screener',
        type: 'AlphaScreener',
        x: 0,
        y: 0,
        properties: {
          'flow:portTypes': {
            in: { input_portfolio: 'alpha_signal' },
            out: { output_alpha_signal: 'alpha_signal' },
          },
        },
      },
      {
        id: 'compute_summary',
        label: 'Alpha Synthesis - Compute Summary',
        type: 'ComputeSummary',
        x: 220,
        y: 0,
        properties: {
          'flow:portTypes': {
            in: { input_alpha_signal: 'alpha_signal' },
            out: { output_markdown: 'markdown' },
          },
        },
      },
      {
        id: 'media_ingestion_source',
        label: 'Media Ingestion Source',
        type: 'MediaSource',
        x: 440,
        y: 0,
        properties: {
          'flow:portTypes': {
            out: { source_url: 'video_source' },
          },
        },
      },
      {
        id: 'html_video_source_spec',
        label: 'Programmatic Video Agent Render Spec',
        type: 'InputWidget',
        x: 660,
        y: 0,
        properties: {
          'flow:portTypes': {
            out: {
              html: 'html_video_spec',
              css: 'html_video_spec',
              data_json: 'html_video_spec',
              frameBoundingBoxes: 'annotation_json',
            },
          },
        },
      },
      {
        id: 'floating_media_ingestion_source',
        label: 'FloatingPanel Media Source',
        type: 'MediaSource',
        x: 880,
        y: 0,
        properties: {
          'flow:portTypes': {
            out: {
              image_asset_url: 'visual_media_asset',
              video_frame_asset_url: 'visual_media_asset',
            },
          },
        },
      },
    ],
    edges: [
      {
        id: 'edge_alpha_to_summary',
        source: 'node_alpha_screener',
        target: 'compute_summary',
        label: 'alpha signal',
        properties: {
          'flow:sourcePortKey': 'output_alpha_signal',
          'flow:targetPortKey': 'input_alpha_signal',
        },
      },
    ],
  }
  const timelineModel = parseMermaidDiagramCodeModel([
    'timeline LR',
    '  title Dynamic chronology',
    '  section Screening',
    '    Non-consensus alpha screener : Factor coverage delta',
    '  section Synthesis',
    '    Compute summary : Response and tokens',
  ].join('\n'), 'timeline')
  const portRows = buildFlowEditorPortRows(graphData).rows
  const bridge = buildFlowEditorDiagramSelectionBridge({
    diagramRows: timelineModel.rows,
    flowRows: portRows,
  })
  const alphaTimelineRow = timelineModel.rows.find(row => row.label === 'Non-consensus alpha screener')
  if (!alphaTimelineRow) {
    throw new Error('expected timeline model to parse non-consensus alpha event row')
  }
  const alphaPortRowKey = resolveFlowEditorPortRowKeyForDiagramRow(bridge, alphaTimelineRow.key)
  if (!alphaPortRowKey.startsWith('node_alpha_screener:')) {
    throw new Error(`expected alpha timeline row to select a node_alpha_screener FlowEditor row, got ${alphaPortRowKey}`)
  }

  const computeInputRow = portRows.find(row => row.key === 'compute_summary:input:input_alpha_signal')
  if (!computeInputRow) {
    throw new Error('expected compute_summary input row to exist')
  }
  const computeTimelineRowKey = resolveDiagramRowKeyForFlowEditorPortRow(bridge, computeInputRow.key)
  const computeTimelineRow = timelineModel.rows.find(row => row.key === computeTimelineRowKey)
  if (computeTimelineRow?.label !== 'Compute summary') {
    throw new Error(`expected compute_summary FlowEditor row to select Compute summary timeline row, got ${computeTimelineRow?.label || computeTimelineRowKey}`)
  }
  const ingestTimelineModel = parseMermaidDiagramCodeModel([
    'gantt',
    '  title Video agent stages',
    '  dateFormat HH:mm',
    '  section Source intake',
    '  Ingest test URL : ingest, 00:00, 1m',
    '  section Frame-by-frame boxes',
    '  Frame-by-frame bbox 0.0s tracked subject : frame_box_0_fbf, 00:00, 1m',
  ].join('\n'), 'gantt')
  const ingestBridge = buildFlowEditorDiagramSelectionBridge({
    diagramRows: ingestTimelineModel.rows,
    flowRows: portRows,
  })
  const ingestTimelineRow = ingestTimelineModel.rows.find(row => row.label === 'Ingest test URL')
  if (!ingestTimelineRow) {
    throw new Error('expected ingestion Gantt row to parse')
  }
  const ingestPortRowKey = resolveFlowEditorPortRowKeyForDiagramRow(ingestBridge, ingestTimelineRow.key)
  if (ingestPortRowKey !== 'html_video_source_spec:output:data_json') {
    throw new Error(`expected video-agent Ingest test URL Gantt row to select the source Render_Spec data_json KV row, got ${ingestPortRowKey}`)
  }
  const frameBoxTimelineRow = ingestTimelineModel.rows.find(row => row.label === 'Frame-by-frame bbox 0.0s tracked subject')
  if (!frameBoxTimelineRow) {
    throw new Error('expected frame-by-frame Gantt row to parse')
  }
  const frameBoxPortRowKey = resolveFlowEditorPortRowKeyForDiagramRow(ingestBridge, frameBoxTimelineRow.key)
  if (frameBoxPortRowKey !== 'html_video_source_spec:output:frameBoundingBoxes') {
    throw new Error(`expected frame-by-frame Gantt row to select the source Render_Spec frameBoundingBoxes KV row, got ${frameBoxPortRowKey}`)
  }
  if (ingestPortRowKey.includes('image_asset_url') || frameBoxPortRowKey.includes('image_asset_url')) {
    throw new Error('expected video-agent Gantt selection to avoid FloatingPanel media asset rows')
  }

  const titleTimelineRow = timelineModel.rows.find(row => row.kind === 'title')
  if (!titleTimelineRow) {
    throw new Error('expected timeline title row to exist')
  }
  if (resolveFlowEditorPortRowKeyForDiagramRow(bridge, titleTimelineRow.key)) {
    throw new Error('expected timeline title rows to stay out of FlowEditor KTV row selection')
  }

  const gitGraphModel = parseMermaidDiagramCodeModel([
    'gitGraph',
    '  commit id: "source_input" tag: "inputs"',
    '  branch alpha_screener',
    '  checkout alpha_screener',
    '  commit id: "node_alpha_screener"',
    '  commit id: "output_alpha_signal"',
    '  checkout main',
    '  merge alpha_screener id: "merge_alpha_signal"',
    '  commit id: "compute_summary" tag: "synthesis"',
  ].join('\n'), 'gitgraph')
  const gitGraphBridge = buildFlowEditorDiagramSelectionBridge({
    diagramRows: gitGraphModel.rows,
    flowRows: portRows,
  })
  const alphaOutputRow = portRows.find(row => row.key === 'node_alpha_screener:output:output_alpha_signal')
  if (!alphaOutputRow) {
    throw new Error('expected node_alpha_screener output row to exist')
  }
  const alphaOutputDiagramRow = gitGraphModel.rows.find(row => row.raw.includes('output_alpha_signal'))
  if (!alphaOutputDiagramRow) {
    throw new Error('expected GitGraph output_alpha_signal commit row to parse')
  }
  const alphaOutputPortRowKey = resolveFlowEditorPortRowKeyForDiagramRow(gitGraphBridge, alphaOutputDiagramRow.key)
  if (alphaOutputPortRowKey !== alphaOutputRow.key) {
    throw new Error(`expected GitGraph output commit to select the alpha output KTV row, got ${alphaOutputPortRowKey}`)
  }
  const computeGitGraphRowKey = resolveDiagramRowKeyForFlowEditorPortRow(gitGraphBridge, computeInputRow.key)
  const computeGitGraphRow = gitGraphModel.rows.find(row => row.key === computeGitGraphRowKey)
  if (!computeGitGraphRow?.raw.includes('compute_summary')) {
    throw new Error(`expected compute_summary KTV row to select the compute_summary GitGraph frame, got ${computeGitGraphRow?.raw || computeGitGraphRowKey}`)
  }
}

export function testFlowEditorFloatingPanelReusesSharedFloatingPanelAndKtvChrome() {
  const root = process.cwd()
  const toolbarText = readFileSync(resolve(root, 'src', 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx'), 'utf8')
  const iconLibraryText = readFileSync(resolve(root, 'src', 'features', 'panels', 'ui', 'mainPanelHelpIconLibrary.tsx'), 'utf8')
  const viewTypeText = readFileSync(resolve(root, 'src', 'hooks', 'store', 'store-types', 'graph-state-chat-import.ts'), 'utf8')
  const uiSliceText = readFileSync(resolve(root, 'src', 'hooks', 'store', 'uiSliceInitialState.ts'), 'utf8')
  const panelText = readFileSync(resolve(root, 'src', 'features', 'flow-editor-manager', 'FlowEditorFloatingPanelView.tsx'), 'utf8')
  const videoAgentValidationControlsText = readFileSync(resolve(root, 'src', 'features', 'video-agent', 'VideoAgentValidationImportControls.tsx'), 'utf8')
  const flowCanvasText = readFileSync(resolve(root, 'src', 'components', 'FlowCanvas.tsx'), 'utf8')
  const nativeRuntimeText = readFileSync(resolve(root, 'src', 'components', 'FlowCanvas', 'nativeRuntime.ts'), 'utf8')
  const overlayEdgesText = readFileSync(resolve(root, 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts'), 'utf8')
  const canvasUtilsText = readFileSync(resolve(root, 'src', 'features', 'canvas', 'utils.ts'), 'utf8')
  const toolbarLauncherText = readFileSync(resolve(root, 'src', 'features', 'toolbar', 'ToolbarMenuLauncher.tsx'), 'utf8')
  const configRenderText = readFileSync(resolve(root, 'src', 'lib', 'config.render.ts'), 'utf8')
  const sharedResizeText = readFileSync(resolve(root, 'src', 'lib', 'ui', 'resizeSeparatorDrag.ts'), 'utf8')
  const diagramBridgeText = readFileSync(resolve(root, 'src', 'lib', 'flowEditor', 'flowEditorDiagramSelection.ts'), 'utf8')
  const diagramSelectionHookText = readFileSync(resolve(root, 'src', 'features', 'gitgraph', 'useFlowEditorDiagramSelectionBridge.ts'), 'utf8')
  const timelineBottomText = readFileSync(resolve(root, 'src', 'features', 'gitgraph', 'TimelineBottomPanelView.tsx'), 'utf8')
  const timelineFloatingText = readFileSync(resolve(root, 'src', 'features', 'gitgraph', 'TimelineFloatingPanelView.tsx'), 'utf8')
  const ganttBottomText = readFileSync(resolve(root, 'src', 'features', 'gitgraph', 'GanttBottomPanelView.tsx'), 'utf8')
  const ganttFloatingText = readFileSync(resolve(root, 'src', 'features', 'gitgraph', 'GanttFloatingPanelView.tsx'), 'utf8')
  const gitGraphBottomText = readFileSync(resolve(root, 'src', 'features', 'gitgraph', 'GitGraphBottomPanelView.tsx'), 'utf8')
  const gitGraphFloatingText = readFileSync(resolve(root, 'src', 'features', 'gitgraph', 'GitGraphFloatingPanelView.tsx'), 'utf8')
  const mermaidPanelText = readFileSync(resolve(root, 'src', 'features', 'gitgraph', 'MermaidDiagramPanelView.tsx'), 'utf8')
  const kvTableText = readFileSync(resolve(root, 'src', 'components', 'FlowEditor', 'NodeOverlayEditorKvTable.tsx'), 'utf8')
  const workspaceResizeRuntimeText = readFileSync(resolve(root, 'src', 'features', 'canvas', 'canvasWorkspacePaneResizeHandleRuntime.ts'), 'utf8')
  const explorerResizeText = readFileSync(resolve(root, 'src', 'features', 'markdown-workspace', 'MarkdownExplorerSectionResizeHandle.tsx'), 'utf8')

  if (!viewTypeText.includes("| 'flowEditor'")) {
    throw new Error('expected FlowEditor to be a first-class FloatingPanelView')
  }
  if (!uiSliceText.includes("|| view === 'flowEditor'")) {
    throw new Error('expected shared floating panel view normalization to accept FlowEditor instead of falling back to Props Panel')
  }
  if (!iconLibraryText.includes("'floatingPanel.flowEditor'") || !iconLibraryText.includes("flowEditor: 'floatingPanel.flowEditor'")) {
    throw new Error('expected FlowEditor floating panel icon to reuse the shared icon library mapping')
  }
  if (!toolbarText.includes('FlowEditorFloatingPanelViewLazy')
    || !toolbarText.includes("FLOATING_PANEL_TYPE_ICON_BY_VIEW.flowEditor")
    || !toolbarText.includes("view: 'flowEditor'")
    || !toolbarText.includes("floatingPanelView === 'flowEditor'")) {
    throw new Error('expected FlowEditor floating panel to be registered through the shared toolbar FloatingPanel wiring')
  }
  if (!canvasUtilsText.includes("'flowEditor'")
    || !toolbarLauncherText.includes("tab === 'flowEditor'")
    || !toolbarLauncherText.includes("? 'flowEditor'")) {
    throw new Error('expected shared floating-panel open bridge to accept FlowEditor without a local alias')
  }
  if (!configRenderText.includes("ToolbarRunAllFloatingPanelTab = 'strybldr'")
    || configRenderText.includes("if (id === 'flowEditor') return 'flowEditor'")) {
    throw new Error('expected FlowEditor Run All to keep its always-mounted canvas runtime consumer')
  }
  if (!panelText.includes('KeyTypeValueHeader')
    || !panelText.includes('KeyTypeValueStaticRow')
    || !panelText.includes('KeyTypeValueSectionStack')
    || !panelText.includes('buildFlowEditorPortRows')
    || !panelText.includes('flowEditorSelectedPortRowKey')
    || !panelText.includes('setFlowEditorSelectedPortRowKey')
    || !panelText.includes('data-kg-flow-editor-port-selected')
    || !panelText.includes('data-kg-flow-editor-port-dimmed')
    || !panelText.includes('selectionActive={!!selectedRowKey}')
    || !panelText.includes('activeClassName={selected ? UI_THEME_TOKENS.table.rowSelected : staticRowProps.activeClassName}')
    || !panelText.includes('HorizontalResizeSeparatorHr')
    || !panelText.includes('bindResizeSeparatorDragRuntime')
    || !panelText.includes('data-kg-flow-editor-port-split-resize')
    || !panelText.includes('data-kg-flow-editor-port-detail-panel')
    || !panelText.includes('data-kg-flow-editor-floating-panel="1"')) {
    throw new Error('expected FlowEditor floating panel to render shared KTV rows with stable test hooks')
  }
  if (!panelText.includes('VideoAgentValidationImportControls')
    || !panelText.includes('Flow Editor video-agent validation document path')
    || !panelText.includes('Flow Editor video-agent validation import URLs')
    || !panelText.includes('runtimeInput={graphData}')
    || !panelText.includes('optionMode="import"')
    || !panelText.includes('optionButtonLabel={option => `Import ${option.label}`}')
    || !panelText.includes('flowEditorDataHook')) {
    throw new Error('expected FlowEditor floating panel to delegate user-configurable video-agent validation imports to the shared owner')
  }
  if (panelText.includes('readVideoAgentValidationConfig')
    || panelText.includes('writeVideoAgentValidationConfig')
    || panelText.includes('getMarkdownWorkspaceActionBridge')
    || panelText.includes('canvas2dRenderer:')) {
    throw new Error('expected FlowEditor floating panel to avoid a local video-agent validation config or URL-import alias path')
  }
  if (!videoAgentValidationControlsText.includes('containerAriaLabel')
    || !videoAgentValidationControlsText.includes('docPathAriaLabel')
    || !videoAgentValidationControlsText.includes('urlsAriaLabel')
    || !videoAgentValidationControlsText.includes('readVideoAgentValidationConfig')
    || !videoAgentValidationControlsText.includes('readVideoAgentValidationConfigFromRuntimeInput')
    || !videoAgentValidationControlsText.includes('mergeVideoAgentValidationConfigs')
    || !videoAgentValidationControlsText.includes('buildVideoAgentValidationUrlOptions')
    || !videoAgentValidationControlsText.includes('writeVideoAgentValidationConfig')
    || !videoAgentValidationControlsText.includes('getMarkdownWorkspaceActionBridge')
    || !videoAgentValidationControlsText.includes("optionMode === 'select'")
    || !videoAgentValidationControlsText.includes('data-kg-video-agent-validation-url-option')
    || !videoAgentValidationControlsText.includes('data-kg-flow-editor-video-agent-validation-controls')) {
    throw new Error('expected shared video-agent validation controls to own URL derivation, storage, and import behavior')
  }
  if (panelText.includes('Use first')) {
    throw new Error('expected FlowEditor validation imports to keep the configured URL set and expose per-URL actions')
  }
  for (const forbidden of ['video-db', 'VideoDB', '@video-db', 'Director(', 'VIDEODB_API_KEY', 'youtu.be/']) {
    if (panelText.includes(forbidden) || videoAgentValidationControlsText.includes(forbidden)) {
      throw new Error(`expected FlowEditor video-agent validation controls to avoid hardcoded external dependency or URL token ${forbidden}`)
    }
  }
  if (!sharedResizeText.includes('bindResizeSeparatorDragRuntime')
    || !sharedResizeText.includes("cursor: ResizeSeparatorDragCursor")
    || !sharedResizeText.includes('startPointerDrag')
    || !workspaceResizeRuntimeText.includes('bindResizeSeparatorDragRuntime<number>')
    || !explorerResizeText.includes('bindResizeSeparatorDragRuntime<MarkdownExplorerSectionHeightsPx>')) {
    throw new Error('expected FlowEditor and workspace separators to reuse the shared resize drag binder')
  }
  if (!flowCanvasText.includes('resolveFlowEditorFocusedEdgeIds')
    || !flowCanvasText.includes('edgeFocusActive')
    || !flowCanvasText.includes('focusedEdgeIds')) {
    throw new Error('expected FlowCanvas to resolve selected FlowEditor port rows into focused edge draw args')
  }
  if (!nativeRuntimeText.includes('dimmed: edgeFocusActive')
    || !nativeRuntimeText.includes('focusedEdgeIds')
    || !nativeRuntimeText.includes('ctx.globalAlpha * dimAlpha')) {
    throw new Error('expected native FlowCanvas edges to dim unfocused edges from FlowEditor row selection')
  }
  if (!overlayEdgesText.includes('data-kg-flow-editor-edge-dimmed')
    || !overlayEdgesText.includes('data-kg-flow-editor-edge-focused')
    || !overlayEdgesText.includes('FLOW_EDITOR_OVERLAY_EDGE_DIMMED_OPACITY')
    || !overlayEdgesText.includes('resolveFlowEditorFocusedEdgeIds')) {
    throw new Error('expected FlowEditor overlay edges to expose focused and dimmed row-selection state')
  }
  if (!diagramBridgeText.includes('readDiagramSelectionLabels')
    || !diagramBridgeText.includes('resolveDiagramRowKey')
    || !diagramBridgeText.includes('buildFlowEditorDiagramSelectionBridge')
    || !diagramBridgeText.includes('resolveFlowEditorPortRowKeyForDiagramRow')
    || !diagramBridgeText.includes('resolveDiagramRowKeyForFlowEditorPortRow')
    || !diagramSelectionHookText.includes('state.mermaidDiagramSelectedRowKeyByKind[kind]')
    || !diagramSelectionHookText.includes('flowEditorSelectedPortRowKey')
    || !timelineBottomText.includes('useFlowEditorDiagramSelectionBridge')
    || !timelineFloatingText.includes('useFlowEditorDiagramSelectionBridge')
    || !timelineFloatingText.includes('handleGanttDiagramSelectedRowKeyChange')
    || !timelineFloatingText.includes('onSelectedRowKeyChange={handleGanttDiagramSelectedRowKeyChange}')
    || !ganttBottomText.includes('useFlowEditorDiagramSelectionBridge')
    || !ganttBottomText.includes('onSelectedRowKeyChange={handleDiagramSelectedRowKeyChange}')
    || !ganttFloatingText.includes('useFlowEditorDiagramSelectionBridge')
    || !ganttFloatingText.includes('onSelectedRowKeyChange={handleDiagramSelectedRowKeyChange}')
    || !gitGraphBottomText.includes('useFlowEditorDiagramSelectionBridge')
    || !gitGraphBottomText.includes("kind: 'gitgraph'")
    || !gitGraphFloatingText.includes('useFlowEditorDiagramSelectionBridge')
    || !gitGraphFloatingText.includes('resolveCommandSelectionKey')
    || !gitGraphFloatingText.includes('data-kg-gitgraph-command-row-key')
    || !mermaidPanelText.includes('onSelectedRowKeyChange?.(rowKey)')) {
    throw new Error('expected BottomPanel/FloatingPanel Mermaid selection to reuse shared diagram row keys and FlowEditor port rows')
  }
  if (!diagramSelectionHookText.includes('portRows.find(row => row.key === nextPortRowKey)')
    || !diagramSelectionHookText.includes('diagramSelectionWriteRef')
    || !diagramSelectionHookText.includes("setSelectionSource('editor')")
    || !diagramSelectionHookText.includes('selectNode(nextNodeId)')) {
    throw new Error('expected Mermaid row selection to select the matching Flow Editor node before focusing its KV row')
  }
  if (!kvTableText.includes('data-kg-flow-widget-kv-row-selected')
    || !kvTableText.includes('data-kg-flow-editor-port-row-key')
    || !kvTableText.includes("root.closest('[data-kg-widget]')")
    || !kvTableText.includes('[data-kg-port-dir="${cssAttrValue(parsed.direction)}"]')
    || !kvTableText.includes('[data-kg-port-key="${cssAttrValue(parsed.portKey)}"]')
    || !kvTableText.includes("nextSelectedRow.scrollIntoView({ block: 'nearest', inline: 'nearest' })")) {
    throw new Error('expected Flow Editor widget KV rows to resolve and reveal the selected diagram port row')
  }
  for (const forbidden of ['knowgrph-missalph-demo', '/Users/']) {
    if (diagramBridgeText.includes(forbidden) || diagramSelectionHookText.includes(forbidden) || kvTableText.includes(forbidden) || timelineBottomText.includes(forbidden) || timelineFloatingText.includes(forbidden) || ganttBottomText.includes(forbidden) || ganttFloatingText.includes(forbidden) || gitGraphBottomText.includes(forbidden) || gitGraphFloatingText.includes(forbidden)) {
      throw new Error(`expected Mermaid to FlowEditor selection bridge to avoid hardcoded fixture token ${forbidden}`)
    }
  }
}
