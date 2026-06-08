import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveFlowEditorAutoRunNodeIds } from '@/components/FlowEditorCanvas/runtime/flowEditorAutoRunTargets'
import type { GraphData } from '@/lib/graph/types'

export function testFlowEditorNodeDraftUpdatesRefBeforeRunStoreWriteback() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorNodeDraftActions.ts'), 'utf8')
  const draftWrite = 'args.draftGraphDataRef.current = bumpFlowEditorDraftGraphDataRevision('
  const storeWrite = 'args.updateNode(id, patch)'

  if (!text.includes('const updateNodeById = React.useCallback((nodeId: string, patch: Partial<GraphNode>) => {')
    || !text.includes(draftWrite)
    || !text.includes('const readDraftMutationRevisionFloor = React.useCallback((): number => {')
    || !text.includes('{ revisionFloor: readDraftMutationRevisionFloor() },')
    || !text.includes(storeWrite)
    || text.indexOf(draftWrite) > text.indexOf(storeWrite)) {
    throw new Error('expected Flow Editor node property commits to update the live draft graph ref before store writeback so Run All cannot read stale KTV values')
  }
}

export function testFlowEditorPropertyPatchesPreferLiveDraftBeforeStoreGraph() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorNodeDraftActions.ts'), 'utf8')
  const liveDraftRead = 'const cur = args.draftGraphDataRef.current || args.draftGraphData || useGraphStore.getState().graphData'
  const patchWrite = 'updateNodeById(id, { properties: nextProps as never })'

  if (!text.includes(liveDraftRead) || !text.includes(patchWrite) || text.indexOf(liveDraftRead) > text.indexOf(patchWrite)) {
    throw new Error('expected Flow Editor KTV property patches to merge from the live draft graph before falling back to the indexed store graph')
  }
}

export function testFlowEditorAutoRunSchedulesAfterWidgetPropertyCommit() {
  const actionsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorNodeDraftActions.ts'), 'utf8')
  const runtimeText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx'), 'utf8')
  const autoTargetsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorAutoRunTargets.ts'), 'utf8')
  const runModeRead = 'canvasRunMode, collapsedGroupIds'
  const callback = 'const handleNodePropertiesCommittedForAutoRun = React.useCallback((nodeId: string, changedPropertyKeys?: ReadonlyArray<string>) => {'
  const targetResolver = 'resolveFlowEditorAutoRunNodeIds({'
  const downstreamResolver = 'resolveFlowEditorWorkflowDownstreamRunTargetIds({'
  const runnableFilter = 'isFlowEditorWorkflowRunnableNode({'
  const sourcePortFilter = "const sourcePortKey = readFlowEdgePortKey(edge, 'source') || ''"
  const autoGate = "if (canvasRunMode !== 'auto') return"
  const callbackProp = 'onNodePropertiesCommittedForAutoRun?: (nodeId: string, changedPropertyKeys?: ReadonlyArray<string>) => void'
  const callbackPass = 'onNodePropertiesCommittedForAutoRun: handleNodePropertiesCommittedForAutoRun'

  for (const [source, snippet] of [
    [runtimeText, runModeRead],
    [runtimeText, callback],
    [runtimeText, autoGate],
    [runtimeText, targetResolver],
    [runtimeText, 'changedPropertyKeys,'],
    [runtimeText, callbackPass],
    [actionsText, callbackProp],
    [actionsText, 'args.onNodePropertiesCommittedForAutoRun?.(id, changedPropertyKeys)'],
    [autoTargetsText, downstreamResolver],
    [autoTargetsText, runnableFilter],
    [autoTargetsText, sourcePortFilter],
    [autoTargetsText, 'if (shouldScopeToChangedProperties) return downstreamTargetIds'],
  ] as const) {
    if (!source.includes(snippet)) {
      throw new Error(`expected Flow Editor Auto Run to schedule from shared widget property commits: ${snippet}`)
    }
  }
  if (!runtimeText.includes('for (const targetNodeId of targetNodeIds) {') || !runtimeText.includes('void runWorkflowNodeRef.current(targetNodeId)')) {
    throw new Error('expected Auto Run to execute resolved downstream runnable node ids, not only the edited source node')
  }
  const patchWrapperIndex = actionsText.indexOf('const patchNodePropertiesById = React.useCallback((nodeId: string, patch: Record<string, unknown>) => {')
  const setWrapperIndex = actionsText.indexOf('const setNodePropertiesById = React.useCallback((nodeId: string, properties: Record<string, unknown>) => {')
  const patchWrapperBlock = actionsText.slice(patchWrapperIndex, actionsText.indexOf('const patchSelectedNodeProperties'))
  const setWrapperBlock = actionsText.slice(setWrapperIndex, actionsText.indexOf('const validateNodeById'))
  if (patchWrapperBlock.indexOf('patchNodePropertiesById(nodeId, patch)') > patchWrapperBlock.indexOf('scheduleAutoRunNode(nodeId)')) {
    throw new Error('unexpected stale overlay-level Auto Run scheduler remains in patch wrapper')
  }
  if (patchWrapperBlock.indexOf('updateNodeById(id, { properties: nextProps as never })') > patchWrapperBlock.indexOf('args.onNodePropertiesCommittedForAutoRun?.(id, changedPropertyKeys)')) {
    throw new Error('expected property patch auto-run callback after live draft ref update')
  }
  if (setWrapperBlock.indexOf('updateNodeById(id, { properties: nextProps as never })') > setWrapperBlock.indexOf('args.onNodePropertiesCommittedForAutoRun?.(id, changedPropertyKeys)')) {
    throw new Error('expected property set auto-run callback after live draft ref update')
  }
}

export function testFlowEditorRunTargetResolverPrefersDownstreamRunnableTargets() {
  const graphData: GraphData = {
    type: 'flow',
    nodes: [
      {
        id: 'source_input',
        type: 'templateInput',
        label: 'Source Input',
        x: 0,
        y: 0,
        properties: {},
      },
      {
        id: 'compute_summary',
        type: 'templateNode',
        label: 'Compute Summary',
        x: 220,
        y: 0,
        properties: {
          'flow:compute': 'inputs => ({ output: String(inputs?.input_metric_target || "") })',
        },
      },
    ],
    edges: [
      {
        id: 'source_to_compute',
        label: '',
        source: 'source_input',
        target: 'compute_summary',
        properties: {
          'flow:sourcePortKey': 'input_metric_target',
          'flow:targetPortKey': 'input_metric_target',
        },
      },
    ],
  }

  const targetIds = resolveFlowEditorAutoRunNodeIds({ graphData, nodeId: 'source_input' })
  if (targetIds.length !== 1 || targetIds[0] !== 'compute_summary') {
    throw new Error(`expected Widget Run resolver to target downstream runnable compute node, got ${JSON.stringify(targetIds)}`)
  }
  const changedDataTargetIds = resolveFlowEditorAutoRunNodeIds({
    graphData,
    nodeId: 'source_input',
    changedPropertyKeys: ['input_metric_target'],
  })
  if (changedDataTargetIds.length !== 1 || changedDataTargetIds[0] !== 'compute_summary') {
    throw new Error(`expected Auto Run resolver to target connected downstream runnable compute node for changed data port, got ${JSON.stringify(changedDataTargetIds)}`)
  }
  const changedWidgetMetadataTargetIds = resolveFlowEditorAutoRunNodeIds({
    graphData,
    nodeId: 'source_input',
    changedPropertyKeys: ['canvas:widgetCard'],
  })
  if (changedWidgetMetadataTargetIds.length !== 0) {
    throw new Error(`expected Auto Run resolver to ignore widget metadata property commits, got ${JSON.stringify(changedWidgetMetadataTargetIds)}`)
  }
  const noChangeTargetIds = resolveFlowEditorAutoRunNodeIds({
    graphData,
    nodeId: 'source_input',
    changedPropertyKeys: [],
  })
  if (noChangeTargetIds.length !== 0) {
    throw new Error(`expected Auto Run resolver to ignore no-op property commits, got ${JSON.stringify(noChangeTargetIds)}`)
  }
}

export function testFlowEditorRunCommitsActiveSharedInlineEditorBeforeRun() {
  const toolbarText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx'), 'utf8')
  const overlayElementsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx'), 'utf8')
  const renderGraphText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts'), 'utf8')
  const cardInlineText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'cards', 'CardInlineTextEditor.tsx'), 'utf8')
  const plainTextInput = readFileSync(resolve(process.cwd(), 'src', 'components', 'ui', 'PlainTextInputEditor.tsx'), 'utf8')

  for (const snippet of [
    'export function commitActiveCardInlineTextEditor(ownerDocument?: Document | null): boolean {',
    "const CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE = 'data-kg-card-inline-edit-input'",
    'active.blur()',
    "dataAttributes={{ [CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE]: '1' }}",
  ]) {
    if (!cardInlineText.includes(snippet)) {
      throw new Error(`expected shared CardInlineTextEditor to expose active-editor commit contract: ${snippet}`)
    }
  }
  if (!plainTextInput.includes('dataAttributes?: Record<`data-${string}`, string | number | boolean | undefined>') || !plainTextInput.includes('{...dataAttributes}')) {
    throw new Error('expected PlainTextInputEditor to preserve generic data attributes for shared inline editor commit markers')
  }
  if (!toolbarText.includes("import { commitActiveCardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'")
    || !toolbarText.includes('onPointerDown={() => {')
    || !toolbarText.includes('commitActiveCardInlineTextEditor()')
    || toolbarText.indexOf('commitActiveCardInlineTextEditor()') > toolbarText.indexOf('onClick={onRun}')) {
    throw new Error('expected Flow Editor Run action to commit the active shared inline editor before invoking Run')
  }
  if (!overlayElementsText.includes('const graphDataForRunResolution = args.draftGraphDataRef?.current')
    || !overlayElementsText.includes('const targetNodeIds = resolveFlowEditorAutoRunNodeIds({')
    || !overlayElementsText.includes('nodeId: actionNodeId')
    || !overlayElementsText.includes('for (const targetNodeId of targetNodeIds) {')
    || !overlayElementsText.includes('void args.runWorkflowNode(targetNodeId)')) {
    throw new Error('expected Widget Run to reuse shared downstream runnable target resolution after committing the active KTV edit')
  }
  if (!overlayElementsText.includes('draftGraphDataRef?: React.MutableRefObject<GraphData | null>')) {
    throw new Error('expected Widget Run to resolve downstream runnable targets from the live draft graph after KTV edits')
  }
  for (const snippet of [
    "String(draftLookup?.revision ?? args.draftGraphRevision ?? '')",
    "String(renderLookup?.revision ?? args.renderGraphRevision ?? '')",
  ]) {
    if (!renderGraphText.includes(snippet)) {
      throw new Error(`expected workflow run-target resolution cache to include graph revisions so KTV edits cannot reuse stale run graphs: ${snippet}`)
    }
  }
}
