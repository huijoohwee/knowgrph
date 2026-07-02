import { resolveAnimaticTimelineLanePresentation } from '@/components/AnimaticCanvas/animaticLaneControls'
import {
  buildAnimaticTimelineModel,
  readAnimaticTimelineLaneControlState,
  readAnimaticTimelineLaneOrder,
  serializeAnimaticTimelineMarkdownWithLaneControlState,
  serializeAnimaticTimelineMarkdownWithLaneOrder,
} from '@/components/AnimaticCanvas/animaticTimeline'
import type { GraphData } from '@/lib/graph/types'

// Low-level serializer utility coverage only.
// Runtime ownership for lane state lives in AnimaticCanvas graph writeback tests.

export function testAnimaticLaneControlsHideMutedAndSoloFlagsProjectOntoLanes() {
  const lanes = [
    { id: 'clip', label: 'Clips' },
    { id: 'audio', label: 'Audio' },
    { id: 'overlay', label: 'Overlays' },
  ] as const

  const projected = resolveAnimaticTimelineLanePresentation({
    lanes,
    controls: {
      hiddenLaneIds: ['audio'],
      mutedLaneIds: ['overlay'],
      soloLaneId: null,
    },
  })

  if (projected[1]?.visibleItems !== false || projected[1]?.hidden !== true) {
    throw new Error(`expected hidden lane to suppress lane items, got ${JSON.stringify(projected[1])}`)
  }
  if (projected[2]?.muted !== true || projected[2]?.visibleItems !== true) {
    throw new Error(`expected muted lane to remain visible while flagged muted, got ${JSON.stringify(projected[2])}`)
  }
}

export function testAnimaticLaneControlsSoloOverridesHiddenState() {
  const lanes = [
    { id: 'clip', label: 'Clips' },
    { id: 'audio', label: 'Audio' },
  ] as const

  const projected = resolveAnimaticTimelineLanePresentation({
    lanes,
    controls: {
      hiddenLaneIds: ['audio'],
      mutedLaneIds: [],
      soloLaneId: 'audio',
    },
  })

  if (projected[1]?.visibleItems !== true || projected[1]?.solo !== true) {
    throw new Error(`expected solo lane to stay visible even when hidden, got ${JSON.stringify(projected[1])}`)
  }
  if (projected[0]?.soloFiltered !== true || projected[0]?.visibleItems !== false) {
    throw new Error(`expected non-solo lane to be solo-filtered, got ${JSON.stringify(projected[0])}`)
  }
}

export function testAnimaticLaneControlsReadPersistedFrontmatterState() {
  const controls = readAnimaticTimelineLaneControlState(`---
timeline:
  lane_controls:
    hidden:
      - overlay
    muted:
      - audio
    solo: clip
---
`)

  if (controls.hiddenLaneIds.join(',') !== 'overlay') {
    throw new Error(`expected hidden lane controls to read from frontmatter, got ${controls.hiddenLaneIds.join(',')}`)
  }
  if (controls.mutedLaneIds.join(',') !== 'audio') {
    throw new Error(`expected muted lane controls to read from frontmatter, got ${controls.mutedLaneIds.join(',')}`)
  }
  if (controls.soloLaneId !== 'clip') {
    throw new Error(`expected solo lane control to read from frontmatter, got ${String(controls.soloLaneId)}`)
  }
}

export function testAnimaticLaneControlsSerializerWritesPersistedFrontmatterState() {
  const updated = serializeAnimaticTimelineMarkdownWithLaneControlState({
    markdownText: `---
timeline:
  beats:
    beat_01:
      label: Hook
---
`,
    hiddenLaneIds: ['overlay'],
    mutedLaneIds: ['audio'],
    soloLaneId: 'clip',
  })

  if (!updated.includes('lane_controls:')) {
    throw new Error(`expected lane controls block to be created, got ${updated}`)
  }
  if (!updated.includes('hidden:\n      - overlay')) {
    throw new Error(`expected hidden lane list to persist, got ${updated}`)
  }
  if (!updated.includes('muted:\n      - audio')) {
    throw new Error(`expected muted lane list to persist, got ${updated}`)
  }
  if (!updated.includes('solo: clip')) {
    throw new Error(`expected solo lane to persist, got ${updated}`)
  }
}

export function testAnimaticLaneControlsReadPersistedLaneOrder() {
  const laneOrder = readAnimaticTimelineLaneOrder(`---
timeline:
  lane_order:
    - audio
    - clip
---
`)

  if (laneOrder.join(',') !== 'audio,clip') {
    throw new Error(`expected lane order to read from frontmatter, got ${laneOrder.join(',')}`)
  }
}

export function testAnimaticLaneControlsSerializerWritesPersistedLaneOrder() {
  const updated = serializeAnimaticTimelineMarkdownWithLaneOrder({
    markdownText: `---
timeline:
  beats:
    beat_01:
      label: Hook
---
`,
    laneOrder: ['audio', 'clip', 'overlay'],
  })

  if (!updated.includes('lane_order:')) {
    throw new Error(`expected lane order block to be created, got ${updated}`)
  }
  if (!updated.includes('lane_order:\n    - audio\n    - clip\n    - overlay')) {
    throw new Error(`expected lane order list to persist in requested order, got ${updated}`)
  }
}

export function testAnimaticTimelineModelAppliesPersistedLaneOrder() {
  const model = buildAnimaticTimelineModel({
    graphData: {
      type: 'Graph',
      nodes: [
        { id: 'NODE_CLIP_01', label: 'Clip', type: 'Clip', properties: { params: { beat_ref: 'beat_01' } } },
        { id: 'NODE_AUDIO_01', label: 'Audio', type: 'Audio', properties: { params: { beat_ref: 'beat_01' } } },
        { id: 'WIDGET_01', label: 'Overlay', type: 'Overlay', properties: { params: { beat_ref: 'beat_01' } } },
      ],
      edges: [],
    } as GraphData,
    markdownText: `---
timeline:
  lane_order:
    - audio
    - overlay
    - clip
---
`,
  })

  if (model.lanes.map(lane => lane.id).join(',') !== 'audio,overlay,clip') {
    throw new Error(`expected model lanes to follow persisted lane order, got ${model.lanes.map(lane => lane.id).join(',')}`)
  }
}
