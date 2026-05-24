import { resolveBeatRefForNode } from '@/components/FlowEditor/beatByBeat'
import { FLOW_EDGE_SOURCE_PORT_KEY } from '@/lib/graph/flowPorts'
import { isPlainObject } from '@/lib/graph/value'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'

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

export type AnimationTimelineModel = {
  beats: AnimationTimelineBeat[]
  lanes: AnimationTimelineLane[]
  totalSpan: number
  totalDurationMs: number | null
  usesAbsoluteTiming: boolean
}

type FrontmatterBeatMeta = {
  beatRef: string
  label: string
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

function readRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {}
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
    return {
      beatRef: String(beatRef || '').trim(),
      label,
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
  const lanes = LANE_ORDER.filter(laneId => laneUsage.has(laneId)).map(laneId => ({
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
