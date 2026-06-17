import { readFileSync } from 'node:fs'

export function testStoryboardCanvasKeepsNativeRendererContract() {
  const source = readFileSync(new URL('../components/StoryboardCanvas.tsx', import.meta.url), 'utf8')
  for (const snippet of [
    'Visual Brief',
    'Reference Pack',
    'buildMarkdownMediaDownloadHref',
    'data-kg-storyboard-reference-download="1"',
    'StoryboardMentionPill',
    'CARD_MARKDOWN_PREVIEW_CHIP_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME',
    'resolveStoryboardActionTarget',
    "from '@/components/StoryboardCanvas/storyboardSelectAction'",
    'runStoryboardSelectAction({',
    'const selectStoryboardCardFromCanvas = () => runStoryboardSelectAction({',
    'onFocusCapture={() => {',
    'isCanonicalNodeIdEqual(selectedNodeId, resolvedCardNodeId)',
    'buildStoryboardBoardModel',
    'useKanbanDragAndDrop',
    'reorderKanbanRowIds',
    'data-kg-kanban-card-drag-region="1"',
    '...currentProperties',
    'aria-label={`Select storyboard card ${displayTitle}`}',
    "const toastId = 'storyboard:drag-status'",
    'upsertUiToast({',
    'dismissUiToast(toastId)',
    'const cardDragProps = storyboardDrag.createCardDragProps({ rowId: card.id, groupKey: lane.id })',
    'draggable={cardDragProps.draggable}',
    'onDragStart={cardDragProps.onDragStart}',
    'onDragEnd={cardDragProps.onDragEnd}',
    'const isStoryboardMoveNoOp = React.useCallback',
    'const currentSourceGroupKey = rowIdToLaneKey.get(move.rowId) || move.sourceGroupKey || \'\'',
    'const nextOrderedRowIds = reorderKanbanRowIds({',
    'isNoOpMove: isStoryboardMoveNoOp',
    'editActivation="click"',
    'NodeOverlayEditorActionsToolbar',
    'resolveStoryboardCardPrimaryReferenceUrl',
    'buildStoryboardGraphBackedNodeLookup',
    "from '@/components/StoryboardCanvas/storyboardDuplicateAction'",
    "from '@/components/StoryboardCanvas/storyboardHelpAction'",
    "from '@/components/StoryboardCanvas/storyboardOpenSidepaneAction'",
    "from '@/components/StoryboardCanvas/storyboardRunAction'",
    "from '@/components/StoryboardCanvas/storyboardClearOutputAction'",
    "from '@/components/StoryboardCanvas/storyboardConvertLoopAction'",
    "from '@/components/StoryboardCanvas/storyboardRemoveAction'",
    "from '@/components/StoryboardCanvas/storyboardSelectAction'",
    "from '@/components/StoryboardCanvas/storyboardUpdateKvEntryAction'",
    "from '@/components/StoryboardCanvas/storyboardDuplicateRouting'",
    'runCard: runStoryboardCard',
    'runStoryboardWorkflowNode',
    'duplicateCard: duplicateStoryboardCard',
    'hasStrybldrStoryboardDuplicatePath',
    'const canUseStrybldrStoryboardDuplicatePathForCard = React.useCallback((card: StoryboardCardModel) => {',
    'return canUseStrybldrStoryboardDuplicatePath({',
    'runStoryboardDuplicateAction({',
    'canUseStrybldrDuplicatePath: canUseStrybldrStoryboardDuplicatePathForCard(card)',
    'commitStrybldrMutation: ({ nextMarkdownText, nextSelectedNodeId }) => commitStoryboardMarkdownMutation({',
    'commitMarkdownMutation: nextMarkdownText => commitStoryboardMarkdownMutation({',
    'const canDuplicateStoryboardCard = React.useCallback((card: StoryboardCardModel) => {',
    'getDocumentLocationFromMetadata(sourceNode?.metadata)',
    'duplicatedResult.handled',
    'selectNode: nextSelectedNodeId => selectNode(String(nextSelectedNodeId))',
    "const isMarkdownBackedCard = sourceId.startsWith('blk:md:')",
    "message: 'Duplicate is unavailable for markdown-backed storyboard cards until a durable document duplicate path is available.'",
    'duplicateDisabled: !canDuplicateStoryboardCard(card)',
    'clearCardOutput: clearStoryboardCardOutput',
    'runStoryboardClearOutputAction({',
    'showStoryboardCardHelp',
    'buildStoryboardHelpToast({',
    'openCardInSidepane: openStoryboardCardInSidepane',
    "from '@/components/StoryboardCanvas/storyboardToolbarActionBindings'",
    "from '@/components/StoryboardCanvas/storyboardToolbarProps'",
    'const toolbarProps = buildStoryboardToolbarProps({',
    'const toolbarActionBindings = buildStoryboardToolbarActionBindings({',
    '{...toolbarProps}',
    '{...toolbarActionBindings}',
    'runStoryboardOpenSidepaneAction({',
    'runStoryboardRunAction({',
    'removeCard: removeStoryboardCard',
    'runStoryboardRemoveAction({',
    'const openStoryboardCardWorkflowManagerMapping = React.useCallback((card: StoryboardCardModel) => {',
    'openCardWorkflowManagerMapping: openStoryboardCardWorkflowManagerMapping',
    'runStoryboardUpdateKvEntryAction({',
    'openMappingForNode: openWorkflowManagerMappingForNode',
    'registry: widgetRegistry',
    'graphMetaKind: storyboardRunBaseGraphKind',
    'convertCardToLoop: convertStoryboardCardToLoop',
    'runStoryboardConvertLoopAction({',
    'removeStrybldrStoryboardMarkdownElement',
    'commitStoryboardMarkdownMutation({',
    'runNode: runStoryboardWorkflowNode',
  ]) {
    if (!source.includes(snippet)) {
      throw new Error(`expected StoryboardCanvas to retain native storyboard contract snippet: ${snippet}`)
    }
  }
  if (source.includes('const statusPillText = activeDragStatusText || storyboardDrag.dragOutcomeMessage')) {
    throw new Error('expected StoryboardCanvas to route drag status through the shared toast host instead of a local top-left status pill')
  }
  if (source.includes('{...storyboardDrag.createCardDragProps({ rowId: card.id, groupKey: lane.id })}')) {
    throw new Error('expected StoryboardCanvas to avoid per-subsection drag-owner duplication and keep one shared drag owner on the card shell')
  }
  if (source.includes('if (hasStrybldrStoryboardDuplicatePath) return true')) {
    throw new Error('expected StoryboardCanvas duplicate routing to avoid document-wide Strybldr short-circuiting')
  }
  if (source.includes('const nextMarkdownId = hasStrybldrStoryboardDuplicatePath')) {
    throw new Error('expected StoryboardCanvas duplicate routing to choose the Strybldr append path per card')
  }
  if (source.includes('const nextMarkdownId = canUseStrybldrStoryboardDuplicatePathForCard(card)')) {
    throw new Error('expected StoryboardCanvas to centralize Strybldr duplicate markdown-id allocation in the shared action helper')
  }
  if (source.includes('runStoryboardStrybldrDuplicateAction({') || source.includes('runStoryboardMarkdownDuplicateAction({')) {
    throw new Error('expected StoryboardCanvas to route both duplicate branches through one shared duplicate action helper')
  }
  if (source.includes('const converted = convertNodeToLoopInGraphData(graphData, resolvedCardNodeId)')) {
    throw new Error('expected StoryboardCanvas to centralize convert-to-loop graph mutation in the shared convert-loop action helper')
  }
  if (source.includes("updateStoryboardCanonicalProperty({\n      cardId: card.id,\n      propertyKeys: STORYBOARD_OUTPUT_PROPERTY_KEYS,")) {
    throw new Error('expected StoryboardCanvas to centralize clear-output choreography in the shared clear-output action helper')
  }
  if (source.includes("id: 'storyboard-widget-help'") && source.includes('const showStoryboardCardHelp = React.useCallback(() => {')) {
    throw new Error('expected StoryboardCanvas to centralize help toast payload construction in the shared help action helper')
  }
  if (source.includes("const selectStoryboardCardFromCanvas = () => {\n                      setSelectionSource('canvas')")) {
    throw new Error('expected StoryboardCanvas to centralize card-shell canvas selection choreography in the shared select action helper')
  }
  if (source.includes("const openStoryboardCardInSidepane = React.useCallback((card: StoryboardCardModel) => {\n    const { resolvedCardNodeId } = resolveStoryboardActionTarget(card.id)\n    setSelectionSource('canvas')")) {
    throw new Error('expected StoryboardCanvas to centralize open-sidepane selection choreography in the shared open-sidepane action helper')
  }
  if (source.includes("onOpenInSidepane={() => {\n                                openStoryboardCardInSidepane(card)\n                              }}")) {
    throw new Error('expected StoryboardCanvas to keep the open-sidepane toolbar binder as a thin direct callback')
  }
  if (source.includes('onRun={() => runStoryboardCard(card)}') || source.includes('onDuplicate={() => duplicateStoryboardCard(card)}') || source.includes('onClearOutput={() => clearStoryboardCardOutput(card)}') || source.includes('onRemove={() => removeStoryboardCard(card)}') || source.includes('onUpdateKvEntry={() => openStoryboardCardWorkflowManagerMapping(card)}') || source.includes('onConvertToLoopNode={() => convertStoryboardCardToLoop(card)}')) {
    throw new Error('expected StoryboardCanvas to centralize per-card toolbar action lambdas in the shared toolbar binding helper')
  }
  if (source.includes('ariaLabel="Storyboard card actions"') || source.includes('navClassName="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2"') || source.includes("navStyle={{ pointerEvents: 'auto' }}") || source.includes('iconSizeClass="h-3.5 w-3.5"') || source.includes('iconStrokeWidth={1.8}') || source.includes('convertToLoopDisabled={false}') || source.includes('enableHandlesDisabled') || source.includes("actionVisibility={{\n                                enableHandles: false,\n                              }}") || source.includes("openExternalAction={buildNodeOverlayOpenExternalAction({")) {
    throw new Error('expected StoryboardCanvas to centralize toolbar visual and presentation prop construction in the shared toolbar props helper')
  }
  if (source.includes('onEnableHandlesForAllInputs={() => { void 0 }}')) {
    throw new Error('expected StoryboardCanvas to avoid no-op enable-handles binders when the action is hidden')
  }
  if (source.includes("message: 'Run is available in Flow Editor for runnable graph-backed nodes.'") && source.includes('const runStoryboardCard = React.useCallback((card: StoryboardCardModel) => {')) {
    throw new Error('expected StoryboardCanvas to centralize storyboard run unavailable toast construction in the shared run action helper')
  }
  if (source.includes('void runStoryboardWorkflowNode(resolvedCardNodeId)')) {
    throw new Error('expected StoryboardCanvas to centralize storyboard run choreography in the shared run action helper')
  }
  if (source.includes("window.open(primaryReferenceUrl, '_blank', 'noopener,noreferrer')")) {
    throw new Error('expected StoryboardCanvas to centralize toolbar open-external choreography in the shared node-overlay external action helper')
  }
  if (source.includes("onUpdateKvEntry={() => {\n                                const { sourceNode } = resolveStoryboardActionTarget(card.id)\n                                runStoryboardUpdateKvEntryAction({")) {
    throw new Error('expected StoryboardCanvas to centralize update-KV-entry choreography in the shared update-KV-entry action helper')
  }
  if (source.includes('const nextMarkdownText = removeStrybldrStoryboardMarkdownElement({')) {
    throw new Error('expected StoryboardCanvas to centralize storyboard remove branch choreography in the shared remove action helper')
  }
  if (source.includes('const strybldrRunId = readStoryboardScalar(sourceProperties.strybldrRunId)')) {
    throw new Error('expected StoryboardCanvas to centralize duplicate-path Strybldr metadata checks in the shared helper')
  }
  if (source.includes('const duplicatedRange = duplicateMarkdownLineRange({')) {
    throw new Error('expected StoryboardCanvas to centralize markdown duplicate line-range work in the shared helper')
  }
  if (source.includes('const duplicatedNodeId = committedNodes.find(node => {')) {
    throw new Error('expected StoryboardCanvas to centralize markdown duplicate reselection in the shared helper')
  }
  if (!source.includes("STORYBOARD_BRANCH_ACTION_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4'") || !source.includes("STORYBOARD_SCORECARD_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2'")) {
    throw new Error('expected StoryboardCanvas storytree and scorecard grids to use mobile-first responsive owners')
  }
  if (source.includes('grid grid-cols-4 gap-1.5') || source.includes('grid grid-cols-2 gap-1.5 text-[11px]')) {
    throw new Error('expected StoryboardCanvas to avoid fixed mobile storytree and scorecard grid literals')
  }
  for (const forbidden of ['boords', 'peacock.boords.com', 'app.boords.com']) {
    if (source.toLowerCase().includes(forbidden)) {
      throw new Error(`expected StoryboardCanvas to avoid copied vendor reference: ${forbidden}`)
    }
  }
}
