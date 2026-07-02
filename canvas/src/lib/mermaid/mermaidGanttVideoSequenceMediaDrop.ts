import { hashText } from '@/features/parsers/hash'
import { yamlQuote } from '@/features/markdown-workspace/workspaceImport/yaml'
import { replaceFirstMermaidGanttFrontmatterCode } from './mermaidGanttBarInteraction'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'

export type MermaidGanttVideoSequenceMediaDropResult = {
  markdownText: string
  rowKey: string
}

const DEFAULT_DROP_DURATION_MINUTES = 1

const cleanInline = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim()

const sanitizeMermaidLabel = (value: unknown, fallback: string): string => {
  const label = cleanInline(value).replace(/[:|#]+/g, ' ').replace(/\s+/g, ' ').trim()
  return label || fallback
}

const normalizeClockToken = (minutes: number): string => {
  const safe = Math.max(0, Number.isFinite(minutes) ? minutes : 0)
  return `kgpos_${String(Number(safe.toFixed(3))).replace(/\./g, '_')}`
}

const normalizeSourceRangeToken = (durationMinutes: number): string => {
  const duration = Math.max(0.001, Number.isFinite(durationMinutes) ? durationMinutes : DEFAULT_DROP_DURATION_MINUTES)
  return `kgsrc_0_${String(Number(duration.toFixed(3))).replace(/\./g, '_')}`
}

const normalizeDurationToken = (durationMinutes: number): string => {
  const duration = Math.max(0.001, Number.isFinite(durationMinutes) ? durationMinutes : DEFAULT_DROP_DURATION_MINUTES)
  return `${Number(duration.toFixed(3))}m`
}

const readExistingSourceIds = (frontmatterLines: readonly string[]): Set<string> => {
  const ids = new Set<string>()
  for (const line of frontmatterLines) {
    const match = /^\s*id\s*:\s*["']?([^"'\s]+)["']?\s*$/.exec(line)
    if (match?.[1]) ids.add(match[1])
  }
  return ids
}

const buildMediaSourceId = (media: MediaDragPayload, frontmatterLines: readonly string[]): string => {
  const ids = readExistingSourceIds(frontmatterLines)
  const signature = [media.sourceKey, media.url, media.label, media.kind].map(cleanInline).join(':')
  const base = `clip_${hashText(signature).slice(0, 10)}`
  if (!ids.has(base)) return base
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}_${index}`
    if (!ids.has(candidate)) return candidate
  }
  return `${base}_${Date.now().toString(36)}`
}

const inferMimeHint = (media: MediaDragPayload): string => {
  const signature = `${media.label} ${media.url}`.toLowerCase()
  if (media.kind === 'audio') {
    if (/\.m4a\b/.test(signature)) return 'audio/mp4'
    if (/\.wav\b/.test(signature)) return 'audio/wav'
    if (/\.ogg\b/.test(signature)) return 'audio/ogg'
    return 'audio/mpeg'
  }
  if (media.kind === 'image') {
    if (/\.svg\b/.test(signature)) return 'image/svg+xml'
    if (/\.webp\b/.test(signature)) return 'image/webp'
    if (/\.png\b/.test(signature)) return 'image/png'
    return 'image/jpeg'
  }
  if (/\.webm\b/.test(signature)) return 'video/webm'
  if (/\.mov\b/.test(signature)) return 'video/quicktime'
  return 'video/mp4'
}

const buildSourceLines = (args: {
  id: string
  media: MediaDragPayload
}): string[] => [
  `  - id: ${yamlQuote(args.id)}`,
  `    originalName: ${yamlQuote(cleanInline(args.media.label) || args.media.kind)}`,
  `    relativePath: ${yamlQuote(cleanInline(args.media.label || args.media.url) || args.id)}`,
  '    importMode: "url"',
  `    sourceUrl: ${yamlQuote(args.media.url)}`,
  `    mimeHint: ${yamlQuote(inferMimeHint(args.media))}`,
]

const findFrontmatterEndIndex = (lines: readonly string[]): number => {
  if (lines[0]?.trim() !== '---') return -1
  return lines.findIndex((line, index) => index > 0 && line.trim() === '---')
}

const appendSourceToFrontmatter = (args: {
  lines: string[]
  sourceId: string
  media: MediaDragPayload
}): string[] | null => {
  const frontmatterEndIndex = findFrontmatterEndIndex(args.lines)
  if (frontmatterEndIndex <= 0) return null
  const sourceKeyIndex = args.lines.findIndex((line, index) => (
    index > 0 && index < frontmatterEndIndex && /^\s*kgVideoSequenceSources\s*:\s*$/.test(line)
  ))
  const sourceLines = buildSourceLines({ id: args.sourceId, media: args.media })
  const nextLines = args.lines.slice()
  if (sourceKeyIndex < 0) {
    const flowIndex = nextLines.findIndex((line, index) => index > 0 && index < frontmatterEndIndex && /^\s*flow_diagrams\s*:\s*$/.test(line))
    nextLines.splice(flowIndex > 0 ? flowIndex : frontmatterEndIndex, 0, 'kgVideoSequenceSources:', ...sourceLines)
    return nextLines
  }
  let insertIndex = sourceKeyIndex + 1
  while (insertIndex < frontmatterEndIndex) {
    const line = nextLines[insertIndex] || ''
    if (line.trim() && !/^\s/.test(line)) break
    insertIndex += 1
  }
  nextLines.splice(insertIndex, 0, ...sourceLines)
  return nextLines
}

const readCodeSectionRange = (lines: readonly string[], sectionLabel: string): { endIndex: number; startIndex: number } | null => {
  const sectionPattern = new RegExp(`^\\s*section\\s+${sectionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
  const startIndex = lines.findIndex(line => sectionPattern.test(line))
  if (startIndex < 0) return null
  let endIndex = startIndex + 1
  while (endIndex < lines.length && !/^\s*section\s+/i.test(lines[endIndex] || '')) endIndex += 1
  return { endIndex, startIndex }
}

const mediaLane = (kind: MediaDragPayload['kind']): 'Audio' | 'Image' | 'Video' => {
  if (kind === 'audio') return 'Audio'
  if (kind === 'image') return 'Image'
  return 'Video'
}

const buildTaskLine = (args: {
  durationMinutes: number
  media: MediaDragPayload
  sourceId: string
  startMinutes: number
}): string => {
  const lane = mediaLane(args.media.kind)
  const labelSuffix = lane === 'Video' ? '' : ` ${lane.toLowerCase()}`
  const stableId = lane === 'Video' ? args.sourceId : `${args.sourceId}_${lane.toLowerCase()}`
  const label = `${sanitizeMermaidLabel(args.media.label, lane)}${labelSuffix}`
  return `  ${label} : ${stableId}, ${normalizeSourceRangeToken(args.durationMinutes)}, ${normalizeClockToken(args.startMinutes)}, ${normalizeDurationToken(args.durationMinutes)}`
}

const appendTaskToCode = (args: {
  code: string
  durationMinutes: number
  media: MediaDragPayload
  sourceId: string
  startMinutes: number
}): { code: string; lineIndex: number; line: string } | null => {
  const lines = String(args.code || '').split('\n')
  if (!lines.some(line => /^\s*gantt\s*$/i.test(line))) return null
  const lane = mediaLane(args.media.kind)
  const taskLine = buildTaskLine(args)
  const existingSection = readCodeSectionRange(lines, lane)
  if (existingSection) {
    lines.splice(existingSection.endIndex, 0, taskLine)
    return { code: lines.join('\n'), line: taskLine, lineIndex: existingSection.endIndex }
  }
  const audioSection = readCodeSectionRange(lines, 'Audio')
  const videoSection = readCodeSectionRange(lines, 'Video')
  const sectionLine = `  section ${lane}`
  const insertIndex = lane === 'Audio'
    ? lines.length
    : audioSection?.startIndex ?? videoSection?.endIndex ?? lines.length
  lines.splice(insertIndex, 0, sectionLine, taskLine)
  return { code: lines.join('\n'), line: taskLine, lineIndex: insertIndex + 1 }
}

export function appendMermaidGanttVideoSequenceMediaDrop(args: {
  code: string
  markdownText: string
  media: MediaDragPayload
  startMinutes: number
  durationMinutes?: number
}): MermaidGanttVideoSequenceMediaDropResult | null {
  const sourceId = buildMediaSourceId(args.media, String(args.markdownText || '').split('\n'))
  const durationMinutes = Math.max(0.001, args.durationMinutes || DEFAULT_DROP_DURATION_MINUTES)
  const nextCode = appendTaskToCode({
    code: args.code,
    durationMinutes,
    media: args.media,
    sourceId,
    startMinutes: args.startMinutes,
  })
  if (!nextCode) return null
  const linesWithSource = appendSourceToFrontmatter({
    lines: String(args.markdownText || '').split('\n'),
    media: args.media,
    sourceId,
  })
  if (!linesWithSource) return null
  const markdownText = replaceFirstMermaidGanttFrontmatterCode(linesWithSource.join('\n'), nextCode.code)
  if (!markdownText || markdownText === args.markdownText) return null
  return {
    markdownText,
    rowKey: `${nextCode.lineIndex}:task:${nextCode.line.trim()}`,
  }
}
