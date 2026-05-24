import type { GraphData } from '@/lib/graph/types'
import {
  buildAnimationTimelineModel,
  findAnimationTimelineBeatIndexAtPosition,
  formatAnimationTimelineTimestamp,
} from '@/components/AnimationCanvas/animationTimeline'

export function testAnimationTimelineModelUsesMarkdownFrontmatterTimingAndGraphBeatRefs() {
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
        id: 'NODE_OVERLAY_01',
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
        id: 'edge:beat01',
        source: 'NODE_TIMELINE',
        target: 'NODE_CLIP_01',
        properties: {
          'flow:sourcePortKey': 'beat_01_out',
        },
      },
      {
        id: 'edge:beat02',
        source: 'NODE_TIMELINE',
        target: 'NODE_AUDIO_02',
        properties: {
          'flow:sourcePortKey': 'beat_02_out',
        },
      },
    ],
  } as GraphData

  const markdownText = `---
title: Animation Demo
timeline:
  beats:
    beat_01:
      label: Hook
      start_ms: 0
      end_ms: 4000
    beat_02:
      label: Reveal
      start_ms: 4000
      end_ms: 9000
---
`

  const model = buildAnimationTimelineModel({
    graphData,
    markdownText,
  })

  if (!model.usesAbsoluteTiming) throw new Error('expected frontmatter timing to enable absolute timeline mode')
  if (model.totalDurationMs !== 9000) throw new Error(`expected total duration 9000ms, got ${String(model.totalDurationMs)}`)
  if (model.beats.length !== 2) throw new Error(`expected two beats, got ${model.beats.length}`)
  if (model.beats[0]?.label !== 'Hook') throw new Error(`expected Hook label, got ${String(model.beats[0]?.label || '')}`)
  if (model.beats[1]?.items[0]?.laneId !== 'audio') {
    throw new Error(`expected second beat lane to classify audio, got ${String(model.beats[1]?.items[0]?.laneId || '')}`)
  }
  if (findAnimationTimelineBeatIndexAtPosition(model, 4500) !== 1) {
    throw new Error('expected playhead at 4500ms to resolve to beat_02')
  }
}

export function testAnimationTimelineModelFallsBackToOrdinalBeatSequenceWithoutFrontmatterTiming() {
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
        id: 'NODE_OVERLAY_01',
        label: 'First Beat Overlay',
        type: 'Overlay',
        properties: {},
      },
    ],
    edges: [],
  } as GraphData

  const model = buildAnimationTimelineModel({
    graphData,
    markdownText: null,
  })

  if (model.usesAbsoluteTiming) throw new Error('expected ordinal fallback when no frontmatter timing exists')
  if (model.totalSpan !== 2) throw new Error(`expected ordinal span of 2 beats, got ${model.totalSpan}`)
  if (model.beats[0]?.beatRef !== 'beat_01') throw new Error(`expected beat_01 first, got ${String(model.beats[0]?.beatRef || '')}`)
  if (model.beats[1]?.beatRef !== 'beat_02') throw new Error(`expected beat_02 second, got ${String(model.beats[1]?.beatRef || '')}`)
  if (formatAnimationTimelineTimestamp(4510) !== '00:04.51') {
    throw new Error(`expected timestamp formatting to preserve centiseconds, got ${formatAnimationTimelineTimestamp(4510)}`)
  }
}
