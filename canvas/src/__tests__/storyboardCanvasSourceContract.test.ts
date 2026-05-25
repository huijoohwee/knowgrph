import { readFileSync } from 'node:fs'

export function testStoryboardCanvasKeepsNativeRendererContract() {
  const source = readFileSync(new URL('../components/StoryboardCanvas.tsx', import.meta.url), 'utf8')
  for (const snippet of [
    'Visual Brief',
    'Reference Pack',
    'selectNode(card.id)',
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
  for (const forbidden of ['boords', 'peacock.boords.com', 'app.boords.com']) {
    if (source.toLowerCase().includes(forbidden)) {
      throw new Error(`expected StoryboardCanvas to avoid copied vendor reference: ${forbidden}`)
    }
  }
}
