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
  const commandMenus = readUtf8('../lib/cards/CardInlineTextCommandMenus.tsx')
  const blockInlineMenus = readUtf8('../lib/markdown-core/ui/markdownBlockContainerCore.inlineMenusOverlay.tsx')
  const commandCatalog = readUtf8('../lib/command-menu/inlineCommandMenuCatalog.ts')
  const storyboardModel = readUtf8('../components/StoryboardCanvas/storyboardModel.ts')

  for (const snippet of [
    'PlainTextInputEditor',
    'CardInlineTextCommandMenus',
    'markdownCommandMenus = true',
    'markdownCommandMenus !== false && multiline === true',
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
  for (const snippet of [
    'MarkdownBlockContainerCommandMenu',
    'Slash commands',
    'Variable commands',
    'buildMarkdownVariableToken',
    'INLINE_SLASH_COMMAND_ACTIONS',
    'INLINE_VARIABLE_COMMAND_ACTIONS',
    'INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID',
    'INLINE_MEDIA_VARIABLE_KEY_BY_ACTION_ID',
    'parseInlineVariableCommandQuery',
    'collectInlineMediaCommandCandidates',
    'buildInlineMediaEmbed',
    'thumbnailKind: candidate.kind',
    'thumbnailUrl: candidate.thumbnailUrl',
    'fallbackCandidate?.thumbnailUrl',
    'insert-image',
    'insert-video',
  ]) {
    if (!commandMenus.includes(snippet)) {
      throw new Error(`expected shared card command menu contract snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    'INLINE_SLASH_COMMAND_ACTIONS',
    'INLINE_VARIABLE_COMMAND_ACTIONS',
    'INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID',
    'INLINE_MEDIA_VARIABLE_KEY_BY_ACTION_ID',
    'mediaCommandCandidates',
    'applyMediaCommandCandidate(candidate)',
    'thumbnailKind: candidate.kind',
    'thumbnailUrl: candidate.thumbnailUrl',
    'fallbackCandidate ? applyMediaCommandCandidate(fallbackCandidate) : applyTurnInto(kind)',
    'applyTurnInto(kind)',
  ]) {
    if (!blockInlineMenus.includes(snippet)) {
      throw new Error(`expected markdown block command menu to reuse shared inline command catalog: ${snippet}`)
    }
  }
  for (const snippet of [
    'INLINE_SLASH_COMMAND_ACTIONS',
    'INLINE_VARIABLE_COMMAND_ACTIONS',
    'INLINE_MEDIA_COMMAND_ENTRY_LABELS',
    'INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID',
    'INLINE_MEDIA_VARIABLE_KEY_BY_ACTION_ID',
    'collectInlineMediaCommandCandidates',
    'buildInlineMediaEmbed',
    'resolveInlineMediaThumbnailUrl',
    'parseInlineVariableCommandQuery',
    'isInlineVariableKey',
  ]) {
    if (!commandCatalog.includes(snippet)) {
      throw new Error(`expected shared inline command catalog to own ${snippet}`)
    }
  }
  for (const snippet of [
    'buildStoryboardInlineMediaCommandContext',
    'STORYBOARD_INLINE_MEDIA_CONTEXT_VIDEO_KINDS',
    "pushUrl('videoUrl', media.sourceUrl || media.url)",
    "pushUrl('thumbnailUrl', media.thumbnailUrl)",
  ]) {
    if (!storyboardModel.includes(snippet)) {
      throw new Error(`expected Storyboard model to own inline media command context snippet: ${snippet}`)
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
    'setGraphDataPreservingLayout({',
    'nodes: graphData.nodes.map(node =>',
  ]) {
    if (!storyboard.includes(snippet)) {
      throw new Error(`expected storyboard inline editing to canonicalize text properties through shared property keys: ${snippet}`)
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
