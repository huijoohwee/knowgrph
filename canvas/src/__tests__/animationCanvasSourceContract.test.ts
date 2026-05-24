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
    'const LANE_ROW_HEIGHT_PX = 72',
    '<div className="timeline-player">',
    'className="play-control"',
    "aria-label={playing ? 'pause' : 'caret-right'}",
    '<div className="time">{currentTimeLabel}</div>',
    '<div className="rate-control">',
    'className="ant-select ant-select-sm ant-select-single ant-select-show-arrow"',
    '<div ref={scrollRef} className="timeline-editor min-w-0 flex-1 overflow-auto bg-[#0b1020]">',
    'className="timeline-editor-time-area relative border-b border-slate-800"',
    'timeline-editor-time-unit',
    'timeline-editor-time-unit-big',
    'timeline-editor-time-unit-scale',
    'className="timeline-editor-edit-area flex border-b border-slate-800"',
    'className="timeline-editor-cursor pointer-events-none absolute z-20"',
    'className="timeline-editor-cursor-top"',
    'className="timeline-editor-cursor-area"',
    'className={`timeline-editor-edit-row flex border-b transition ${',
    'timeline-editor-action timeline-editor-action-movable timeline-editor-action-flexible',
    'resolveTimelineEditorActionEffectClassName',
    "laneId === 'audio' ? 'effect0' : 'effect1'",
    'timeline-editor-action-effect-${actionEffectClassName}',
    '${actionEffectClassName} flex items-start justify-between gap-1.5',
    '${actionEffectClassName}-text',
    'timeline-editor-action-left-stretch',
    'timeline-editor-action-right-stretch',
    'getTimelineCompactIconButtonClassName(lanePresentations[0]?.id !== lane.id)',
    'getTimelineCompactIconButtonClassName(!!previousBeat)',
    'compactToolbarIconClassName',
    'dragPointerClientXRef',
    'dragEdgeScrollDirectionRef',
    'window.requestAnimationFrame(tick)',
    'updateDragEdgeScrollDirection(pointerClientX)',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas to retain reference player/timeline shell snippet: ${snippet}`)
    }
  }
  for (const forbiddenSnippet of ['timeline-player-meta', 'timeline-player-chip', 'Auto Scroll On', 'Auto Scroll Off']) {
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
  for (const snippet of ['BEAT_HEADER_HEIGHT_PX = 104', 'buildBeatLaneSummary', 'handleFocusLaneFromBeatCard', 'highlightedLaneShortcutId === lane.id', 'beatLaneSummary.length > 0 ? (', 'LANE_LABEL[laneId]', 'beat.summary ? (', 'beat.tags.length > 0 ? (', 'beat.tags.slice(0, 3)', '+{beat.tags.length - 3}', 'title="Rename beat (L)"', 'title="Duplicate beat (D)"']) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas beat cards to surface metadata snippet: ${snippet}`)
    }
  }
}

export function testAnimationCanvasExposesBeatCardQuickMetadataActions() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  for (const snippet of ['group/beat', 'getTimelineCompactIconButtonClassName', 'handleInsertBeatBeforeQuick', 'handleInsertBeatAfterQuick', 'handleDeleteBeatQuick', 'handleDuplicateBeatQuick', 'handleSplitBeatQuick', 'handleMergeBeatWithNextQuick', 'handleRemoveGapBeforeBeatQuick', 'handleStartBeatLabelQuickEdit', 'handleStartBeatNoteQuickEdit', 'handleStartBeatSummaryQuickEdit', 'handleStartBeatTagsQuickEdit', 'currentEditingBeatRef']) {
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
    'Selected Lane:',
    '([ / ] reorder, H hide, U mute, O solo)',
    'laneOptionRefs',
    'selectedOrFirstLaneId',
    'handleFocusLaneOption',
    'role="listbox"',
    'aria-label="Animation timeline lanes"',
    'tabIndex={selectedOrFirstLaneId === lane.id ? 0 : -1}',
    'role="option"',
    'aria-selected={selectedLaneId === lane.id}',
    'onFocus={() => setSelectedLaneId(lane.id)}',
    "if (event.key === 'ArrowUp')",
    "if (event.key === 'ArrowDown')",
    "if (event.key === 'Home')",
    "if (event.key === 'End')",
    'Tab to focus ${lane.label}; use Arrow Up/Down, Home, End, [ / ], H, U, O',
    '[ / ] reorder',
    'H hide',
    'U mute',
    'O solo',
    'selectedItemNodeId',
    'selectedLaneVisibleItemContexts',
    'selectedItemContext',
    'selectedOrFirstLaneItemNodeId',
    'handleFocusLaneItemOption',
    "action === 'move-selected-item-prev-beat'",
    "action === 'move-selected-item-next-beat'",
    'Selected Item:',
    '(, prev beat, . next beat)',
    'laneItemOptionRefs.current[item.nodeId] = node',
    'tabIndex={selectedLaneId === lane.id && selectedOrFirstLaneItemNodeId === item.nodeId ? 0 : -1}',
    'role="option"',
    'aria-selected={selectedItemNodeId === item.nodeId}',
    'Focus ${item.title}; use Arrow Up/Down, Home, End, , and .',
    'timeline-editor-action timeline-editor-action-movable timeline-editor-action-flexible',
    'timeline-editor-action-left-stretch',
    'timeline-editor-action-right-stretch',
    'focus-visible:ring-cyan-300',
    'setSelectedItemNodeId(item.nodeId)',
    "const itemIndex = selectedLaneVisibleItemContexts.findIndex(entry => entry.nodeId === item.nodeId)",
    'Up/Down focus',
    'Home/End rail',
    ', prev beat',
    '. next beat',
    'beatOptionRefs',
    'selectedOrActiveBeatRef',
    'handleFocusBeatOption',
    'Beat Strip:',
    '(Tab, Left/Right, Home, End)',
    'aria-label="Animation timeline beats"',
    'tabIndex={selectedOrActiveBeatRef === beat.beatRef ? 0 : -1}',
    'aria-selected={isActiveBeat}',
    'Tab to focus ${beat.label}; use Arrow Left/Right, Home, End',
    "if (event.key === 'ArrowLeft')",
    "if (event.key === 'ArrowRight')",
    'title="Rename beat (L)"',
    'title="Edit note (N)"',
    'title="Edit summary (M)"',
    'title="Edit tags (T)"',
    'title="Duplicate beat (D)"',
    'title="Split beat (S)"',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas to retain native hotkey contract snippet: ${snippet}`)
    }
  }
}
