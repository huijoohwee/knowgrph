import { normalizeMarkdownGeoSourceDocumentPath } from './markdownGeoDocumentPath'

export type MarkdownGeoLineRange = {
  startLine: number
  endLine: number
}

export function normalizeMarkdownGeoLineRange(args: {
  startLine: unknown
  endLine?: unknown
}): MarkdownGeoLineRange {
  const startLine = Number.isFinite(args.startLine) ? Math.max(1, Math.floor(args.startLine as number)) : 1
  const endLine = Number.isFinite(args.endLine) ? Math.max(startLine, Math.floor(args.endLine as number)) : startLine
  return { startLine, endLine }
}

export function buildMarkdownGeoDocumentLineRangePath(args: {
  sourceDocumentPath: unknown
  startLine: unknown
  endLine?: unknown
}): string {
  const sourceDocumentPath = normalizeMarkdownGeoSourceDocumentPath(args.sourceDocumentPath) || 'document'
  const range = normalizeMarkdownGeoLineRange({
    startLine: args.startLine,
    endLine: args.endLine,
  })
  return `${sourceDocumentPath}#L${range.startLine}-L${range.endLine}`
}
