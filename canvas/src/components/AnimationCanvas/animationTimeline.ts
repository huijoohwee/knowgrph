import { resolveBeatRefForNode } from '@/components/FlowEditor/beatByBeat'
import { FLOW_EDGE_SOURCE_PORT_KEY } from '@/lib/graph/flowPorts'
import { isPlainObject } from '@/lib/graph/value'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import yaml from 'js-yaml'

export type AnimationTimelineLaneId = 'clip' | 'overlay' | 'audio' | 'scene' | 'node'

export type AnimationTimelineItem = {
  id: string
  nodeId: string
  beatRef: string
  laneId: AnimationTimelineLaneId
  title: string
  subtitle: string
  kind: string
}

export type AnimationTimelineBeat = {
  beatRef: string
  label: string
  note: string
  summary: string
  tags: string[]
  orderIndex: number
  startMs: number | null
  endMs: number | null
  durationMs: number | null
  displayStart: number
  displayEnd: number
  items: AnimationTimelineItem[]
}

export type AnimationTimelineLane = {
  id: AnimationTimelineLaneId
  label: string
}

export type AnimationTimelineLaneControlState = {
  hiddenLaneIds: AnimationTimelineLaneId[]
  mutedLaneIds: AnimationTimelineLaneId[]
  soloLaneId: AnimationTimelineLaneId | null
}

export type AnimationTimelineModel = {
  beats: AnimationTimelineBeat[]
  lanes: AnimationTimelineLane[]
  totalSpan: number
  totalDurationMs: number | null
  usesAbsoluteTiming: boolean
}

export type AnimationTimelineBeatTimingOverride = {
  startMs: number
  endMs: number
}

type AnimationTimelineEditMode = 'move' | 'resize-start' | 'resize-end'
type AnimationTimelineBeatRecord = Record<string, unknown>

type FrontmatterBeatMeta = {
  beatRef: string
  label: string
  note: string
  summary: string
  tags: string[]
  orderIndex: number
  startMs: number | null
  endMs: number | null
  durationMs: number | null
}

const LANE_ORDER: ReadonlyArray<AnimationTimelineLaneId> = ['clip', 'overlay', 'audio', 'scene', 'node']

const LANE_LABELS: Record<AnimationTimelineLaneId, string> = {
  clip: 'Clip',
  overlay: 'Overlay',
  audio: 'Audio',
  scene: 'Scene',
  node: 'Node',
}

function readLaneId(value: unknown): AnimationTimelineLaneId | null {
  const normalized = readString(value).toLowerCase()
  if (normalized === 'clip' || normalized === 'overlay' || normalized === 'audio' || normalized === 'scene' || normalized === 'node') {
    return normalized
  }
  return null
}

function readLaneIdList(value: unknown): AnimationTimelineLaneId[] {
  const rawValues = Array.isArray(value) ? value : []
  const uniqueLaneIds = new Set<AnimationTimelineLaneId>()
  for (const rawValue of rawValues) {
    const laneId = readLaneId(rawValue)
    if (laneId) uniqueLaneIds.add(laneId)
  }
  return Array.from(uniqueLaneIds)
}

function sortAnimationTimelineLanesByOrder(
  laneIds: readonly AnimationTimelineLaneId[],
  preferredOrder: readonly AnimationTimelineLaneId[],
): AnimationTimelineLaneId[] {
  const preferredIndexByLaneId = new Map<AnimationTimelineLaneId, number>()
  preferredOrder.forEach((laneId, index) => preferredIndexByLaneId.set(laneId, index))
  return [...laneIds].sort((left, right) => {
    const leftIndex = preferredIndexByLaneId.get(left)
    const rightIndex = preferredIndexByLaneId.get(right)
    if (leftIndex != null && rightIndex != null && leftIndex !== rightIndex) return leftIndex - rightIndex
    if (leftIndex != null) return -1
    if (rightIndex != null) return 1
    return LANE_ORDER.indexOf(left) - LANE_ORDER.indexOf(right)
  })
}

function readRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {}
}

function cloneJsonLike(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(entry => cloneJsonLike(entry))
  if (isPlainObject(value)) {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(record)) out[key] = cloneJsonLike(record[key])
    return out
  }
  return value
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const uniqueValues = new Set<string>()
    for (const entry of value) {
      const normalized = readString(entry)
      if (normalized) uniqueValues.add(normalized)
    }
    return Array.from(uniqueValues)
  }
  const normalized = readString(value)
  if (!normalized) return []
  const uniqueValues = new Set(
    normalized
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean),
  )
  return Array.from(uniqueValues)
}

function collectAnimationTimelineFrontmatterState(markdownText: string): {
  lines: string[]
  frontmatterEndLine: number
  meta: Record<string, unknown>
  timeline: Record<string, unknown>
  beats: Record<string, AnimationTimelineBeatRecord>
  bodyText: string
} {
  const lines = splitMarkdownLines(markdownText)
  let frontmatterEndLine = -1
  if ((lines[0] || '').trim() === '---') {
    for (let i = 1; i < lines.length; i += 1) {
      if ((lines[i] || '').trim() === '---') {
        frontmatterEndLine = i
        break
      }
    }
  }
  const parsed = parseMarkdownFrontmatter(lines)
  const meta = readRecord(cloneJsonLike(parsed.meta))
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beatsRaw = readRecord(cloneJsonLike(timeline.beats))
  const beats: Record<string, AnimationTimelineBeatRecord> = {}
  for (const [beatRef, value] of Object.entries(beatsRaw)) {
    beats[beatRef] = readRecord(cloneJsonLike(value))
  }
  const bodyText =
    frontmatterEndLine >= 0
      ? lines.slice(frontmatterEndLine + 1).join('\n')
      : markdownText
  return {
    lines,
    frontmatterEndLine,
    meta,
    timeline,
    beats,
    bodyText,
  }
}

function buildAnimationTimelineMarkdownFromFrontmatterState(args: {
  meta: Record<string, unknown>
  timeline: Record<string, unknown>
  beats: Record<string, AnimationTimelineBeatRecord>
  bodyText: string
}): string {
  args.timeline.beats = args.beats
  args.meta.timeline = args.timeline
  const dumpedFrontmatter = String(
    yaml.dump(args.meta, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    }) || '',
  ).trimEnd()
  const normalizedBody = args.bodyText.startsWith('\n') ? args.bodyText.slice(1) : args.bodyText
  return ['---', dumpedFrontmatter, '---', normalizedBody].join('\n').replace(/\n+$/, '\n')
}

function createNextAnimationTimelineBeatRef(usedBeatRefs: Iterable<string>): string {
  const used = new Set<string>()
  for (const ref of usedBeatRefs) {
    const normalized = String(ref || '').trim()
    if (normalized) used.add(normalized)
  }
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `beat_${String(i).padStart(2, '0')}`
    if (!used.has(candidate)) return candidate
  }
  return `beat_${Date.now()}`
}

export function snapAnimationTimelineValue(value: number, stepMs: number | null | undefined): number {
  const normalizedStep = Math.max(0, Math.round(stepMs ?? 0))
  if (!normalizedStep) return Math.max(0, Math.round(value))
  return Math.max(0, Math.round(value / normalizedStep) * normalizedStep)
}

function readBeatOrderFromRef(beatRef: string, fallbackIndex: number): number {
  const match = /(\d+)$/.exec(String(beatRef || '').trim())
  if (!match) return fallbackIndex
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : fallbackIndex
}

function readBeatTiming(record: Record<string, unknown>): Pick<FrontmatterBeatMeta, 'startMs' | 'endMs' | 'durationMs'> {
  const timing = readRecord(record.timing)
  const startMs =
    readFiniteNumber(record.start_ms) ??
    readFiniteNumber(record.startMs) ??
    readFiniteNumber(timing.start_ms) ??
    readFiniteNumber(timing.startMs) ??
    null
  const endMs =
    readFiniteNumber(record.end_ms) ??
    readFiniteNumber(record.endMs) ??
    readFiniteNumber(timing.end_ms) ??
    readFiniteNumber(timing.endMs) ??
    null
  const durationMs =
    readFiniteNumber(record.duration_ms) ??
    readFiniteNumber(record.durationMs) ??
    readFiniteNumber(timing.duration_ms) ??
    readFiniteNumber(timing.durationMs) ??
    null
  const resolvedDurationMs =
    durationMs != null ? durationMs : startMs != null && endMs != null ? Math.max(0, endMs - startMs) : null
  const resolvedEndMs = endMs != null ? endMs : startMs != null && resolvedDurationMs != null ? startMs + resolvedDurationMs : null
  return {
    startMs,
    endMs: resolvedEndMs,
    durationMs: resolvedDurationMs,
  }
}

function readFrontmatterBeatMeta(markdownText: string | null | undefined): FrontmatterBeatMeta[] {
  const text = String(markdownText || '')
  if (!text.trim()) return []
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(text))
  const meta = readRecord(parsed.meta)
  const timeline = readRecord(meta.timeline)
  const beats = readRecord(timeline.beats)
  const entries = Object.entries(beats)
  if (entries.length === 0) return []
  return entries.map(([beatRef, value], index) => {
    const record = readRecord(value)
    const timing = readBeatTiming(record)
    const label =
      readString(record.label) ||
      readString(record.title) ||
      readString(record.name) ||
      String(beatRef || '').trim()
    const note = readString(record.note) || readString(record.notes)
    const summary = readString(record.summary)
    const tags = readStringList(record.tags)
    return {
      beatRef: String(beatRef || '').trim(),
      label,
      note,
      summary,
      tags,
      orderIndex: index,
      startMs: timing.startMs,
      endMs: timing.endMs,
      durationMs: timing.durationMs,
    }
  })
}

function classifyAnimationLane(node: GraphNode): AnimationTimelineLaneId {
  const nodeId = String(node.id || '').trim().toLowerCase()
  const label = String(node.label || '').trim().toLowerCase()
  const type = String(node.type || '').trim().toLowerCase()
  const signature = `${nodeId} ${label} ${type}`
  if (signature.includes('overlay')) return 'overlay'
  if (signature.includes('clip') || signature.includes('video') || signature.includes('shot')) return 'clip'
  if (signature.includes('audio') || signature.includes('voice') || signature.includes('music') || signature.includes('sfx')) return 'audio'
  if (signature.includes('scene') || signature.includes('beat') || signature.includes('timeline')) return 'scene'
  return 'node'
}

function buildEdgeCountByNodeId(edges: readonly GraphEdge[]): Map<string, number> {
  const countByNodeId = new Map<string, number>()
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    if (!edge) continue
    const sourceId = String(edge.source || '').trim()
    const targetId = String(edge.target || '').trim()
    if (sourceId) countByNodeId.set(sourceId, (countByNodeId.get(sourceId) || 0) + 1)
    if (targetId) countByNodeId.set(targetId, (countByNodeId.get(targetId) || 0) + 1)
  }
  return countByNodeId
}

function buildBeatOrderHints(edges: readonly GraphEdge[]): Map<string, number> {
  const orderByBeatRef = new Map<string, number>()
  let nextIndex = 0
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    if (!edge) continue
    if (String(edge.source || '').trim() !== 'NODE_TIMELINE') continue
    const props = readRecord(edge.properties)
    const rawPort = readString(props[FLOW_EDGE_SOURCE_PORT_KEY])
    const beatRef = rawPort.endsWith('_out') ? rawPort.slice(0, -4) : rawPort
    if (!beatRef || orderByBeatRef.has(beatRef)) continue
    orderByBeatRef.set(beatRef, nextIndex)
    nextIndex += 1
  }
  return orderByBeatRef
}

function buildGraphBeatItems(args: {
  graphData: GraphData | null | undefined
}): { itemsByBeatRef: Map<string, AnimationTimelineItem[]>; orderHints: Map<string, number> } {
  const graphData = args.graphData || null
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData?.edges) ? graphData.edges : []
  const edgeCountByNodeId = buildEdgeCountByNodeId(edges)
  const itemsByBeatRef = new Map<string, AnimationTimelineItem[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!node) continue
    const beatRef = resolveBeatRefForNode(node)
    if (!beatRef) continue
    const laneId = classifyAnimationLane(node)
    const nodeId = String(node.id || '').trim()
    const title = String(node.label || '').trim() || nodeId || beatRef
    const typeLabel = String(node.type || '').trim()
    const connectionCount = edgeCountByNodeId.get(nodeId) || 0
    const subtitle = [typeLabel, connectionCount > 0 ? `${connectionCount} links` : 'standalone'].filter(Boolean).join(' · ')
    const item: AnimationTimelineItem = {
      id: nodeId || `${beatRef}:${i}`,
      nodeId,
      beatRef,
      laneId,
      title,
      subtitle,
      kind: typeLabel || laneId,
    }
    const current = itemsByBeatRef.get(beatRef) || []
    current.push(item)
    itemsByBeatRef.set(beatRef, current)
  }
  for (const items of itemsByBeatRef.values()) {
    items.sort((left, right) => left.title.localeCompare(right.title))
  }
  return { itemsByBeatRef, orderHints: buildBeatOrderHints(edges) }
}

function compareAnimationBeatMeta(
  left: FrontmatterBeatMeta,
  right: FrontmatterBeatMeta,
  orderHints: Map<string, number>,
): number {
  const leftHint = orderHints.get(left.beatRef)
  const rightHint = orderHints.get(right.beatRef)
  if (left.startMs != null && right.startMs != null && left.startMs !== right.startMs) {
    return left.startMs - right.startMs
  }
  if (leftHint != null && rightHint != null && leftHint !== rightHint) return leftHint - rightHint
  if (left.orderIndex !== right.orderIndex) return left.orderIndex - right.orderIndex
  return readBeatOrderFromRef(left.beatRef, left.orderIndex) - readBeatOrderFromRef(right.beatRef, right.orderIndex)
}

export function buildAnimationTimelineModel(args: {
  graphData: GraphData | null | undefined
  markdownText?: string | null
}): AnimationTimelineModel {
  const { itemsByBeatRef, orderHints } = buildGraphBeatItems({ graphData: args.graphData })
  const frontmatterBeats = readFrontmatterBeatMeta(args.markdownText)
  const preferredLaneOrder = readAnimationTimelineLaneOrder(args.markdownText)
  const frontmatterByBeatRef = new Map(frontmatterBeats.map(beat => [beat.beatRef, beat]))
  const beatRefSet = new Set<string>()
  for (const beat of frontmatterBeats) {
    if (beat.beatRef) beatRefSet.add(beat.beatRef)
  }
  for (const beatRef of itemsByBeatRef.keys()) {
    if (beatRef) beatRefSet.add(beatRef)
  }
  const rawBeats = Array.from(beatRefSet).map((beatRef, index) => {
    const frontmatterBeat = frontmatterByBeatRef.get(beatRef)
    return {
      beatRef,
      label: frontmatterBeat?.label || beatRef,
      note: frontmatterBeat?.note || '',
      summary: frontmatterBeat?.summary || '',
      tags: frontmatterBeat?.tags || [],
      orderIndex: frontmatterBeat?.orderIndex ?? orderHints.get(beatRef) ?? readBeatOrderFromRef(beatRef, index),
      startMs: frontmatterBeat?.startMs ?? null,
      endMs: frontmatterBeat?.endMs ?? null,
      durationMs: frontmatterBeat?.durationMs ?? null,
    } satisfies FrontmatterBeatMeta
  })
  rawBeats.sort((left, right) => compareAnimationBeatMeta(left, right, orderHints))
  const usesAbsoluteTiming =
    rawBeats.length > 0 && rawBeats.every(beat => beat.startMs != null && beat.endMs != null && beat.endMs >= beat.startMs)
  const beats = rawBeats.map((beat, index) => {
    const displayStart = usesAbsoluteTiming ? (beat.startMs as number) : index
    const displayEnd = usesAbsoluteTiming ? (beat.endMs as number) : index + 1
    return {
      beatRef: beat.beatRef,
      label: beat.label,
      note: beat.note,
      summary: beat.summary,
      tags: beat.tags,
      orderIndex: index,
      startMs: beat.startMs,
      endMs: beat.endMs,
      durationMs: beat.durationMs,
      displayStart,
      displayEnd,
      items: itemsByBeatRef.get(beat.beatRef) || [],
    } satisfies AnimationTimelineBeat
  })
  const totalSpan =
    beats.length === 0
      ? 0
      : usesAbsoluteTiming
        ? Math.max(...beats.map(beat => beat.displayEnd), beats[0]?.displayEnd || 0)
        : beats.length
  const totalDurationMs = usesAbsoluteTiming ? totalSpan : null
  const laneUsage = new Set<AnimationTimelineLaneId>()
  for (const beat of beats) {
    for (const item of beat.items) laneUsage.add(item.laneId)
  }
  const orderedLaneIds = sortAnimationTimelineLanesByOrder(
    LANE_ORDER.filter(laneId => laneUsage.has(laneId)),
    preferredLaneOrder,
  )
  const lanes = orderedLaneIds.map(laneId => ({
    id: laneId,
    label: LANE_LABELS[laneId],
  }))
  return {
    beats,
    lanes: lanes.length > 0 ? lanes : [{ id: 'node', label: LANE_LABELS.node }],
    totalSpan,
    totalDurationMs,
    usesAbsoluteTiming,
  }
}

export function applyAnimationTimelineBeatTimingOverrides(
  model: AnimationTimelineModel,
  overrides: Record<string, AnimationTimelineBeatTimingOverride>,
): AnimationTimelineModel {
  if (!model.usesAbsoluteTiming) return model
  if (!overrides || Object.keys(overrides).length === 0) return model
  const beats = model.beats.map(beat => {
    const override = overrides[beat.beatRef]
    if (!override) return beat
    const startMs = Math.max(0, Math.round(override.startMs))
    const endMs = Math.max(startMs, Math.round(override.endMs))
    return {
      ...beat,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      displayStart: startMs,
      displayEnd: endMs,
    }
  })
  const totalSpan = beats.length > 0 ? Math.max(...beats.map(beat => beat.displayEnd), 0) : 0
  return {
    ...model,
    beats,
    totalSpan,
    totalDurationMs: totalSpan,
  }
}

export function resolveAnimationTimelineBeatTimingEdit(args: {
  beats: readonly AnimationTimelineBeat[]
  beatIndex: number
  mode: AnimationTimelineEditMode
  deltaMs: number
  minDurationMs?: number
  snapStepMs?: number | null
}): AnimationTimelineBeatTimingOverride | null {
  const beats = Array.isArray(args.beats) ? args.beats : []
  const beat = beats[args.beatIndex]
  if (!beat || beat.startMs == null || beat.endMs == null) return null
  const previousBeat = args.beatIndex > 0 ? beats[args.beatIndex - 1] : null
  const nextBeat = args.beatIndex < beats.length - 1 ? beats[args.beatIndex + 1] : null
  const previousBoundary = previousBeat?.endMs != null ? previousBeat.endMs : 0
  const nextBoundary = nextBeat?.startMs != null ? nextBeat.startMs : Number.POSITIVE_INFINITY
  const currentStart = beat.startMs
  const currentEnd = beat.endMs
  const currentDuration = Math.max(0, currentEnd - currentStart)
  const minDurationMs = Math.max(100, Math.round(args.minDurationMs ?? 200))
  const snapStepMs = Math.max(0, Math.round(args.snapStepMs ?? 0))
  if (args.mode === 'move') {
    const minStart = Math.max(0, previousBoundary)
    const maxStart = Number.isFinite(nextBoundary) ? Math.max(minStart, nextBoundary - currentDuration) : Number.POSITIVE_INFINITY
    const nextStart = snapStepMs > 0 ? snapAnimationTimelineValue(currentStart + args.deltaMs, snapStepMs) : currentStart + args.deltaMs
    const startMs = Math.min(maxStart, Math.max(minStart, nextStart))
    return {
      startMs,
      endMs: startMs + currentDuration,
    }
  }
  if (args.mode === 'resize-start') {
    const maxStart = Math.max(previousBoundary, currentEnd - minDurationMs)
    const nextStart = snapStepMs > 0 ? snapAnimationTimelineValue(currentStart + args.deltaMs, snapStepMs) : currentStart + args.deltaMs
    return {
      startMs: Math.min(maxStart, Math.max(previousBoundary, nextStart)),
      endMs: currentEnd,
    }
  }
  const minEnd = currentStart + minDurationMs
  const nextEnd = snapStepMs > 0 ? snapAnimationTimelineValue(currentEnd + args.deltaMs, snapStepMs) : currentEnd + args.deltaMs
  const endMs = Math.max(minEnd, Math.min(nextBoundary, nextEnd))
  return {
    startMs: currentStart,
    endMs,
  }
}

export function updateAnimationTimelineMarkdownBeatTiming(args: {
  markdownText: string | null | undefined
  beatRef: string
  startMs: number
  endMs: number
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const roundedStartMs = Math.max(0, Math.round(args.startMs))
  const roundedEndMs = Math.max(roundedStartMs, Math.round(args.endMs))
  nextBeat.start_ms = roundedStartMs
  nextBeat.end_ms = roundedEndMs
  nextBeat.duration_ms = roundedEndMs - roundedStartMs
  if (!readString(nextBeat.label)) nextBeat.label = beatRef
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function updateAnimationTimelineMarkdownBeatLabel(args: {
  markdownText: string | null | undefined
  beatRef: string
  label: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextLabel = readString(args.label) || beatRef
  nextBeat.label = nextLabel
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function updateAnimationTimelineMarkdownBeatNote(args: {
  markdownText: string | null | undefined
  beatRef: string
  note: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextNote = readString(args.note)
  if (nextNote) nextBeat.note = nextNote
  else delete nextBeat.note
  delete nextBeat.notes
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function updateAnimationTimelineMarkdownBeatSummary(args: {
  markdownText: string | null | undefined
  beatRef: string
  summary: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextSummary = readString(args.summary)
  if (nextSummary) nextBeat.summary = nextSummary
  else delete nextBeat.summary
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function updateAnimationTimelineMarkdownBeatTags(args: {
  markdownText: string | null | undefined
  beatRef: string
  tags: readonly string[] | string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextTags = readStringList(args.tags)
  if (nextTags.length > 0) nextBeat.tags = nextTags
  else delete nextBeat.tags
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function readAnimationTimelineLaneControlState(markdownText: string | null | undefined): AnimationTimelineLaneControlState {
  const text = String(markdownText || '')
  if (!text.trim()) {
    return {
      hiddenLaneIds: [],
      mutedLaneIds: [],
      soloLaneId: null,
    }
  }
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(text))
  const meta = readRecord(parsed.meta)
  const timeline = readRecord(meta.timeline)
  const laneControls = readRecord(timeline.lane_controls)
  return {
    hiddenLaneIds: readLaneIdList(laneControls.hidden),
    mutedLaneIds: readLaneIdList(laneControls.muted),
    soloLaneId: readLaneId(laneControls.solo),
  }
}

export function readAnimationTimelineLaneOrder(markdownText: string | null | undefined): AnimationTimelineLaneId[] {
  const text = String(markdownText || '')
  if (!text.trim()) return []
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(text))
  const meta = readRecord(parsed.meta)
  const timeline = readRecord(meta.timeline)
  return readLaneIdList(timeline.lane_order)
}

function updateAnimationTimelineNodeBeatRefInRows(
  rows: unknown,
  nodeId: string,
  nextBeatRef: string,
): { rows: unknown; updated: boolean } {
  const rawRows = Array.isArray(rows) ? rows : []
  let updated = false
  const nextRows = rawRows.map(row => {
    const record = readRecord(cloneJsonLike(row))
    if (readString(record.id) !== nodeId) return record
    const params = readRecord(cloneJsonLike(record.params))
    params.beat_ref = nextBeatRef
    record.params = params
    updated = true
    return record
  })
  return { rows: nextRows, updated }
}

export function updateAnimationTimelineMarkdownItemBeatRef(args: {
  markdownText: string | null | undefined
  nodeId: string
  beatRef: string
}): { markdownText: string; updated: boolean } {
  const markdownText = String(args.markdownText || '')
  const nodeId = readString(args.nodeId)
  const beatRef = readString(args.beatRef)
  if (!markdownText.trim() || !nodeId || !beatRef) return { markdownText, updated: false }
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const rootRowsResult = updateAnimationTimelineNodeBeatRefInRows(frontmatterState.meta.nodes, nodeId, beatRef)
  if (rootRowsResult.updated) {
    frontmatterState.meta.nodes = rootRowsResult.rows
    return {
      markdownText: buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState),
      updated: true,
    }
  }
  const flow = readRecord(cloneJsonLike(frontmatterState.meta.flow))
  const flowRowsResult = updateAnimationTimelineNodeBeatRefInRows(flow.nodes, nodeId, beatRef)
  if (!flowRowsResult.updated) return { markdownText, updated: false }
  flow.nodes = flowRowsResult.rows
  frontmatterState.meta.flow = flow
  return {
    markdownText: buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState),
    updated: true,
  }
}

export function updateAnimationTimelineMarkdownLaneControlState(args: {
  markdownText: string | null | undefined
  hiddenLaneIds: readonly AnimationTimelineLaneId[]
  mutedLaneIds: readonly AnimationTimelineLaneId[]
  soloLaneId?: AnimationTimelineLaneId | null
}): string {
  const markdownText = String(args.markdownText || '')
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const nextHiddenLaneIds = readLaneIdList(args.hiddenLaneIds)
  const nextMutedLaneIds = readLaneIdList(args.mutedLaneIds)
  const nextSoloLaneId = readLaneId(args.soloLaneId)
  const shouldPersistControls = nextHiddenLaneIds.length > 0 || nextMutedLaneIds.length > 0 || nextSoloLaneId != null
  if (shouldPersistControls) {
    frontmatterState.timeline.lane_controls = {
      hidden: nextHiddenLaneIds,
      muted: nextMutedLaneIds,
      ...(nextSoloLaneId ? { solo: nextSoloLaneId } : {}),
    }
  } else {
    delete frontmatterState.timeline.lane_controls
  }
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function updateAnimationTimelineMarkdownLaneOrder(args: {
  markdownText: string | null | undefined
  laneOrder: readonly AnimationTimelineLaneId[]
}): string {
  const markdownText = String(args.markdownText || '')
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const nextLaneOrder = readLaneIdList(args.laneOrder)
  if (nextLaneOrder.length > 0) frontmatterState.timeline.lane_order = nextLaneOrder
  else delete frontmatterState.timeline.lane_order
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function insertAnimationTimelineBeat(args: {
  markdownText: string | null | undefined
  model: AnimationTimelineModel
  insertAfterBeatRef?: string | null
  insertBeforeBeatRef?: string | null
  snapStepMs?: number | null
}): { markdownText: string; beatRef: string } {
  const markdownText = String(args.markdownText || '')
  const snapStepMs = Math.max(0, Math.round(args.snapStepMs ?? 0)) || 1000
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const existingBeatRefs = new Set<string>([
    ...Object.keys(frontmatterState.beats),
    ...args.model.beats.map(beat => beat.beatRef),
  ])
  const beatRef = createNextAnimationTimelineBeatRef(existingBeatRefs)
  const insertMode = args.insertBeforeBeatRef ? 'before' : 'after'
  const relativeBeatRef = args.insertBeforeBeatRef || args.insertAfterBeatRef || null
  const relativeIndex = (() => {
    if (!relativeBeatRef) return args.model.beats.length - 1
    const found = args.model.beats.findIndex(beat => beat.beatRef === relativeBeatRef)
    return found >= 0 ? found : args.model.beats.length - 1
  })()
  if (args.model.usesAbsoluteTiming) {
    const targetBeat = relativeIndex >= 0 ? args.model.beats[relativeIndex] : null
    const nextBeats = args.model.beats.filter((_, index) => (insertMode === 'before' ? index >= relativeIndex : index > relativeIndex))
    const insertStart =
      insertMode === 'before'
        ? targetBeat?.startMs ?? 0
        : targetBeat?.endMs != null
          ? targetBeat.endMs
          : 0
    const defaultDuration = snapStepMs
    const newBeatRecord: AnimationTimelineBeatRecord = {
      label: `New Beat ${beatRef.replace(/^beat_/, '')}`,
      start_ms: insertStart,
      end_ms: insertStart + defaultDuration,
      duration_ms: defaultDuration,
    }
    for (const beat of nextBeats) {
      const current = readRecord(cloneJsonLike(frontmatterState.beats[beat.beatRef]))
      if (beat.startMs != null) current.start_ms = beat.startMs + defaultDuration
      if (beat.endMs != null) current.end_ms = beat.endMs + defaultDuration
      if (typeof current.start_ms === 'number' && typeof current.end_ms === 'number') {
        current.duration_ms = Math.max(0, current.end_ms - current.start_ms)
      }
      frontmatterState.beats[beat.beatRef] = current
    }
    const orderedBeatRefs = args.model.beats.map(beat => beat.beatRef)
    const insertAt = insertMode === 'before' ? Math.max(0, relativeIndex) : Math.max(0, relativeIndex + 1)
    orderedBeatRefs.splice(insertAt, 0, beatRef)
    const nextOrderedBeats: Record<string, AnimationTimelineBeatRecord> = {}
    for (const orderedBeatRef of orderedBeatRefs) {
      if (orderedBeatRef === beatRef) {
        nextOrderedBeats[orderedBeatRef] = newBeatRecord
        continue
      }
      if (frontmatterState.beats[orderedBeatRef]) {
        nextOrderedBeats[orderedBeatRef] = frontmatterState.beats[orderedBeatRef]
      }
    }
    for (const [existingBeatRef, existingBeatRecord] of Object.entries(frontmatterState.beats)) {
      if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
        nextOrderedBeats[existingBeatRef] = existingBeatRecord
      }
    }
    frontmatterState.beats = nextOrderedBeats
  } else {
    frontmatterState.beats[beatRef] = {
      label: `New Beat ${beatRef.replace(/^beat_/, '')}`,
    }
  }
  return {
    markdownText: buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState),
    beatRef,
  }
}

export function deleteAnimationTimelineBeat(args: {
  markdownText: string | null | undefined
  model: AnimationTimelineModel
  beatRef: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  if (beatIndex < 0) return markdownText
  const beat = args.model.beats[beatIndex]
  if (!beat || beat.items.length > 0) return markdownText
  const durationToRemove =
    beat.startMs != null && beat.endMs != null
      ? Math.max(0, beat.endMs - beat.startMs)
      : null
  delete frontmatterState.beats[beatRef]
  if (args.model.usesAbsoluteTiming && durationToRemove && durationToRemove > 0) {
    for (let i = beatIndex + 1; i < args.model.beats.length; i += 1) {
      const nextBeat = args.model.beats[i]
      if (!nextBeat) continue
      const current = readRecord(cloneJsonLike(frontmatterState.beats[nextBeat.beatRef]))
      if (nextBeat.startMs != null) current.start_ms = Math.max(0, nextBeat.startMs - durationToRemove)
      if (nextBeat.endMs != null) current.end_ms = Math.max(0, nextBeat.endMs - durationToRemove)
      if (typeof current.start_ms === 'number' && typeof current.end_ms === 'number') {
        current.duration_ms = Math.max(0, current.end_ms - current.start_ms)
      }
      frontmatterState.beats[nextBeat.beatRef] = current
    }
  }
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function duplicateAnimationTimelineBeat(args: {
  markdownText: string | null | undefined
  model: AnimationTimelineModel
  beatRef: string
  snapStepMs?: number | null
}): { markdownText: string; beatRef: string } {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  const beat = beatIndex >= 0 ? args.model.beats[beatIndex] : null
  if (!beat) return { markdownText, beatRef: '' }
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const existingBeatRefs = new Set<string>([
    ...Object.keys(frontmatterState.beats),
    ...args.model.beats.map(entry => entry.beatRef),
  ])
  const nextBeatRef = createNextAnimationTimelineBeatRef(existingBeatRefs)
  const nextBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const durationMs =
    beat.startMs != null && beat.endMs != null
      ? Math.max(0, beat.endMs - beat.startMs)
      : Math.max(0, Math.round(args.snapStepMs ?? 1000)) || 1000
  if (args.model.usesAbsoluteTiming && beat.endMs != null) {
    for (let i = beatIndex + 1; i < args.model.beats.length; i += 1) {
      const followingBeat = args.model.beats[i]
      if (!followingBeat) continue
      const current = readRecord(cloneJsonLike(frontmatterState.beats[followingBeat.beatRef]))
      if (followingBeat.startMs != null) current.start_ms = followingBeat.startMs + durationMs
      if (followingBeat.endMs != null) current.end_ms = followingBeat.endMs + durationMs
      if (typeof current.start_ms === 'number' && typeof current.end_ms === 'number') {
        current.duration_ms = Math.max(0, current.end_ms - current.start_ms)
      }
      frontmatterState.beats[followingBeat.beatRef] = current
    }
    nextBeatRecord.start_ms = beat.endMs
    nextBeatRecord.end_ms = beat.endMs + durationMs
    nextBeatRecord.duration_ms = durationMs
  }
  nextBeatRecord.label = `${readString(nextBeatRecord.label) || beat.label} Copy`
  const orderedBeatRefs = args.model.beats.map(entry => entry.beatRef)
  orderedBeatRefs.splice(Math.max(0, beatIndex + 1), 0, nextBeatRef)
  const nextOrderedBeats: Record<string, AnimationTimelineBeatRecord> = {}
  for (const orderedBeatRef of orderedBeatRefs) {
    if (orderedBeatRef === nextBeatRef) {
      nextOrderedBeats[orderedBeatRef] = nextBeatRecord
      continue
    }
    if (frontmatterState.beats[orderedBeatRef]) {
      nextOrderedBeats[orderedBeatRef] = frontmatterState.beats[orderedBeatRef]
    }
  }
  for (const [existingBeatRef, existingBeatRecord] of Object.entries(frontmatterState.beats)) {
    if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
      nextOrderedBeats[existingBeatRef] = existingBeatRecord
    }
  }
  frontmatterState.beats = nextOrderedBeats
  return {
    markdownText: buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState),
    beatRef: nextBeatRef,
  }
}

export function splitAnimationTimelineBeat(args: {
  markdownText: string | null | undefined
  model: AnimationTimelineModel
  beatRef: string
  splitAtMs: number
  minDurationMs?: number
  snapStepMs?: number | null
}): { markdownText: string; beatRef: string } {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  const beat = beatIndex >= 0 ? args.model.beats[beatIndex] : null
  if (!beat || beat.startMs == null || beat.endMs == null) return { markdownText, beatRef: '' }
  const minDurationMs = Math.max(100, Math.round(args.minDurationMs ?? 300))
  const snapStepMs = Math.max(0, Math.round(args.snapStepMs ?? 0))
  const rawSplitAtMs = snapStepMs > 0 ? snapAnimationTimelineValue(args.splitAtMs, snapStepMs) : Math.round(args.splitAtMs)
  const splitAtMs = Math.max(beat.startMs + minDurationMs, Math.min(beat.endMs - minDurationMs, rawSplitAtMs))
  if (splitAtMs <= beat.startMs || splitAtMs >= beat.endMs) return { markdownText, beatRef: '' }
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const existingBeatRefs = new Set<string>([
    ...Object.keys(frontmatterState.beats),
    ...args.model.beats.map(entry => entry.beatRef),
  ])
  const nextBeatRef = createNextAnimationTimelineBeatRef(existingBeatRefs)
  const currentBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  currentBeatRecord.end_ms = splitAtMs
  currentBeatRecord.duration_ms = splitAtMs - beat.startMs
  nextBeatRecord.start_ms = splitAtMs
  nextBeatRecord.end_ms = beat.endMs
  nextBeatRecord.duration_ms = beat.endMs - splitAtMs
  nextBeatRecord.label = `${readString(nextBeatRecord.label) || beat.label} Part 2`
  frontmatterState.beats[beatRef] = currentBeatRecord
  const orderedBeatRefs = args.model.beats.map(entry => entry.beatRef)
  orderedBeatRefs.splice(Math.max(0, beatIndex + 1), 0, nextBeatRef)
  const nextOrderedBeats: Record<string, AnimationTimelineBeatRecord> = {}
  for (const orderedBeatRef of orderedBeatRefs) {
    if (orderedBeatRef === nextBeatRef) {
      nextOrderedBeats[orderedBeatRef] = nextBeatRecord
      continue
    }
    if (frontmatterState.beats[orderedBeatRef]) {
      nextOrderedBeats[orderedBeatRef] = frontmatterState.beats[orderedBeatRef]
    }
  }
  for (const [existingBeatRef, existingBeatRecord] of Object.entries(frontmatterState.beats)) {
    if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
      nextOrderedBeats[existingBeatRef] = existingBeatRecord
    }
  }
  frontmatterState.beats = nextOrderedBeats
  return {
    markdownText: buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState),
    beatRef: nextBeatRef,
  }
}

export function mergeAnimationTimelineBeatWithNext(args: {
  markdownText: string | null | undefined
  model: AnimationTimelineModel
  beatRef: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  if (beatIndex < 0) return markdownText
  const beat = args.model.beats[beatIndex]
  const nextBeat = args.model.beats[beatIndex + 1]
  if (!beat || !nextBeat) return markdownText
  if (!args.model.usesAbsoluteTiming) return markdownText
  if (beat.startMs == null || beat.endMs == null || nextBeat.endMs == null) return markdownText
  if (nextBeat.items.length > 0) return markdownText
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  const currentBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  currentBeatRecord.end_ms = nextBeat.endMs
  currentBeatRecord.duration_ms = Math.max(0, nextBeat.endMs - beat.startMs)
  frontmatterState.beats[beatRef] = currentBeatRecord
  delete frontmatterState.beats[nextBeat.beatRef]
  const orderedBeatRefs = args.model.beats.map(entry => entry.beatRef).filter(entry => entry !== nextBeat.beatRef)
  const nextOrderedBeats: Record<string, AnimationTimelineBeatRecord> = {}
  for (const orderedBeatRef of orderedBeatRefs) {
    if (frontmatterState.beats[orderedBeatRef]) nextOrderedBeats[orderedBeatRef] = frontmatterState.beats[orderedBeatRef]
  }
  for (const [existingBeatRef, existingBeatRecord] of Object.entries(frontmatterState.beats)) {
    if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
      nextOrderedBeats[existingBeatRef] = existingBeatRecord
    }
  }
  frontmatterState.beats = nextOrderedBeats
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function removeAnimationTimelineGapBeforeBeat(args: {
  markdownText: string | null | undefined
  model: AnimationTimelineModel
  beatRef: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  if (beatIndex <= 0) return markdownText
  const beat = args.model.beats[beatIndex]
  const previousBeat = args.model.beats[beatIndex - 1]
  if (!beat || !previousBeat) return markdownText
  if (!args.model.usesAbsoluteTiming) return markdownText
  if (beat.startMs == null || previousBeat.endMs == null) return markdownText
  const gapMs = Math.max(0, beat.startMs - previousBeat.endMs)
  if (gapMs <= 0) return markdownText
  const frontmatterState = collectAnimationTimelineFrontmatterState(markdownText)
  for (let i = beatIndex; i < args.model.beats.length; i += 1) {
    const currentBeat = args.model.beats[i]
    if (!currentBeat) continue
    const currentBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[currentBeat.beatRef]))
    if (currentBeat.startMs != null) currentBeatRecord.start_ms = Math.max(0, currentBeat.startMs - gapMs)
    if (currentBeat.endMs != null) currentBeatRecord.end_ms = Math.max(0, currentBeat.endMs - gapMs)
    if (typeof currentBeatRecord.start_ms === 'number' && typeof currentBeatRecord.end_ms === 'number') {
      currentBeatRecord.duration_ms = Math.max(0, currentBeatRecord.end_ms - currentBeatRecord.start_ms)
    }
    frontmatterState.beats[currentBeat.beatRef] = currentBeatRecord
  }
  return buildAnimationTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function findAnimationTimelineBeatIndexAtPosition(model: AnimationTimelineModel, position: number): number {
  if (model.beats.length === 0) return -1
  const normalizedPosition = Number.isFinite(position) ? position : 0
  for (let i = 0; i < model.beats.length; i += 1) {
    const beat = model.beats[i]
    if (normalizedPosition < beat.displayEnd || i === model.beats.length - 1) return i
  }
  return model.beats.length - 1
}

export function formatAnimationTimelineTimestamp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--:--.--'
  const totalMs = Math.max(0, Math.floor(value))
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const centiseconds = Math.floor((totalMs % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}
