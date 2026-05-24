import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const normalizeSpace = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim()

export function testAnimationCanvasRetainsNativeRunnerAutoScrollSwitchContract() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  const orderedSnippets = [
    '<div className="player-config">',
    'type="button"',
    'role="switch"',
    'aria-checked={runtimeAutoScrollEnabled}',
    "className={runtimeAutoScrollEnabled ? 'ant-switch ant-switch-checked' : 'ant-switch'}",
    'ant-click-animating="true"',
    'style={{ marginBottom: 20 }}',
    '<div className="ant-switch-handle"></div>',
    '<span className="ant-switch-inner">Enable Runtime Auto Scroll</span>',
    '<div className="ant-click-animating-node"></div>',
  ] as const
  for (const snippet of orderedSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas to retain runner switch contract snippet: ${snippet}`)
    }
  }
  let previousIndex = -1
  const normalizedText = normalizeSpace(text)
  for (const snippet of orderedSnippets.map(normalizeSpace)) {
    const nextIndex = normalizedText.indexOf(snippet, previousIndex + 1)
    if (nextIndex < 0) {
      throw new Error(`expected AnimationCanvas ordered switch contract snippet to appear after the prior snippet: ${snippet}`)
    }
    previousIndex = nextIndex
  }
}

export function testAnimationCanvasRetainsReferencePlayerAndTimelineShellContract() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  for (const snippet of [
    'const SCALE_ROW_HEIGHT_PX = 32',
    'const LANE_ROW_HEIGHT_PX = 32',
    "useMediaQuery('(max-width: 768px), (pointer: coarse)')",
    'uiToolbarRowScrollClassName',
    'uiToolbarResponsiveRowScrollClassName',
    'uiToolbarTouchRowScrollClassName',
    'UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME',
    "touchAction: 'pan-x manipulation'",
    '<div className="timeline-player">',
    'className="play-control"',
    "aria-label={playing ? 'pause' : 'caret-right'}",
    '<div className="time">{currentTimeLabel}</div>',
    '<div className="rate-control">',
    'className="ant-select ant-select-sm ant-select-single ant-select-show-arrow"',
    '<div ref={scrollRef} className="timeline-editor min-w-0 flex-1 overflow-auto bg-[#0b1020]">',
    '<header className="timeline-editor-header sticky top-0 z-10 bg-[#0f1625]/95 backdrop-blur">',
    'className="timeline-editor-time-area relative border-b border-slate-800"',
    'className="timeline-editor-time-scale-list"',
    'timeline-editor-time-unit',
    'timeline-editor-time-unit-big',
    'timeline-editor-time-unit-scale',
    '<time className="timeline-editor-time-unit-scale"',
    'className="timeline-editor-time-mark absolute inset-y-0"',
    'className="timeline-editor-time-mark-layer"',
    'className="timeline-editor-edit-area flex border-b border-slate-800"',
    'className="timeline-editor-cursor pointer-events-none absolute z-20"',
    'className="timeline-editor-cursor-top"',
    'className="timeline-editor-cursor-area"',
    'className={`timeline-editor-edit-row flex border-b transition ${',
    'timeline-editor-action timeline-editor-action-movable timeline-editor-action-flexible',
    'resolveTimelineEditorActionEffectClassName',
    "laneId === 'audio' ? 'effect0' : 'effect1'",
    'timeline-editor-action-effect-${actionEffectClassName}',
    'timeline-editor-action-effect ${actionEffectClassName}',
    '${actionEffectClassName}-text',
    'const LANE_ITEM_RESIZE_EDGE_PX = 14',
    'shouldIgnoreTimelineActionPointerMoveStart',
    'resolveLaneItemPointerStartMode',
    'if (offsetX <= LANE_ITEM_RESIZE_EDGE_PX) return \'resize-start\'',
    'if (rect.right - event.clientX <= LANE_ITEM_RESIZE_EDGE_PX) return \'resize-end\'',
    'handleLaneItemPointerStart(event, beat, index)',
    '<section className={`timeline-editor-action-effect ${actionEffectClassName}`}',
    'aria-label={`${lane.label} action ${item.title}`}',
    'aria-label={`Move ${item.title} between beats`}',
    'type="button"',
    'className="timeline-editor-action-left-stretch"',
    'className="timeline-editor-action-right-stretch"',
    "handleBeatPointerStart(event, beat, index, 'resize-start')",
    "handleBeatPointerStart(event, beat, index, 'resize-end')",
    'getTimelineCompactStatusChipClassName',
    'getTimelineCompactIconButtonClassName(lanePresentations[0]?.id !== lane.id)',
    'getTimelineInlineMoveIconButtonClassName(!!previousBeat)',
    'getTimelineCompactIconButtonClassName(true, lane.muted ? \'amber\' : \'default\')',
    'getTimelineCompactIconButtonClassName(true, lane.solo ? \'cyan\' : \'default\')',
    'getTimelineCompactIconButtonClassName(canDeleteActiveBeat)',
    'group/item',
    'Grid {snapStepMs}ms',
    'compactToolbarIconClassName',
    'dragPointerClientXRef',
    'dragEdgeScrollDirectionRef',
    'window.requestAnimationFrame(tick)',
    'updateDragEdgeScrollDirection(pointerClientX)',
    'bg-cyan-500/6',
    'bg-cyan-500/4',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas to retain reference player/timeline shell snippet: ${snippet}`)
    }
  }
  for (const forbiddenSnippet of ['timeline-player-meta', 'timeline-player-chip', 'Auto Scroll On', 'Auto Scroll Off', 'Selected Lane:', 'Selected Item:', 'Beat Strip:', 'Drag beat bars to move. Drag edges to resize. Snap follows the active grid step. Split uses the current playhead.', 'No note', 'No summary', 'No tags', 'Active Beat:']) {
    if (text.includes(forbiddenSnippet)) {
      throw new Error(`expected AnimationCanvas player shell to avoid local-only meta chrome snippet: ${forbiddenSnippet}`)
    }
  }
}

export function testAnimationCanvasDoesNotImportVendorTimelineEditor() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  if (text.includes('react-timeline-editor')) {
    throw new Error('expected AnimationCanvas to stay native and avoid vendor timeline editor imports')
  }
  if (text.includes('xzdarcy/react-timeline-editor')) {
    throw new Error('expected AnimationCanvas to avoid copied upstream vendor references')
  }
  if (text.includes('https://zdarcy.com/guide/engine/101-intro.html')) {
    throw new Error('expected AnimationCanvas to avoid copying vendor guide URLs into the native renderer source')
  }
}

export function testAnimationCanvasRetainsSoftenedVisualTextureContract() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  const cssText = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.css'), 'utf8')
  for (const snippet of ['border-cyan-400/30 bg-cyan-500/8', 'border-fuchsia-400/30 bg-fuchsia-500/8', 'border-amber-400/30 bg-amber-500/8', 'border-emerald-400/30 bg-emerald-500/8', 'border-slate-500/30 bg-slate-500/8']) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas to retain softened lane accent snippet: ${snippet}`)
    }
  }
  for (const snippet of ['rgb(147 51 234 / 0.18)', 'rgb(109 40 217 / 0.16)', 'rgb(217 119 6 / 0.18)', 'rgb(180 83 9 / 0.16)', 'box-sizing: border-box;', 'display: flex;', 'align-items: center;', 'height: 28px;', 'height: 100%;', 'min-height: 28px;', 'margin-left: 4px;', 'top: 0;', 'width: 10px;', 'z-index: 20;', 'padding: 0;', 'border: 0;', 'appearance: none;', 'cursor: ew-resize;', 'background: transparent;', 'border-radius: 4px;', 'opacity: 1;', 'pointer-events: none;', 'user-select: none;', 'overflow: hidden;', 'list-style: none;', 'inset: 0;', '0 0 10px rgb(34 211 238 / 0.22)']) {
    if (!cssText.includes(snippet)) {
      throw new Error(`expected AnimationCanvas CSS to retain softened visual texture snippet: ${snippet}`)
    }
  }
}

export function testAnimationCanvasReusesSharedToolbarIconButtons() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  for (const snippet of ['import IconButton', 'getIconSizeClass', '<IconButton', 'toolbarIconClassName']) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas to reuse shared toolbar icon primitives: ${snippet}`)
    }
  }
  for (const legacySnippet of ['<span>Insert Before</span>', '<span>Insert After</span>', '<span>Split Beat</span>', '<span>Duplicate Beat</span>']) {
    if (text.includes(legacySnippet)) {
      throw new Error(`expected AnimationCanvas action surface to avoid legacy visible text button snippet: ${legacySnippet}`)
    }
  }
}

export function testAnimationCanvasSurfacesBeatSummaryAndTagsInTimelineCards() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  for (const snippet of ['BEAT_HEADER_HEIGHT_PX = 72', 'buildBeatLaneSummary', 'handleFocusLaneFromBeatCard', 'highlightedLaneShortcutId === lane.id', 'beatLaneSummary.length > 0 ? (', 'LANE_LABEL[laneId]', 'beat.summary ? (', 'beat.tags.length > 0 ? (', 'beat.tags.slice(0, 3)', '+{beat.tags.length - 3}', 'SELECTED_BEAT_HINTS', 'laneInlineScrollClassName', 'laneInlineScrollStyle', "title: 'Rename beat (L)'", "title: 'Duplicate beat (D)'"]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas beat cards to surface metadata snippet: ${snippet}`)
    }
  }
}

export function testAnimationCanvasExposesBeatCardQuickMetadataActions() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  for (const snippet of ['group/beat', 'getTimelineCompactIconButtonClassName', 'getTimelineBeatQuickIconButtonClassName', 'handleInsertBeatBeforeQuick', 'handleInsertBeatAfterQuick', 'handleDeleteBeatQuick', 'handleDuplicateBeatQuick', 'handleSplitBeatQuick', 'handleMergeBeatWithNextQuick', 'handleRemoveGapBeforeBeatQuick', 'handleStartBeatLabelQuickEdit', 'handleStartBeatNoteQuickEdit', 'handleStartBeatSummaryQuickEdit', 'handleStartBeatTagsQuickEdit', 'currentEditingBeatRef', 'justify-end', 'w-2.5 cursor-ew-resize bg-cyan-300/0 hover:bg-cyan-300/12']) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas beat cards to expose quick metadata action snippet: ${snippet}`)
    }
  }
}

export function testAnimationCanvasAvoidsFixtureOnlyTimelineRows() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  if (!text.includes('It does not ship fixture-only demo rows.')) {
    throw new Error('expected AnimationCanvas empty state to state that the renderer avoids fixture-only demo rows')
  }
  for (const forbiddenSnippet of ['fake timeline row', 'hardcoded timeline row', 'demoRow', 'mockTimelineRow']) {
    if (text.includes(forbiddenSnippet)) {
      throw new Error(`expected AnimationCanvas to avoid fixture-only timeline row markers: ${forbiddenSnippet}`)
    }
  }
}

export function testAnimationCanvasRegistersNativeTimelineHotkeys() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  for (const snippet of [
    "from '@/components/AnimationCanvas/animationKeyboard'",
    'resolveAnimationTimelineHotkeyAction(event)',
    'shouldIgnoreAnimationTimelineHotkeys({',
    'isAnimationTimelineMutationHotkeyAction(action)',
    "window.addEventListener('keydown', onKeyDown)",
    "window.removeEventListener('keydown', onKeyDown)",
    "Play (Space)",
    'Prev Beat (Left Arrow)',
    'Next Beat (Right Arrow)',
    'Reset (R)',
    'Split active beat at playhead (S)',
    'Duplicate active beat after the current beat (D)',
    "action === 'edit-beat-label'",
    "action === 'edit-beat-note'",
    "action === 'edit-beat-summary'",
    "action === 'edit-beat-tags'",
    'Rename ${activeBeat.label} (L)',
    'Edit beat note (N)',
    'Add beat note (N)',
    'Edit beat summary (M)',
    'Add beat summary (M)',
    'Edit beat tags (T)',
    'Add beat tags (T)',
    "aria-label=\"Active beat note\"",
    "aria-label=\"Active beat summary\"",
    "(event.metaKey || event.ctrlKey) && event.key === 'Enter'",
    'Save beat note (Cmd/Ctrl+Enter)',
    'Cancel beat note edit (Escape)',
    'Save beat summary (Cmd/Ctrl+Enter)',
    'Cancel beat summary edit (Escape)',
    'selectedLaneId',
    "action === 'toggle-lane-hidden'",
    "action === 'toggle-lane-muted'",
    "action === 'toggle-lane-solo'",
    "action === 'move-lane-up'",
    "action === 'move-lane-down'",
    'laneOptionRefs',
    'selectedOrFirstLaneId',
    'handleFocusLaneOption',
    'role="listbox"',
    'aria-label="Animation timeline lanes"',
    'tabIndex={selectedOrFirstLaneId === lane.id ? 0 : -1}',
    'role="option"',
    'aria-selected={selectedLaneId === lane.id}',
    'onFocus={() => setSelectedLaneId(lane.id)}',
    'SELECTED_LANE_HINTS',
    'TIMELINE_COMPACT_HINT_CHIP_CLASS_NAME',
    'SELECTED_LANE_HINTS.map(hint => (',
    'laneInlineScrollClassName',
    'laneInlineScrollStyle',
    'title={hint.title}',
    "if (event.key === 'ArrowUp')",
    "if (event.key === 'ArrowDown')",
    "if (event.key === 'Home')",
    "if (event.key === 'End')",
    'Tab to focus ${lane.label}; use Arrow Up/Down, Home, End, [ / ], H, U, O',
    "label: '[ / ]'",
    "label: 'H'",
    "label: 'U'",
    "label: 'O'",
    'selectedItemNodeId',
    'selectedLaneVisibleItemContexts',
    'selectedItemContext',
    'selectedOrFirstLaneItemNodeId',
    'handleFocusLaneItemOption',
    "action === 'move-selected-item-prev-beat'",
    "action === 'move-selected-item-next-beat'",
    'laneItemOptionRefs.current[item.nodeId] = node',
    'tabIndex={selectedLaneId === lane.id && selectedOrFirstLaneItemNodeId === item.nodeId ? 0 : -1}',
    'role="option"',
    'aria-selected={selectedItemNodeId === item.nodeId}',
    'Focus ${item.title}; use Arrow Up/Down, Home, End, , and .',
    'timeline-editor-action timeline-editor-action-movable timeline-editor-action-flexible',
    'timeline-editor-action-left-stretch',
    'timeline-editor-action-right-stretch',
    'getTimelineInlineMoveIconButtonClassName(!!nextBeat)',
    'absolute inset-y-0 right-0 z-10 flex items-center gap-0.5 pr-0.5',
    'group-hover/item:pointer-events-auto',
    'group-focus-within/item:pointer-events-auto',
    'focus-visible:ring-cyan-300',
    'setSelectedItemNodeId(item.nodeId)',
    "const itemIndex = selectedLaneVisibleItemContexts.findIndex(entry => entry.nodeId === item.nodeId)",
    'SELECTED_ITEM_HINTS',
    'SELECTED_ITEM_HINTS.map(hint => (',
    'laneInlineScrollClassName',
    'laneInlineScrollStyle',
    "label: ','",
    "label: '.'",
    'beatOptionRefs',
    'selectedOrActiveBeatRef',
    'handleFocusBeatOption',
    'aria-label="Animation timeline beats"',
    'tabIndex={selectedOrActiveBeatRef === beat.beatRef ? 0 : -1}',
    'aria-selected={isActiveBeat}',
    'Tab to focus ${beat.label}; use Arrow Left/Right, Home, End',
    "if (event.key === 'ArrowLeft')",
    "if (event.key === 'ArrowRight')",
    "title: 'Rename beat (L)'",
    "title: 'Edit note (N)'",
    "title: 'Edit summary (M)'",
    "title: 'Edit tags (T)'",
    "title: 'Duplicate beat (D)'",
    "title: 'Split beat (S)'",
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas to retain native hotkey contract snippet: ${snippet}`)
    }
  }
}
