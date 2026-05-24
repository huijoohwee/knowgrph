import React from 'react'
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  Check,
  CircleDot,
  Copy,
  EyeOff,
  FileText,
  GitMerge,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Tags,
  Trash2,
  VolumeX,
  X,
} from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveAnimationTimelineLanePresentation } from '@/components/AnimationCanvas/animationLaneControls'
import { getIconSizeClass } from '@/lib/ui'
import {
  applyAnimationTimelineBeatTimingOverrides,
  buildAnimationTimelineModel,
  deleteAnimationTimelineBeat,
  duplicateAnimationTimelineBeat,
  findAnimationTimelineBeatIndexAtPosition,
  formatAnimationTimelineTimestamp,
  insertAnimationTimelineBeat,
  mergeAnimationTimelineBeatWithNext,
  readAnimationTimelineLaneControlState,
  updateAnimationTimelineMarkdownLaneOrder,
  removeAnimationTimelineGapBeforeBeat,
  resolveAnimationTimelineBeatTimingEdit,
  splitAnimationTimelineBeat,
  snapAnimationTimelineValue,
  type AnimationTimelineLaneId,
  type AnimationTimelineLaneControlState,
  type AnimationTimelineBeat,
  type AnimationTimelineBeatTimingOverride,
  updateAnimationTimelineMarkdownBeatLabel,
  updateAnimationTimelineMarkdownItemBeatRef,
  updateAnimationTimelineMarkdownLaneControlState,
  updateAnimationTimelineMarkdownBeatNote,
  updateAnimationTimelineMarkdownBeatSummary,
  updateAnimationTimelineMarkdownBeatTags,
  updateAnimationTimelineMarkdownBeatTiming,
} from '@/components/AnimationCanvas/animationTimeline'

const ORDINAL_PLAYBACK_BEAT_MS = 1000
const SCALE_ROW_HEIGHT_PX = 42
const BEAT_HEADER_HEIGHT_PX = 136
const LANE_ROW_HEIGHT_PX = 108
const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const
const SNAP_STEP_OPTIONS_MS = [100, 250, 500, 1000] as const
const EDIT_MIN_DURATION_MS = 300
const DRAG_EDGE_SCROLL_THRESHOLD_PX = 72
const DRAG_EDGE_SCROLL_STEP_PX = 28
const BEAT_LANE_SUMMARY_LIMIT = 3

const LANE_ACCENT_CLASS: Record<AnimationTimelineLaneId, string> = {
  clip: 'border-cyan-400/40 bg-cyan-500/12 text-cyan-50',
  overlay: 'border-fuchsia-400/40 bg-fuchsia-500/12 text-fuchsia-50',
  audio: 'border-amber-400/40 bg-amber-500/12 text-amber-50',
  scene: 'border-emerald-400/40 bg-emerald-500/12 text-emerald-50',
  node: 'border-slate-500/40 bg-slate-500/12 text-slate-100',
}

const LANE_LABEL: Record<AnimationTimelineLaneId, string> = {
  clip: 'Clip',
  overlay: 'Overlay',
  audio: 'Audio',
  scene: 'Scene',
  node: 'Node',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildScaleMarks(args: {
  totalSpan: number
  usesAbsoluteTiming: boolean
}): Array<{ key: string; position: number; label: string }> {
  const totalSpan = Math.max(0, args.totalSpan)
  if (totalSpan <= 0) return []
  if (args.usesAbsoluteTiming) {
    const maxSeconds = Math.max(1, Math.ceil(totalSpan / 1000))
    const divisions = Math.min(5, maxSeconds)
    const marks = new Map<number, string>()
    for (let i = 0; i <= divisions; i += 1) {
      const second = Math.round((i / divisions) * maxSeconds)
      const position = clamp(second * 1000, 0, totalSpan)
      marks.set(position, String(second))
    }
    return Array.from(marks.entries()).map(([position, label]) => ({
      key: `ms:${position}`,
      position,
      label,
    }))
  }
  return Array.from({ length: totalSpan + 1 }, (_, index) => ({
    key: `beat:${index}`,
    position: index,
    label: String(index),
  }))
}

type AnimationDragState = {
  beatRef: string
  beatIndex: number
  mode: 'move' | 'resize-start' | 'resize-end'
  pointerId: number
  originClientX: number
  originScrollLeft: number
  beatsSnapshot: AnimationTimelineBeat[]
}

function buildSnapMarks(totalSpan: number, snapStepMs: number, enabled: boolean): number[] {
  if (!enabled || snapStepMs <= 0 || totalSpan <= 0) return []
  const marks: number[] = []
  for (let value = 0; value <= totalSpan; value += snapStepMs) marks.push(value)
  const last = marks[marks.length - 1] || 0
  if (last !== totalSpan) marks.push(totalSpan)
  return marks
}

function buildBeatLaneSummary(items: ReadonlyArray<AnimationTimelineBeat['items'][number]>): Array<{ laneId: AnimationTimelineLaneId; count: number }> {
  const countByLaneId = new Map<AnimationTimelineLaneId, number>()
  for (const item of items) {
    countByLaneId.set(item.laneId, (countByLaneId.get(item.laneId) || 0) + 1)
  }
  return Array.from(countByLaneId.entries())
    .map(([laneId, count]) => ({ laneId, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count
      return LANE_LABEL[left.laneId].localeCompare(LANE_LABEL[right.laneId])
    })
}

function getTimelineIconButtonClassName(enabled: boolean, accent: 'default' | 'amber' | 'cyan' = 'default'): string {
  if (!enabled) return 'h-10 w-10 border border-slate-800 bg-slate-950 text-slate-500'
  if (accent === 'amber') return 'h-10 w-10 border border-amber-700 bg-amber-500/10 text-amber-200 hover:border-amber-600 hover:bg-amber-500/15'
  if (accent === 'cyan') return 'h-10 w-10 border border-cyan-700 bg-cyan-500/10 text-cyan-100 hover:border-cyan-600 hover:bg-cyan-500/15'
  return 'h-10 w-10 border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
}

function getTimelineCompactIconButtonClassName(enabled: boolean): string {
  if (!enabled) return 'h-7 w-7 border border-slate-800 bg-slate-950 text-slate-500'
  return 'h-7 w-7 border border-slate-700 bg-slate-950/90 text-slate-200 hover:border-slate-600 hover:bg-slate-900'
}

export default function AnimationCanvas({
  active = true,
}: {
  active?: boolean
}) {
  const graphData = useActiveGraphRenderData(active)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName || '')
  const markdownText = useGraphStore(s => s.markdownDocumentText || '')
  const setActiveMarkdownDocument = useGraphStore(s => s.setActiveMarkdownDocument)
  const baseTimelineModel = React.useMemo(
    () =>
      buildAnimationTimelineModel({
        graphData,
        markdownText,
      }),
    [graphData, markdownText],
  )
  const [playbackPosition, setPlaybackPosition] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [playbackRate, setPlaybackRate] = React.useState<(typeof PLAYBACK_RATES)[number]>(1)
  const [runtimeAutoScrollEnabled, setRuntimeAutoScrollEnabled] = React.useState(true)
  const [snapEnabled, setSnapEnabled] = React.useState(true)
  const [snapStepMs, setSnapStepMs] = React.useState<(typeof SNAP_STEP_OPTIONS_MS)[number]>(500)
  const [hiddenLaneIds, setHiddenLaneIds] = React.useState<AnimationTimelineLaneId[]>([])
  const [mutedLaneIds, setMutedLaneIds] = React.useState<AnimationTimelineLaneId[]>([])
  const [soloLaneId, setSoloLaneId] = React.useState<AnimationTimelineLaneId | null>(null)
  const [editingBeatRef, setEditingBeatRef] = React.useState<string | null>(null)
  const [editingBeatLabel, setEditingBeatLabel] = React.useState('')
  const [editingBeatNoteRef, setEditingBeatNoteRef] = React.useState<string | null>(null)
  const [editingBeatNote, setEditingBeatNote] = React.useState('')
  const [editingBeatSummaryRef, setEditingBeatSummaryRef] = React.useState<string | null>(null)
  const [editingBeatSummary, setEditingBeatSummary] = React.useState('')
  const [editingBeatTagsRef, setEditingBeatTagsRef] = React.useState<string | null>(null)
  const [editingBeatTags, setEditingBeatTags] = React.useState('')
  const [highlightedLaneShortcutId, setHighlightedLaneShortcutId] = React.useState<AnimationTimelineLaneId | null>(null)
  const [timingOverrides, setTimingOverrides] = React.useState<Record<string, AnimationTimelineBeatTimingOverride>>({})
  const [dragState, setDragState] = React.useState<AnimationDragState | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const laneRowRefs = React.useRef<Partial<Record<AnimationTimelineLaneId, HTMLDivElement | null>>>({})
  const laneShortcutHighlightTimeoutRef = React.useRef<number | null>(null)
  const timingOverridesRef = React.useRef<Record<string, AnimationTimelineBeatTimingOverride>>({})
  const toolbarIconClassName = getIconSizeClass('default')
  const compactToolbarIconClassName = getIconSizeClass('compact')

  React.useEffect(() => {
    timingOverridesRef.current = timingOverrides
  }, [timingOverrides])

  React.useEffect(() => {
    return () => {
      if (laneShortcutHighlightTimeoutRef.current != null) {
        window.clearTimeout(laneShortcutHighlightTimeoutRef.current)
      }
    }
  }, [])

  const timelineModel = React.useMemo(
    () => applyAnimationTimelineBeatTimingOverrides(baseTimelineModel, timingOverrides),
    [baseTimelineModel, timingOverrides],
  )
  const persistedLaneControls = React.useMemo(
    () => readAnimationTimelineLaneControlState(markdownText),
    [markdownText],
  )

  React.useEffect(() => {
    setHiddenLaneIds(persistedLaneControls.hiddenLaneIds)
    setMutedLaneIds(persistedLaneControls.mutedLaneIds)
    setSoloLaneId(persistedLaneControls.soloLaneId)
  }, [persistedLaneControls])

  React.useEffect(() => {
    if (timelineModel.totalSpan <= 0) {
      setPlaybackPosition(0)
      setPlaying(false)
      return
    }
    setPlaybackPosition(current => clamp(current, 0, timelineModel.totalSpan))
  }, [timelineModel.totalSpan])

  React.useEffect(() => {
    if (timelineModel.usesAbsoluteTiming) return
    setTimingOverrides({})
    setDragState(null)
  }, [timelineModel.usesAbsoluteTiming])

  React.useEffect(() => {
    if (!active || !playing || timelineModel.totalSpan <= 0) return
    let frameId = 0
    let startTimestamp = 0
    let startPosition = playbackPosition
    const unitsPerMs = (timelineModel.usesAbsoluteTiming ? 1 : 1 / ORDINAL_PLAYBACK_BEAT_MS) * playbackRate
    const tick = (timestamp: number) => {
      if (startTimestamp === 0) startTimestamp = timestamp
      const elapsedMs = timestamp - startTimestamp
      const nextPosition = clamp(startPosition + elapsedMs * unitsPerMs, 0, timelineModel.totalSpan)
      setPlaybackPosition(nextPosition)
      if (nextPosition >= timelineModel.totalSpan) {
        setPlaying(false)
        return
      }
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frameId)
      startTimestamp = 0
      startPosition = 0
    }
  }, [active, playbackPosition, playbackRate, playing, timelineModel.totalSpan, timelineModel.usesAbsoluteTiming])

  const activeBeatIndex = React.useMemo(
    () => findAnimationTimelineBeatIndexAtPosition(timelineModel, playbackPosition),
    [timelineModel, playbackPosition],
  )

  const beatWidths = React.useMemo(() => {
    if (timelineModel.beats.length === 0) return [] as number[]
    if (!timelineModel.usesAbsoluteTiming || !timelineModel.totalDurationMs) {
      return timelineModel.beats.map(() => 220)
    }
    const targetWidth = Math.max(960, timelineModel.beats.length * 220)
    return timelineModel.beats.map(beat => {
      const duration = Math.max(1, beat.durationMs ?? beat.displayEnd - beat.displayStart)
      const proportionalWidth = (duration / timelineModel.totalDurationMs) * targetWidth
      return Math.max(180, Math.round(proportionalWidth))
    })
  }, [timelineModel])

  const beatOffsets = React.useMemo(() => {
    let currentOffset = 0
    return beatWidths.map(width => {
      const offset = currentOffset
      currentOffset += width
      return offset
    })
  }, [beatWidths])

  const totalTimelineWidth = React.useMemo(() => beatWidths.reduce((sum, width) => sum + width, 0), [beatWidths])
  const timelineUnitsPerPixel = React.useMemo(
    () => (timelineModel.totalSpan > 0 && totalTimelineWidth > 0 ? timelineModel.totalSpan / totalTimelineWidth : 0),
    [timelineModel.totalSpan, totalTimelineWidth],
  )

  const playheadOffsetPx = React.useMemo(() => {
    if (timelineModel.beats.length === 0 || totalTimelineWidth <= 0) return 0
    const activeBeat = timelineModel.beats[activeBeatIndex] || timelineModel.beats[timelineModel.beats.length - 1]
    if (!activeBeat) return 0
    const beatStart = beatOffsets[activeBeatIndex] || 0
    const beatWidth = beatWidths[activeBeatIndex] || 0
    const beatSpan = Math.max(0.0001, activeBeat.displayEnd - activeBeat.displayStart)
    const progressWithinBeat = clamp((playbackPosition - activeBeat.displayStart) / beatSpan, 0, 1)
    return beatStart + beatWidth * progressWithinBeat
  }, [activeBeatIndex, beatOffsets, beatWidths, playbackPosition, timelineModel.beats])

  React.useEffect(() => {
    if (!runtimeAutoScrollEnabled) return
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const targetScrollLeft = Math.max(0, playheadOffsetPx - scrollEl.clientWidth * 0.5)
    scrollEl.scrollTo({
      left: targetScrollLeft,
      behavior: playing ? 'smooth' : 'auto',
    })
  }, [playheadOffsetPx, playing, runtimeAutoScrollEnabled])

  const activeBeat = activeBeatIndex >= 0 ? timelineModel.beats[activeBeatIndex] : null
  const currentEditingBeatRef = editingBeatRef || editingBeatNoteRef || editingBeatSummaryRef || editingBeatTagsRef
  const currentTimeLabel = timelineModel.usesAbsoluteTiming ? formatAnimationTimelineTimestamp(playbackPosition) : formatAnimationTimelineTimestamp(playbackPosition * 1000)
  const totalTimeLabel = timelineModel.usesAbsoluteTiming
    ? formatAnimationTimelineTimestamp(timelineModel.totalDurationMs)
    : formatAnimationTimelineTimestamp(timelineModel.totalSpan * 1000)
  const scaleMarks = React.useMemo(
    () =>
      buildScaleMarks({
        totalSpan: timelineModel.totalSpan,
        usesAbsoluteTiming: timelineModel.usesAbsoluteTiming,
      }),
    [timelineModel.totalSpan, timelineModel.usesAbsoluteTiming],
  )
  const snapMarks = React.useMemo(
    () => buildSnapMarks(timelineModel.totalSpan, snapStepMs, timelineModel.usesAbsoluteTiming && snapEnabled),
    [snapEnabled, snapStepMs, timelineModel.totalSpan, timelineModel.usesAbsoluteTiming],
  )
  const lanePresentations = React.useMemo(
    () =>
      resolveAnimationTimelineLanePresentation({
        lanes: timelineModel.lanes,
        controls: {
          hiddenLaneIds,
          mutedLaneIds,
          soloLaneId,
        },
      }),
    [hiddenLaneIds, mutedLaneIds, soloLaneId, timelineModel.lanes],
  )
  const canDeleteActiveBeat = !!activeBeat && activeBeat.items.length === 0
  const nextBeat = activeBeatIndex >= 0 ? timelineModel.beats[activeBeatIndex + 1] || null : null
  const previousBeat = activeBeatIndex > 0 ? timelineModel.beats[activeBeatIndex - 1] || null : null
  const snappedPlaybackPosition = React.useMemo(
    () => (snapEnabled ? snapAnimationTimelineValue(playbackPosition, snapStepMs) : Math.round(playbackPosition)),
    [playbackPosition, snapEnabled, snapStepMs],
  )
  const canSplitActiveBeat =
    !!activeBeat &&
    activeBeat.startMs != null &&
    activeBeat.endMs != null &&
    snappedPlaybackPosition > activeBeat.startMs + EDIT_MIN_DURATION_MS &&
    snappedPlaybackPosition < activeBeat.endMs - EDIT_MIN_DURATION_MS
  const activeGapBeforeMs =
    activeBeat?.startMs != null && previousBeat?.endMs != null ? Math.max(0, activeBeat.startMs - previousBeat.endMs) : 0
  const canRemoveGapBeforeActiveBeat = timelineModel.usesAbsoluteTiming && activeGapBeforeMs > 0
  const canMergeActiveBeatWithNext =
    timelineModel.usesAbsoluteTiming &&
    !!activeBeat &&
    !!nextBeat &&
    activeBeat.startMs != null &&
    nextBeat.endMs != null &&
    nextBeat.items.length === 0

  const commitMarkdownDocumentText = React.useCallback(
    async (nextMarkdownText: string) => {
      if (nextMarkdownText === markdownText || !markdownDocumentName) return false
      await setActiveMarkdownDocument({
        name: markdownDocumentName,
        text: nextMarkdownText,
        autoEnableFrontmatter: false,
        applyViewPreset: false,
        applyToGraph: false,
        normalizeMermaidMmd: false,
      })
      return true
    },
    [markdownDocumentName, markdownText, setActiveMarkdownDocument],
  )

  const commitMarkdownGraphDocumentText = React.useCallback(
    async (nextMarkdownText: string) => {
      if (nextMarkdownText === markdownText || !markdownDocumentName) return false
      return await setActiveMarkdownDocument({
        name: markdownDocumentName,
        text: nextMarkdownText,
        autoEnableFrontmatter: false,
        applyViewPreset: false,
        applyToGraph: true,
        normalizeMermaidMmd: false,
      })
    },
    [markdownDocumentName, markdownText, setActiveMarkdownDocument],
  )

  const commitLaneControlState = React.useCallback(
    async (nextControls: AnimationTimelineLaneControlState) => {
      const nextMarkdownText = updateAnimationTimelineMarkdownLaneControlState({
        markdownText,
        hiddenLaneIds: nextControls.hiddenLaneIds,
        mutedLaneIds: nextControls.mutedLaneIds,
        soloLaneId: nextControls.soloLaneId,
      })
      await commitMarkdownDocumentText(nextMarkdownText)
    },
    [commitMarkdownDocumentText, markdownText],
  )

  const handleToggleHiddenLane = React.useCallback(
    async (laneId: AnimationTimelineLaneId) => {
      const nextHiddenLaneIds = hiddenLaneIds.includes(laneId)
        ? hiddenLaneIds.filter(entry => entry !== laneId)
        : [...hiddenLaneIds, laneId]
      setHiddenLaneIds(nextHiddenLaneIds)
      await commitLaneControlState({
        hiddenLaneIds: nextHiddenLaneIds,
        mutedLaneIds,
        soloLaneId,
      })
    },
    [commitLaneControlState, hiddenLaneIds, mutedLaneIds, soloLaneId],
  )

  const handleToggleMutedLane = React.useCallback(
    async (laneId: AnimationTimelineLaneId) => {
      const nextMutedLaneIds = mutedLaneIds.includes(laneId)
        ? mutedLaneIds.filter(entry => entry !== laneId)
        : [...mutedLaneIds, laneId]
      setMutedLaneIds(nextMutedLaneIds)
      await commitLaneControlState({
        hiddenLaneIds,
        mutedLaneIds: nextMutedLaneIds,
        soloLaneId,
      })
    },
    [commitLaneControlState, hiddenLaneIds, mutedLaneIds, soloLaneId],
  )

  const handleToggleSoloLane = React.useCallback(
    async (laneId: AnimationTimelineLaneId) => {
      const nextSoloLaneId = soloLaneId === laneId ? null : laneId
      setSoloLaneId(nextSoloLaneId)
      await commitLaneControlState({
        hiddenLaneIds,
        mutedLaneIds,
        soloLaneId: nextSoloLaneId,
      })
    },
    [commitLaneControlState, hiddenLaneIds, mutedLaneIds, soloLaneId],
  )

  const handleMoveItemToBeat = React.useCallback(
    async (itemNodeId: string, nextBeat: AnimationTimelineBeat | null | undefined) => {
      const targetBeatRef = String(nextBeat?.beatRef || '').trim()
      if (!targetBeatRef) return
      const updateResult = updateAnimationTimelineMarkdownItemBeatRef({
        markdownText,
        nodeId: itemNodeId,
        beatRef: targetBeatRef,
      })
      if (!updateResult.updated) return
      const committed = await commitMarkdownGraphDocumentText(updateResult.markdownText)
      if (!committed) return
      setPlaying(false)
      setPlaybackPosition(nextBeat?.displayStart ?? 0)
    },
    [commitMarkdownGraphDocumentText, markdownText],
  )

  const handleReorderLane = React.useCallback(
    async (laneId: AnimationTimelineLaneId, direction: -1 | 1) => {
      const currentLaneOrder = lanePresentations.map(lane => lane.id)
      const currentIndex = currentLaneOrder.indexOf(laneId)
      if (currentIndex < 0) return
      const nextIndex = clamp(currentIndex + direction, 0, currentLaneOrder.length - 1)
      if (nextIndex === currentIndex) return
      const nextLaneOrder = [...currentLaneOrder]
      const [movedLaneId] = nextLaneOrder.splice(currentIndex, 1)
      if (!movedLaneId) return
      nextLaneOrder.splice(nextIndex, 0, movedLaneId)
      const nextMarkdownText = updateAnimationTimelineMarkdownLaneOrder({
        markdownText,
        laneOrder: nextLaneOrder,
      })
      await commitMarkdownDocumentText(nextMarkdownText)
    },
    [commitMarkdownDocumentText, lanePresentations, markdownText],
  )

  React.useEffect(() => {
    if (!activeBeat) {
      setEditingBeatRef(null)
      setEditingBeatLabel('')
      setEditingBeatNoteRef(null)
      setEditingBeatNote('')
      setEditingBeatSummaryRef(null)
      setEditingBeatSummary('')
      setEditingBeatTagsRef(null)
      setEditingBeatTags('')
      return
    }
    if (currentEditingBeatRef === activeBeat.beatRef) return
    setEditingBeatRef(null)
    setEditingBeatLabel('')
    setEditingBeatNoteRef(null)
    setEditingBeatNote('')
    setEditingBeatSummaryRef(null)
    setEditingBeatSummary('')
    setEditingBeatTagsRef(null)
    setEditingBeatTags('')
  }, [activeBeat, currentEditingBeatRef])

  const handleTogglePlayback = React.useCallback(() => {
    if (timelineModel.totalSpan <= 0) return
    if (playbackPosition >= timelineModel.totalSpan) {
      setPlaybackPosition(0)
    }
    setPlaying(current => !current)
  }, [playbackPosition, timelineModel.totalSpan])

  const handleReset = React.useCallback(() => {
    setPlaying(false)
    setPlaybackPosition(0)
  }, [])

  const handleStepBeat = React.useCallback(
    (direction: -1 | 1) => {
      if (timelineModel.beats.length === 0) return
      const nextIndex = clamp(activeBeatIndex + direction, 0, timelineModel.beats.length - 1)
      const nextBeat = timelineModel.beats[nextIndex]
      if (!nextBeat) return
      setPlaying(false)
      setPlaybackPosition(nextBeat.displayStart)
    },
    [activeBeatIndex, timelineModel.beats],
  )

  const handleFocusBeat = React.useCallback((beat: AnimationTimelineBeat) => {
    setPlaying(false)
    setPlaybackPosition(beat.displayStart)
  }, [])

  const handleFocusLaneFromBeatCard = React.useCallback((laneId: AnimationTimelineLaneId) => {
    const row = laneRowRefs.current[laneId]
    if (!row) return
    row.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    })
    setHighlightedLaneShortcutId(laneId)
    if (laneShortcutHighlightTimeoutRef.current != null) {
      window.clearTimeout(laneShortcutHighlightTimeoutRef.current)
    }
    laneShortcutHighlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedLaneShortcutId(current => (current === laneId ? null : current))
      laneShortcutHighlightTimeoutRef.current = null
    }, 1600)
  }, [])

  const handleInsertBeatAtTarget = React.useCallback(
    async (targetBeat: AnimationTimelineBeat | null | undefined, position: 'before' | 'after' = 'after') => {
      const insertResult = insertAnimationTimelineBeat({
        markdownText,
        model: timelineModel,
        insertAfterBeatRef:
          position === 'after'
            ? targetBeat?.beatRef || activeBeat?.beatRef || timelineModel.beats[timelineModel.beats.length - 1]?.beatRef || null
            : null,
        insertBeforeBeatRef:
          position === 'before'
            ? targetBeat?.beatRef || activeBeat?.beatRef || timelineModel.beats[0]?.beatRef || null
            : null,
        snapStepMs: timelineModel.usesAbsoluteTiming ? snapStepMs : null,
      })
      const committed = await commitMarkdownDocumentText(insertResult.markdownText)
      if (!committed) return
      setPlaying(false)
      const insertedBeat = buildAnimationTimelineModel({
        graphData,
        markdownText: insertResult.markdownText,
      }).beats.find(beat => beat.beatRef === insertResult.beatRef)
      if (insertedBeat) {
        setPlaybackPosition(insertedBeat.displayStart)
      }
    },
    [activeBeat?.beatRef, commitMarkdownDocumentText, graphData, markdownText, snapStepMs, timelineModel],
  )

  const handleInsertBeat = React.useCallback(
    async (position: 'before' | 'after' = 'after') => {
      await handleInsertBeatAtTarget(activeBeat, position)
    },
    [activeBeat, handleInsertBeatAtTarget],
  )

  const handleDeleteBeat = React.useCallback(async () => {
    if (!activeBeat || activeBeat.items.length > 0) return
    const nextMarkdownText = deleteAnimationTimelineBeat({
      markdownText,
      model: timelineModel,
      beatRef: activeBeat.beatRef,
    })
    const committed = await commitMarkdownDocumentText(nextMarkdownText)
    if (!committed) return
    setPlaying(false)
    const fallbackBeat = timelineModel.beats[Math.max(0, activeBeatIndex - 1)]
    setPlaybackPosition(fallbackBeat?.displayStart ?? 0)
  }, [activeBeat, activeBeatIndex, commitMarkdownDocumentText, markdownText, timelineModel])

  const handleDeleteBeatAtTarget = React.useCallback(
    async (targetBeat: AnimationTimelineBeat | null | undefined) => {
      const beat = targetBeat || activeBeat
      if (!beat || beat.items.length > 0) return
      const beatIndex = timelineModel.beats.findIndex(entry => entry.beatRef === beat.beatRef)
      const nextMarkdownText = deleteAnimationTimelineBeat({
        markdownText,
        model: timelineModel,
        beatRef: beat.beatRef,
      })
      const committed = await commitMarkdownDocumentText(nextMarkdownText)
      if (!committed) return
      setPlaying(false)
      const fallbackBeat = timelineModel.beats[Math.max(0, beatIndex - 1)]
      setPlaybackPosition(fallbackBeat?.displayStart ?? 0)
    },
    [activeBeat, commitMarkdownDocumentText, markdownText, timelineModel],
  )

  const handleDuplicateBeatAtTarget = React.useCallback(
    async (targetBeat: AnimationTimelineBeat | null | undefined) => {
      const beatRef = String(targetBeat?.beatRef || activeBeat?.beatRef || '').trim()
      if (!beatRef) return
      const duplicateResult = duplicateAnimationTimelineBeat({
        markdownText,
        model: timelineModel,
        beatRef,
        snapStepMs: timelineModel.usesAbsoluteTiming ? snapStepMs : null,
      })
      if (!duplicateResult.beatRef) return
      const committed = await commitMarkdownDocumentText(duplicateResult.markdownText)
      if (!committed) return
      setPlaying(false)
      const duplicatedBeat = buildAnimationTimelineModel({
        graphData,
        markdownText: duplicateResult.markdownText,
      }).beats.find(beat => beat.beatRef === duplicateResult.beatRef)
      if (duplicatedBeat) setPlaybackPosition(duplicatedBeat.displayStart)
    },
    [activeBeat?.beatRef, commitMarkdownDocumentText, graphData, markdownText, snapStepMs, timelineModel],
  )

  const handleDuplicateBeat = React.useCallback(async () => {
    await handleDuplicateBeatAtTarget(activeBeat)
  }, [activeBeat, handleDuplicateBeatAtTarget])

  const handleSplitBeatAtTarget = React.useCallback(
    async (targetBeat: AnimationTimelineBeat | null | undefined) => {
      const beat = targetBeat || activeBeat
      if (!beat || beat.startMs == null || beat.endMs == null) return
      if (beat.endMs - beat.startMs < EDIT_MIN_DURATION_MS * 2) return
      const midpointMs = beat.startMs + (beat.endMs - beat.startMs) * 0.5
      const splitResult = splitAnimationTimelineBeat({
        markdownText,
        model: timelineModel,
        beatRef: beat.beatRef,
        splitAtMs: midpointMs,
        minDurationMs: EDIT_MIN_DURATION_MS,
        snapStepMs: snapEnabled ? snapStepMs : null,
      })
      if (!splitResult.beatRef) return
      const committed = await commitMarkdownDocumentText(splitResult.markdownText)
      if (!committed) return
      setPlaying(false)
      const splitBeat = buildAnimationTimelineModel({
        graphData,
        markdownText: splitResult.markdownText,
      }).beats.find(entry => entry.beatRef === splitResult.beatRef)
      if (splitBeat) setPlaybackPosition(splitBeat.displayStart)
    },
    [activeBeat, commitMarkdownDocumentText, graphData, markdownText, snapEnabled, snapStepMs, timelineModel],
  )

  const handleSplitBeat = React.useCallback(async () => {
    if (!activeBeat || !canSplitActiveBeat) return
    const splitResult = splitAnimationTimelineBeat({
      markdownText,
      model: timelineModel,
      beatRef: activeBeat.beatRef,
      splitAtMs: snappedPlaybackPosition,
      minDurationMs: EDIT_MIN_DURATION_MS,
      snapStepMs: snapEnabled ? snapStepMs : null,
    })
    if (!splitResult.beatRef) return
    const committed = await commitMarkdownDocumentText(splitResult.markdownText)
    if (!committed) return
    setPlaying(false)
    const splitBeat = buildAnimationTimelineModel({
      graphData,
      markdownText: splitResult.markdownText,
    }).beats.find(beat => beat.beatRef === splitResult.beatRef)
    if (splitBeat) setPlaybackPosition(splitBeat.displayStart)
  }, [activeBeat, canSplitActiveBeat, commitMarkdownDocumentText, graphData, markdownText, snapEnabled, snapStepMs, snappedPlaybackPosition, timelineModel])

  const handleMergeBeatWithNext = React.useCallback(async () => {
    if (!activeBeat || !canMergeActiveBeatWithNext) return
    const nextMarkdownText = mergeAnimationTimelineBeatWithNext({
      markdownText,
      model: timelineModel,
      beatRef: activeBeat.beatRef,
    })
    const committed = await commitMarkdownDocumentText(nextMarkdownText)
    if (!committed) return
    setPlaying(false)
    setPlaybackPosition(activeBeat.displayStart)
  }, [activeBeat, canMergeActiveBeatWithNext, commitMarkdownDocumentText, markdownText, timelineModel])

  const handleMergeBeatWithNextAtTarget = React.useCallback(
    async (targetBeat: AnimationTimelineBeat | null | undefined) => {
      const beat = targetBeat || activeBeat
      if (!beat) return
      const beatIndex = timelineModel.beats.findIndex(entry => entry.beatRef === beat.beatRef)
      const nextBeat = beatIndex >= 0 ? timelineModel.beats[beatIndex + 1] || null : null
      const canMergeAtTarget =
        timelineModel.usesAbsoluteTiming &&
        beat.startMs != null &&
        nextBeat?.endMs != null &&
        (nextBeat?.items.length || 0) === 0
      if (!canMergeAtTarget) return
      const nextMarkdownText = mergeAnimationTimelineBeatWithNext({
        markdownText,
        model: timelineModel,
        beatRef: beat.beatRef,
      })
      const committed = await commitMarkdownDocumentText(nextMarkdownText)
      if (!committed) return
      setPlaying(false)
      setPlaybackPosition(beat.displayStart)
    },
    [activeBeat, commitMarkdownDocumentText, markdownText, timelineModel],
  )

  const handleRemoveGapBeforeBeat = React.useCallback(async () => {
    if (!activeBeat || !canRemoveGapBeforeActiveBeat) return
    const nextMarkdownText = removeAnimationTimelineGapBeforeBeat({
      markdownText,
      model: timelineModel,
      beatRef: activeBeat.beatRef,
    })
    const committed = await commitMarkdownDocumentText(nextMarkdownText)
    if (!committed) return
    setPlaying(false)
    setPlaybackPosition(Math.max(0, playbackPosition - activeGapBeforeMs))
  }, [activeBeat, activeGapBeforeMs, canRemoveGapBeforeActiveBeat, commitMarkdownDocumentText, markdownText, playbackPosition, timelineModel])

  const handleRemoveGapBeforeBeatAtTarget = React.useCallback(
    async (targetBeat: AnimationTimelineBeat | null | undefined) => {
      const beat = targetBeat || activeBeat
      if (!beat || beat.startMs == null) return
      const beatIndex = timelineModel.beats.findIndex(entry => entry.beatRef === beat.beatRef)
      if (beatIndex <= 0) return
      const previousBeat = timelineModel.beats[beatIndex - 1] || null
      const gapBeforeBeatMs =
        timelineModel.usesAbsoluteTiming && previousBeat?.endMs != null ? Math.max(0, beat.startMs - previousBeat.endMs) : 0
      if (gapBeforeBeatMs <= 0) return
      const nextMarkdownText = removeAnimationTimelineGapBeforeBeat({
        markdownText,
        model: timelineModel,
        beatRef: beat.beatRef,
      })
      const committed = await commitMarkdownDocumentText(nextMarkdownText)
      if (!committed) return
      setPlaying(false)
      setPlaybackPosition(Math.max(0, beat.displayStart - gapBeforeBeatMs))
    },
    [activeBeat, commitMarkdownDocumentText, markdownText, timelineModel],
  )

  const handleStartBeatLabelEdit = React.useCallback((beat: AnimationTimelineBeat) => {
    setEditingBeatRef(beat.beatRef)
    setEditingBeatLabel(beat.label)
  }, [])

  const handleCancelBeatLabelEdit = React.useCallback(() => {
    setEditingBeatRef(null)
    setEditingBeatLabel('')
  }, [])

  const handleCommitBeatLabelEdit = React.useCallback(async () => {
    if (!editingBeatRef) return
    const nextMarkdownText = updateAnimationTimelineMarkdownBeatLabel({
      markdownText,
      beatRef: editingBeatRef,
      label: editingBeatLabel,
    })
    await commitMarkdownDocumentText(nextMarkdownText)
    setEditingBeatRef(null)
    setEditingBeatLabel('')
  }, [commitMarkdownDocumentText, editingBeatLabel, editingBeatRef, markdownText])

  const handleStartBeatNoteEdit = React.useCallback((beat: AnimationTimelineBeat) => {
    setEditingBeatNoteRef(beat.beatRef)
    setEditingBeatNote(beat.note)
  }, [])

  const handleCancelBeatNoteEdit = React.useCallback(() => {
    setEditingBeatNoteRef(null)
    setEditingBeatNote('')
  }, [])

  const handleCommitBeatNoteEdit = React.useCallback(async () => {
    if (!editingBeatNoteRef) return
    const nextMarkdownText = updateAnimationTimelineMarkdownBeatNote({
      markdownText,
      beatRef: editingBeatNoteRef,
      note: editingBeatNote,
    })
    await commitMarkdownDocumentText(nextMarkdownText)
    setEditingBeatNoteRef(null)
    setEditingBeatNote('')
  }, [commitMarkdownDocumentText, editingBeatNote, editingBeatNoteRef, markdownText])

  const handleStartBeatSummaryEdit = React.useCallback((beat: AnimationTimelineBeat) => {
    setEditingBeatSummaryRef(beat.beatRef)
    setEditingBeatSummary(beat.summary)
  }, [])

  const handleCancelBeatSummaryEdit = React.useCallback(() => {
    setEditingBeatSummaryRef(null)
    setEditingBeatSummary('')
  }, [])

  const handleCommitBeatSummaryEdit = React.useCallback(async () => {
    if (!editingBeatSummaryRef) return
    const nextMarkdownText = updateAnimationTimelineMarkdownBeatSummary({
      markdownText,
      beatRef: editingBeatSummaryRef,
      summary: editingBeatSummary,
    })
    await commitMarkdownDocumentText(nextMarkdownText)
    setEditingBeatSummaryRef(null)
    setEditingBeatSummary('')
  }, [commitMarkdownDocumentText, editingBeatSummary, editingBeatSummaryRef, markdownText])

  const handleStartBeatTagsEdit = React.useCallback((beat: AnimationTimelineBeat) => {
    setEditingBeatTagsRef(beat.beatRef)
    setEditingBeatTags(beat.tags.join(', '))
  }, [])

  const handleCancelBeatTagsEdit = React.useCallback(() => {
    setEditingBeatTagsRef(null)
    setEditingBeatTags('')
  }, [])

  const handleCommitBeatTagsEdit = React.useCallback(async () => {
    if (!editingBeatTagsRef) return
    const nextMarkdownText = updateAnimationTimelineMarkdownBeatTags({
      markdownText,
      beatRef: editingBeatTagsRef,
      tags: editingBeatTags,
    })
    await commitMarkdownDocumentText(nextMarkdownText)
    setEditingBeatTagsRef(null)
    setEditingBeatTags('')
  }, [commitMarkdownDocumentText, editingBeatTags, editingBeatTagsRef, markdownText])

  const handleStartBeatSummaryQuickEdit = React.useCallback((beat: AnimationTimelineBeat) => {
    handleFocusBeat(beat)
    handleStartBeatSummaryEdit(beat)
  }, [handleFocusBeat, handleStartBeatSummaryEdit])

  const handleStartBeatLabelQuickEdit = React.useCallback((beat: AnimationTimelineBeat) => {
    handleFocusBeat(beat)
    handleStartBeatLabelEdit(beat)
  }, [handleFocusBeat, handleStartBeatLabelEdit])

  const handleInsertBeatBeforeQuick = React.useCallback((beat: AnimationTimelineBeat) => {
    void handleInsertBeatAtTarget(beat, 'before')
  }, [handleInsertBeatAtTarget])

  const handleInsertBeatAfterQuick = React.useCallback((beat: AnimationTimelineBeat) => {
    void handleInsertBeatAtTarget(beat, 'after')
  }, [handleInsertBeatAtTarget])

  const handleDeleteBeatQuick = React.useCallback((beat: AnimationTimelineBeat) => {
    void handleDeleteBeatAtTarget(beat)
  }, [handleDeleteBeatAtTarget])

  const handleDuplicateBeatQuick = React.useCallback((beat: AnimationTimelineBeat) => {
    void handleDuplicateBeatAtTarget(beat)
  }, [handleDuplicateBeatAtTarget])

  const handleSplitBeatQuick = React.useCallback((beat: AnimationTimelineBeat) => {
    void handleSplitBeatAtTarget(beat)
  }, [handleSplitBeatAtTarget])

  const handleMergeBeatWithNextQuick = React.useCallback((beat: AnimationTimelineBeat) => {
    void handleMergeBeatWithNextAtTarget(beat)
  }, [handleMergeBeatWithNextAtTarget])

  const handleRemoveGapBeforeBeatQuick = React.useCallback((beat: AnimationTimelineBeat) => {
    void handleRemoveGapBeforeBeatAtTarget(beat)
  }, [handleRemoveGapBeforeBeatAtTarget])

  const handleStartBeatNoteQuickEdit = React.useCallback((beat: AnimationTimelineBeat) => {
    handleFocusBeat(beat)
    handleStartBeatNoteEdit(beat)
  }, [handleFocusBeat, handleStartBeatNoteEdit])

  const handleStartBeatTagsQuickEdit = React.useCallback((beat: AnimationTimelineBeat) => {
    handleFocusBeat(beat)
    handleStartBeatTagsEdit(beat)
  }, [handleFocusBeat, handleStartBeatTagsEdit])

  const handleBeatPointerStart = React.useCallback(
    (event: React.PointerEvent<HTMLElement>, beat: AnimationTimelineBeat, beatIndex: number, mode: AnimationDragState['mode']) => {
      if (!timelineModel.usesAbsoluteTiming) return
      if (beat.startMs == null || beat.endMs == null) return
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const scrollLeft = scrollRef.current?.scrollLeft || 0
      ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
      setPlaying(false)
      setDragState({
        beatRef: beat.beatRef,
        beatIndex,
        mode,
        pointerId: event.pointerId,
        originClientX: event.clientX,
        originScrollLeft: scrollLeft,
        beatsSnapshot: timelineModel.beats.map(entry => ({ ...entry, items: entry.items.slice() })),
      })
    },
    [timelineModel.beats, timelineModel.usesAbsoluteTiming],
  )

  React.useEffect(() => {
    if (!dragState || !timelineModel.usesAbsoluteTiming || timelineUnitsPerPixel <= 0) return
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return
      const scrollEl = scrollRef.current
      if (scrollEl) {
        const rect = scrollEl.getBoundingClientRect()
        if (event.clientX < rect.left + DRAG_EDGE_SCROLL_THRESHOLD_PX) {
          scrollEl.scrollLeft = Math.max(0, scrollEl.scrollLeft - DRAG_EDGE_SCROLL_STEP_PX)
        } else if (event.clientX > rect.right - DRAG_EDGE_SCROLL_THRESHOLD_PX) {
          scrollEl.scrollLeft += DRAG_EDGE_SCROLL_STEP_PX
        }
      }
      const currentScrollLeft = scrollEl?.scrollLeft || 0
      const deltaPx = event.clientX - dragState.originClientX + (currentScrollLeft - dragState.originScrollLeft)
      const deltaMs = deltaPx * timelineUnitsPerPixel
      const nextOverride = resolveAnimationTimelineBeatTimingEdit({
        beats: dragState.beatsSnapshot,
        beatIndex: dragState.beatIndex,
        mode: dragState.mode,
        deltaMs,
        minDurationMs: EDIT_MIN_DURATION_MS,
        snapStepMs: snapEnabled ? snapStepMs : null,
      })
      if (!nextOverride) return
      setTimingOverrides(prev => ({
        ...prev,
        [dragState.beatRef]: nextOverride,
      }))
    }
    const commitDrag = async () => {
      const override = timingOverridesRef.current[dragState.beatRef]
      setDragState(null)
      if (!override) return
      const nextMarkdownText = updateAnimationTimelineMarkdownBeatTiming({
        markdownText,
        beatRef: dragState.beatRef,
        startMs: override.startMs,
        endMs: override.endMs,
      })
      await commitMarkdownDocumentText(nextMarkdownText)
      setTimingOverrides(current => {
        const next = { ...current }
        delete next[dragState.beatRef]
        return next
      })
    }
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return
      void commitDrag()
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerUp, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [commitMarkdownDocumentText, dragState, markdownText, snapEnabled, snapStepMs, timelineModel.usesAbsoluteTiming, timelineUnitsPerPixel])

  if (!timelineModel.beats.length) {
    return (
      <section className="w-full h-full bg-[#0b0f17] text-slate-100">
        <div className="h-full w-full flex items-center justify-center p-8">
          <div className="max-w-xl rounded-2xl border border-slate-800 bg-slate-900/85 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">2D Renderer: Animation</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Add beat-linked nodes like <code>NODE_CLIP_01</code> / <code>NODE_OVERLAY_01</code> or provide
              <code> timeline.beats </code> in Markdown frontmatter to populate the native timeline surface.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This renderer reads the current workspace graph and Markdown document directly. It does not ship fixture-only demo rows.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full h-full bg-[#0b0f17] text-slate-100 select-none">
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-slate-800 bg-[#0f1625]/95 px-5 pt-5 pb-4 backdrop-blur">
          <div className="player-config">
            <button
              type="button"
              role="switch"
              aria-checked={runtimeAutoScrollEnabled}
              className={`ant-switch ${runtimeAutoScrollEnabled ? 'ant-switch-checked' : ''} relative inline-flex min-h-9 min-w-[248px] items-center rounded-full border px-3 py-2 pr-4 text-sm transition ${
                runtimeAutoScrollEnabled
                  ? 'border-cyan-400/70 bg-cyan-500/18 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
              ant-click-animating="true"
              style={{ marginBottom: 20 }}
              onClick={() => setRuntimeAutoScrollEnabled(current => !current)}
            >
              <div
                className={`ant-switch-handle absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white shadow transition ${
                  runtimeAutoScrollEnabled ? 'translate-x-[208px]' : 'translate-x-0'
                }`}
              />
              <span className="ant-switch-inner block pr-10 text-left font-medium">Enable Runtime Auto Scroll</span>
              <div className="ant-click-animating-node pointer-events-none absolute inset-0 rounded-full" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton title={playing ? 'Pause' : 'Play'} showTooltip className={getTimelineIconButtonClassName(true)} onClick={handleTogglePlayback}>
              {playing ? <Pause className={toolbarIconClassName} /> : <Play className={toolbarIconClassName} />}
            </IconButton>
            <IconButton title="Prev Beat" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStepBeat(-1)}>
              <SkipBack className={toolbarIconClassName} />
            </IconButton>
            <IconButton title="Next Beat" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStepBeat(1)}>
              <SkipForward className={toolbarIconClassName} />
            </IconButton>
            <IconButton title="Reset" showTooltip className={getTimelineIconButtonClassName(true)} onClick={handleReset}>
              <RotateCcw className={toolbarIconClassName} />
            </IconButton>
            <IconButton title="Insert Before" showTooltip className={getTimelineIconButtonClassName(!!activeBeat || timelineModel.beats.length > 0)} onClick={() => void handleInsertBeat('before')}>
              <ArrowLeftToLine className={toolbarIconClassName} />
            </IconButton>
            <IconButton title="Insert After" showTooltip className={getTimelineIconButtonClassName(!!activeBeat || timelineModel.beats.length > 0)} onClick={() => void handleInsertBeat('after')}>
              <ArrowRightToLine className={toolbarIconClassName} />
            </IconButton>
            <IconButton
              title={canSplitActiveBeat ? 'Split active beat at playhead' : 'Move the playhead inside the active beat to split it'}
              showTooltip
              className={getTimelineIconButtonClassName(canSplitActiveBeat)}
              onClick={() => void handleSplitBeat()}
              disabled={!canSplitActiveBeat}
            >
              <Scissors className={toolbarIconClassName} />
            </IconButton>
            <IconButton
              title={activeBeat ? 'Duplicate active beat after the current beat' : 'Select an active beat first'}
              showTooltip
              className={getTimelineIconButtonClassName(!!activeBeat)}
              onClick={() => void handleDuplicateBeat()}
              disabled={!activeBeat}
            >
              <Copy className={toolbarIconClassName} />
            </IconButton>
            <IconButton
              title={canMergeActiveBeatWithNext ? 'Merge active beat with next empty beat' : 'Merge is available only when the next beat is empty'}
              showTooltip
              className={getTimelineIconButtonClassName(canMergeActiveBeatWithNext)}
              onClick={() => void handleMergeBeatWithNext()}
              disabled={!canMergeActiveBeatWithNext}
            >
              <GitMerge className={toolbarIconClassName} />
            </IconButton>
            <IconButton
              title={
                canRemoveGapBeforeActiveBeat
                  ? `Remove ${Math.round(activeGapBeforeMs)}ms gap before active beat`
                  : 'Remove Gap is available only when a positive gap exists before the active beat'
              }
              showTooltip
              className={getTimelineIconButtonClassName(canRemoveGapBeforeActiveBeat)}
              onClick={() => void handleRemoveGapBeforeBeat()}
              disabled={!canRemoveGapBeforeActiveBeat}
            >
              <ArrowLeftToLine className={toolbarIconClassName} />
            </IconButton>
            <IconButton
              title={canDeleteActiveBeat ? 'Delete active beat' : 'Delete is available only for empty beats'}
              showTooltip
              className={getTimelineIconButtonClassName(canDeleteActiveBeat)}
              onClick={() => void handleDeleteBeat()}
              disabled={!canDeleteActiveBeat}
            >
              <Trash2 className={toolbarIconClassName} />
            </IconButton>
            <div className="flex h-10 items-center rounded-md border border-slate-800 bg-slate-950/80 px-3 text-sm text-slate-200">
              <span className="font-mono">{currentTimeLabel}</span>
            </div>
            <div className="flex h-10 items-center rounded-md border border-slate-800 bg-slate-950/80 px-3 text-sm text-slate-400">
              <span className="font-mono">{totalTimeLabel}</span>
            </div>
            <div className="flex h-10 items-center overflow-hidden rounded-md border border-slate-800 bg-slate-950/80">
              {PLAYBACK_RATES.map(rate => (
                <button
                  key={rate}
                  type="button"
                  className={`h-full px-3 text-sm transition ${
                    playbackRate === rate ? 'bg-cyan-500/18 text-cyan-50' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                  onClick={() => setPlaybackRate(rate)}
                >
                  {rate.toFixed(1)}x
                </button>
              ))}
            </div>
            <div className="flex h-10 items-center overflow-hidden rounded-md border border-slate-800 bg-slate-950/80">
              <button
                type="button"
                className={`h-full px-3 text-sm transition ${
                  snapEnabled ? 'bg-cyan-500/18 text-cyan-50' : 'text-slate-400 hover:bg-slate-900'
                }`}
                onClick={() => setSnapEnabled(current => !current)}
              >
                Snap {snapEnabled ? 'On' : 'Off'}
              </button>
              {SNAP_STEP_OPTIONS_MS.map(step => (
                <button
                  key={step}
                  type="button"
                  className={`h-full px-3 text-sm transition ${
                    snapStepMs === step ? 'bg-cyan-500/18 text-cyan-50' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                  onClick={() => setSnapStepMs(step)}
                >
                  {step}ms
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm text-slate-300">
              {timelineModel.usesAbsoluteTiming ? (
                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-400">
                  Drag beat bars to move. Drag edges to resize. Snap follows the active grid step. Split uses the current playhead.
                </span>
              ) : null}
              {activeBeat ? (
                editingBeatRef === activeBeat.beatRef ? (
                  <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-2">
                    <input
                      aria-label="Active beat label"
                      className="w-44 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none"
                      value={editingBeatLabel}
                      onChange={event => setEditingBeatLabel(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleCommitBeatLabelEdit()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          handleCancelBeatLabelEdit()
                        }
                      }}
                      autoFocus
                    />
                    <IconButton title="Save beat label" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => void handleCommitBeatLabelEdit()}>
                      <Check className={toolbarIconClassName} />
                    </IconButton>
                    <IconButton title="Cancel beat label edit" showTooltip className={getTimelineIconButtonClassName(true)} onClick={handleCancelBeatLabelEdit}>
                      <X className={toolbarIconClassName} />
                    </IconButton>
                  </div>
                ) : (
                  <IconButton title={`Rename ${activeBeat.label}`} showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStartBeatLabelEdit(activeBeat)}>
                    <Pencil className={toolbarIconClassName} />
                  </IconButton>
                )
              ) : null}
              {activeBeat ? (
                editingBeatNoteRef === activeBeat.beatRef ? (
                  <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-2">
                    <textarea
                      aria-label="Active beat note"
                      className="min-h-16 w-52 resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none"
                      value={editingBeatNote}
                      onChange={event => setEditingBeatNote(event.target.value)}
                    />
                    <div className="flex flex-col gap-2">
                      <IconButton title="Save beat note" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => void handleCommitBeatNoteEdit()}>
                        <Check className={toolbarIconClassName} />
                      </IconButton>
                      <IconButton title="Cancel beat note edit" showTooltip className={getTimelineIconButtonClassName(true)} onClick={handleCancelBeatNoteEdit}>
                        <X className={toolbarIconClassName} />
                      </IconButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                    <IconButton title={activeBeat.note ? 'Edit beat note' : 'Add beat note'} showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStartBeatNoteEdit(activeBeat)}>
                      <FileText className={toolbarIconClassName} />
                    </IconButton>
                    <span className="max-w-48 truncate text-slate-400">{activeBeat.note || 'No note'}</span>
                  </div>
                )
              ) : null}
              {activeBeat ? (
                editingBeatSummaryRef === activeBeat.beatRef ? (
                  <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-2">
                    <textarea
                      aria-label="Active beat summary"
                      className="min-h-16 w-60 resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none"
                      value={editingBeatSummary}
                      onChange={event => setEditingBeatSummary(event.target.value)}
                    />
                    <div className="flex flex-col gap-2">
                      <IconButton title="Save beat summary" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => void handleCommitBeatSummaryEdit()}>
                        <Check className={toolbarIconClassName} />
                      </IconButton>
                      <IconButton title="Cancel beat summary edit" showTooltip className={getTimelineIconButtonClassName(true)} onClick={handleCancelBeatSummaryEdit}>
                        <X className={toolbarIconClassName} />
                      </IconButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                    <IconButton title={activeBeat.summary ? 'Edit beat summary' : 'Add beat summary'} showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStartBeatSummaryEdit(activeBeat)}>
                      <AlignLeft className={toolbarIconClassName} />
                    </IconButton>
                    <span className="max-w-56 truncate text-slate-400">{activeBeat.summary || 'No summary'}</span>
                  </div>
                )
              ) : null}
              {activeBeat ? (
                editingBeatTagsRef === activeBeat.beatRef ? (
                  <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-2">
                    <input
                      aria-label="Active beat tags"
                      className="w-56 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none"
                      value={editingBeatTags}
                      onChange={event => setEditingBeatTags(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleCommitBeatTagsEdit()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          handleCancelBeatTagsEdit()
                        }
                      }}
                      placeholder="comma, separated, tags"
                    />
                    <IconButton title="Save beat tags" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => void handleCommitBeatTagsEdit()}>
                      <Check className={toolbarIconClassName} />
                    </IconButton>
                    <IconButton title="Cancel beat tags edit" showTooltip className={getTimelineIconButtonClassName(true)} onClick={handleCancelBeatTagsEdit}>
                      <X className={toolbarIconClassName} />
                    </IconButton>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                    <IconButton title={activeBeat.tags.length > 0 ? 'Edit beat tags' : 'Add beat tags'} showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStartBeatTagsEdit(activeBeat)}>
                      <Tags className={toolbarIconClassName} />
                    </IconButton>
                    <span className="max-w-56 truncate text-slate-400">{activeBeat.tags.length > 0 ? activeBeat.tags.join(' · ') : 'No tags'}</span>
                  </div>
                )
              ) : null}
              {!canDeleteActiveBeat && activeBeat ? (
                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-500">
                  Delete is blocked while the active beat still owns lane items.
                </span>
              ) : null}
              {!canMergeActiveBeatWithNext && activeBeat && nextBeat ? (
                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-500">
                  Merge Next is blocked while the next beat still owns lane items.
                </span>
              ) : null}
              {activeBeat ? (
                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2">
                  Active Beat: {activeBeat.beatRef}
                </span>
              ) : null}
              {canRemoveGapBeforeActiveBeat ? (
                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-amber-200">
                  Gap Before: {Math.round(activeGapBeforeMs)}ms
                </span>
              ) : null}
              {soloLaneId ? (
                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-cyan-200">
                  Solo Lane: {soloLaneId}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-4">
            <input
              aria-label="Animation timeline playhead"
              className="w-full accent-cyan-400"
              type="range"
              min={0}
              max={timelineModel.totalSpan || 0}
              step={timelineModel.usesAbsoluteTiming ? 10 : 0.01}
              value={playbackPosition}
              onChange={event => {
                setPlaying(false)
                setPlaybackPosition(Number(event.target.value || 0))
              }}
            />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="w-44 shrink-0 border-r border-slate-800 bg-[#111827]">
            <div
              className="flex items-center border-b border-slate-800 px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500"
              style={{ height: SCALE_ROW_HEIGHT_PX }}
            >
              Scale
            </div>
            <div
              className="flex items-center border-b border-slate-800 px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400"
              style={{ height: BEAT_HEADER_HEIGHT_PX }}
            >
              Timeline
            </div>
            {lanePresentations.map(lane => (
              <div
                key={lane.id}
                className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 text-sm font-medium text-slate-200"
                style={{ minHeight: LANE_ROW_HEIGHT_PX }}
              >
                <div className="flex min-w-0 items-center gap-1">
                  <IconButton
                    title={`Move ${lane.label} up`}
                    showTooltip
                    className={getTimelineIconButtonClassName(lanePresentations[0]?.id !== lane.id)}
                    onClick={() => void handleReorderLane(lane.id, -1)}
                    disabled={lanePresentations[0]?.id === lane.id}
                  >
                    <ArrowUp className={toolbarIconClassName} />
                  </IconButton>
                  <IconButton
                    title={`Move ${lane.label} down`}
                    showTooltip
                    className={getTimelineIconButtonClassName(lanePresentations[lanePresentations.length - 1]?.id !== lane.id)}
                    onClick={() => void handleReorderLane(lane.id, 1)}
                    disabled={lanePresentations[lanePresentations.length - 1]?.id === lane.id}
                  >
                    <ArrowDown className={toolbarIconClassName} />
                  </IconButton>
                  <div className={`truncate ${lane.solo ? 'text-cyan-200' : lane.hidden ? 'text-slate-500 line-through' : lane.muted ? 'text-slate-400' : 'text-slate-200'}`}>
                    {lane.label}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton
                    title={lane.hidden && !lane.solo ? `Show ${lane.label}` : `Hide ${lane.label}`}
                    showTooltip
                    className={getTimelineIconButtonClassName(true)}
                    onClick={() => void handleToggleHiddenLane(lane.id)}
                  >
                    <EyeOff className={toolbarIconClassName} />
                  </IconButton>
                  <IconButton
                    title={lane.muted ? `Unmute ${lane.label}` : `Mute ${lane.label}`}
                    showTooltip
                    className={getTimelineIconButtonClassName(true, lane.muted ? 'amber' : 'default')}
                    onClick={() => void handleToggleMutedLane(lane.id)}
                  >
                    <VolumeX className={toolbarIconClassName} />
                  </IconButton>
                  <IconButton
                    title={lane.solo ? `Unsolo ${lane.label}` : `Solo ${lane.label}`}
                    showTooltip
                    className={getTimelineIconButtonClassName(true, lane.solo ? 'cyan' : 'default')}
                    onClick={() => void handleToggleSoloLane(lane.id)}
                  >
                    <CircleDot className={toolbarIconClassName} />
                  </IconButton>
                </div>
              </div>
            ))}
          </aside>
          <div ref={scrollRef} className="min-w-0 flex-1 overflow-auto bg-[#0b1020]">
            <div className="relative" style={{ width: Math.max(totalTimelineWidth, 1) }}>
              <div
                className="pointer-events-none absolute z-20 w-px bg-cyan-300/90 shadow-[0_0_16px_rgba(34,211,238,0.45)]"
                style={{
                  left: playheadOffsetPx,
                  top: 0,
                  height: SCALE_ROW_HEIGHT_PX + BEAT_HEADER_HEIGHT_PX + lanePresentations.length * LANE_ROW_HEIGHT_PX,
                }}
              />
              <div className="sticky top-0 z-10 bg-[#0f1625]/95 backdrop-blur">
                <div className="relative border-b border-slate-800" style={{ height: SCALE_ROW_HEIGHT_PX }}>
                  {snapMarks.map(mark => {
                    const left = timelineModel.totalSpan > 0 ? (mark / timelineModel.totalSpan) * totalTimelineWidth : 0
                    return (
                      <div key={`snap:${mark}`} className="pointer-events-none absolute inset-y-0" style={{ left }}>
                        <div className="h-full w-px bg-cyan-500/15" />
                      </div>
                    )
                  })}
                  {scaleMarks.map(mark => {
                    const left = timelineModel.totalSpan > 0 ? (mark.position / timelineModel.totalSpan) * totalTimelineWidth : 0
                    return (
                      <div key={mark.key} className="absolute inset-y-0" style={{ left }}>
                        <div className="h-full w-px bg-slate-700/80" />
                        <span className="absolute left-2 top-1 text-[11px] font-medium text-slate-400">{mark.label}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex border-b border-slate-800">
                  {timelineModel.beats.map((beat, index) => {
                    const isActiveBeat = index === activeBeatIndex
                    const beatLaneSummary = buildBeatLaneSummary(beat.items)
                    const visibleBeatLaneSummary = beatLaneSummary.slice(0, BEAT_LANE_SUMMARY_LIMIT)
                    const previousBeatForCard = index > 0 ? timelineModel.beats[index - 1] || null : null
                    const nextBeatForCard = timelineModel.beats[index + 1] || null
                    const canQuickDeleteBeat = beat.items.length === 0
                    const gapBeforeCardMs =
                      timelineModel.usesAbsoluteTiming && beat.startMs != null && previousBeatForCard?.endMs != null
                        ? Math.max(0, beat.startMs - previousBeatForCard.endMs)
                        : 0
                    const canQuickSplitBeat =
                      timelineModel.usesAbsoluteTiming &&
                      beat.startMs != null &&
                      beat.endMs != null &&
                      beat.endMs - beat.startMs >= EDIT_MIN_DURATION_MS * 2
                    const canQuickRemoveGapBeforeBeat = gapBeforeCardMs > 0
                    const canQuickMergeBeatWithNext =
                      timelineModel.usesAbsoluteTiming &&
                      beat.startMs != null &&
                      nextBeatForCard?.endMs != null &&
                      (nextBeatForCard?.items.length || 0) === 0
                    return (
                      <div
                        key={beat.beatRef}
                        className={`group/beat relative flex shrink-0 flex-col justify-start overflow-hidden border-r border-slate-800 px-4 py-3 text-left transition ${
                          isActiveBeat ? 'bg-cyan-500/10' : 'bg-transparent hover:bg-slate-900/80'
                        }`}
                        style={{ width: beatWidths[index], height: BEAT_HEADER_HEIGHT_PX }}
                      >
                        <div className="absolute right-3 top-3 z-30 flex items-center gap-1 opacity-0 transition group-hover/beat:opacity-100 group-focus-within/beat:opacity-100">
                          <IconButton
                            title={`Insert beat before ${beat.label}`}
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(true)}
                            onClick={() => handleInsertBeatBeforeQuick(beat)}
                          >
                            <ArrowLeftToLine className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={`Insert beat after ${beat.label}`}
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(true)}
                            onClick={() => handleInsertBeatAfterQuick(beat)}
                          >
                            <ArrowRightToLine className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={`Rename ${beat.label}`}
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(true)}
                            onClick={() => handleStartBeatLabelQuickEdit(beat)}
                          >
                            <Pencil className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={`Duplicate ${beat.label}`}
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(true)}
                            onClick={() => handleDuplicateBeatQuick(beat)}
                          >
                            <Copy className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={
                              canQuickRemoveGapBeforeBeat
                                ? `Remove ${Math.round(gapBeforeCardMs)}ms gap before ${beat.label}`
                                : `Remove Gap is available only when ${beat.label} has a positive leading gap`
                            }
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(canQuickRemoveGapBeforeBeat)}
                            onClick={() => handleRemoveGapBeforeBeatQuick(beat)}
                            disabled={!canQuickRemoveGapBeforeBeat}
                          >
                            <ArrowLeft className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={
                              canQuickMergeBeatWithNext
                                ? `Merge ${beat.label} with next empty beat`
                                : `Merge Next is available only when the next beat is empty`
                            }
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(canQuickMergeBeatWithNext)}
                            onClick={() => handleMergeBeatWithNextQuick(beat)}
                            disabled={!canQuickMergeBeatWithNext}
                          >
                            <GitMerge className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={
                              canQuickSplitBeat
                                ? `Split ${beat.label} at the midpoint`
                                : `Split is available only when ${beat.label} is long enough`
                            }
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(canQuickSplitBeat)}
                            onClick={() => handleSplitBeatQuick(beat)}
                            disabled={!canQuickSplitBeat}
                          >
                            <Scissors className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={canQuickDeleteBeat ? `Delete ${beat.label}` : `Delete is available only for empty beats`}
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(canQuickDeleteBeat)}
                            onClick={() => handleDeleteBeatQuick(beat)}
                            disabled={!canQuickDeleteBeat}
                          >
                            <Trash2 className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={beat.note ? `Edit note for ${beat.label}` : `Add note for ${beat.label}`}
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(true)}
                            onClick={() => handleStartBeatNoteQuickEdit(beat)}
                          >
                            <FileText className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={beat.summary ? `Edit summary for ${beat.label}` : `Add summary for ${beat.label}`}
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(true)}
                            onClick={() => handleStartBeatSummaryQuickEdit(beat)}
                          >
                            <AlignLeft className={compactToolbarIconClassName} />
                          </IconButton>
                          <IconButton
                            title={beat.tags.length > 0 ? `Edit tags for ${beat.label}` : `Add tags for ${beat.label}`}
                            showTooltip
                            className={getTimelineCompactIconButtonClassName(true)}
                            onClick={() => handleStartBeatTagsQuickEdit(beat)}
                          >
                            <Tags className={compactToolbarIconClassName} />
                          </IconButton>
                        </div>
                        <button
                          type="button"
                          className="absolute inset-0 z-0"
                          onDoubleClick={() => handleStartBeatLabelEdit(beat)}
                          onClick={() => {
                            setPlaying(false)
                            setPlaybackPosition(beat.displayStart)
                          }}
                        />
                        {timelineModel.usesAbsoluteTiming ? (
                          <>
                            <button
                              type="button"
                              aria-label={`Move ${beat.label}`}
                              className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
                              onPointerDown={event => handleBeatPointerStart(event, beat, index, 'move')}
                              onClick={() => {
                                setPlaying(false)
                                setPlaybackPosition(beat.displayStart)
                              }}
                            />
                            <button
                              type="button"
                              aria-label={`Resize ${beat.label} start`}
                              className="absolute inset-y-0 left-0 z-20 w-3 cursor-ew-resize bg-cyan-300/0 hover:bg-cyan-300/20"
                              onPointerDown={event => handleBeatPointerStart(event, beat, index, 'resize-start')}
                            />
                            <button
                              type="button"
                              aria-label={`Resize ${beat.label} end`}
                              className="absolute inset-y-0 right-0 z-20 w-3 cursor-ew-resize bg-cyan-300/0 hover:bg-cyan-300/20"
                              onPointerDown={event => handleBeatPointerStart(event, beat, index, 'resize-end')}
                            />
                          </>
                        ) : (
                          <span />
                        )}
                        <span className="relative z-10 text-[11px] uppercase tracking-[0.22em] text-slate-500">{beat.beatRef}</span>
                        <span className="relative z-10 mt-1 text-sm font-semibold text-slate-100">{beat.label}</span>
                        <div className="relative z-10 mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                          <span>
                            {timelineModel.usesAbsoluteTiming
                              ? `${formatAnimationTimelineTimestamp(beat.startMs)} -> ${formatAnimationTimelineTimestamp(beat.endMs)}`
                              : `${beat.items.length} item${beat.items.length === 1 ? '' : 's'}`}
                          </span>
                          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300">
                            {beat.items.length} item{beat.items.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {beatLaneSummary.length > 0 ? (
                          <div className="relative z-10 mt-2 flex items-center gap-1 overflow-hidden text-[11px]">
                            {visibleBeatLaneSummary.map(({ laneId, count }) => (
                              <button
                                type="button"
                                key={`${beat.beatRef}:lane:${laneId}`}
                                className={`truncate rounded-full border px-2 py-0.5 transition hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-cyan-300 ${LANE_ACCENT_CLASS[laneId]}`}
                                title={`${LANE_LABEL[laneId]}: ${count} item${count === 1 ? '' : 's'}`}
                                onClick={() => handleFocusLaneFromBeatCard(laneId)}
                              >
                                {LANE_LABEL[laneId]} {count}
                              </button>
                            ))}
                            {beatLaneSummary.length > BEAT_LANE_SUMMARY_LIMIT ? (
                              <span
                                className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-slate-300"
                                title={`${beatLaneSummary.length - BEAT_LANE_SUMMARY_LIMIT} more lane summaries`}
                              >
                                +{beatLaneSummary.length - BEAT_LANE_SUMMARY_LIMIT}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {beat.summary ? (
                          <span className="relative z-10 mt-2 truncate text-xs text-slate-300" title={beat.summary}>
                            {beat.summary}
                          </span>
                        ) : null}
                        {beat.tags.length > 0 ? (
                          <div className="relative z-10 mt-2 flex items-center gap-1 overflow-hidden text-[11px]">
                            {beat.tags.slice(0, 3).map(tag => (
                              <span
                                key={`${beat.beatRef}:${tag}`}
                                className="truncate rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-100"
                                title={tag}
                              >
                                {tag}
                              </span>
                            ))}
                            {beat.tags.length > 3 ? (
                              <span
                                className="rounded-full border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-slate-400"
                                title={beat.tags.slice(3).join(', ')}
                              >
                                +{beat.tags.length - 3}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
              {lanePresentations.map(lane => (
                <div
                  key={lane.id}
                  ref={node => {
                    laneRowRefs.current[lane.id] = node
                  }}
                  className={`flex border-b transition ${
                    highlightedLaneShortcutId === lane.id ? 'border-cyan-500/70 bg-cyan-500/5' : 'border-slate-900/80'
                  }`}
                >
                  {timelineModel.beats.map((beat, index) => {
                    const laneItems = beat.items.filter(item => item.laneId === lane.id)
                    const isActiveBeat = index === activeBeatIndex
                    return (
                      <div
                        key={`${lane.id}:${beat.beatRef}`}
                        className={`shrink-0 border-r border-slate-800 px-3 py-3 ${
                          isActiveBeat ? 'bg-slate-900/75' : 'bg-[#0b1020]'
                        }`}
                        style={{ width: beatWidths[index], minHeight: LANE_ROW_HEIGHT_PX }}
                      >
                        {lane.visibleItems && laneItems.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {laneItems.map(item => {
                              const previousBeat = timelineModel.beats[index - 1] || null
                              const nextBeat = timelineModel.beats[index + 1] || null
                              return (
                                <article
                                  key={item.id}
                                  className={`rounded-md border px-3 py-2 shadow-sm ${LANE_ACCENT_CLASS[item.laneId]} ${
                                    lane.muted ? 'opacity-40 saturate-50' : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-sm font-semibold">{item.title}</div>
                                      <div className="mt-1 truncate text-xs opacity-80">{item.subtitle || item.kind}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <IconButton
                                        title={previousBeat ? `Move ${item.title} to ${previousBeat.label}` : `No previous beat for ${item.title}`}
                                        showTooltip
                                        className={getTimelineIconButtonClassName(!!previousBeat)}
                                        onClick={() => void handleMoveItemToBeat(item.nodeId, previousBeat)}
                                        disabled={!previousBeat}
                                      >
                                        <ArrowLeft className={toolbarIconClassName} />
                                      </IconButton>
                                      <IconButton
                                        title={nextBeat ? `Move ${item.title} to ${nextBeat.label}` : `No next beat for ${item.title}`}
                                        showTooltip
                                        className={getTimelineIconButtonClassName(!!nextBeat)}
                                        onClick={() => void handleMoveItemToBeat(item.nodeId, nextBeat)}
                                        disabled={!nextBeat}
                                      >
                                        <ArrowRight className={toolbarIconClassName} />
                                      </IconButton>
                                    </div>
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        ) : lane.soloFiltered ? (
                          <div className="flex h-full items-center text-xs text-slate-600">Solo filtered</div>
                        ) : lane.hidden ? (
                          <div className="flex h-full items-center text-xs text-slate-600">Hidden lane</div>
                        ) : lane.muted ? (
                          <div className="flex h-full items-center text-xs text-slate-600">Muted lane</div>
                        ) : (
                          <div className="flex h-full items-center text-xs text-slate-600">No {lane.label.toLowerCase()} item</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
