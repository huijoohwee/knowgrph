import { hashText } from '@/features/parsers/hash'
import type { MarkdownGeoCodeBlockLanguage } from './markdownGeoCodeBlockContract'
import type { MarkdownGeoDatasetRegistrationRequest } from './markdownGeoDatasetContract'
import {
  normalizeMarkdownGeoSourceDocumentPath,
  readMarkdownGeoSourceDocumentBasename,
} from './markdownGeoDocumentPath'
import {
  normalizeMarkdownGeoLineRange,
} from './markdownGeoLineRange'
import { buildMarkdownGeoCodeBlockContentHash } from './markdownGeoContentSignature'
import { buildMarkdownGeoCodeBlockGraphSourceDescriptor } from './markdownGeoSourcePath'

const sanitizeFileNameStem = (raw: string): string => {
  const text = String(raw || '').trim()
  if (!text) return ''
  const dot = text.lastIndexOf('.')
  const stem = dot > 0 ? text.slice(0, dot) : text
  return stem.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, '')
}

export function buildMarkdownGeoDatasetRegistrationRequest(args: {
  activeDocumentPath: string
  lang: MarkdownGeoCodeBlockLanguage
  text: string
  startLine: number
  endLine: number
}): MarkdownGeoDatasetRegistrationRequest {
  const lineRange = normalizeMarkdownGeoLineRange({
    startLine: args.startLine,
    endLine: args.endLine,
  })
  return {
    sourceDocumentPath: normalizeMarkdownGeoSourceDocumentPath(args.activeDocumentPath),
    codeBlock: {
      lang: args.lang,
      text: String(args.text || ''),
      startLine: lineRange.startLine,
      endLine: lineRange.endLine,
    },
  }
}

export function buildMarkdownGeoDatasetSourceLineRangePath(req: MarkdownGeoDatasetRegistrationRequest): string {
  return buildMarkdownGeoCodeBlockGraphSourceDescriptor(req).sourcePath
}

export function buildMarkdownGeoDatasetRequestFingerprint(req: MarkdownGeoDatasetRegistrationRequest): string {
  const key = [
    buildMarkdownGeoDatasetSourceLineRangePath(req),
    req.codeBlock.lang,
    buildMarkdownGeoCodeBlockContentHash(req.codeBlock.text),
  ].join('|')
  return `kg:md:geo:req:${hashText(key)}`
}

export function buildMarkdownGeoDatasetUploadStem(req: MarkdownGeoDatasetRegistrationRequest): string {
  const base = readMarkdownGeoSourceDocumentBasename(req.sourceDocumentPath)
  const stem = sanitizeFileNameStem(base) || 'document'
  const lineRange = normalizeMarkdownGeoLineRange(req.codeBlock)
  return `${stem}-L${lineRange.startLine}-L${lineRange.endLine}`
}

export function buildMarkdownGeoDatasetId(req: MarkdownGeoDatasetRegistrationRequest): string {
  return buildMarkdownGeoDatasetRequestFingerprint(req).replace('kg:md:geo:req:', 'kg:md:geo:')
}

export function buildMarkdownGeoDatasetUploadName(req: MarkdownGeoDatasetRegistrationRequest): string {
  return `${buildMarkdownGeoDatasetUploadStem(req)}.geojson`
}

export function buildMarkdownGeoDatasetGraphSourcePath(req: MarkdownGeoDatasetRegistrationRequest): string {
  return buildMarkdownGeoDatasetSourceLineRangePath(req)
}
