import type { ParserSpec } from '@/features/parsers/types'
import { toParserId } from '@/features/parsers/types'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import type { GraphData, JSONValue } from '@/lib/graph/types'
import {
  buildStrybldrGraphData,
  isStrybldrStoryboardMarkdown,
  parseStrybldrStoryboardMarkdown,
} from './strybldrStoryboard'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function countIndent(value: string): number {
  const match = String(value || '').match(/^\s*/)
  return match ? match[0].length : 0
}

function findLeadingUnfencedYamlMetadataEnd(lines: readonly string[]): number {
  let sawTopLevelKey = false
  for (let i = 0; i < lines.length; i += 1) {
    const raw = String(lines[i] || '')
    const trimmed = raw.trim()
    if (!trimmed) continue
    const indent = countIndent(raw)
    if (indent === 0 && /^#{1,6}\s+/.test(trimmed)) return sawTopLevelKey ? i : -1
    if (indent === 0 && /^(```|~~~)/.test(trimmed)) return sawTopLevelKey ? i : -1
    if (indent === 0 && /^<[A-Za-z!/]/.test(trimmed)) return sawTopLevelKey ? i : -1
    if (indent === 0 && /^[A-Za-z0-9_.-]+\s*:/.test(trimmed)) sawTopLevelKey = true
  }
  return sawTopLevelKey ? lines.length : -1
}

function parseStrybldrMarkdownFrontmatter(text: string): ReturnType<typeof parseMarkdownFrontmatter> {
  const lines = splitMarkdownLines(text)
  const fenced = parseMarkdownFrontmatter(lines)
  if (Object.keys(fenced.meta || {}).length > 0 || fenced.warnings.length > 0 || fenced.startIndex > 0) return fenced
  const end = findLeadingUnfencedYamlMetadataEnd(lines)
  if (end <= 0) return fenced
  return parseMarkdownFrontmatter(['---', ...lines.slice(0, end), '---'])
}

function withStrybldrMarkdownFrontmatterMetadata(args: {
  graphData: GraphData
  text: string
}): { graphData: GraphData; warnings: string[] } {
  const parsed = parseStrybldrMarkdownFrontmatter(args.text)
  const meta = isRecord(parsed.meta) ? parsed.meta : null
  if (!meta) {
    return {
      graphData: args.graphData,
      warnings: parsed.warnings || [],
    }
  }
  const graphMetadata = isRecord(args.graphData.metadata)
    ? (args.graphData.metadata as Record<string, JSONValue>)
    : {}
  return {
    graphData: {
      ...args.graphData,
      metadata: {
        ...graphMetadata,
        frontmatterMeta: meta as Record<string, JSONValue>,
      } as GraphData['metadata'],
    },
    warnings: parsed.warnings || [],
  }
}

export const strybldrStoryboardSpec: ParserSpec = {
  id: toParserId('strybldr-storyboard'),
  name: 'Strybldr Storyboard',
  match: (_name, text) => isStrybldrStoryboardMarkdown(text),
  parse: (_name, text) => {
    const doc = parseStrybldrStoryboardMarkdown(text)
    if (!doc) {
      return {
        graphData: { context: 'strybldr-storyboard', type: 'Graph', nodes: [], edges: [] },
        warnings: ['Strybldr storyboard payload was not parseable'],
      }
    }
    const enriched = withStrybldrMarkdownFrontmatterMetadata({
      graphData: buildStrybldrGraphData(doc),
      text,
    })
    return {
      graphData: enriched.graphData,
      warnings: enriched.warnings,
    }
  },
}

export const strybldrParsers: ParserSpec[] = [strybldrStoryboardSpec]
