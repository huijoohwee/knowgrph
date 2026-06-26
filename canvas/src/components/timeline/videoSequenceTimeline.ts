import type { MermaidGanttSourceRangeMinutes, MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { readMermaidGanttTaskSourceRangeMinutes } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { clampTimelineTransportValue } from './timelineTransport'
import { isLikelyAbsoluteFsPath, buildLocalFsFetchPath } from '@/lib/url'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { isPlainObject } from '@/lib/graph/value'

export type VideoSequenceTimelineToolId = 'cut' | 'splice' | 'mask' | 'grade' | 'speed' | 'adjustment' | 'transition' | 'keyframe' | 'fbf' | 'detached' | 'nested' | 'morph' | 'text' | 'modifier' | 'record' | 'filter' | 'effect'
export type VideoSequenceTimelineLaneId = 'video' | 'image' | 'scene' | 'mask' | 'grade' | 'effect' | 'adjustment' | 'transition' | 'keyframe' | 'fbf' | 'detached' | 'nested' | 'morph' | 'text' | 'modifier' | 'record' | 'filter' | 'audio'
export type VideoSequenceTimelineImportMode = 'file' | 'folder' | 'url' | 'workspace'
export type VideoSequenceTimelineSourceCoverageMode = 'authored' | 'source-covered'
export type VideoSequenceTimelineScopeId = 'live-preview' | 'luma-waveform' | 'chroma-vectorscope' | 'histogram' | 'audio-waveform' | 'audio-mix'
export type VideoSequenceTimelineProjectionOptions = {
  disabledLaneIds?: readonly VideoSequenceTimelineLaneId[]
  sourceCoverageMode?: VideoSequenceTimelineSourceCoverageMode
}

export type VideoSequenceTimelineTool = {
  id: VideoSequenceTimelineToolId
  label: string
  title: string
}

export type VideoSequenceTimelineLane = {
  id: VideoSequenceTimelineLaneId
  label: string
}

export type VideoSequenceTimelineScope = {
  active: boolean
  activeFamilyId: string
  activityMode: string
  id: VideoSequenceTimelineScopeId
  label: string
  samples: number[]
  selectionActive: boolean
  value: number
}

export type TimelineTransportPlaybackRequestDetail = {
  documentKey: string
  playbackRate: number
  playing: boolean
  position: number
}

export type VideoSequenceTimelineSource = {
  id: string
  originalName: string
  relativePath: string
  workspacePath: string
  sourceUrl: string
  mimeHint: string
  byteSize: number | null
  durationSeconds?: number
  frameRate?: number
  displayWidth?: number
  displayHeight?: number
  importMode: VideoSequenceTimelineImportMode | ''
}

export type VideoSequenceTimelineFrontmatterModel = {
  enabled: boolean
  sources: VideoSequenceTimelineSource[]
}

export const TIMELINE_TRANSPORT_PLAYBACK_REQUEST_EVENT = 'knowgrph:timeline-transport-playback-request'

export const VIDEO_SEQUENCE_TIMELINE_TOOLS: readonly VideoSequenceTimelineTool[] = [
  { id: 'cut', label: 'Cut', title: 'Cut selected clip at playhead' },
  { id: 'splice', label: 'Splice', title: 'Splice selected clip to playhead' },
  { id: 'mask', label: 'Mask', title: 'Add mask lane for selected clip' },
  { id: 'grade', label: 'Grade', title: 'Add color grade lane for selected clip' },
  { id: 'speed', label: 'Speed', title: 'Add speed control lane for selected clip' },
  { id: 'adjustment', label: 'Adjustment', title: 'Add adjustment layer for selected clip' },
  { id: 'transition', label: 'Transition', title: 'Add transition lane for selected clip' },
  { id: 'keyframe', label: 'Keyframe', title: 'Add keyframe lane for selected clip' },
  { id: 'fbf', label: 'FBF', title: 'Add frame-by-frame cel lane with onion skinning' },
  { id: 'detached', label: 'Detached', title: 'Add persistent detached layer lane' },
  { id: 'nested', label: 'Nested', title: 'Add nested timeline and frame-by-frame composition lane' },
  { id: 'morph', label: 'Morph', title: 'Add vector morph lane for selected clip' },
  { id: 'text', label: 'Text', title: 'Add text animation lane for selected clip' },
  { id: 'modifier', label: 'Modifier', title: 'Add stroke trim, follow path, or loop mode without keyframes' },
  { id: 'record', label: 'Record', title: 'Enable playhead recording for automatic keyframes' },
  { id: 'filter', label: 'Filter', title: 'Add filter lane for selected clip' },
  { id: 'effect', label: 'Effect', title: 'Add effect lane for selected clip' },
] as const

export const VIDEO_SEQUENCE_TIMELINE_LANES: readonly VideoSequenceTimelineLane[] = [
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Image' },
  { id: 'scene', label: 'Scene' },
  { id: 'mask', label: 'Mask' },
  { id: 'grade', label: 'Grade' },
  { id: 'effect', label: 'Effect' },
  { id: 'adjustment', label: 'Adjust' },
  { id: 'transition', label: 'Trans' },
  { id: 'keyframe', label: 'Keys' },
  { id: 'fbf', label: 'FBF' },
  { id: 'detached', label: 'Persist' },
  { id: 'nested', label: 'Nest' },
  { id: 'morph', label: 'Morph' },
  { id: 'text', label: 'Text' },
  { id: 'modifier', label: 'Mods' },
  { id: 'record', label: 'Rec' },
  { id: 'filter', label: 'Filter' },
  { id: 'audio', label: 'Audio' },
] as const

export const VIDEO_SEQUENCE_BOTTOM_PANEL_DISABLED_LANE_IDS: readonly VideoSequenceTimelineLaneId[] = ['mask', 'grade'] as const

const VIDEO_SEQUENCE_TIMELINE_SCOPE_DEFS: readonly Pick<VideoSequenceTimelineScope, 'id' | 'label'>[] = [
  { id: 'live-preview', label: 'Live preview' },
  { id: 'luma-waveform', label: 'Luma waveform' },
  { id: 'chroma-vectorscope', label: 'Chroma vectorscope' },
  { id: 'histogram', label: 'Histogram' },
  { id: 'audio-waveform', label: 'Audio waveform' },
  { id: 'audio-mix', label: 'Audio mix' },
] as const

export const VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS: readonly VideoSequenceTimelineToolId[] = [
  'mask',
  'grade',
  'speed',
  'adjustment',
  'transition',
  'keyframe',
  'fbf',
  'detached',
  'nested',
  'morph',
  'text',
  'modifier',
  'record',
  'filter',
  'effect',
] as const

const clean = (value: unknown): string => String(value || '').trim()

const cleanPath = (value: unknown): string => clean(value).replace(/\\/g, '/').trim()

const readBoolean = (value: unknown): boolean => {
  if (value === true) return true
  const normalized = clean(value).toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}

const readByteSize = (value: unknown): number | null => {
  const size = Number(value)
  if (!Number.isFinite(size) || size < 0) return null
  return Math.floor(size)
}

const readPositiveNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const readImportMode = (value: unknown): VideoSequenceTimelineImportMode | '' => {
  const mode = clean(value)
  return mode === 'file' || mode === 'folder' || mode === 'url' || mode === 'workspace' ? mode : ''
}

export function dispatchTimelineTransportPlaybackRequest(detail: TimelineTransportPlaybackRequestDetail): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(new CustomEvent(TIMELINE_TRANSPORT_PLAYBACK_REQUEST_EVENT, { detail }))
}

const normalizeVideoSequenceSource = (value: unknown): VideoSequenceTimelineSource | null => {
  if (!isPlainObject(value)) return null
  const record = value as Record<string, unknown>
  const id = clean(record.id)
  const originalName = clean(record.originalName)
  const relativePath = cleanPath(record.relativePath)
  const workspacePath = cleanPath(record.workspacePath)
  const sourceUrl = clean(record.sourceUrl)
  const mimeHint = clean(record.mimeHint)
  if (!id && !originalName && !relativePath && !workspacePath && !sourceUrl) return null
  return {
    id,
    originalName,
    relativePath,
    workspacePath,
    sourceUrl,
    mimeHint,
    byteSize: readByteSize(record.byteSize),
    displayHeight: readPositiveNumber(record.displayHeight),
    displayWidth: readPositiveNumber(record.displayWidth),
    durationSeconds: readPositiveNumber(record.durationSeconds),
    frameRate: readPositiveNumber(record.frameRate),
    importMode: readImportMode(record.importMode),
  }
}

export function readVideoSequenceTimelineModelFromMarkdown(rawText: string): VideoSequenceTimelineFrontmatterModel | null {
  const lines = splitMarkdownLines(String(rawText || ''))
  const parsed = parseMarkdownFrontmatter(lines)
  const meta = isPlainObject(parsed.meta) ? parsed.meta : null
  if (!meta) return null
  const sources = Array.isArray(meta.kgVideoSequenceSources)
    ? meta.kgVideoSequenceSources.map(normalizeVideoSequenceSource).filter((item): item is VideoSequenceTimelineSource => !!item)
    : []
  const enabled = readBoolean(meta.kgVideoSequenceTimeline) || sources.length > 0
  return enabled ? { enabled, sources } : null
}

export function isVideoSequenceTimelineMarkdown(rawText: string): boolean {
  return readVideoSequenceTimelineModelFromMarkdown(rawText)?.enabled === true
}

const resolvePlayableSourceCandidate = (value: unknown): string => {
  const candidate = clean(value)
  if (!candidate) return ''
  if (/^(?:https?:|blob:|data:video\/)/i.test(candidate)) return candidate
  if (candidate.startsWith('/@fs/')) return candidate
  if (/^file:\/\//i.test(candidate)) return buildLocalFsFetchPath(candidate.replace(/^file:\/\//i, '')) || ''
  const localFsPath = buildLocalFsFetchPath(candidate)
  if (localFsPath) return localFsPath
  if (candidate.startsWith('/') && !isLikelyAbsoluteFsPath(candidate)) return candidate
  return ''
}

export function readVideoSequenceSourcePlayableUrl(source: VideoSequenceTimelineSource | null | undefined): string {
  if (!source) return ''
  return resolvePlayableSourceCandidate(source.sourceUrl)
    || resolvePlayableSourceCandidate(source.relativePath)
}

export function resolveVideoSequenceTimelineLane(span: MermaidGanttTimelineTaskSpan): VideoSequenceTimelineLaneId {
  const signature = `${span.label} ${span.raw}`.toLowerCase()
  if (/\baudio|sound|voice|music\b/.test(signature)) return 'audio'
  if (/\bnested|composite|child timeline|timeline inside|inside timeline|timeline[-\s]?in[-\s]?fbf|fbf[-\s]?in[-\s]?timeline|timeline inside frame[-\s]?by[-\s]?frame|frame[-\s]?by[-\s]?frame inside timeline\b/.test(signature) || /_nested\b/.test(signature)) return 'nested'
  if (/\bfbf|frame[-\s]?by[-\s]?frame|cel|onion|onion skin\b/.test(signature) || /_fbf\b/.test(signature)) return 'fbf'
  if (/\bdetached|persistent|continuous|background|ui chrome\b/.test(signature) || /_detached\b/.test(signature)) return 'detached'
  if (/\bimage|still|plate|photo|frame\b/.test(signature) || /_image\b/.test(signature)) return 'image'
  if (/\bscene\b/.test(signature) || /_scene\b/.test(signature)) return 'scene'
  if (/\bkeyframe|key\b/.test(signature) || /_keyframe\b/.test(signature)) return 'keyframe'
  if (/\bmorph|shape|vector|path|rectangle|ellipse|polygon|star|boolean|union|subtract|intersect|exclude\b/.test(signature) || /_morph\b/.test(signature)) return 'morph'
  if (/\btext|caption|title|subtitle|type|character|segment|node|font|font size|letter spacing|line height|tracking\b/.test(signature) || /_text\b/.test(signature)) return 'text'
  if (/\bmodifier|stroke trim|follow path|loop|ping-pong|ping pong\b/.test(signature) || /_modifier\b/.test(signature)) return 'modifier'
  if (/\brecord|recording|auto[-\s]?key\b/.test(signature) || /_record\b/.test(signature)) return 'record'
  if (/\btransition|dissolve|wipe|fade\b/.test(signature) || /_transition\b/.test(signature)) return 'transition'
  if (/\badjust|adjustment|layer\b/.test(signature) || /_adjustment\b/.test(signature)) return 'adjustment'
  if (/\bfilter|blur|sharpen|denoise\b/.test(signature) || /_filter\b/.test(signature)) return 'filter'
  if (/\beffect|fx|speed|retime|stabilize\b/.test(signature) || /_(?:effect|speed)\b/.test(signature)) return 'effect'
  if (/\bmask|matte|roto|alpha\b/.test(signature)) return 'mask'
  if (/\bgrade|color|lut|exposure|contrast\b/.test(signature)) return 'grade'
  return 'video'
}

export function shouldRenderVideoSequenceTimelineSpan(span: MermaidGanttTimelineTaskSpan): boolean {
  if (/(^|[:,\s])vert([,\s]|$)/i.test(span.raw)) return true
  return clean(span.label).length > 0 && span.durationMinutes > 0.0001 && span.endMinutes > span.startMinutes
}

const readVideoSequenceSpanSourceRange = (span: MermaidGanttTimelineTaskSpan): MermaidGanttSourceRangeMinutes => {
  return readMermaidGanttTaskSourceRangeMinutes(span.raw) || {
    endMinutes: span.endMinutes,
    startMinutes: span.startMinutes,
  }
}

const isVideoSequenceSourceRangeCovered = (
  range: MermaidGanttSourceRangeMinutes,
  videoRanges: readonly MermaidGanttSourceRangeMinutes[],
): boolean => {
  const epsilon = 0.0001
  let cursor = range.startMinutes
  for (const videoRange of videoRanges) {
    if (videoRange.endMinutes <= cursor + epsilon) continue
    if (videoRange.startMinutes > cursor + epsilon) return false
    cursor = Math.max(cursor, videoRange.endMinutes)
    if (cursor >= range.endMinutes - epsilon) return true
  }
  return false
}

export function resolveRenderableVideoSequenceTimelineSpans(
  taskSpans: readonly MermaidGanttTimelineTaskSpan[],
  options: VideoSequenceTimelineProjectionOptions = {},
): readonly MermaidGanttTimelineTaskSpan[] {
  const baseSpans = taskSpans.filter(shouldRenderVideoSequenceTimelineSpan)
  const disabledLaneIds = new Set(options.disabledLaneIds || [])
  const enabledBaseSpans = disabledLaneIds.size
    ? baseSpans.filter(span => !disabledLaneIds.has(resolveVideoSequenceTimelineLane(span)))
    : baseSpans
  if (options.sourceCoverageMode !== 'source-covered') return enabledBaseSpans
  const videoRanges = baseSpans
    .filter(span => resolveVideoSequenceTimelineLane(span) === 'video')
    .map(readVideoSequenceSpanSourceRange)
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes)
  if (!videoRanges.length) return enabledBaseSpans
  return enabledBaseSpans.filter(span => {
    const lane = resolveVideoSequenceTimelineLane(span)
    if (lane === 'video' || lane === 'image' || lane === 'scene') return true
    return isVideoSequenceSourceRangeCovered(readVideoSequenceSpanSourceRange(span), videoRanges)
  })
}

export function resolveVisibleVideoSequenceTimelineLanes(
  taskSpans: readonly MermaidGanttTimelineTaskSpan[],
  options: VideoSequenceTimelineProjectionOptions = {},
): readonly VideoSequenceTimelineLane[] {
  const activeLaneIds = new Set(resolveRenderableVideoSequenceTimelineSpans(taskSpans, options).map(span => resolveVideoSequenceTimelineLane(span)))
  const disabledLaneIds = new Set(options.disabledLaneIds || [])
  const candidateLanes = disabledLaneIds.size
    ? VIDEO_SEQUENCE_TIMELINE_LANES.filter(lane => !disabledLaneIds.has(lane.id))
    : VIDEO_SEQUENCE_TIMELINE_LANES
  const visibleLanes = candidateLanes.filter(lane => activeLaneIds.has(lane.id))
  return visibleLanes.length ? visibleLanes : candidateLanes
}

export function resolveVisibleVideoSequenceTimelineLaneCount(
  taskSpans: readonly MermaidGanttTimelineTaskSpan[],
  options: VideoSequenceTimelineProjectionOptions = {},
): number {
  return resolveVisibleVideoSequenceTimelineLanes(taskSpans, options).length
}

export function formatVideoSequenceTimelineSecondsOffset(valueSeconds: number): string {
  const totalSeconds = Math.max(0, Math.round(Number.isFinite(valueSeconds) ? valueSeconds : 0))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function resolveVideoSequenceTimelineMediaSeconds(args: {
  durationSeconds: number
  maxMinutes: number
  positionMinutes: number
}): number {
  if (!Number.isFinite(args.durationSeconds) || args.durationSeconds <= 0 || args.maxMinutes <= 0) return 0
  const ratio = clampTimelineTransportValue(args.positionMinutes, 0, args.maxMinutes) / args.maxMinutes
  return clampTimelineTransportValue(ratio * args.durationSeconds, 0, args.durationSeconds)
}

export function resolveVideoSequenceTimelinePositionMinutes(args: {
  currentTimeSeconds: number
  durationSeconds: number
  maxMinutes: number
}): number {
  if (!Number.isFinite(args.currentTimeSeconds) || !Number.isFinite(args.durationSeconds) || args.durationSeconds <= 0 || args.maxMinutes <= 0) return 0
  const ratio = clampTimelineTransportValue(args.currentTimeSeconds, 0, args.durationSeconds) / args.durationSeconds
  return clampTimelineTransportValue(ratio * args.maxMinutes, 0, args.maxMinutes)
}

export function resolveVideoSequenceTimelineUnitsPerMs(args: {
  durationSeconds: number
  fallbackUnitsPerMs: number
  maxMinutes: number
}): number {
  if (!Number.isFinite(args.durationSeconds) || args.durationSeconds <= 0 || args.maxMinutes <= 0) return args.fallbackUnitsPerMs
  return args.maxMinutes / (args.durationSeconds * 1000)
}

export function buildVideoSequenceTimelineScopes(args: {
  activeFamilyId?: string
  activityMode?: string
  maxMinutes: number
  positionMinutes: number
  selectionActive?: boolean
  sourceCount: number
  spanCount: number
}): VideoSequenceTimelineScope[] {
  const maxMinutes = Math.max(0, Number.isFinite(args.maxMinutes) ? args.maxMinutes : 0)
  const progress = maxMinutes > 0 ? clampTimelineTransportValue(args.positionMinutes, 0, maxMinutes) / maxMinutes : 0
  const density = Math.max(1, args.sourceCount + args.spanCount)
  const activityKey = String(args.activeFamilyId || '').trim()
  const activitySeed = Array.from(activityKey).reduce((total, char, index) => total + char.charCodeAt(0) * (index + 5), density * 19)
  const activityMode = String(args.activityMode || 'fallback').trim() || 'fallback'
  const selectionActive = !!args.selectionActive
  return VIDEO_SEQUENCE_TIMELINE_SCOPE_DEFS.map((scope, scopeIndex) => {
    const samples = Array.from({ length: 12 }, (_, sampleIndex) => {
      const phase = (sampleIndex + 1) * (scopeIndex + 2) * 0.37 + progress * Math.PI * 2 + activitySeed * 0.0009
      const shaped = Math.sin(phase) * 0.34 + Math.cos(phase / Math.max(1, density)) * 0.18 + (selectionActive ? 0.56 : 0.5)
      return Math.round(clampTimelineTransportValue(shaped, 0.06, 0.96) * 100)
    })
    const value = Math.round(samples.reduce((total, sample) => total + sample, 0) / samples.length)
    return {
      ...scope,
      active: scopeIndex === 0 && activityKey.length > 0,
      activeFamilyId: activityKey,
      activityMode,
      samples,
      selectionActive,
      value,
    }
  })
}

type VideoSequenceTimelineSampleArgs = {
  sampleCount: number
  seedText: string
}

function buildVideoSequenceTimelineSeededSamples(args: VideoSequenceTimelineSampleArgs, options: {
  maxValue: number
  minValue: number
  phaseStep: number
}): number[] {
  const count = Math.max(4, Math.min(96, Math.round(Number.isFinite(args.sampleCount) ? args.sampleCount : 0)))
  const seedText = clean(args.seedText)
  const seed = Array.from(seedText).reduce((total, char, index) => total + (char.charCodeAt(0) * (index + 3)), count * 17)
  return Array.from({ length: count }, (_, sampleIndex) => {
    const phase = (sampleIndex + 1) * options.phaseStep + seed * 0.013
    const shaped = Math.sin(phase) * 0.32 + Math.cos(phase * 0.47) * 0.22 + 0.52
    return Math.round(clampTimelineTransportValue(shaped * 100, options.minValue, options.maxValue))
  })
}

export function buildVideoSequenceTimelineCueSamples(args: VideoSequenceTimelineSampleArgs): number[] {
  return buildVideoSequenceTimelineSeededSamples(args, { minValue: 18, maxValue: 100, phaseStep: 0.53 })
}

export function buildVideoSequenceTimelineFrameSamples(args: VideoSequenceTimelineSampleArgs): number[] {
  return buildVideoSequenceTimelineSeededSamples(args, { minValue: 28, maxValue: 100, phaseStep: 0.41 })
}

export function buildVideoSequenceTimelineWaveformSamples(args: VideoSequenceTimelineSampleArgs): number[] {
  return buildVideoSequenceTimelineSeededSamples(args, { minValue: 8, maxValue: 96, phaseStep: 0.71 })
}

export function buildVideoSequenceTimelineToolStatus(args: {
  selectedSpan: MermaidGanttTimelineTaskSpan | null
  positionMinutes: number
}): Record<VideoSequenceTimelineToolId, boolean> {
  const span = args.selectedSpan
  if (!span) {
    return VIDEO_SEQUENCE_TIMELINE_TOOLS.reduce((out, tool) => {
      out[tool.id] = false
      return out
    }, {} as Record<VideoSequenceTimelineToolId, boolean>)
  }
  const playhead = Math.round(args.positionMinutes)
  const canCut = playhead > span.startMinutes && playhead < span.endMinutes
  return {
    cut: canCut,
    splice: playhead >= 0 && playhead !== span.startMinutes,
    mask: true,
    grade: true,
    speed: true,
    adjustment: true,
    transition: true,
    keyframe: true,
    fbf: true,
    detached: true,
    nested: true,
    morph: true,
    text: true,
    modifier: true,
    record: true,
    filter: true,
    effect: true,
  }
}
