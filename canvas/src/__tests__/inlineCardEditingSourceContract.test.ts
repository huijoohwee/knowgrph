import { readFileSync } from 'node:fs'

const readUtf8 = (relativePath: string) => {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

export function testInlineCardEditingStaysSharedAcrossSurfaces() {
  const sharedEditor = readUtf8('../lib/cards/CardInlineTextEditor.tsx')
  const animatic = readUtf8('../components/AnimaticCanvas.tsx')
  const markdownKanban = readUtf8('../features/markdown/ui/kanban/KanbanCard.tsx')
  const graphKanban = readUtf8('../features/graph-table/ui/GraphTableKanbanView.tsx')
  const graphWorkspaceLeft = readUtf8('../features/graph-table/ui/GraphTableWorkspaceLeft.tsx')
  const flowEditorInspector = readUtf8('../components/FlowEditor/FlowEditorInspector.tsx')
  const storyboard = readUtf8('../components/StoryboardCanvas.tsx')
  const sharedCardFields = readUtf8('../lib/cards/graphNodeCardFields.ts')
  const graphStoreSync = readUtf8('../features/graph-table/lib/applyCellUpdateToGraphStore.ts')
  const graphTableDb = readUtf8('../lib/graph-table-db/graphTableDb.impl.ts')

  for (const snippet of [
    'PlainTextInputEditor',
    'onDoubleClick',
    'editActivation',
    "editActivation = 'doubleClick'",
    "editActivation !== 'click'",
    'event.key === \'Escape\'',
    'event.key === \'Enter\' && (event.metaKey || event.ctrlKey)',
    'editRequestKey',
    'onEditingChange',
  ]) {
    if (!sharedEditor.includes(snippet)) {
      throw new Error(`expected shared inline card editor contract snippet: ${snippet}`)
    }
  }

  for (const text of [animatic, markdownKanban, graphKanban, flowEditorInspector, storyboard]) {
    if (!text.includes('CardInlineTextEditor')) {
      throw new Error('expected all card surfaces to reuse the shared inline card editor')
    }
  }

  for (const snippet of [
    'GRAPH_NODE_CARD_TEXT_FIELDS',
    'GRAPH_NODE_CARD_OUTPUT_PROPERTY_KEYS',
    'buildGraphNodeCanonicalTextPatch',
    'readGraphNodeCardTitle',
  ]) {
    if (!sharedCardFields.includes(snippet)) {
      throw new Error(`expected shared graph-node card field helper snippet: ${snippet}`)
    }
  }

  if (!graphKanban.includes('onUpdateCell?: (rowId: string, columnId: string, nextValue: unknown) => void')) {
    throw new Error('expected workflow kanban surface to own inline cell updates through a shared callback')
  }
  if (!graphWorkspaceLeft.includes('onUpdateCell={props.onCellValueChanged}')) {
    throw new Error('expected workflow kanban owner to wire inline card edits into the existing graph-table cell write path')
  }

  for (const snippet of [
    'updateStoryboardCanonicalProperty',
    'STORYBOARD_SUMMARY_PROPERTY_KEYS',
    'STORYBOARD_OUTPUT_PROPERTY_KEYS',
    'STORYBOARD_ACTION_PROPERTY_KEYS',
    'STORYBOARD_DIALOGUE_PROPERTY_KEYS',
    "canonicalKey: 'summary'",
    "canonicalKey: 'output'",
    "canonicalKey: 'action'",
    "canonicalKey: 'dialogue'",
  ]) {
    if (!storyboard.includes(snippet)) {
      throw new Error(`expected storyboard inline editing to canonicalize text properties through shared aliases: ${snippet}`)
    }
  }

  if (!flowEditorInspector.includes('onPatchSelectedNodeProperties')) {
    throw new Error('expected Flow Editor inspector to commit shared card edits through the selected-node property owner callback')
  }
  if (!flowEditorInspector.includes('editActivation="click"')) {
    throw new Error('expected Flow Editor Card inspector to allow inline editing through the shared CardInlineTextEditor activation contract')
  }
  for (const snippet of ['beatEditSession', 'handleCommitBeatFieldEdit', 'commitTimelineFrontmatterMeta', 'updateGraphMetadata({', "updateNode(resolvedNodeId, {"]) {
    if (!animatic.includes(snippet)) {
      throw new Error(`expected Animatic to route shared card edits and timeline mutations through graph-owned upstream owners: ${snippet}`)
    }
  }

  if (!graphStoreSync.includes("if (normalizedValue == null) delete properties[key]")) {
    throw new Error('expected graph-store sync to delete cleared inline card values instead of persisting stale blanks')
  }
  if (!graphTableDb.includes('if (normalizedValue == null) delete data[columnId]')) {
    throw new Error('expected graph-table db writes to delete cleared inline card values at the source row document')
  }
}
