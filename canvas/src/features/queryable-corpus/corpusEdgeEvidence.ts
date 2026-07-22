import { hashText } from '@/features/parsers/hash'
import type { JSONValue } from '@/lib/graph/types'

export type CorpusEdgeEvidenceArgs = {
  sourcePath: string
  sourceText: string
  lineStart: number
  lineEnd?: number
  parserId: string
  parserVersion?: string
  ruleId: string
  explanation: string
  excerpt?: string
  kind?: 'extracted' | 'inferred' | 'ambiguous'
  confidence?: 'low' | 'medium' | 'high'
  premiseEdgeIds?: string[]
  candidateCount?: number
}

export const CORPUS_EDGE_EVIDENCE_FIELDS = Object.freeze([
  'evidence:kind',
  'evidence:confidence',
  'evidence:sourcePath',
  'evidence:lineStart',
  'evidence:lineEnd',
  'evidence:ruleId',
  'evidence:explanation',
  'evidence:parserId',
  'evidence:parserVersion',
  'evidence:excerpt',
  'evidence:excerptHash',
] as const)

const asJson = (value: unknown): JSONValue => value as JSONValue

function sourceExcerpt(text: string, lineStart: number, lineEnd: number): string {
  const lines = String(text || '').split(/\r?\n/)
  const start = Math.max(0, lineStart - 1)
  const end = Math.max(start + 1, Math.min(lines.length, lineEnd))
  const selected = lines.slice(start, end).join('\n').trim()
  return (selected || String(text || '').trim()).slice(0, 480)
}

export function buildCorpusEdgeEvidence(args: CorpusEdgeEvidenceArgs): Record<string, JSONValue> {
  const lineStart = Math.max(1, Math.floor(Number(args.lineStart) || 1))
  const lineEnd = Math.max(lineStart, Math.floor(Number(args.lineEnd) || lineStart))
  const excerpt = String(args.excerpt ?? sourceExcerpt(args.sourceText, lineStart, lineEnd)).trim().slice(0, 480)
  const premiseEdgeIds = Array.from(new Set((args.premiseEdgeIds || []).map(String).map(value => value.trim()).filter(Boolean))).sort()
  return {
    'evidence:kind': asJson(args.kind || 'extracted'),
    'evidence:confidence': asJson(args.confidence || 'high'),
    'evidence:sourcePath': asJson(String(args.sourcePath || '').trim()),
    'evidence:lineStart': asJson(lineStart),
    'evidence:lineEnd': asJson(lineEnd),
    'evidence:ruleId': asJson(String(args.ruleId || '').trim()),
    'evidence:explanation': asJson(String(args.explanation || '').trim()),
    'evidence:parserId': asJson(String(args.parserId || '').trim()),
    'evidence:parserVersion': asJson(String(args.parserVersion || '1').trim()),
    'evidence:excerpt': asJson(excerpt),
    'evidence:excerptHash': asJson(hashText(excerpt)),
    ...(premiseEdgeIds.length ? { 'evidence:premiseEdgeIds': asJson(premiseEdgeIds) } : {}),
    ...(Number.isInteger(args.candidateCount) && Number(args.candidateCount) > 0
      ? { 'evidence:candidateCount': asJson(Number(args.candidateCount)) }
      : {}),
    'corpus:parserId': asJson(String(args.parserId || '').trim()),
  }
}

export function corpusEdgeHasExplanation(properties: Record<string, unknown>): boolean {
  if (!CORPUS_EDGE_EVIDENCE_FIELDS.every(field => String(properties[field] ?? '').trim())) return false
  const excerpt = String(properties['evidence:excerpt'] || '')
  return String(properties['evidence:excerptHash'] || '') === hashText(excerpt)
}
