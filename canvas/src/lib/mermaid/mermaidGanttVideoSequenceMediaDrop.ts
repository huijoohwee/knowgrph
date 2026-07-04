import { hashText } from '@/features/parsers/hash'
import { yamlQuote } from '@/features/markdown-workspace/workspaceImport/yaml'
import { resolveVideoSequenceTimelineFrameRate } from '@/components/timeline/videoSequenceTimelineZoom'
import { replaceFirstMermaidGanttFrontmatterCode } from './mermaidGanttBarInteraction'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'

export type MermaidGanttVideoSequenceMediaDropResult = {
  markdownText: string
  rowKey: string
}

const DEFAULT_DROP_DURATION_MINUTES = 1
const MIN_DROP_DURATION_MINUTES = 0.000001
const DEFAULT_VIDEO_SEQUENCE_CODE = [
  'gantt',
  '  title Video Sequence',
  '  dateFormat HH:mm',
  '  axisFormat %H:%M',
].join('\n')

const cleanInline = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim()

const readPositiveNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const sanitizeMermaidLabel = (value: unknown, fallback: string): string => {
  const label = cleanInline(value).replace(/[:|#]+/g, ' ').replace(/\s+/g, ' ').trim()
  return label || fallback
}

const formatFractionalMinuteToken = (minutes: number): string => {
  const safe = Math.max(MIN_DROP_DURATION_MINUTES, Number.isFinite(minutes) ? minutes : DEFAULT_DROP_DURATION_MINUTES)
  const precision = safe < 0.01 ? 6 : 3
  return String(Number(safe.toFixed(precision)))
}

const normalizeClockToken = (minutes: number): string => {
  const safe = Math.max(0, Number.isFinite(minutes) ? minutes : 0)
  return `kgpos_${String(Number(safe.toFixed(3))).replace(/\./g, '_')}`
}

const normalizeSourceRangeToken = (durationMinutes: number): string => {
  return `kgsrc_0_${formatFractionalMinuteToken(durationMinutes).replace(/\./g, '_')}`
}

const normalizeDurationToken = (durationMinutes: number): string => {
  return `${formatFractionalMinuteToken(durationMinutes)}m`
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

const readSourceEntryId = (line: string): string => {
  const match = /^\s*-\s+id\s*:\s*["']?([^"'\s]+)["']?\s*$/.exec(line)
  return cleanInline(match?.[1])
}

const unquoteYamlScalar = (value: string): string => {
  const trimmed = cleanInline(value)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const readSourceEntryScalar = (lines: readonly string[], key: string): string => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^\\s*${escapedKey}\\s*:\\s*(.*)\\s*$`)
  for (const line of lines) {
    const match = pattern.exec(line)
    if (match) return unquoteYamlScalar(match[1] || '')
  }
  return ''
}

const readVideoSequenceSourceEntries = (
  lines: readonly string[],
  frontmatterEndIndex: number,
): readonly { endIndex: number; id: string; lines: readonly string[]; startIndex: number }[] => {
  const sourceKeyIndex = lines.findIndex((line, index) => (
    index > 0 && index < frontmatterEndIndex && /^\s*kgVideoSequenceSources\s*:\s*$/.test(line)
  ))
  if (sourceKeyIndex < 0) return []
  const entries: { endIndex: number; id: string; lines: readonly string[]; startIndex: number }[] = []
  let index = sourceKeyIndex + 1
  while (index < frontmatterEndIndex) {
    const line = lines[index] || ''
    if (line.trim() && !/^\s/.test(line)) break
    const id = readSourceEntryId(line)
    if (!id) {
      index += 1
      continue
    }
    let endIndex = index + 1
    while (endIndex < frontmatterEndIndex && !readSourceEntryId(lines[endIndex] || '')) {
      const entryLine = lines[endIndex] || ''
      if (entryLine.trim() && !/^\s/.test(entryLine)) break
      endIndex += 1
    }
    entries.push({ endIndex, id, lines: lines.slice(index, endIndex), startIndex: index })
    index = endIndex
  }
  return entries
}

const readReusableBlankVideoSourceId = (lines: readonly string[]): string => {
  const frontmatterEndIndex = findFrontmatterEndIndex(lines)
  if (frontmatterEndIndex <= 0) return ''
  const blankVideoSource = readVideoSequenceSourceEntries(lines, frontmatterEndIndex).find(entry => {
    const sourceText = entry.lines.join('\n')
    return /^\s*sourceUrl\s*:\s*(?:""|''|)\s*$/m.test(sourceText)
      && /^\s*mimeHint\s*:\s*["']?video\//m.test(sourceText)
  })
  return blankVideoSource?.id || ''
}

const isSourceUrlMatch = (left: unknown, right: unknown): boolean => {
  const normalize = (value: unknown) => cleanInline(value).replace(/^file:\/\//i, '').replace(/\/+$/g, '')
  const normalizedLeft = normalize(left)
  const normalizedRight = normalize(right)
  return !!normalizedLeft && normalizedLeft === normalizedRight
}

const removeSourceEntryFromFrontmatter = (
  lines: readonly string[],
  sourceId: string,
): string[] => {
  const cleanSourceId = cleanInline(sourceId)
  if (!cleanSourceId) return lines.slice()
  const frontmatterEndIndex = findFrontmatterEndIndex(lines)
  if (frontmatterEndIndex <= 0) return lines.slice()
  const removeEntry = readVideoSequenceSourceEntries(lines, frontmatterEndIndex)
    .find(entry => entry.id === cleanSourceId)
  if (!removeEntry) return lines.slice()
  const nextLines = lines.slice()
  nextLines.splice(removeEntry.startIndex, removeEntry.endIndex - removeEntry.startIndex)
  return nextLines
}

const inferMimeHint = (media: MediaDragPayload): string => {
  const explicit = cleanInline(media.mimeHint)
  if (explicit) return explicit
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
}): string[] => {
  const lines = [
    `  - id: ${yamlQuote(args.id)}`,
    `    originalName: ${yamlQuote(cleanInline(args.media.label) || args.media.kind)}`,
    `    relativePath: ${yamlQuote(cleanInline(args.media.label || args.media.url) || args.id)}`,
    '    importMode: "url"',
    `    sourceUrl: ${yamlQuote(args.media.url)}`,
    `    mimeHint: ${yamlQuote(inferMimeHint(args.media))}`,
  ]
  const byteSize = Math.floor(Number(args.media.byteSize))
  if (Number.isFinite(byteSize) && byteSize >= 0) lines.push(`    byteSize: ${byteSize}`)
  const durationSeconds = readPositiveNumber(args.media.durationSeconds)
  if (durationSeconds > 0) lines.push(`    durationSeconds: ${durationSeconds}`)
  const frameRate = readPositiveNumber(args.media.frameRate)
  if (frameRate > 0) lines.push(`    frameRate: ${frameRate}`)
  const displayWidth = readPositiveNumber(args.media.displayWidth)
  const displayHeight = readPositiveNumber(args.media.displayHeight)
  if (displayWidth > 0 && displayHeight > 0) {
    lines.push(`    displayWidth: ${Math.round(displayWidth)}`)
    lines.push(`    displayHeight: ${Math.round(displayHeight)}`)
  }
  return lines
}

const findFrontmatterEndIndex = (lines: readonly string[]): number => {
  if (lines[0]?.trim() !== '---') return -1
  return lines.findIndex((line, index) => index > 0 && line.trim() === '---')
}

const readIndent = (line: string): number => (line.match(/^(\s*)/)?.[1] || '').length

const hasRootKey = (lines: readonly string[], frontmatterEndIndex: number, key: string): boolean => {
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`)
  return lines.some((line, index) => index > 0 && index < frontmatterEndIndex && pattern.test(line))
}

const findFlowDiagramsValueIndex = (lines: readonly string[], frontmatterEndIndex: number, flowIndex: number): number => {
  const flowIndent = readIndent(lines[flowIndex] || '')
  for (let index = flowIndex + 1; index < frontmatterEndIndex; index += 1) {
    const line = lines[index] || ''
    if (line.trim() && readIndent(line) <= flowIndent) break
    if (/^\s*value\s*:\s*$/.test(line)) return index
  }
  return -1
}

const buildVideoSequenceDiagramLines = (code: string, indent = '  '): string[] => [
  `${indent}video_sequence:`,
  `${indent}  key: video_sequence`,
  `${indent}  type: mermaid_gantt`,
  `${indent}  value: |-`,
  ...String(code || DEFAULT_VIDEO_SEQUENCE_CODE).split('\n').map(line => `${indent}    ${line}`),
]

const insertVideoSequenceDiagramIntoFrontmatter = (args: {
  lines: string[]
  code: string
}): string[] | null => {
  const frontmatterEndIndex = findFrontmatterEndIndex(args.lines)
  if (frontmatterEndIndex <= 0) return null
  const nextLines = args.lines.slice()
  let endIndex = frontmatterEndIndex
  if (!hasRootKey(nextLines, endIndex, 'kgVideoSequenceTimeline')) {
    const flowIndexForFlag = nextLines.findIndex((line, index) => index > 0 && index < endIndex && /^\s*flow_diagrams\s*:\s*$/.test(line))
    nextLines.splice(flowIndexForFlag > 0 ? flowIndexForFlag : endIndex, 0, 'kgVideoSequenceTimeline: true')
    endIndex += 1
  }
  const existingVideoSequenceIndex = nextLines.findIndex((line, index) => (
    index > 0 && index < endIndex && /^\s*video_sequence\s*:\s*$/.test(line)
  ))
  if (existingVideoSequenceIndex > 0) return nextLines
  const flowIndex = nextLines.findIndex((line, index) => index > 0 && index < endIndex && /^\s*flow_diagrams\s*:\s*$/.test(line))
  if (flowIndex < 0) {
    nextLines.splice(endIndex, 0, 'flow_diagrams:', ...buildVideoSequenceDiagramLines(args.code))
    return nextLines
  }
  const valueIndex = findFlowDiagramsValueIndex(nextLines, endIndex, flowIndex)
  if (valueIndex > 0) {
    nextLines.splice(valueIndex + 1, 0, ...buildVideoSequenceDiagramLines(args.code, '    '))
    return nextLines
  }
  nextLines.splice(flowIndex + 1, 0, ...buildVideoSequenceDiagramLines(args.code))
  return nextLines
}

const appendSourceToFrontmatter = (args: {
  lines: string[]
  removeSourceId?: string
  sourceId: string
  media: MediaDragPayload
  replaceSourceId?: string
}): string[] | null => {
  const sourceBaseLines = args.removeSourceId
    ? removeSourceEntryFromFrontmatter(args.lines, args.removeSourceId)
    : args.lines
  const frontmatterEndIndex = findFrontmatterEndIndex(sourceBaseLines)
  if (frontmatterEndIndex <= 0) return null
  const sourceLines = buildSourceLines({ id: args.sourceId, media: args.media })
  if (args.replaceSourceId) {
    const replaceEntry = readVideoSequenceSourceEntries(sourceBaseLines, frontmatterEndIndex)
      .find(entry => entry.id === args.replaceSourceId)
    if (replaceEntry) {
      const nextLines = sourceBaseLines.slice()
      nextLines.splice(replaceEntry.startIndex, replaceEntry.endIndex - replaceEntry.startIndex, ...sourceLines)
      return nextLines
    }
  }
  const sourceKeyIndex = sourceBaseLines.findIndex((line, index) => (
    index > 0 && index < frontmatterEndIndex && /^\s*kgVideoSequenceSources\s*:\s*$/.test(line)
  ))
  const nextLines = sourceBaseLines.slice()
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

const readCodeSectionRangeAny = (lines: readonly string[], sectionLabels: readonly string[]): { endIndex: number; startIndex: number } | null => {
  for (const sectionLabel of sectionLabels) {
    const range = readCodeSectionRange(lines, sectionLabel)
    if (range) return range
  }
  return null
}

const mediaLane = (kind: MediaDragPayload['kind']): 'Audio' | 'Image' | 'Video' => {
  if (kind === 'audio') return 'Audio'
  if (kind === 'image') return 'Image'
  return 'Video'
}

const mediaSectionLabels = (lane: 'Audio' | 'Image' | 'Video'): readonly string[] => {
  if (lane === 'Video') return ['Source video', 'Video']
  if (lane === 'Audio') return ['Source audio', 'Audio']
  return ['Image']
}

const hasMermaidGanttTaskLine = (code: string): boolean =>
  String(code || '').split('\n').some(line => /^\s*[^:\n]+:\s*[^,\n]+,\s*.+/.test(line))

const isSourceVideoScaffoldTaskLine = (line: string, sourceId: string): boolean => {
  const cleanSourceId = cleanInline(sourceId)
  if (!cleanSourceId) return false
  const escapedSourceId = cleanSourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\s*Source video\\s*:\\s*${escapedSourceId}(?:\\s*,|\\s*$)`, 'i').test(line)
}

const isBlankSourcePlaceholderTaskLine = (line: string, sourceId: string): boolean => (
  isSourceVideoScaffoldTaskLine(line, sourceId)
    && !/(?:^|,\s*)kgsrc_\d+(?:_\d+)?_\d+(?:_\d+)?(?:\s*,|$)/i.test(line)
)

const readReusableScaffoldVideoSourceId = (args: {
  code: string
  lines: readonly string[]
  media: MediaDragPayload
}): string => {
  if (args.media.kind !== 'video') return ''
  const frontmatterEndIndex = findFrontmatterEndIndex(args.lines)
  if (frontmatterEndIndex <= 0) return ''
  const codeLines = String(args.code || '').split('\n')
  for (const entry of readVideoSequenceSourceEntries(args.lines, frontmatterEndIndex)) {
    const sourceUrl = readSourceEntryScalar(entry.lines, 'sourceUrl')
    const relativePath = readSourceEntryScalar(entry.lines, 'relativePath')
    if (!isSourceUrlMatch(sourceUrl, args.media.url) && !isSourceUrlMatch(relativePath, args.media.url)) continue
    if (codeLines.some(line => isSourceVideoScaffoldTaskLine(line, entry.id))) return entry.id
  }
  return ''
}

const resolveDropDurationMinutes = (media: MediaDragPayload, overrideDurationMinutes?: number): number => {
  const override = readPositiveNumber(overrideDurationMinutes)
  if (override > 0) return Math.max(MIN_DROP_DURATION_MINUTES, override)
  if (media.kind === 'image') return 1 / (resolveVideoSequenceTimelineFrameRate(readPositiveNumber(media.frameRate)) * 60)
  const durationSeconds = readPositiveNumber(media.durationSeconds)
  if (durationSeconds > 0) return Math.max(MIN_DROP_DURATION_MINUTES, durationSeconds / 60)
  return DEFAULT_DROP_DURATION_MINUTES
}

const buildTaskLine = (args: {
  importChrome: boolean
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
  importChrome: boolean
  media: MediaDragPayload
  removeSourceId?: string
  replaceSourceId?: string
  sourceId: string
  startMinutes: number
}): { code: string; lineIndex: number; line: string } | null => {
  const lines = String(args.code || '').split('\n')
  if (!lines.some(line => /^\s*gantt\s*$/i.test(line))) return null
  const lane = mediaLane(args.media.kind)
  const taskLine = buildTaskLine(args)
  if (args.removeSourceId) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (isBlankSourcePlaceholderTaskLine(lines[index] || '', args.removeSourceId)) lines.splice(index, 1)
    }
  }
  const existingSection = readCodeSectionRangeAny(lines, mediaSectionLabels(lane))
  if (existingSection) {
    if (lane === 'Video' && args.replaceSourceId) {
      const replaceIndex = lines.findIndex((line, index) => (
        index > existingSection.startIndex &&
        index < existingSection.endIndex &&
        isSourceVideoScaffoldTaskLine(line, args.replaceSourceId || '')
      ))
      if (replaceIndex > existingSection.startIndex) {
        lines.splice(replaceIndex, 1, taskLine)
        return { code: lines.join('\n'), line: taskLine, lineIndex: replaceIndex }
      }
    }
    lines.splice(existingSection.endIndex, 0, taskLine)
    return { code: lines.join('\n'), line: taskLine, lineIndex: existingSection.endIndex }
  }
  const audioSection = readCodeSectionRangeAny(lines, mediaSectionLabels('Audio'))
  const videoSection = readCodeSectionRangeAny(lines, mediaSectionLabels('Video'))
  const sectionLine = args.importChrome && lane === 'Video' ? '  section Source video' : `  section ${lane}`
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
  const markdownLines = String(args.markdownText || '').split('\n')
  const reusableBlankVideoSourceId = args.media.kind === 'video'
    ? readReusableBlankVideoSourceId(markdownLines)
    : ''
  const reusableScaffoldVideoSourceId = reusableBlankVideoSourceId || readReusableScaffoldVideoSourceId({
    code: String(args.code || '').trim() || DEFAULT_VIDEO_SEQUENCE_CODE,
    lines: markdownLines,
    media: args.media,
  })
  const removableBlankVideoSourceId = reusableBlankVideoSourceId || readReusableBlankVideoSourceId(markdownLines)
  const sourceId = reusableScaffoldVideoSourceId || buildMediaSourceId(args.media, markdownLines)
  const durationMinutes = resolveDropDurationMinutes(args.media, args.durationMinutes)
  const baseCode = String(args.code || '').trim() || DEFAULT_VIDEO_SEQUENCE_CODE
  const importChrome = args.media.kind === 'video' && !hasMermaidGanttTaskLine(baseCode)
  const nextCode = appendTaskToCode({
    code: baseCode,
    durationMinutes,
    importChrome,
    media: args.media,
    removeSourceId: args.media.kind === 'video' ? '' : removableBlankVideoSourceId,
    replaceSourceId: reusableScaffoldVideoSourceId,
    sourceId,
    startMinutes: importChrome ? 0 : args.startMinutes,
  })
  if (!nextCode) return null
  const linesWithSource = appendSourceToFrontmatter({
    lines: markdownLines,
    media: args.media,
    removeSourceId: args.media.kind === 'video' ? '' : removableBlankVideoSourceId,
    replaceSourceId: reusableScaffoldVideoSourceId,
    sourceId,
  })
  if (!linesWithSource) return null
  const markdownWithVideoSequenceDiagram =
    replaceFirstMermaidGanttFrontmatterCode(linesWithSource.join('\n'), nextCode.code) ||
    insertVideoSequenceDiagramIntoFrontmatter({ lines: linesWithSource, code: nextCode.code })?.join('\n') ||
    null
  const markdownText = markdownWithVideoSequenceDiagram
  if (!markdownText || markdownText === args.markdownText) return null
  return {
    markdownText,
    rowKey: `${nextCode.lineIndex}:task:${nextCode.line.trim()}`,
  }
}
