import type { HighlightedLineRange } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceTypes'

type ResolvedLineRange = {
  start: number
  end: number
}

export type MarkdownWorkspaceLineOffsetCache = {
  text: string
  lineStarts: number[]
}

type MarkdownWorkspaceDocLocationHit = {
  kind: 'node' | 'edge'
  id: string
}

function resolveLineRange(line: number, endLine?: number): ResolvedLineRange | null {
  if (!Number.isFinite(line) || line <= 0) return null
  const start = Math.floor(line)
  const end = Number.isFinite(endLine) && (endLine as number) > 0 ? Math.max(start, Math.floor(endLine as number)) : start
  return { start, end }
}

function buildLineStarts(text: string): number[] {
  const lineStarts = [0]
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) lineStarts.push(i + 1)
  }
  return lineStarts
}

export function resolveMarkdownWorkspaceLineOffset(args: {
  text: string
  line: number
  cache: MarkdownWorkspaceLineOffsetCache | null
}): { offset: number; cache: MarkdownWorkspaceLineOffsetCache } {
  const text = String(args.text || '')
  const line = Number.isFinite(args.line) && args.line > 0 ? Math.floor(args.line) : 1
  const cache = args.cache && args.cache.text === text ? args.cache : { text, lineStarts: buildLineStarts(text) }
  const lineIndex = Math.max(0, Math.min(line - 1, cache.lineStarts.length - 1))
  return {
    offset: cache.lineStarts[lineIndex] ?? text.length,
    cache,
  }
}

export function syncMarkdownWorkspaceSelectionFromEditorCaret(args: {
  line: number
  currentLayoutMode: string
  lastCaretLine: number | null
  setHighlightedLineRange: (value: HighlightedLineRange) => void
  findDocLocation: (line: number) => MarkdownWorkspaceDocLocationHit | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  setSelectionSource: (source: string) => void
  selectNode: (id: string) => void
  selectEdge: (id: string) => void
}): number | null {
  if (args.currentLayoutMode !== 'editor' && args.currentLayoutMode !== 'split') return args.lastCaretLine
  if (!Number.isFinite(args.line) || args.line <= 0) return args.lastCaretLine
  const value = Math.floor(args.line)
  if (args.lastCaretLine === value) return args.lastCaretLine
  args.setHighlightedLineRange({ start: value, end: value })

  const hit = args.findDocLocation(value)
  if (!hit) return value
  if (hit.kind === 'node') {
    if (args.selectedNodeId !== hit.id) {
      args.setSelectionSource('editor')
      args.selectNode(hit.id)
    }
    return value
  }
  if (args.selectedEdgeId !== hit.id) {
    args.setSelectionSource('editor')
    args.selectEdge(hit.id)
  }
  return value
}

export function revealMarkdownWorkspaceLineInEditor(args: {
  line: number
  endLine?: number
  currentLayoutMode: string
  setLayoutMode: (mode: 'split') => void
  requestRevealLine: (line: number) => void
  setHighlightedLineRange: (value: HighlightedLineRange) => void
}): void {
  const range = resolveLineRange(args.line, args.endLine)
  if (!range) return
  args.setHighlightedLineRange(range)
  if (args.currentLayoutMode !== 'split' && args.currentLayoutMode !== 'editor') args.setLayoutMode('split')
  args.requestRevealLine(range.start)
}

export function revealMarkdownWorkspaceLineFromCanvas(args: {
  line: number
  endLine?: number
  currentLayoutMode: string
  setHighlightedLineRange: (value: HighlightedLineRange) => void
  revealLineInEditor: (line: number, endLine?: number) => void
}): void {
  const range = resolveLineRange(args.line, args.endLine)
  if (!range) return
  if (args.currentLayoutMode === 'editor' || args.currentLayoutMode === 'viewer') {
    args.setHighlightedLineRange(range)
    return
  }
  args.revealLineInEditor(range.start, range.end)
}

export function showMarkdownWorkspaceLineInMode(args: {
  mode: 'viewer' | 'presentation' | 'slides-gallery'
  line: number
  setLayoutMode: (mode: 'viewer' | 'presentation' | 'slides-gallery') => void
  setHighlightedLineRange: (value: HighlightedLineRange) => void
}): void {
  args.setLayoutMode(args.mode)
  const range = resolveLineRange(args.line)
  if (!range) {
    args.setHighlightedLineRange(null)
    return
  }
  args.setHighlightedLineRange(range)
}
