import type { GraphData } from '@/lib/graph/types'
import {
  applyAnimaticTimelineBeatTimingOverrides,
  buildAnimaticTimelineModel,
  findAnimaticTimelineBeatIndexAtPosition,
  formatAnimaticTimelineTimestamp,
  readAnimaticTimelineScaleConfig,
  resolveAnimaticTimelineBeatTimingEdit,
  serializeAnimaticTimelineMarkdownWithBeatLabel,
  serializeAnimaticTimelineMarkdownWithBeatNote,
  serializeAnimaticTimelineMarkdownWithBeatSummary,
  serializeAnimaticTimelineMarkdownWithBeatTags,
  serializeAnimaticTimelineMarkdownWithBeatTiming,
  serializeAnimaticTimelineMarkdownWithBeatTimingOverrides,
  serializeAnimaticTimelineMarkdownWithDeletedBeat,
  serializeAnimaticTimelineMarkdownWithDuplicatedBeat,
  serializeAnimaticTimelineMarkdownWithInsertedBeat,
  serializeAnimaticTimelineMarkdownWithItemBeatRef,
  serializeAnimaticTimelineMarkdownWithMergedBeatWithNext,
  serializeAnimaticTimelineMarkdownWithRemovedGapBeforeBeat,
  serializeAnimaticTimelineMarkdownWithScaleConfig,
  serializeAnimaticTimelineMarkdownWithSplitBeat,
  snapAnimaticTimelineValue,
} from '@/components/AnimaticCanvas/animaticTimeline'

// Low-level serializer utility coverage only.
// AnimaticCanvas runtime ownership is covered separately by graph writeback tests
// and source contracts that require updateGraphMetadata/updateNode.

export function testAnimaticTimelineModelUsesMarkdownFrontmatterTimingAndGraphBeatRefs() {
  const graphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'NODE_CLIP_01',
        label: 'Hook Clip',
        type: 'Clip',
        properties: {},
      },
      {
        id: 'WIDGET_01',
        label: 'Hook Overlay',
        type: 'Overlay',
        properties: {},
      },
      {
        id: 'NODE_AUDIO_02',
        label: 'VO Line',
        type: 'Audio',
        properties: {
          params: {
            beat_ref: 'beat_02',
          },
        },
      },
    ],
    edges: [
      {
        id: 'edge:beat01', label: 'Beat 01',
        source: 'NODE_TIMELINE',
        target: 'NODE_CLIP_01',
        properties: {
          'flow:sourcePortKey': 'beat_01_out',
        },
      },
      {
        id: 'edge:beat02', label: 'Beat 02',
        source: 'NODE_TIMELINE',
        target: 'NODE_AUDIO_02',
        properties: {
          'flow:sourcePortKey': 'beat_02_out',
        },
      },
    ],
  } as GraphData

  const markdownText = `---
title: Animatic Demo
timeline:
  beats:
    beat_01:
      label: Hook
      summary: Lead with the audience problem.
      tags:
        - intro
        - hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Reveal
      start_ms: 4000
      end_ms: 9000
---
`

  const model = buildAnimaticTimelineModel({
    graphData,
    markdownText,
  })

  if (!model.usesAbsoluteTiming) throw new Error('expected frontmatter timing to enable absolute timeline mode')
  if (model.totalDurationMs !== 9000) throw new Error(`expected total duration 9000ms, got ${String(model.totalDurationMs)}`)
  if (model.beats.length !== 2) throw new Error(`expected two beats, got ${model.beats.length}`)
  if (model.beats[0]?.label !== 'Hook') throw new Error(`expected Hook label, got ${String(model.beats[0]?.label || '')}`)
  if (model.beats[0]?.summary !== 'Lead with the audience problem.') {
    throw new Error(`expected beat summary to be derived from frontmatter, got ${String(model.beats[0]?.summary || '')}`)
  }
  if (JSON.stringify(model.beats[0]?.tags || []) !== JSON.stringify(['intro', 'hook'])) {
    throw new Error(`expected beat tags to be derived from frontmatter, got ${JSON.stringify(model.beats[0]?.tags || [])}`)
  }
  if (model.beats[1]?.items[0]?.laneId !== 'audio') {
    throw new Error(`expected second beat lane to classify audio, got ${String(model.beats[1]?.items[0]?.laneId || '')}`)
  }
  if (findAnimaticTimelineBeatIndexAtPosition(model, 4500) !== 1) {
    throw new Error('expected playhead at 4500ms to resolve to beat_02')
  }
}

export function testAnimaticTimelineModelReadsNativeScaleConfigFromFrontmatter() {
  const model = buildAnimaticTimelineModel({
    graphData: { type: 'Graph', nodes: [], edges: [] } as GraphData,
    markdownText: `---
timeline:
  scale:
    scale: 8
    scale_split_count: 4
    scale_width: 240
    start_left: 28
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
---
`,
  })

  if (model.scaleConfig.scale !== 8) {
    throw new Error(`expected scale 8, got ${model.scaleConfig.scale}`)
  }
  if (model.scaleConfig.scaleSplitCount !== 4) {
    throw new Error(`expected split count 4, got ${model.scaleConfig.scaleSplitCount}`)
  }
  if (model.scaleConfig.scaleWidth !== 240) {
    throw new Error(`expected scale width 240, got ${model.scaleConfig.scaleWidth}`)
  }
  if (model.scaleConfig.startLeft !== 28) {
    throw new Error(`expected start left 28, got ${model.scaleConfig.startLeft}`)
  }
}

export function testAnimaticTimelineScaleConfigSerializerRewritesTimelineScaleBlock() {
  const updated = serializeAnimaticTimelineMarkdownWithScaleConfig({
    markdownText: `---
title: Demo
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
---
`,
    scaleConfig: {
      scale: 6,
      scaleSplitCount: 8,
      scaleWidth: 192,
      startLeft: 24,
    },
  })

  for (const snippet of ['scale:', 'scale: 6', 'scale_split_count: 8', 'scale_width: 192', 'start_left: 24']) {
    if (!updated.includes(snippet)) {
      throw new Error(`expected rewritten scale config to include ${snippet}, got ${updated}`)
    }
  }
  const scaleConfig = readAnimaticTimelineScaleConfig(updated)
  if (scaleConfig.scale !== 6 || scaleConfig.scaleSplitCount !== 8 || scaleConfig.scaleWidth !== 192 || scaleConfig.startLeft !== 24) {
    throw new Error(`expected scale config round-trip to match rewrite, got ${JSON.stringify(scaleConfig)}`)
  }
}

export function testAnimaticTimelineModelFallsBackToOrdinalBeatSequenceWithoutFrontmatterTiming() {
  const graphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'NODE_CLIP_02',
        label: 'Second Beat Clip',
        type: 'Clip',
        properties: {},
      },
      {
        id: 'WIDGET_01',
        label: 'First Beat Overlay',
        type: 'Overlay',
        properties: {},
      },
    ],
    edges: [],
  } as GraphData

  const model = buildAnimaticTimelineModel({
    graphData,
    markdownText: null,
  })

  if (model.usesAbsoluteTiming) throw new Error('expected ordinal fallback when no frontmatter timing exists')
  if (model.totalSpan !== 2) throw new Error(`expected ordinal span of 2 beats, got ${model.totalSpan}`)
  if (model.beats[0]?.beatRef !== 'beat_01') throw new Error(`expected beat_01 first, got ${String(model.beats[0]?.beatRef || '')}`)
  if (model.beats[1]?.beatRef !== 'beat_02') throw new Error(`expected beat_02 second, got ${String(model.beats[1]?.beatRef || '')}`)
  if (formatAnimaticTimelineTimestamp(4510) !== '00:04.51') {
    throw new Error(`expected timestamp formatting to preserve centiseconds, got ${formatAnimaticTimelineTimestamp(4510)}`)
  }
}

export function testAnimaticTimelineBeatTimingEditClampsAgainstNeighborsAndResizes() {
  const model = buildAnimaticTimelineModel({
    graphData: { type: 'Graph', nodes: [], edges: [] } as GraphData,
    markdownText: `---
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Proof
      start_ms: 4000
      end_ms: 9000
    beat_03:
      label: CTA
      start_ms: 9000
      end_ms: 12000
---
`,
  })

  const moved = resolveAnimaticTimelineBeatTimingEdit({
    beats: model.beats,
    beatIndex: 1,
    mode: 'move',
    deltaMs: 8000,
    minDurationMs: 300,
  })
  if (!moved) throw new Error('expected move timing override')
  if (moved.beat_02?.startMs !== 12000 || moved.beat_02?.endMs !== 17000) {
    throw new Error(`expected move to shift the edited beat forward, got ${JSON.stringify(moved)}`)
  }
  if (moved.beat_03?.startMs !== 17000 || moved.beat_03?.endMs !== 20000) {
    throw new Error(`expected move to carry following beats forward, got ${JSON.stringify(moved)}`)
  }

  const resized = resolveAnimaticTimelineBeatTimingEdit({
    beats: model.beats,
    beatIndex: 1,
    mode: 'resize-end',
    deltaMs: 4000,
    minDurationMs: 300,
  })
  if (!resized) throw new Error('expected resize timing override')
  if (resized.beat_02?.endMs !== 13000) {
    throw new Error(`expected resize end to extend the edited beat, got ${JSON.stringify(resized)}`)
  }
  if (resized.beat_03?.startMs !== 13000 || resized.beat_03?.endMs !== 16000) {
    throw new Error(`expected resize end to carry following beats forward, got ${JSON.stringify(resized)}`)
  }

  const overridden = applyAnimaticTimelineBeatTimingOverrides(model, {
    beat_02: {
      startMs: 4200,
      endMs: 8600,
    },
  })
  if (overridden.beats[1]?.displayStart !== 4200 || overridden.beats[1]?.displayEnd !== 8600) {
    throw new Error(`expected override to update display range, got ${JSON.stringify(overridden.beats[1])}`)
  }
}

export function testAnimaticTimelineBeatTimingSerializerRewritesBeatWindow() {
  const updated = serializeAnimaticTimelineMarkdownWithBeatTiming({
    markdownText: `---
title: Demo
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
---

# Body
`,
    beatRef: 'beat_01',
    startMs: 250,
    endMs: 4750,
  })

  if (!updated.includes('start_ms: 250')) {
    throw new Error(`expected updated markdown to include start_ms: 250, got ${updated}`)
  }
  if (!updated.includes('end_ms: 4750')) {
    throw new Error(`expected updated markdown to include end_ms: 4750, got ${updated}`)
  }
  if (!updated.includes('duration_ms: 4500')) {
    throw new Error(`expected updated markdown to include duration_ms: 4500, got ${updated}`)
  }
  if (!updated.includes('# Body')) {
    throw new Error('expected markdown body to remain intact after frontmatter rewrite')
  }
}

export function testAnimaticTimelineBeatTimingOverrideSerializerRewritesMultipleBeatWindows() {
  const updated = serializeAnimaticTimelineMarkdownWithBeatTimingOverrides({
    markdownText: `---
title: Demo
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Problem
      start_ms: 4000
      end_ms: 9000
---
`,
    overrides: {
      beat_01: { startMs: 250, endMs: 4250 },
      beat_02: { startMs: 4250, endMs: 9750 },
    },
  })

  for (const snippet of ['beat_01:', 'start_ms: 250', 'end_ms: 4250', 'duration_ms: 4000', 'beat_02:', 'start_ms: 4250', 'end_ms: 9750', 'duration_ms: 5500']) {
    if (!updated.includes(snippet)) {
      throw new Error(`expected multi-beat timing override update to include ${snippet}, got ${updated}`)
    }
  }
}

export function testAnimaticTimelineSnapRoundsToConfiguredGrid() {
  if (snapAnimaticTimelineValue(1124, 250) !== 1000) {
    throw new Error(`expected 1124ms to snap down to 1000ms, got ${snapAnimaticTimelineValue(1124, 250)}`)
  }
  if (snapAnimaticTimelineValue(1130, 250) !== 1250) {
    throw new Error(`expected 1130ms to snap up to 1250ms, got ${snapAnimaticTimelineValue(1130, 250)}`)
  }
  if (snapAnimaticTimelineValue(1130, 0) !== 1130) {
    throw new Error(`expected zero-step snap to preserve value, got ${snapAnimaticTimelineValue(1130, 0)}`)
  }
}

export function testAnimaticTimelineInsertedBeatSerializerAppendsAndShiftsFollowingTiming() {
  const markdownText = `---
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Proof
      start_ms: 4000
      end_ms: 9000
---
`
  const model = buildAnimaticTimelineModel({
    graphData: { type: 'Graph', nodes: [], edges: [] } as GraphData,
    markdownText,
  })
  const inserted = serializeAnimaticTimelineMarkdownWithInsertedBeat({
    markdownText,
    model,
    insertAfterBeatRef: 'beat_01',
    snapStepMs: 1000,
  })

  if (inserted.beatRef === 'beat_01' || inserted.beatRef === 'beat_02') {
    throw new Error(`expected inserted beat ref to be new, got ${inserted.beatRef}`)
  }
  if (!inserted.markdownText.includes(`${inserted.beatRef}:`)) {
    throw new Error(`expected inserted markdown to include new beat ref, got ${inserted.markdownText}`)
  }
  if (!inserted.markdownText.includes('start_ms: 4000')) {
    throw new Error('expected inserted beat to start at the previous beat end')
  }
  if (!inserted.markdownText.includes('end_ms: 5000')) {
    throw new Error('expected inserted beat to use snap-sized default duration')
  }
  if (!inserted.markdownText.includes('beat_02:\n      label: Proof\n      start_ms: 5000\n      end_ms: 10000')) {
    throw new Error(`expected following beat to shift forward after insertion, got ${inserted.markdownText}`)
  }
}

export function testAnimaticTimelineDeletedBeatSerializerCompactsFollowingTiming() {
  const markdownText = `---
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Empty
      start_ms: 4000
      end_ms: 5000
    beat_03:
      label: CTA
      start_ms: 5000
      end_ms: 9000
---
`
  const model = buildAnimaticTimelineModel({
    graphData: { type: 'Graph', nodes: [], edges: [] } as GraphData,
    markdownText,
  })
  const updated = serializeAnimaticTimelineMarkdownWithDeletedBeat({
    markdownText,
    model,
    beatRef: 'beat_02',
  })

  if (updated.includes('beat_02:')) {
    throw new Error(`expected beat_02 to be removed, got ${updated}`)
  }
  if (!updated.includes('beat_03:\n      label: CTA\n      start_ms: 4000\n      end_ms: 8000')) {
    throw new Error(`expected following beat to compact backward after delete, got ${updated}`)
  }
}

export function testAnimaticTimelineBeatLabelSerializerRewritesFrontmatterLabel() {
  const updated = serializeAnimaticTimelineMarkdownWithBeatLabel({
    markdownText: `---
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
---
`,
    beatRef: 'beat_01',
    label: 'Opening Hook',
  })
  if (!updated.includes('label: Opening Hook')) {
    throw new Error(`expected label update to persist in frontmatter, got ${updated}`)
  }
}

export function testAnimaticTimelineBeatNoteSerializerRewritesFrontmatterNote() {
  const updated = serializeAnimaticTimelineMarkdownWithBeatNote({
    markdownText: `---
timeline:
  beats:
    beat_01:
      label: Hook
      note: Old note
      start_ms: 0
      end_ms: 4000
---
`,
    beatRef: 'beat_01',
    note: 'Opening note',
  })
  if (!updated.includes('note: Opening note')) {
    throw new Error(`expected beat note update to persist in frontmatter, got ${updated}`)
  }
}

export function testAnimaticTimelineBeatSummarySerializerRewritesAndClearsFrontmatterSummary() {
  const updated = serializeAnimaticTimelineMarkdownWithBeatSummary({
    markdownText: `---
timeline:
  beats:
    beat_01:
      label: Hook
      summary: Old summary
      start_ms: 0
      end_ms: 4000
---
`,
    beatRef: 'beat_01',
    summary: 'Opening summary',
  })
  if (!updated.includes('summary: Opening summary')) {
    throw new Error(`expected beat summary update to persist in frontmatter, got ${updated}`)
  }

  const cleared = serializeAnimaticTimelineMarkdownWithBeatSummary({
    markdownText: updated,
    beatRef: 'beat_01',
    summary: '   ',
  })
  if (cleared.includes('summary:')) {
    throw new Error(`expected empty beat summary to clear frontmatter summary, got ${cleared}`)
  }
}

export function testAnimaticTimelineBeatTagsSerializerRewritesAndClearsFrontmatterTags() {
  const updated = serializeAnimaticTimelineMarkdownWithBeatTags({
    markdownText: `---
timeline:
  beats:
    beat_01:
      label: Hook
      tags:
        - old
      start_ms: 0
      end_ms: 4000
---
`,
    beatRef: 'beat_01',
    tags: 'intro, hook, intro',
  })
  if (!updated.includes('tags:\n        - intro\n        - hook')) {
    throw new Error(`expected beat tags update to persist deduplicated frontmatter tags, got ${updated}`)
  }

  const cleared = serializeAnimaticTimelineMarkdownWithBeatTags({
    markdownText: updated,
    beatRef: 'beat_01',
    tags: [],
  })
  if (cleared.includes('tags:')) {
    throw new Error(`expected empty beat tags to clear frontmatter tags, got ${cleared}`)
  }
}

export function testAnimaticTimelineInsertedBeatSerializerShiftsTargetForward() {
  const markdownText = `---
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Proof
      start_ms: 4000
      end_ms: 9000
---
`
  const model = buildAnimaticTimelineModel({
    graphData: { type: 'Graph', nodes: [], edges: [] } as GraphData,
    markdownText,
  })
  const inserted = serializeAnimaticTimelineMarkdownWithInsertedBeat({
    markdownText,
    model,
    insertBeforeBeatRef: 'beat_02',
    snapStepMs: 1000,
  })

  if (!inserted.markdownText.includes(`${inserted.beatRef}:\n      label: New Beat`)) {
    throw new Error(`expected insert-before to create a new beat record, got ${inserted.markdownText}`)
  }
  if (!inserted.markdownText.includes(`${inserted.beatRef}:\n      label: New Beat ${inserted.beatRef.replace(/^beat_/, '')}\n      start_ms: 4000\n      end_ms: 5000`)) {
    throw new Error(`expected insert-before beat to take the target start window, got ${inserted.markdownText}`)
  }
  if (!inserted.markdownText.includes('beat_02:\n      label: Proof\n      start_ms: 5000\n      end_ms: 10000')) {
    throw new Error(`expected target beat to shift forward after insert-before, got ${inserted.markdownText}`)
  }
}

export function testAnimaticTimelineDuplicatedBeatSerializerAppendsCopyAndShiftsFollowingTiming() {
  const markdownText = `---
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Proof
      start_ms: 4000
      end_ms: 9000
    beat_03:
      label: CTA
      start_ms: 9000
      end_ms: 12000
---
`
  const model = buildAnimaticTimelineModel({
    graphData: { type: 'Graph', nodes: [], edges: [] } as GraphData,
    markdownText,
  })
  const duplicated = serializeAnimaticTimelineMarkdownWithDuplicatedBeat({
    markdownText,
    model,
    beatRef: 'beat_02',
    snapStepMs: 1000,
  })

  if (!duplicated.beatRef) throw new Error('expected duplicate to create a new beat ref')
  if (!duplicated.markdownText.includes(`${duplicated.beatRef}:\n      label: Proof Copy\n      start_ms: 9000\n      end_ms: 14000`)) {
    throw new Error(`expected duplicate beat to start after the source beat, got ${duplicated.markdownText}`)
  }
  if (!duplicated.markdownText.includes('beat_03:\n      label: CTA\n      start_ms: 14000\n      end_ms: 17000')) {
    throw new Error(`expected following beats to shift after duplication, got ${duplicated.markdownText}`)
  }
}

export function testAnimaticTimelineSplitBeatSerializerCreatesSecondSegmentAtPlayhead() {
  const markdownText = `---
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Proof
      start_ms: 4000
      end_ms: 9000
---
`
  const model = buildAnimaticTimelineModel({
    graphData: { type: 'Graph', nodes: [], edges: [] } as GraphData,
    markdownText,
  })
  const split = serializeAnimaticTimelineMarkdownWithSplitBeat({
    markdownText,
    model,
    beatRef: 'beat_02',
    splitAtMs: 6100,
    minDurationMs: 300,
    snapStepMs: 500,
  })

  if (!split.beatRef) throw new Error('expected split to create a new beat ref')
  if (!split.markdownText.includes('beat_02:\n      label: Proof\n      start_ms: 4000\n      end_ms: 6000')) {
    throw new Error(`expected original beat to end at snapped split point, got ${split.markdownText}`)
  }
  if (!split.markdownText.includes(`${split.beatRef}:\n      label: Proof Part 2\n      start_ms: 6000\n      end_ms: 9000`)) {
    throw new Error(`expected new split beat to start at snapped split point, got ${split.markdownText}`)
  }
}

export function testAnimaticTimelineMergedBeatSerializerConsumesEmptyAdjacentBeat() {
  const markdownText = `---
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Empty
      start_ms: 4000
      end_ms: 7000
    beat_03:
      label: CTA
      start_ms: 7000
      end_ms: 9000
---
`
  const model = buildAnimaticTimelineModel({
    graphData: {
      type: 'Graph',
      nodes: [
        {
          id: 'NODE_CLIP_03',
          label: 'CTA',
          type: 'Clip',
          properties: {
            params: {
              beat_ref: 'beat_03',
            },
          },
        },
      ],
      edges: [],
    } as GraphData,
    markdownText,
  })
  const merged = serializeAnimaticTimelineMarkdownWithMergedBeatWithNext({
    markdownText,
    model,
    beatRef: 'beat_01',
  })

  if (merged.includes('beat_02:')) {
    throw new Error(`expected adjacent empty beat to be removed, got ${merged}`)
  }
  if (!merged.includes('beat_01:\n      label: Hook\n      start_ms: 0\n      end_ms: 7000')) {
    throw new Error(`expected active beat to extend into merged beat window, got ${merged}`)
  }
}

export function testAnimaticTimelineRemovedGapSerializerCompactsCurrentAndFollowingBeats() {
  const markdownText = `---
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Proof
      start_ms: 5500
      end_ms: 9000
    beat_03:
      label: CTA
      start_ms: 9000
      end_ms: 12000
---
`
  const model = buildAnimaticTimelineModel({
    graphData: { type: 'Graph', nodes: [], edges: [] } as GraphData,
    markdownText,
  })
  const compacted = serializeAnimaticTimelineMarkdownWithRemovedGapBeforeBeat({
    markdownText,
    model,
    beatRef: 'beat_02',
  })

  if (!compacted.includes('beat_02:\n      label: Proof\n      start_ms: 4000\n      end_ms: 7500')) {
    throw new Error(`expected active beat to shift back to previous beat boundary, got ${compacted}`)
  }
  if (!compacted.includes('beat_03:\n      label: CTA\n      start_ms: 7500\n      end_ms: 10500')) {
    throw new Error(`expected following beats to shift back by removed gap, got ${compacted}`)
  }
}

export function testAnimaticTimelineItemBeatRefSerializerRewritesRootNodes() {
  const markdownText = `---
nodes:
  - id: NODE_CLIP_01
    type: Clip
    label: Hook
    params:
      beat_ref: beat_01
  - id: NODE_AUDIO_01
    type: Audio
    label: Voice
    params:
      beat_ref: beat_01
timeline:
  beats:
    beat_01:
      label: Hook
    beat_02:
      label: CTA
---
`
  const updated = serializeAnimaticTimelineMarkdownWithItemBeatRef({
    markdownText,
    nodeId: 'NODE_AUDIO_01',
    beatRef: 'beat_02',
  })

  if (!updated.updated) {
    throw new Error('expected root node beat ref rewrite to report updated')
  }
  if (!updated.markdownText.includes('id: NODE_AUDIO_01\n    type: Audio\n    label: Voice\n    params:\n      beat_ref: beat_02')) {
    throw new Error(`expected root node beat_ref to be rewritten, got ${updated.markdownText}`)
  }
}

export function testAnimaticTimelineItemBeatRefSerializerRewritesFlowNodes() {
  const markdownText = `---
flow:
  nodes:
    - id: NODE_CLIP_01
      type: Clip
      label: Hook
      params:
        beat_ref: beat_01
    - id: WIDGET_01
      type: Overlay
      label: CTA Overlay
      params:
        beat_ref: beat_02
timeline:
  beats:
    beat_01:
      label: Hook
    beat_02:
      label: CTA
---
`
  const updated = serializeAnimaticTimelineMarkdownWithItemBeatRef({
    markdownText,
    nodeId: 'NODE_CLIP_01',
    beatRef: 'beat_02',
  })

  if (!updated.updated) {
    throw new Error('expected flow node beat ref rewrite to report updated')
  }
  if (!updated.markdownText.includes('id: NODE_CLIP_01\n      type: Clip\n      label: Hook\n      params:\n        beat_ref: beat_02')) {
    throw new Error(`expected flow node beat_ref to be rewritten, got ${updated.markdownText}`)
  }
}

export function testAnimaticTimelineItemBeatRefSerializerFallsBackToLaneAndTitle() {
  const markdownText = `---
flow:
  nodes:
    - id: NODE_AUDIO_01
      type: Audio
      label: Problem Voiceover
      params:
        beat_ref: beat_02
timeline:
  beats:
    beat_01:
      label: Hook
    beat_02:
      label: Problem
---
`
  const updated = serializeAnimaticTimelineMarkdownWithItemBeatRef({
    markdownText,
    nodeId: '',
    title: 'Problem Voiceover',
    laneId: 'audio',
    sourceBeatRef: 'beat_02',
    beatRef: 'beat_01',
  })

  if (!updated.updated) {
    throw new Error('expected flow node beat ref rewrite fallback to report updated')
  }
  if (!updated.markdownText.includes('id: NODE_AUDIO_01\n      type: Audio\n      label: Problem Voiceover\n      params:\n        beat_ref: beat_01')) {
    throw new Error(`expected fallback beat_ref rewrite to be applied, got ${updated.markdownText}`)
  }
}

export function testAnimaticTimelineItemBeatRefSerializerRewritesPropertiesParamsBeatRef() {
  const markdownText = `---
flow:
  nodes:
    - id: NODE_AUDIO_01
      type: Audio
      label: Problem Voiceover
      properties:
        params:
          beat_ref: beat_02
timeline:
  beats:
    beat_01:
      label: Hook
    beat_02:
      label: Problem
---
`
  const updated = serializeAnimaticTimelineMarkdownWithItemBeatRef({
    markdownText,
    nodeId: 'NODE_AUDIO_01',
    beatRef: 'beat_01',
  })

  if (!updated.updated) {
    throw new Error('expected properties.params beat ref rewrite to report updated')
  }
  if (!updated.markdownText.includes('properties:\n        params:\n          beat_ref: beat_01')) {
    throw new Error(`expected properties.params beat_ref rewrite to be applied, got ${updated.markdownText}`)
  }
}
