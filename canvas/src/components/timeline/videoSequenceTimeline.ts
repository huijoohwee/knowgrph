import type { MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { isLikelyAbsoluteFsPath, buildLocalFsFetchPath } from '@/lib/url'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { isPlainObject } from '@/lib/graph/value'

export type VideoSequenceTimelineToolId = 'cut' | 'splice' | 'mask' | 'grade'
export type VideoSequenceTimelineLaneId = 'video' | 'mask' | 'grade' | 'audio'
export type VideoSequenceTimelineImportMode = 'file' | 'folder' | 'url' | 'workspace'

export type VideoSequenceTimelineTool = {
  id: VideoSequenceTimelineToolId
  label: string
  title: string
}

export type VideoSequenceTimelineLane = {
  id: VideoSequenceTimelineLaneId
  label: string
}

export type VideoSequenceTimelineSource = {
  id: string
  originalName: string
  relativePath: string
  workspacePath: string
  sourceUrl: string
  mimeHint: string
  byteSize: number | null
  importMode: VideoSequenceTimelineImportMode | ''
}

export type VideoSequenceTimelineFrontmatterModel = {
  enabled: boolean
  sources: VideoSequenceTimelineSource[]
}

export const VIDEO_SEQUENCE_TIMELINE_TOOLS: readonly VideoSequenceTimelineTool[] = [
  { id: 'cut', label: 'Cut', title: 'Cut selected clip at playhead' },
  { id: 'splice', label: 'Splice', title: 'Splice selected clip to playhead' },
  { id: 'mask', label: 'Mask', title: 'Add mask lane for selected clip' },
  { id: 'grade', label: 'Grade', title: 'Add color grade lane for selected clip' },
] as const

export const VIDEO_SEQUENCE_TIMELINE_LANES: readonly VideoSequenceTimelineLane[] = [
  { id: 'video', label: 'Video' },
  { id: 'mask', label: 'Mask' },
  { id: 'grade', label: 'Grade' },
  { id: 'audio', label: 'Audio' },
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

const readImportMode = (value: unknown): VideoSequenceTimelineImportMode | '' => {
  const mode = clean(value)
  return mode === 'file' || mode === 'folder' || mode === 'url' || mode === 'workspace' ? mode : ''
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
  if (/\bmask|matte|roto|alpha\b/.test(signature)) return 'mask'
  if (/\bgrade|color|lut|exposure|contrast\b/.test(signature)) return 'grade'
  return 'video'
}

export function resolveVideoSequenceTimelineLaneIndex(lane: VideoSequenceTimelineLaneId): number {
  return Math.max(0, VIDEO_SEQUENCE_TIMELINE_LANES.findIndex(item => item.id === lane))
}

export function buildVideoSequenceTimelineToolStatus(args: {
  selectedSpan: MermaidGanttTimelineTaskSpan | null
  positionMinutes: number
}): Record<VideoSequenceTimelineToolId, boolean> {
  const span = args.selectedSpan
  if (!span) return { cut: false, splice: false, mask: false, grade: false }
  const playhead = Math.round(args.positionMinutes)
  const canCut = playhead > span.startMinutes && playhead < span.endMinutes
  return {
    cut: canCut,
    splice: playhead >= 0 && playhead !== span.startMinutes,
    mask: true,
    grade: true,
  }
}
