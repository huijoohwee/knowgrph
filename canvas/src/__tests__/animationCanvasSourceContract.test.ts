import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testAnimationCanvasRetainsNativeRunnerAutoScrollSwitchContract() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'components', 'AnimationCanvas.tsx'), 'utf8')
  for (const snippet of ['player-config', 'ant-switch', 'ant-switch-handle', 'ant-switch-inner', 'ant-click-animating', 'Enable Runtime Auto Scroll']) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AnimationCanvas to retain runner switch contract snippet: ${snippet}`)
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
  for (const snippet of ['BEAT_HEADER_HEIGHT_PX = 136', 'buildBeatLaneSummary', 'handleFocusLaneFromBeatCard', 'highlightedLaneShortcutId === lane.id', 'beatLaneSummary.length > 0 ? (', 'LANE_LABEL[laneId]', 'beat.summary ? (', 'beat.tags.length > 0 ? (', 'beat.tags.slice(0, 3)', '+{beat.tags.length - 3}']) {
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
