import type { GraphData, GraphNode } from '@/lib/graph/types'
import { readNodeProperties } from '@/lib/graph/nodeProperties'
import { toMetadataRecord } from '@/lib/graph/documentMetadata'
import { isPlainObject } from '@/lib/graph/value'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { extractYamlFrontmatterHeaderBlock } from '@/lib/markdown/frontmatter'
import {
  readMermaidDiagramKind,
  splitMermaidDiagrams,
  type MermaidDiagramKind,
} from 'grph-shared/markdown/mermaidInput'

export type MermaidStructuredDiagramKind = Extract<MermaidDiagramKind, 'gitgraph' | 'gantt' | 'timeline'>

export type MermaidDiagramCommandRow = {
  key: string
  lineIndex: number
  lineNumber: number
  raw: string
  kind: string
  label: string
}

export type MermaidDiagramCodeModel = {
  kind: MermaidStructuredDiagramKind
  code: string
  lines: string[]
  declarationLineIndex: number
  rows: MermaidDiagramCommandRow[]
}

const MERMAID_TYPED_TYPE_BY_KIND: Record<MermaidStructuredDiagramKind, string> = {
  gitgraph: 'mermaid_gitgraph',
  gantt: 'mermaid_gantt',
  timeline: 'mermaid_timeline',
}

const MAX_TYPED_SCAN_DEPTH = 8
const MAX_TYPED_SCAN_NODES = 600

const readCode = (value: unknown): string => {
  return typeof value === 'string' ? String(value || '').trim() : ''
}

const normalizeTypedToken = (value: unknown): string => {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

const isMatchingTypedMermaidDiagram = (
  value: Record<string, unknown>,
  kind: MermaidStructuredDiagramKind,
): boolean => {
  return normalizeTypedToken(value.type) === MERMAID_TYPED_TYPE_BY_KIND[kind]
}

const pushUniqueCode = (out: string[], code: string): void => {
  const next = readCode(code)
  if (!next || out.includes(next)) return
  out.push(next)
}

const collectTypedMermaidDiagramCodes = (
  value: unknown,
  kind: MermaidStructuredDiagramKind,
  out: string[],
  state: { depth: number; visited: number },
): void => {
  if (state.depth > MAX_TYPED_SCAN_DEPTH || state.visited > MAX_TYPED_SCAN_NODES) return
  state.visited += 1

  if (Array.isArray(value)) {
    state.depth += 1
    for (const item of value) collectTypedMermaidDiagramCodes(item, kind, out, state)
    state.depth -= 1
    return
  }

  if (!isPlainObject(value)) return
  const record = value as Record<string, unknown>
  if (isMatchingTypedMermaidDiagram(record, kind)) {
    pushUniqueCode(out, readCode(record.value))
  }

  state.depth += 1
  for (const item of Object.values(record)) {
    collectTypedMermaidDiagramCodes(item, kind, out, state)
  }
  state.depth -= 1
}

export const readTypedMermaidDiagramCodes = (
  value: unknown,
  kind: MermaidStructuredDiagramKind,
): string[] => {
  const out: string[] = []
  collectTypedMermaidDiagramCodes(value, kind, out, { depth: 0, visited: 0 })
  return out
}

export const resolveMermaidDiagramCode = (
  candidates: ReadonlyArray<string | null | undefined>,
  kind: MermaidStructuredDiagramKind,
): string => {
  for (let i = 0; i < candidates.length; i += 1) {
    const raw = readCode(candidates[i])
    if (!raw) continue
    const diagrams = splitMermaidDiagrams(raw)
    const match = diagrams.find(diagram => diagram.kind === kind)
    const code = readCode(match?.code)
    if (code) return code
  }
  return ''
}

export const readYamlFrontmatterMermaidDiagramCodes = (
  rawText: string,
  kind: MermaidStructuredDiagramKind,
): string[] => {
  const block = extractYamlFrontmatterHeaderBlock(rawText)
  if (!block) return []
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(block.rawBlock))
  const meta = isPlainObject(parsed.meta) ? parsed.meta : null
  if (!meta) return []
  const out = readTypedMermaidDiagramCodes(meta, kind)
  pushUniqueCode(out, readCode(meta.mermaid))
  return out
}

const isFrontmatterMermaidDiagram = (node: GraphNode | null | undefined): boolean => {
  if (!node || String(node.type || '') !== 'MermaidDiagram') return false
  const props = readNodeProperties(node)
  return props.isMermaidFrontmatter === true || props.mermaidScope === 'frontmatter'
}

export const readFrontmatterMermaidDiagramCodes = (
  graphData: GraphData | null | undefined,
  kind: MermaidStructuredDiagramKind,
): string[] => {
  if (!graphData) return []
  const out: string[] = []
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  for (const node of nodes) {
    if (!isFrontmatterMermaidDiagram(node)) continue
    const props = readNodeProperties(node)
    const code = readCode(props.code)
    if (!code) continue
    const propKind = normalizeTypedToken(props.diagramKind)
    if (propKind === kind || readMermaidDiagramKind(code) === kind) pushUniqueCode(out, code)
  }
  const metadata = toMetadataRecord(graphData.metadata)
  const frontmatterMeta = isPlainObject(metadata.frontmatterMeta) ? metadata.frontmatterMeta : null
  if (frontmatterMeta) {
    for (const code of readTypedMermaidDiagramCodes(frontmatterMeta, kind)) pushUniqueCode(out, code)
    pushUniqueCode(out, readCode((frontmatterMeta as Record<string, unknown>).mermaid))
  }
  return out
}

const readGanttRowKind = (trimmed: string): string => {
  if (/^section\b/i.test(trimmed)) return 'section'
  if (/^title\b/i.test(trimmed)) return 'title'
  if (/^(?:dateFormat|axisFormat|tickInterval|weekday|excludes|includes|todayMarker)\b/i.test(trimmed)) return 'config'
  if (/:/.test(trimmed)) return 'task'
  return 'line'
}

const readGanttRowLabel = (trimmed: string, kind: string): string => {
  if (kind === 'section') return trimmed.replace(/^section\b/i, '').trim() || trimmed
  if (kind === 'title') return trimmed.replace(/^title\b/i, '').trim() || trimmed
  if (kind === 'task') return trimmed.split(':', 1)[0]?.trim() || trimmed
  return trimmed
}

const readTimelineRowKind = (trimmed: string): string => {
  if (/^section\b/i.test(trimmed)) return 'section'
  if (/^title\b/i.test(trimmed)) return 'title'
  if (/:/.test(trimmed)) return 'event'
  return 'line'
}

const readTimelineRowLabel = (trimmed: string, kind: string): string => {
  if (kind === 'section') return trimmed.replace(/^section\b/i, '').trim() || trimmed
  if (kind === 'title') return trimmed.replace(/^title\b/i, '').trim() || trimmed
  if (kind === 'event') return trimmed.split(':', 1)[0]?.trim() || trimmed
  return trimmed
}

const readDiagramRowKind = (kind: MermaidStructuredDiagramKind, trimmed: string): string => {
  if (kind === 'gantt') return readGanttRowKind(trimmed)
  if (kind === 'timeline') return readTimelineRowKind(trimmed)
  return trimmed.split(/\s+/, 1)[0] || 'line'
}

const readDiagramRowLabel = (kind: MermaidStructuredDiagramKind, trimmed: string, rowKind: string): string => {
  if (kind === 'gantt') return readGanttRowLabel(trimmed, rowKind)
  if (kind === 'timeline') return readTimelineRowLabel(trimmed, rowKind)
  return trimmed
}

export const parseMermaidDiagramCodeModel = (
  code: string,
  kind: MermaidStructuredDiagramKind,
): MermaidDiagramCodeModel => {
  const normalizedCode = String(code || '').replace(/\r/g, '')
  const lines = normalizedCode.split('\n')
  const declarationLineIndex = lines.findIndex(line => readMermaidDiagramKind(line) === kind)
  const rows: MermaidDiagramCommandRow[] = []
  if (declarationLineIndex >= 0) {
    for (let i = declarationLineIndex + 1; i < lines.length; i += 1) {
      const raw = String(lines[i] || '')
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('%%')) continue
      const rowKind = readDiagramRowKind(kind, trimmed)
      rows.push({
        key: `${i}:${rowKind}:${trimmed}`,
        lineIndex: i,
        lineNumber: i + 1,
        raw: trimmed,
        kind: rowKind,
        label: readDiagramRowLabel(kind, trimmed, rowKind),
      })
    }
  }
  return {
    kind,
    code: normalizedCode,
    lines,
    declarationLineIndex,
    rows,
  }
}
