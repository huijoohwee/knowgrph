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
  Pencil,
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
import {
  isAnimationTimelineMutationHotkeyAction,
  resolveAnimationTimelineHotkeyAction,
  shouldIgnoreAnimationTimelineHotkeys,
} from '@/components/AnimationCanvas/animationKeyboard'
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
import './AnimationCanvas.css'

const ORDINAL_PLAYBACK_BEAT_MS = 1000
const SCALE_ROW_HEIGHT_PX = 32
const BEAT_HEADER_HEIGHT_PX = 104
const LANE_ROW_HEIGHT_PX = 72
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

function buildTimelineEditorTimeUnits(args: {
  totalSpan: number
  totalTimelineWidth: number
  usesAbsoluteTiming: boolean
}): Array<{ key: string; left: number; width: number; label: string | null; big: boolean }> {
  const totalSpan = Math.max(0, args.totalSpan)
  const totalTimelineWidth = Math.max(0, args.totalTimelineWidth)
  if (totalSpan <= 0 || totalTimelineWidth <= 0) return []
  if (!args.usesAbsoluteTiming) {
    const unitWidth = totalTimelineWidth / totalSpan
    return Array.from({ length: totalSpan }, (_, index) => ({
      key: `beat-unit:${index}`,
      left: unitWidth * index,
      width: unitWidth,
      label: String(index),
      big: true,
    }))
  }
  const unitMs = totalSpan <= 30000 ? 500 : 1000
  const majorStepMs = unitMs * 10
  const units: Array<{ key: string; left: number; width: number; label: string | null; big: boolean }> = []
  for (let start = 0; start < totalSpan; start += unitMs) {
    const end = Math.min(totalSpan, start + unitMs)
    const left = (start / totalSpan) * totalTimelineWidth
    const nextLeft = (end / totalSpan) * totalTimelineWidth
    const big = start % majorStepMs === 0
    units.push({
      key: `time-unit:${start}`,
      left,
      width: Math.max(16, nextLeft - left),
      label: big ? String(Math.round(start / 1000)) : null,
      big,
    })
  }
  return units
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

function resolveTimelineEditorActionEffectClassName(laneId: AnimationTimelineLaneId): 'effect0' | 'effect1' {
  return laneId === 'audio' ? 'effect0' : 'effect1'
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
  const [selectedLaneId, setSelectedLaneId] = React.useState<AnimationTimelineLaneId | null>(null)
  const [selectedItemNodeId, setSelectedItemNodeId] = React.useState<string | null>(null)
  const [timingOverrides, setTimingOverrides] = React.useState<Record<string, AnimationTimelineBeatTimingOverride>>({})
  const [dragState, setDragState] = React.useState<AnimationDragState | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const laneRowRefs = React.useRef<Partial<Record<AnimationTimelineLaneId, HTMLDivElement | null>>>({})
  const laneOptionRefs = React.useRef<Partial<Record<AnimationTimelineLaneId, HTMLDivElement | null>>>({})
  const laneItemOptionRefs = React.useRef<Record<string, HTMLElement | null>>({})
  const beatOptionRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const laneShortcutHighlightTimeoutRef = React.useRef<number | null>(null)
  const timingOverridesRef = React.useRef<Record<string, AnimationTimelineBeatTimingOverride>>({})
  const dragPointerClientXRef = React.useRef<number | null>(null)
  const dragEdgeScrollDirectionRef = React.useRef<-1 | 0 | 1>(0)
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
    dragPointerClientXRef.current = null
    dragEdgeScrollDirectionRef.current = 0
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
  const timelineEditorTimeUnits = React.useMemo(
    () =>
      buildTimelineEditorTimeUnits({
        totalSpan: timelineModel.totalSpan,
        totalTimelineWidth,
        usesAbsoluteTiming: timelineModel.usesAbsoluteTiming,
      }),
    [timelineModel.totalSpan, timelineModel.usesAbsoluteTiming, totalTimelineWidth],
  )
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
  const selectedLane = React.useMemo(
    () => lanePresentations.find(lane => lane.id === selectedLaneId) || null,
    [lanePresentations, selectedLaneId],
  )
  const selectedOrActiveBeatRef = activeBeat?.beatRef || timelineModel.beats[0]?.beatRef || null
  const selectedOrFirstLaneId = selectedLaneId || lanePresentations[0]?.id || null
  const selectedLaneVisibleItemContexts = React.useMemo(() => {
    if (!selectedLane) return [] as Array<{
      nodeId: string
      title: string
      laneId: AnimationTimelineLaneId
      beatRef: string
      previousBeat: AnimationTimelineBeat | null
      nextBeat: AnimationTimelineBeat | null
    }>
    if (!selectedLane.visibleItems) return []
    const contexts: Array<{
      nodeId: string
      title: string
      laneId: AnimationTimelineLaneId
      beatRef: string
      previousBeat: AnimationTimelineBeat | null
      nextBeat: AnimationTimelineBeat | null
    }> = []
    for (let index = 0; index < timelineModel.beats.length; index += 1) {
      const beat = timelineModel.beats[index]
      if (!beat) continue
      const previousBeat = timelineModel.beats[index - 1] || null
      const nextBeat = timelineModel.beats[index + 1] || null
      for (const item of beat.items) {
        if (item.laneId !== selectedLane.id) continue
        contexts.push({
          nodeId: item.nodeId,
          title: item.title,
          laneId: item.laneId,
          beatRef: beat.beatRef,
          previousBeat,
          nextBeat,
        })
      }
    }
    return contexts
  }, [selectedLane, timelineModel.beats])
  const selectedItemContext = React.useMemo(
    () => selectedLaneVisibleItemContexts.find(item => item.nodeId === selectedItemNodeId) || null,
    [selectedItemNodeId, selectedLaneVisibleItemContexts],
  )
  const selectedOrFirstLaneItemNodeId = selectedItemNodeId || selectedLaneVisibleItemContexts[0]?.nodeId || null
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

  React.useEffect(() => {
    if (!selectedLaneId) return
    if (lanePresentations.some(lane => lane.id === selectedLaneId)) return
    setSelectedLaneId(null)
  }, [lanePresentations, selectedLaneId])

  React.useEffect(() => {
    if (!selectedItemNodeId) return
    if (selectedLaneVisibleItemContexts.some(item => item.nodeId === selectedItemNodeId)) return
    setSelectedItemNodeId(null)
  }, [selectedItemNodeId, selectedLaneVisibleItemContexts])

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
    setSelectedLaneId(laneId)
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

  const handleFocusLaneOption = React.useCallback((laneId: AnimationTimelineLaneId) => {
    setSelectedLaneId(laneId)
    laneOptionRefs.current[laneId]?.focus()
  }, [])

  const handleFocusBeatOption = React.useCallback((beat: AnimationTimelineBeat | null | undefined) => {
    if (!beat) return
    handleFocusBeat(beat)
    beatOptionRefs.current[beat.beatRef]?.focus()
  }, [handleFocusBeat])

  const handleFocusLaneItemOption = React.useCallback((nodeId: string) => {
    setSelectedItemNodeId(nodeId)
    laneItemOptionRefs.current[nodeId]?.focus()
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

  React.useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveAnimationTimelineHotkeyAction(event)
      if (!action) return
      const targetElement =
        event.target instanceof HTMLElement
          ? (event.target.closest('input, textarea, select, button, a[href], [role="textbox"], [contenteditable="true"]') as HTMLElement | null) ||
            event.target
          : null
      if (
        shouldIgnoreAnimationTimelineHotkeys({
          defaultPrevented: event.defaultPrevented,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          editingBeat: !!currentEditingBeatRef,
          dragging: !!dragState,
          targetTagName: targetElement?.tagName,
          targetRole: targetElement?.getAttribute('role'),
          targetContentEditable: targetElement?.isContentEditable,
        })
      ) {
        return
      }
      if (event.repeat && isAnimationTimelineMutationHotkeyAction(action)) return
      event.preventDefault()
      if (action === 'toggle-playback') {
        handleTogglePlayback()
        return
      }
      if (action === 'step-prev-beat') {
        handleStepBeat(-1)
        return
      }
      if (action === 'step-next-beat') {
        handleStepBeat(1)
        return
      }
      if (action === 'reset-playhead') {
        handleReset()
        return
      }
      if (action === 'duplicate-beat') {
        void handleDuplicateBeat()
        return
      }
      if (action === 'split-beat') {
        void handleSplitBeat()
        return
      }
      if (!activeBeat) return
      if (action === 'edit-beat-label') {
        handleStartBeatLabelEdit(activeBeat)
        return
      }
      if (action === 'edit-beat-note') {
        handleStartBeatNoteEdit(activeBeat)
        return
      }
      if (action === 'edit-beat-summary') {
        handleStartBeatSummaryEdit(activeBeat)
        return
      }
      if (action === 'edit-beat-tags') {
        handleStartBeatTagsEdit(activeBeat)
        return
      }
      if (!selectedLane) return
      if (action === 'toggle-lane-hidden') {
        void handleToggleHiddenLane(selectedLane.id)
        return
      }
      if (action === 'toggle-lane-muted') {
        void handleToggleMutedLane(selectedLane.id)
        return
      }
      if (action === 'toggle-lane-solo') {
        void handleToggleSoloLane(selectedLane.id)
        return
      }
      if (action === 'move-lane-up') {
        void handleReorderLane(selectedLane.id, -1)
        return
      }
      if (action === 'move-lane-down') {
        void handleReorderLane(selectedLane.id, 1)
        return
      }
      if (!selectedItemContext) return
      if (action === 'move-selected-item-prev-beat') {
        void handleMoveItemToBeat(selectedItemContext.nodeId, selectedItemContext.previousBeat)
        return
      }
      if (action === 'move-selected-item-next-beat') {
        void handleMoveItemToBeat(selectedItemContext.nodeId, selectedItemContext.nextBeat)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    active,
    activeBeat,
    currentEditingBeatRef,
    dragState,
    handleDuplicateBeat,
    handleReset,
    handleSplitBeat,
    handleStartBeatLabelEdit,
    handleStartBeatNoteEdit,
    handleStartBeatSummaryEdit,
    handleStartBeatTagsEdit,
    handleReorderLane,
    handleMoveItemToBeat,
    handleStepBeat,
    handleToggleHiddenLane,
    handleToggleMutedLane,
    handleToggleSoloLane,
    handleTogglePlayback,
    selectedItemContext,
    selectedLane,
  ])

  const handleBeatPointerStart = React.useCallback(
    (event: React.PointerEvent<HTMLElement>, beat: AnimationTimelineBeat, beatIndex: number, mode: AnimationDragState['mode']) => {
      if (!timelineModel.usesAbsoluteTiming) return
      if (beat.startMs == null || beat.endMs == null) return
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const scrollLeft = scrollRef.current?.scrollLeft || 0
      dragPointerClientXRef.current = event.clientX
      dragEdgeScrollDirectionRef.current = 0
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
    const updateDragPreview = (clientX: number) => {
      const scrollEl = scrollRef.current
      const currentScrollLeft = scrollEl?.scrollLeft || 0
      const deltaPx = clientX - dragState.originClientX + (currentScrollLeft - dragState.originScrollLeft)
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
      setTimingOverrides(prev => {
        const currentOverride = prev[dragState.beatRef]
        if (currentOverride && currentOverride.startMs === nextOverride.startMs && currentOverride.endMs === nextOverride.endMs) {
          return prev
        }
        return {
          ...prev,
          [dragState.beatRef]: nextOverride,
        }
      })
    }
    const updateDragEdgeScrollDirection = (clientX: number) => {
      const scrollEl = scrollRef.current
      if (!scrollEl) {
        dragEdgeScrollDirectionRef.current = 0
        return
      }
      const rect = scrollEl.getBoundingClientRect()
      const maxScrollLeft = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth)
      if (clientX < rect.left + DRAG_EDGE_SCROLL_THRESHOLD_PX && scrollEl.scrollLeft > 0) {
        dragEdgeScrollDirectionRef.current = -1
        return
      }
      if (clientX > rect.right - DRAG_EDGE_SCROLL_THRESHOLD_PX && scrollEl.scrollLeft < maxScrollLeft) {
        dragEdgeScrollDirectionRef.current = 1
        return
      }
      dragEdgeScrollDirectionRef.current = 0
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return
      dragPointerClientXRef.current = event.clientX
      updateDragEdgeScrollDirection(event.clientX)
      updateDragPreview(event.clientX)
    }
    const commitDrag = async () => {
      const override = timingOverridesRef.current[dragState.beatRef]
      setDragState(null)
      dragPointerClientXRef.current = null
      dragEdgeScrollDirectionRef.current = 0
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
      dragPointerClientXRef.current = null
      dragEdgeScrollDirectionRef.current = 0
      void commitDrag()
    }
    let animationFrameId = 0
    const tick = () => {
      const scrollEl = scrollRef.current
      const pointerClientX = dragPointerClientXRef.current
      const direction = dragEdgeScrollDirectionRef.current
      if (scrollEl && pointerClientX != null && direction !== 0) {
        const maxScrollLeft = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth)
        const nextScrollLeft = clamp(scrollEl.scrollLeft + direction * DRAG_EDGE_SCROLL_STEP_PX, 0, maxScrollLeft)
        if (nextScrollLeft !== scrollEl.scrollLeft) {
          scrollEl.scrollLeft = nextScrollLeft
          updateDragEdgeScrollDirection(pointerClientX)
          updateDragPreview(pointerClientX)
        } else {
          dragEdgeScrollDirectionRef.current = 0
        }
      }
      animationFrameId = window.requestAnimationFrame(tick)
    }
    animationFrameId = window.requestAnimationFrame(tick)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerUp, { passive: true })
    return () => {
      window.cancelAnimationFrame(animationFrameId)
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
              className={runtimeAutoScrollEnabled ? 'ant-switch ant-switch-checked' : 'ant-switch'}
              ant-click-animating="true"
              style={{ marginBottom: 20 }}
              onClick={() => setRuntimeAutoScrollEnabled(current => !current)}
            >
              <div className="ant-switch-handle"></div>
              <span className="ant-switch-inner">Enable Runtime Auto Scroll</span>
              <div className="ant-click-animating-node"></div>
            </button>
          </div>
          <div className="timeline-player">
            <button
              type="button"
              className="play-control"
              aria-label={playing ? 'Pause playback' : 'Start playback'}
              title={playing ? 'Pause (Space)' : 'Play (Space)'}
              onClick={handleTogglePlayback}
            >
              <span role="img" aria-label={playing ? 'pause' : 'caret-right'} className={`anticon ${playing ? 'anticon-pause' : 'anticon-caret-right'}`}>
                {playing ? (
                  <svg viewBox="64 64 896 896" focusable="false" data-icon="pause" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                    <path d="M424 792V232c0-4.4-3.6-8-8-8h-72c-4.4 0-8 3.6-8 8v560c0 4.4 3.6 8 8 8h72c4.4 0 8-3.6 8-8zm264 0V232c0-4.4-3.6-8-8-8h-72c-4.4 0-8 3.6-8 8v560c0 4.4 3.6 8 8 8h72c4.4 0 8-3.6 8-8z"></path>
                  </svg>
                ) : (
                  <svg viewBox="0 0 1024 1024" focusable="false" data-icon="caret-right" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                    <path d="M715.8 493.5L335 165.1c-14.2-12.2-35-1.2-35 18.5v656.8c0 19.7 20.8 30.7 35 18.5l380.8-328.4c10.9-9.4 10.9-27.6 0-37z"></path>
                  </svg>
                )}
              </span>
            </button>
            <div className="time">{currentTimeLabel}</div>
            <div className="rate-control">
              <label className="sr-only" htmlFor="animation-timeline-playback-rate">
                Playback rate
              </label>
              <div className="ant-select ant-select-sm ant-select-single ant-select-show-arrow" style={{ width: 90 }}>
                <select
                  id="animation-timeline-playback-rate"
                  className="ant-select-selection-native"
                  value={String(playbackRate)}
                  onChange={event => setPlaybackRate(Number(event.target.value) as (typeof PLAYBACK_RATES)[number])}
                >
                  {PLAYBACK_RATES.map(rate => (
                    <option key={rate} value={String(rate)}>
                      {rate.toFixed(1)}x
                    </option>
                  ))}
                </select>
                <div className="ant-select-selector">
                  <span className="ant-select-selection-item" title={`${playbackRate.toFixed(1)}x`}>
                    {playbackRate.toFixed(1)}x
                  </span>
                </div>
                <span className="ant-select-arrow" unselectable="on" aria-hidden="true">
                  <span role="img" aria-label="down" className="anticon anticon-down ant-select-suffix">
                    <svg viewBox="64 64 896 896" focusable="false" data-icon="down" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                      <path d="M884 256h-75c-5.1 0-9.9 2.5-12.9 6.6L512 654.2 227.9 262.6c-3-4.1-7.8-6.6-12.9-6.6h-75c-6.5 0-10.3 7.4-6.5 12.7l352.6 486.1c12.8 17.6 39 17.6 51.7 0l352.6-486.1c3.9-5.3.1-12.7-6.4-12.7z"></path>
                    </svg>
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton title="Prev Beat (Left Arrow)" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStepBeat(-1)}>
              <SkipBack className={toolbarIconClassName} />
            </IconButton>
            <IconButton title="Next Beat (Right Arrow)" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStepBeat(1)}>
              <SkipForward className={toolbarIconClassName} />
            </IconButton>
            <IconButton title="Reset (R)" showTooltip className={getTimelineIconButtonClassName(true)} onClick={handleReset}>
              <RotateCcw className={toolbarIconClassName} />
            </IconButton>
            <IconButton title="Insert Before" showTooltip className={getTimelineIconButtonClassName(!!activeBeat || timelineModel.beats.length > 0)} onClick={() => void handleInsertBeat('before')}>
              <ArrowLeftToLine className={toolbarIconClassName} />
            </IconButton>
            <IconButton title="Insert After" showTooltip className={getTimelineIconButtonClassName(!!activeBeat || timelineModel.beats.length > 0)} onClick={() => void handleInsertBeat('after')}>
              <ArrowRightToLine className={toolbarIconClassName} />
            </IconButton>
            <IconButton
              title={canSplitActiveBeat ? 'Split active beat at playhead (S)' : 'Move the playhead inside the active beat to split it (S)'}
              showTooltip
              className={getTimelineIconButtonClassName(canSplitActiveBeat)}
              onClick={() => void handleSplitBeat()}
              disabled={!canSplitActiveBeat}
            >
              <Scissors className={toolbarIconClassName} />
            </IconButton>
            <IconButton
              title={activeBeat ? 'Duplicate active beat after the current beat (D)' : 'Select an active beat first (D)'}
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
                  <IconButton title={`Rename ${activeBeat.label} (L)`} showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStartBeatLabelEdit(activeBeat)}>
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
                      onKeyDown={event => {
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                          event.preventDefault()
                          void handleCommitBeatNoteEdit()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          handleCancelBeatNoteEdit()
                        }
                      }}
                    />
                    <div className="flex flex-col gap-2">
                      <IconButton title="Save beat note (Cmd/Ctrl+Enter)" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => void handleCommitBeatNoteEdit()}>
                        <Check className={toolbarIconClassName} />
                      </IconButton>
                      <IconButton title="Cancel beat note edit (Escape)" showTooltip className={getTimelineIconButtonClassName(true)} onClick={handleCancelBeatNoteEdit}>
                        <X className={toolbarIconClassName} />
                      </IconButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                    <IconButton title={activeBeat.note ? 'Edit beat note (N)' : 'Add beat note (N)'} showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStartBeatNoteEdit(activeBeat)}>
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
                      onKeyDown={event => {
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                          event.preventDefault()
                          void handleCommitBeatSummaryEdit()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          handleCancelBeatSummaryEdit()
                        }
                      }}
                    />
                    <div className="flex flex-col gap-2">
                      <IconButton title="Save beat summary (Cmd/Ctrl+Enter)" showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => void handleCommitBeatSummaryEdit()}>
                        <Check className={toolbarIconClassName} />
                      </IconButton>
                      <IconButton title="Cancel beat summary edit (Escape)" showTooltip className={getTimelineIconButtonClassName(true)} onClick={handleCancelBeatSummaryEdit}>
                        <X className={toolbarIconClassName} />
                      </IconButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                    <IconButton title={activeBeat.summary ? 'Edit beat summary (M)' : 'Add beat summary (M)'} showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStartBeatSummaryEdit(activeBeat)}>
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
                    <IconButton title={activeBeat.tags.length > 0 ? 'Edit beat tags (T)' : 'Add beat tags (T)'} showTooltip className={getTimelineIconButtonClassName(true)} onClick={() => handleStartBeatTagsEdit(activeBeat)}>
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
              {selectedLane ? (
                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-cyan-100">
                  Selected Lane: {selectedLane.label} ([ / ] reorder, H hide, U mute, O solo)
                </span>
              ) : null}
              {selectedItemContext ? (
                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-cyan-100">
                  Selected Item: {selectedItemContext.title} (, prev beat, . next beat)
                </span>
              ) : null}
              {activeBeat ? (
                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-cyan-100">
                  Beat Strip: {activeBeat.label} (Tab, Left/Right, Home, End)
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
            <div role="listbox" aria-label="Animation timeline lanes">
              {lanePresentations.map((lane, laneIndex) => (
                <div
                key={lane.id}
                ref={node => {
                  laneOptionRefs.current[lane.id] = node
                }}
                tabIndex={selectedOrFirstLaneId === lane.id ? 0 : -1}
                role="option"
                aria-selected={selectedLaneId === lane.id}
                className={`flex cursor-pointer items-center justify-between gap-2 border-b px-2 text-xs font-medium text-slate-200 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300 ${
                  selectedLaneId === lane.id ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-slate-800'
                }`}
                style={{ minHeight: LANE_ROW_HEIGHT_PX }}
                onClick={() => setSelectedLaneId(lane.id)}
                onFocus={() => setSelectedLaneId(lane.id)}
                onKeyDown={event => {
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    const previousLane = lanePresentations[Math.max(0, laneIndex - 1)]
                    if (previousLane) handleFocusLaneOption(previousLane.id)
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    const nextLane = lanePresentations[Math.min(lanePresentations.length - 1, laneIndex + 1)]
                    if (nextLane) handleFocusLaneOption(nextLane.id)
                  }
                  if (event.key === 'Home') {
                    event.preventDefault()
                    const firstLane = lanePresentations[0]
                    if (firstLane) handleFocusLaneOption(firstLane.id)
                  }
                  if (event.key === 'End') {
                    event.preventDefault()
                    const lastLane = lanePresentations[lanePresentations.length - 1]
                    if (lastLane) handleFocusLaneOption(lastLane.id)
                  }
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <IconButton
                    title={`Move ${lane.label} up`}
                    showTooltip
                    className={getTimelineCompactIconButtonClassName(lanePresentations[0]?.id !== lane.id)}
                    onClick={() => void handleReorderLane(lane.id, -1)}
                    disabled={lanePresentations[0]?.id === lane.id}
                  >
                    <ArrowUp className={compactToolbarIconClassName} />
                  </IconButton>
                  <IconButton
                    title={`Move ${lane.label} down`}
                    showTooltip
                    className={getTimelineCompactIconButtonClassName(lanePresentations[lanePresentations.length - 1]?.id !== lane.id)}
                    onClick={() => void handleReorderLane(lane.id, 1)}
                    disabled={lanePresentations[lanePresentations.length - 1]?.id === lane.id}
                  >
                    <ArrowDown className={compactToolbarIconClassName} />
                  </IconButton>
                  <div className="min-w-0">
                    <div
                      className={`truncate ${lane.solo ? 'text-cyan-200' : lane.hidden ? 'text-slate-500 line-through' : lane.muted ? 'text-slate-400' : 'text-slate-200'}`}
                      title={`Tab to focus ${lane.label}; use Arrow Up/Down, Home, End, [ / ], H, U, O`}
                    >
                      {lane.label}
                    </div>
                    {selectedLaneId === lane.id ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-cyan-100">
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">Up/Down focus</span>
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">Home/End rail</span>
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">[ / ] reorder</span>
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">H hide</span>
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">U mute</span>
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">O solo</span>
                      </div>
                    ) : null}
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
            </div>
          </aside>
          <div ref={scrollRef} className="timeline-editor min-w-0 flex-1 overflow-auto bg-[#0b1020]">
            <div className="relative" style={{ width: Math.max(totalTimelineWidth, 1) }}>
              <div
                className="timeline-editor-cursor pointer-events-none absolute z-20"
                draggable={false}
                data-width="2"
                data-left={playheadOffsetPx}
                style={{
                  width: 2,
                  left: playheadOffsetPx,
                  top: 0,
                  height: SCALE_ROW_HEIGHT_PX + BEAT_HEADER_HEIGHT_PX + lanePresentations.length * LANE_ROW_HEIGHT_PX,
                }}
              >
                <svg className="timeline-editor-cursor-top" width="8" height="12" viewBox="0 0 8 12" fill="none">
                  <path d="M0 1C0 0.447715 0.447715 0 1 0H7C7.55228 0 8 0.447715 8 1V9.38197C8 9.76074 7.786 10.107 7.44721 10.2764L4.44721 11.7764C4.16569 11.9172 3.83431 11.9172 3.55279 11.7764L0.552786 10.2764C0.214002 10.107 0 9.76074 0 9.38197V1Z" fill="#5297FF"></path>
                </svg>
                <div className="timeline-editor-cursor-area"></div>
              </div>
              <div className="sticky top-0 z-10 bg-[#0f1625]/95 backdrop-blur">
                <div className="timeline-editor-time-area relative border-b border-slate-800" style={{ height: SCALE_ROW_HEIGHT_PX }}>
                  {timelineEditorTimeUnits.map(unit => (
                    <div
                      key={unit.key}
                      role="gridcell"
                      className={`timeline-editor-time-unit ${unit.big ? 'timeline-editor-time-unit-big' : ''}`}
                      style={{ left: unit.left, width: unit.width, height: SCALE_ROW_HEIGHT_PX }}
                    >
                      {unit.label ? <div className="timeline-editor-time-unit-scale">{unit.label}</div> : null}
                    </div>
                  ))}
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
                <div className="timeline-editor-edit-area flex border-b border-slate-800" role="listbox" aria-label="Animation timeline beats">
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
                        ref={node => {
                          beatOptionRefs.current[beat.beatRef] = node
                        }}
                        tabIndex={selectedOrActiveBeatRef === beat.beatRef ? 0 : -1}
                        role="option"
                        aria-selected={isActiveBeat}
                        title={`Tab to focus ${beat.label}; use Arrow Left/Right, Home, End`}
                        className={`group/beat relative flex shrink-0 flex-col justify-start overflow-hidden border-r border-slate-800 px-3 py-2 text-left transition focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300 ${
                          isActiveBeat ? 'bg-cyan-500/10' : 'bg-transparent hover:bg-slate-900/80'
                        }`}
                        style={{ width: beatWidths[index], height: BEAT_HEADER_HEIGHT_PX }}
                        onFocus={() => handleFocusBeat(beat)}
                        onKeyDown={event => {
                          if (event.key === 'ArrowLeft') {
                            event.preventDefault()
                            const previousBeat = timelineModel.beats[Math.max(0, index - 1)]
                            if (previousBeat) handleFocusBeatOption(previousBeat)
                          }
                          if (event.key === 'ArrowRight') {
                            event.preventDefault()
                            const nextBeat = timelineModel.beats[Math.min(timelineModel.beats.length - 1, index + 1)]
                            if (nextBeat) handleFocusBeatOption(nextBeat)
                          }
                          if (event.key === 'Home') {
                            event.preventDefault()
                            const firstBeat = timelineModel.beats[0]
                            if (firstBeat) handleFocusBeatOption(firstBeat)
                          }
                          if (event.key === 'End') {
                            event.preventDefault()
                            const lastBeat = timelineModel.beats[timelineModel.beats.length - 1]
                            if (lastBeat) handleFocusBeatOption(lastBeat)
                          }
                        }}
                      >
                        <div className="absolute right-2 top-2 z-30 flex items-center gap-1 opacity-0 transition group-hover/beat:opacity-100 group-focus-within/beat:opacity-100">
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
                        <span className="relative z-10 text-[10px] uppercase tracking-[0.18em] text-slate-500">{beat.beatRef}</span>
                        <span className="relative z-10 mt-0.5 text-xs font-semibold text-slate-100">{beat.label}</span>
                        <div className="relative z-10 mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
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
                          <div className="relative z-10 mt-1 flex items-center gap-1 overflow-hidden text-[10px]">
                            {visibleBeatLaneSummary.map(({ laneId, count }) => (
                              <button
                                type="button"
                                key={`${beat.beatRef}:lane:${laneId}`}
                                className={`truncate rounded-full border px-1.5 py-0.5 transition hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-cyan-300 ${LANE_ACCENT_CLASS[laneId]}`}
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
                          <span className="relative z-10 mt-1 truncate text-[11px] text-slate-300" title={beat.summary}>
                            {beat.summary}
                          </span>
                        ) : null}
                        {beat.tags.length > 0 ? (
                          <div className="relative z-10 mt-1 flex items-center gap-1 overflow-hidden text-[10px]">
                            {beat.tags.slice(0, 3).map(tag => (
                              <span
                                key={`${beat.beatRef}:${tag}`}
                                className="truncate rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-cyan-100"
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
                        {isActiveBeat ? (
                          <div className="relative z-10 mt-1 flex flex-wrap items-center gap-1 text-[10px] text-cyan-100">
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5" title="Rename beat (L)">L</span>
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5" title="Edit note (N)">N</span>
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5" title="Edit summary (M)">M</span>
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5" title="Edit tags (T)">T</span>
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5" title="Duplicate beat (D)">D</span>
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5" title="Split beat (S)">S</span>
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
                  className={`timeline-editor-edit-row flex border-b transition ${
                    highlightedLaneShortcutId === lane.id ? 'border-cyan-500/70 bg-cyan-500/5' : 'border-slate-900/80'
                  }`}
                >
                  {timelineModel.beats.map((beat, index) => {
                    const laneItems = beat.items.filter(item => item.laneId === lane.id)
                    const isActiveBeat = index === activeBeatIndex
                    return (
                      <div
                        key={`${lane.id}:${beat.beatRef}`}
                        className={`shrink-0 border-r border-slate-800 px-2 py-2 ${
                          isActiveBeat ? 'bg-slate-900/75' : 'bg-[#0b1020]'
                        }`}
                        style={{ width: beatWidths[index], minHeight: LANE_ROW_HEIGHT_PX }}
                      >
                        {lane.visibleItems && laneItems.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {laneItems.map(item => {
                              const previousBeat = timelineModel.beats[index - 1] || null
                              const nextBeat = timelineModel.beats[index + 1] || null
                              const actionEffectClassName = resolveTimelineEditorActionEffectClassName(item.laneId)
                              return (
                                <article
                                  key={item.id}
                                  ref={node => {
                                    laneItemOptionRefs.current[item.nodeId] = node
                                  }}
                                  tabIndex={selectedLaneId === lane.id && selectedOrFirstLaneItemNodeId === item.nodeId ? 0 : -1}
                                  role="option"
                                  aria-selected={selectedItemNodeId === item.nodeId}
                                  title={`Focus ${item.title}; use Arrow Up/Down, Home, End, , and .`}
                                  className={`timeline-editor-action timeline-editor-action-movable timeline-editor-action-flexible timeline-editor-action-effect-${actionEffectClassName} rounded-[4px] border px-2 py-1 shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300 ${LANE_ACCENT_CLASS[item.laneId]} ${
                                    lane.muted ? 'opacity-40 saturate-50' : ''
                                  } ${
                                    selectedItemNodeId === item.nodeId ? 'ring-1 ring-cyan-300' : ''
                                  }`}
                                  onClick={() => {
                                    setSelectedLaneId(lane.id)
                                    setSelectedItemNodeId(item.nodeId)
                                  }}
                                  onFocus={() => {
                                    setSelectedLaneId(lane.id)
                                    setSelectedItemNodeId(item.nodeId)
                                  }}
                                  onKeyDown={event => {
                                    const itemIndex = selectedLaneVisibleItemContexts.findIndex(entry => entry.nodeId === item.nodeId)
                                    if (event.key === 'ArrowUp') {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      const previousItem = selectedLaneVisibleItemContexts[Math.max(0, itemIndex - 1)]
                                      if (previousItem) handleFocusLaneItemOption(previousItem.nodeId)
                                    }
                                    if (event.key === 'ArrowDown') {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      const nextItem = selectedLaneVisibleItemContexts[Math.min(selectedLaneVisibleItemContexts.length - 1, itemIndex + 1)]
                                      if (nextItem) handleFocusLaneItemOption(nextItem.nodeId)
                                    }
                                    if (event.key === 'Home') {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      const firstItem = selectedLaneVisibleItemContexts[0]
                                      if (firstItem) handleFocusLaneItemOption(firstItem.nodeId)
                                    }
                                    if (event.key === 'End') {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      const lastItem = selectedLaneVisibleItemContexts[selectedLaneVisibleItemContexts.length - 1]
                                      if (lastItem) handleFocusLaneItemOption(lastItem.nodeId)
                                    }
                                  }}
                                >
                                  <div className={`timeline-editor-action-effect timeline-editor-action-effect-${actionEffectClassName} ${actionEffectClassName} flex items-start justify-between gap-1.5`}>
                                    <div className="min-w-0 flex-1">
                                      <div className={`${actionEffectClassName}-text truncate text-[10px] font-normal`}>{item.title}</div>
                                      {selectedItemNodeId === item.nodeId ? (
                                        <div className={`${actionEffectClassName}-text mt-1 truncate text-[10px] opacity-80`}>{item.subtitle || item.kind}</div>
                                      ) : null}
                                      {selectedItemNodeId === item.nodeId ? (
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-cyan-100">
                                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">Up/Down focus</span>
                                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">Home/End rail</span>
                                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">, prev beat</span>
                                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">. next beat</span>
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <IconButton
                                        title={previousBeat ? `Move ${item.title} to ${previousBeat.label}` : `No previous beat for ${item.title}`}
                                        showTooltip
                                        className={getTimelineCompactIconButtonClassName(!!previousBeat)}
                                        onClick={() => void handleMoveItemToBeat(item.nodeId, previousBeat)}
                                        disabled={!previousBeat}
                                      >
                                        <ArrowLeft className={compactToolbarIconClassName} />
                                      </IconButton>
                                      <IconButton
                                        title={nextBeat ? `Move ${item.title} to ${nextBeat.label}` : `No next beat for ${item.title}`}
                                        showTooltip
                                        className={getTimelineCompactIconButtonClassName(!!nextBeat)}
                                        onClick={() => void handleMoveItemToBeat(item.nodeId, nextBeat)}
                                        disabled={!nextBeat}
                                      >
                                        <ArrowRight className={compactToolbarIconClassName} />
                                      </IconButton>
                                    </div>
                                  </div>
                                  <div className="timeline-editor-action-left-stretch" aria-hidden="true"></div>
                                  <div className="timeline-editor-action-right-stretch" aria-hidden="true"></div>
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
