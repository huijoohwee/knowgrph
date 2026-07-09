import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { computeViewportSafeInlineCenterShiftPx } from '@/lib/ui/viewportToolbarPlacement'
import {
  materializeProbeTreeBranchCards,
  resolveProbeTreeCardMaterializationRequestText,
} from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import {
  buildProbeTreeStoryboardMermaidFlowchart,
  parseProbeTreeStoryboardMermaidFlowchart,
  PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND,
} from '@/components/StoryboardCanvas/storyboardProbeTreeMermaidFlowchart'
import type { GraphData } from '@/lib/graph/types'

export function testStoryboardWidgetToolbarRestoresTinyFloatingActionsWithRun() {
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorActionsToolbar.tsx')
  const overlayImplementationPaths = [
    resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorInner.tsx'),
    resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorView.tsx'),
    resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'useWidgetPlacementRuntime.ts'),
    resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'flowWidgetOverlayShared.ts'),
  ]
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetOverlaySurface.tsx')
  const overlaySurfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'storyboardWidgetOverlaySurfaceElements.tsx')
  const probeTreeActionPath = resolve(process.cwd(), 'src', 'components', 'StoryboardCanvas', 'storyboardProbeTreeInvocationAction.ts')
  const openMappingHelperPath = resolve(process.cwd(), 'src', 'features', 'storyboard-widget-manager', 'openWorkflowManagerMappingForNode.ts')
  const copyPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiCopy.ts')
  const metaPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiMeta.ts')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const overlayText = overlayImplementationPaths.map(path => readFileSync(path, 'utf8')).join('\n')
  const overlaySurfaceText = [overlaySurfacePath, overlaySurfaceElementsPath].map(path => readFileSync(path, 'utf8')).join('\n')
  const probeTreeActionText = readFileSync(probeTreeActionPath, 'utf8')
  const openMappingHelperText = readFileSync(openMappingHelperPath, 'utf8')
  const copyText = readFileSync(copyPath, 'utf8')
  const metaText = readFileSync(metaPath, 'utf8')

  const requiredToolbarSnippets = [
    'title={UI_LABELS.updateKvEntry}',
    'tooltipContent={UI_LABELS.updateKvEntry}',
    'flowWidgetOpenInSidepane',
    'flowWidgetEnableHandles',
    'flowWidgetProbeTree',
    'flowWidgetConvertToLoop',
    'flowWidgetDuplicate',
    'flowWidgetClearOutput',
    'flowWidgetHelp',
    'flowWidgetRemoveNode',
    'flowWidgetRun',
    '<Play className={iconSizeClass}',
    '<GitBranch className={iconSizeClass}',
    'onClick={onRun}',
    'onClick={onProbeTree}',
  ]
  for (const snippet of requiredToolbarSnippets) {
    if (!toolbarText.includes(snippet)) {
      throw new Error(`expected restored widget toolbar snippet: ${snippet}`)
    }
  }
  if (!overlayText.includes('const [toolbarDock, setToolbarDock] = React.useState<\'above\' | \'below\'>(\'above\')')) {
    throw new Error('expected widget tiny floating toolbar to track adaptive above/below docking state')
  }
  if (!overlayText.includes('const nextToolbarDock = pos.top >= WIDGET_ACTIONS_TOOLBAR_CLEARANCE_PX ? \'above\' : \'below\'')) {
    throw new Error('expected widget tiny floating toolbar docking to derive from viewport-safe overlay position')
  }
  if (!overlayText.includes('absolute left-1/2 z-10 ${pointerPolicy.toolbarPointerEventsClassName}')) {
    throw new Error('expected widget tiny floating toolbar anchor to keep explicit stacking and pointer-event visibility')
  }
  if (!overlayText.includes('const [toolbarSideClamp, setToolbarSideClamp] = React.useState(false)')) {
    throw new Error('expected Rich Media widget toolbar to track side clamping state')
  }
  if (!overlayText.includes('const nextToolbarSideClamp = pos.left + effectiveScaled.width + WIDGET_ACTIONS_TOOLBAR_SIDE_CLEARANCE_PX > viewportW')) {
    throw new Error('expected Rich Media widget toolbar to clamp inside the widget when right-side placement would clip')
  }
  if (!overlayText.includes('isRichMediaPanelWidget\n              ? `absolute z-10 ${pointerPolicy.toolbarPointerEventsClassName}`')) {
    throw new Error('expected Rich Media widget toolbar anchor to branch into side-docked placement while preserving default center toolbar behavior for other widgets')
  }
  if (!overlayText.includes('computeViewportSafeInlineCenterShiftPx')
    || !overlayText.includes('toolbarInlineShiftPx')
    || !overlayText.includes('toolbarMaxWidthPx')) {
    throw new Error('expected widget tiny floating toolbar placement to use the shared viewport-safe inline shift contract')
  }
  if (!toolbarText.includes('App-toolbar--touch-scroll') || !toolbarText.includes('maxWidthPx')) {
    throw new Error('expected widget tiny floating toolbar to reuse shared touch-scroll behavior and viewport max-width')
  }
  if (!overlayText.includes('visible={toolbarVisible}')) {
    throw new Error('expected widget tiny floating toolbar visibility to be driven by local click-open state without duplicate selected-node gating')
  }
  if (!overlaySurfaceText.includes('onRun={() => {')) {
    throw new Error('expected StoryboardWidget overlay widget to wire the Run action through the shared run handler')
  }
  if (!overlaySurfaceText.includes('void args.runWorkflowNode(actionNodeId)')) {
    throw new Error('expected StoryboardWidget Run action to reuse the existing workflow run callback through the resolved action identity')
  }
  const probeTreeToolbarIndex = toolbarText.indexOf('tooltipContent={UI_COPY.flowWidgetProbeTree}')
  const convertToLoopToolbarIndex = toolbarText.indexOf('tooltipContent={UI_COPY.flowWidgetConvertToLoop}')
  if (probeTreeToolbarIndex < 0 || convertToLoopToolbarIndex < 0 || probeTreeToolbarIndex > convertToLoopToolbarIndex) {
    throw new Error('expected Probe-Tree to render immediately before Convert to loop in the shared widget bubble toolbar')
  }
  const probeTreeCard = {
    id: 'care_source',
    title: 'Care Source',
    summary: 'check my hand, numb...',
    lane: 'Source',
    typeLabel: 'Input Widget',
    action: '',
    prompt: '',
    output: '',
    lanePropertyKey: 'lane',
    indexLabel: '',
    slugline: '',
    dialogue: '',
    style: '',
    tags: [],
    meta: [],
    invocationTokens: [],
    sourceModelLabel: '',
    sourcePromptLabel: '',
    href: '',
    media: null,
    references: [],
    order: 0,
    inputIndex: 0,
    candidateScore: 0,
    structural: false,
  } as Parameters<typeof resolveProbeTreeCardMaterializationRequestText>[0]
  const probeTreeInvocationText = resolveProbeTreeCardMaterializationRequestText(probeTreeCard)
  for (const expected of ['/knowgrph.probe-tree', 'Selected card id: care_source', 'response.structuredContent.cards']) {
    if (!probeTreeInvocationText.includes(expected)) throw new Error(`expected Probe-Tree toolbar invocation to include ${expected}`)
  }
  for (const forbidden of ['emitChatInputAppend', 'emitFloatingPanelOpen']) {
    if (probeTreeActionText.includes(forbidden)) {
      throw new Error(`expected Probe-Tree toolbar action to avoid FloatingPanel Chat route: ${forbidden}`)
    }
  }
  for (const expected of ['materializeProbeTreeBranchCards({ graphData: store.graphData, card })', 'setGraphDataPreservingLayout(result.graphData)', 'selectNodesExpanded({']) {
    if (!probeTreeActionText.includes(expected)) {
      throw new Error(`expected Probe-Tree toolbar action to materialize selectable cards on canvas: ${expected}`)
    }
  }
  const probeTreeGraph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'care_source', label: 'Care Source', type: 'Node', properties: { title: 'Care Source' } }],
    edges: [],
  }
  const materialized = materializeProbeTreeBranchCards({ graphData: probeTreeGraph, card: probeTreeCard })
  if (!materialized.changed || materialized.kind !== 'success') {
    throw new Error('expected Probe-Tree toolbar materialization to create selectable branch cards')
  }
  if (materialized.materializedNodeIds.length !== 3) {
    throw new Error(`expected Probe-Tree toolbar materialization to create 3 branch cards, got ${materialized.materializedNodeIds.length}`)
  }
  const materializedGraph = materialized.graphData
  const probeNodes = (materializedGraph?.nodes || []).filter(node => node.type === 'ProbeTreeCandidate')
  const candidateEdges = (materializedGraph?.edges || []).filter(edge => edge.label === 'candidateOption')
  if (probeNodes.length !== 3 || candidateEdges.length !== 3) {
    throw new Error('expected Probe-Tree toolbar materialization to create ProbeTreeCandidate nodes with candidateOption edges')
  }
  if (!probeNodes.every(node => node.properties.slashCommand === '/knowgrph.probe-tree' && node.properties.hashToken === '#knowgrph.probe-tree' && node.properties.atToken === '@knowgrph.probe-tree')) {
    throw new Error('expected Probe-Tree materialized cards to reuse shared slash, hash, and at invocation chips')
  }
  const graphMermaid = String((materializedGraph?.metadata || {}).probeTreeMermaidFlowchart || '')
  if (
    !graphMermaid.includes('flowchart TB')
    || !graphMermaid.includes('care_source["Care Source"]')
    || !graphMermaid.includes('-->|candidateOption|')
    || (materializedGraph?.metadata || {}).probeTreeMermaidFlowchartKind !== PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND
  ) {
    throw new Error(`expected Probe-Tree materialization to store the Storyboard to Mermaid flowchart mapping, got ${graphMermaid}`)
  }
  const rebuiltMermaid = buildProbeTreeStoryboardMermaidFlowchart({ graphData: materializedGraph, rootNodeId: 'care_source' })
  if (rebuiltMermaid !== graphMermaid) {
    throw new Error('expected Probe-Tree Mermaid mapping to be deterministic from graph data')
  }
  const roundTrippedGraph = parseProbeTreeStoryboardMermaidFlowchart(graphMermaid)
  const roundTripIds = new Set((roundTrippedGraph?.nodes || []).map(node => String(node.id || '')))
  if (!roundTripIds.has('care_source') || !materialized.materializedNodeIds.every(id => roundTripIds.has(id))) {
    throw new Error(`expected Mermaid flowchart to parse back into Storyboard graph node ids, got ${Array.from(roundTripIds).join(',')}`)
  }
  const roundTripCandidateEdges = (roundTrippedGraph?.edges || []).filter(edge => (
    edge.source === 'care_source'
    && edge.label === 'candidateOption'
    && materialized.materializedNodeIds.includes(String(edge.target || ''))
  ))
  if (roundTripCandidateEdges.length !== 3) {
    throw new Error(`expected Mermaid flowchart to parse back into 3 candidateOption edges, got ${JSON.stringify(roundTrippedGraph?.edges || [])}`)
  }
  const repeated = materializeProbeTreeBranchCards({ graphData: materializedGraph, card: probeTreeCard })
  if (repeated.changed) {
    throw new Error('expected Probe-Tree materialization to reselect existing cards instead of duplicating them')
  }
  if (!toolbarText.includes('GRAPH_FIELDS_ENTRY_SHORTCUT_NODE_LABEL')) {
    throw new Error('expected Open sidepane to reuse the shared Graph Fields node entry label instead of a local literal')
  }
  if (!toolbarText.includes("workflowManagerEntryLabel: GRAPH_FIELDS_ENTRY_SHORTCUT_NODE_LABEL")) {
    throw new Error('expected Open sidepane to deep-link into the Workflow Manager node entry target')
  }
  if (toolbarText.includes("emitFloatingPanelOpen({ tab: 'node', open: true })")) {
    throw new Error('expected Open sidepane to stop using the ambiguous floating-panel node route')
  }
  if (!overlaySurfaceText.includes('openWorkflowManagerMappingForNode({')) {
    throw new Error('expected Update KV entry to reuse the shared mapping-open helper instead of inlining a local route')
  }
  for (const snippet of [
    'const resolvedWidgetRegistryEntry = resolveWidgetRegistryEntry({',
    'const widgetIdentity = resolveWidgetIdentity({',
    "workflowManagerTab: 'mapping' as const",
    '...(searchQuery ? { searchQuery } : {}),',
  ]) {
    if (!openMappingHelperText.includes(snippet)) {
      throw new Error(`expected shared mapping-open helper snippet: ${snippet}`)
    }
  }
  if (!copyText.includes("flowWidgetRun: 'Run'")) {
    throw new Error('expected shared UI copy to expose a Run label for the widget tiny floating toolbar')
  }
  for (const snippet of [
    "flowWidgetOpenInSidepane: 'Open sidepane'",
    "flowWidgetProbeTree: 'Probe-Tree'",
    "flowWidgetConvertToLoop: 'Convert to loop'",
    "flowWidgetDuplicate: 'Duplicate'",
    "flowWidgetClearOutput: 'Reset'",
    "flowWidgetRemoveNode: 'Remove'",
  ]) {
    if (!copyText.includes(snippet)) {
      throw new Error(`expected shared widget toolbar copy snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    "updateKvEntry: 'Update KV entry'",
    "openInSidepane: 'Open sidepane'",
    "probeTree: 'Probe-Tree'",
    "convertToLoopNode: 'Convert to loop'",
    "clearOutput: 'Reset'",
    "removeNode: 'Remove'",
  ]) {
    if (!metaText.includes(snippet)) {
      throw new Error(`expected shared widget toolbar meta label snippet: ${snippet}`)
    }
  }
}

export function testStoryboardWidgetToolbarViewportShiftKeepsActionsReachable() {
  const centered = computeViewportSafeInlineCenterShiftPx({
    anchorCenterPx: 160,
    elementWidthPx: 240,
    viewportWidthPx: 320,
    marginPx: 8,
  })
  if (centered !== 0) {
    throw new Error(`expected centered toolbar to avoid unnecessary shift, got ${centered}`)
  }

  const left = computeViewportSafeInlineCenterShiftPx({
    anchorCenterPx: 24,
    elementWidthPx: 260,
    viewportWidthPx: 320,
    marginPx: 8,
  })
  if (!(left > 0) || Math.abs(24 + left - 138) > 0.001) {
    throw new Error(`expected left-edge toolbar to shift into the viewport, got ${left}`)
  }

  const right = computeViewportSafeInlineCenterShiftPx({
    anchorCenterPx: 300,
    elementWidthPx: 260,
    viewportWidthPx: 320,
    marginPx: 8,
  })
  if (!(right < 0) || Math.abs(300 + right - 182) > 0.001) {
    throw new Error(`expected right-edge toolbar to shift into the viewport, got ${right}`)
  }

  const oversized = computeViewportSafeInlineCenterShiftPx({
    anchorCenterPx: 24,
    elementWidthPx: 640,
    viewportWidthPx: 320,
    marginPx: 8,
  })
  if (Math.abs(24 + oversized - 160) > 0.001) {
    throw new Error(`expected oversized toolbar to center within the available viewport, got ${oversized}`)
  }
}
