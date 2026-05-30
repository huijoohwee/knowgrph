import { hashText } from '@/features/parsers/hash'
import type { CorpusMediaKind, CorpusSourceUnit } from '@/features/queryable-corpus/corpusGraph'
import { inferCorpusMediaKind } from '@/features/queryable-corpus/corpusGraph'

export type CorpusImportSkipped = {
  name: string
  reason: 'unsupported' | 'missing-name'
  mediaKind: CorpusSourceUnit['mediaKind']
}

export type CorpusImportFailed = {
  name: string
  error: string
  mediaKind: CorpusSourceUnit['mediaKind']
}

export type CorpusImportManifest = {
  version: 1
  sourceUnits: CorpusSourceUnit[]
  skipped: CorpusImportSkipped[]
  failed: CorpusImportFailed[]
  metrics: {
    total: number
    parsed: number
    cached: number
    pending: number
    unsupported: number
    error: number
    skipped: number
    failed: number
    cacheHits: number
  }
}

export type CorpusSourceUnitRecordInput = {
  path: string
  relativePath: string
  originalName: string
  text: string
  mimeHint?: string | null
  byteSize?: number | null
  mediaKind?: CorpusMediaKind | null
  status: CorpusSourceUnit['status']
}

const normalizePath = (raw: unknown): string => String(raw || '').replace(/\\/g, '/').replace(/^\/+/, '').trim()

const normalizeImportMode = (raw: unknown): CorpusSourceUnit['provenance']['importMode'] => {
  const mode = String(raw || '').trim()
  return mode === 'folder' || mode === 'url' || mode === 'workspace' ? mode : 'file'
}

const normalizeStatus = (raw: unknown): CorpusSourceUnit['status'] => {
  const status = String(raw || '').trim()
  if (status === 'cached' || status === 'pending' || status === 'unsupported' || status === 'error') return status
  return 'parsed'
}

const normalizeMediaKind = (raw: unknown): CorpusMediaKind | null => {
  const value = String(raw || '').trim()
  switch (value) {
    case 'code':
    case 'sql':
    case 'script':
    case 'doc':
    case 'paper':
    case 'image':
    case 'video':
    case 'data':
    case 'model':
    case 'unknown':
      return value
    default:
      return null
  }
}

export function buildCorpusSourceUnit(args: {
  workspacePath: string
  relativePath: string
  originalName: string
  text: string
  mimeHint?: string | null
  byteSize?: number | null
  mediaKind?: CorpusMediaKind | null
  status?: CorpusSourceUnit['status']
  importMode: CorpusSourceUnit['provenance']['importMode']
  importedAtMs?: number | null
  parentFolderId?: string | null
}): CorpusSourceUnit {
  const workspacePath = normalizePath(args.workspacePath)
  const relativePath = normalizePath(args.relativePath || args.originalName || workspacePath)
  const originalName = String(args.originalName || relativePath || workspacePath || 'source').trim()
  const text = String(args.text || '')
  const textHash = hashText(text)
  const importedAtMs = Number.isFinite(Number(args.importedAtMs)) ? Number(args.importedAtMs) : Date.now()
  const provenance: CorpusSourceUnit['provenance'] = {
    importMode: normalizeImportMode(args.importMode),
    importedAtMs,
  }
  const parentFolderId = String(args.parentFolderId || '').trim()
  if (parentFolderId) provenance.parentFolderId = parentFolderId
  return {
    id: `corpus-source-${hashText(`${workspacePath}:${relativePath}:${textHash}`)}`,
    workspacePath,
    relativePath,
    originalName,
    mediaKind: normalizeMediaKind(args.mediaKind) || inferCorpusMediaKind(originalName, args.mimeHint),
    mimeHint: String(args.mimeHint || '').trim() || null,
    byteSize: Number.isFinite(Number(args.byteSize)) ? Math.max(0, Number(args.byteSize)) : text.length,
    textHash,
    status: normalizeStatus(args.status),
    provenance,
  }
}

export function createCorpusSourceUnitRecorder(args: {
  sourceUnits: CorpusSourceUnit[]
  importMode: CorpusSourceUnit['provenance']['importMode']
  importedAtMs?: number | null
}): (input: CorpusSourceUnitRecordInput) => void {
  const importedAtMs = Number.isFinite(Number(args.importedAtMs)) ? Number(args.importedAtMs) : Date.now()
  return input => {
    args.sourceUnits.push(buildCorpusSourceUnit({
      workspacePath: input.path,
      relativePath: input.relativePath,
      originalName: input.originalName,
      text: input.text,
      mimeHint: input.mimeHint,
      byteSize: input.byteSize,
      mediaKind: input.mediaKind,
      status: input.status,
      importMode: args.importMode,
      importedAtMs,
    }))
  }
}

function statusCount(sourceUnits: CorpusSourceUnit[], status: CorpusSourceUnit['status']): number {
  return sourceUnits.filter(unit => unit.status === status).length
}

export function buildCorpusImportManifest(args: {
  sourceUnits: CorpusSourceUnit[]
  skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }>
  failed: Array<{ name: string; error: string }>
}): CorpusImportManifest {
  const sourceUnits = Array.isArray(args.sourceUnits) ? args.sourceUnits : []
  const skipped = (Array.isArray(args.skipped) ? args.skipped : []).map(item => ({
    name: String(item.name || '').trim(),
    reason: item.reason === 'missing-name' ? 'missing-name' as const : 'unsupported' as const,
    mediaKind: inferCorpusMediaKind(String(item.name || '')),
  }))
  const failed = (Array.isArray(args.failed) ? args.failed : []).map(item => ({
    name: String(item.name || '').trim(),
    error: String(item.error || '').trim(),
    mediaKind: inferCorpusMediaKind(String(item.name || '')),
  }))
  const cached = statusCount(sourceUnits, 'cached')
  return {
    version: 1,
    sourceUnits,
    skipped,
    failed,
    metrics: {
      total: sourceUnits.length + skipped.length + failed.length,
      parsed: statusCount(sourceUnits, 'parsed'),
      cached,
      pending: statusCount(sourceUnits, 'pending'),
      unsupported: statusCount(sourceUnits, 'unsupported'),
      error: statusCount(sourceUnits, 'error') + failed.length,
      skipped: skipped.length,
      failed: failed.length,
      cacheHits: cached,
    },
  }
}

export function buildCorpusWorkspaceImportResult<TPath extends string, TSource>(args: {
  createdPaths: TPath[]
  sources: TSource[]
  skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }>
  failed: Array<{ name: string; error: string }>
  sourceUnits: CorpusSourceUnit[]
}): {
  createdPaths: TPath[]
  sources: TSource[]
  skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }>
  failed: Array<{ name: string; error: string }>
  corpusManifest: CorpusImportManifest
} {
  return {
    createdPaths: args.createdPaths,
    sources: args.sources,
    skipped: args.skipped,
    failed: args.failed,
    corpusManifest: buildCorpusImportManifest({
      sourceUnits: args.sourceUnits,
      skipped: args.skipped,
      failed: args.failed,
    }),
  }
}

const readUnit = (value: unknown): CorpusSourceUnit | null => {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<CorpusSourceUnit>
  const workspacePath = normalizePath(item.workspacePath)
  const relativePath = normalizePath(item.relativePath || item.originalName || workspacePath)
  const originalName = String(item.originalName || relativePath || workspacePath || '').trim()
  if (!workspacePath || !originalName) return null
  const provenanceRaw = item.provenance && typeof item.provenance === 'object' ? item.provenance : null
  return {
    id: String(item.id || `corpus-source-${hashText(`${workspacePath}:${relativePath}`)}`).trim(),
    workspacePath,
    relativePath,
    originalName,
    mediaKind: inferCorpusMediaKind(originalName, item.mimeHint),
    mimeHint: String(item.mimeHint || '').trim() || null,
    byteSize: Number.isFinite(Number(item.byteSize)) ? Math.max(0, Number(item.byteSize)) : 0,
    textHash: String(item.textHash || '').trim(),
    status: normalizeStatus(item.status),
    provenance: {
      importMode: normalizeImportMode(provenanceRaw?.importMode),
      importedAtMs: Number.isFinite(Number(provenanceRaw?.importedAtMs)) ? Number(provenanceRaw?.importedAtMs) : 0,
      ...(String(provenanceRaw?.parentFolderId || '').trim()
        ? { parentFolderId: String(provenanceRaw?.parentFolderId || '').trim() }
        : {}),
    },
  }
}

export function normalizeCorpusImportManifest(value: unknown): CorpusImportManifest | undefined {
  if (!value || typeof value !== 'object') return undefined
  const rec = value as Partial<CorpusImportManifest>
  const sourceUnits = Array.isArray(rec.sourceUnits)
    ? rec.sourceUnits.map(readUnit).filter((item): item is CorpusSourceUnit => !!item)
    : []
  const skipped = Array.isArray(rec.skipped)
    ? rec.skipped.map(item => {
        const name = String((item as { name?: unknown } | null)?.name || '').trim()
        const reasonRaw = String((item as { reason?: unknown } | null)?.reason || '').trim()
        const reason = reasonRaw === 'missing-name' ? 'missing-name' as const : 'unsupported' as const
        return { name, reason }
      })
    : []
  const failed = Array.isArray(rec.failed)
    ? rec.failed.map(item => ({
        name: String((item as { name?: unknown } | null)?.name || '').trim(),
        error: String((item as { error?: unknown } | null)?.error || '').trim(),
      })).filter(item => item.error)
    : []
  if (sourceUnits.length < 1 && skipped.length < 1 && failed.length < 1) return undefined
  return buildCorpusImportManifest({ sourceUnits, skipped, failed })
}

export function summarizeCorpusImportManifest(manifest: CorpusImportManifest | null | undefined): string {
  if (!manifest) return ''
  const parts: string[] = []
  if (manifest.sourceUnits.length) parts.push(`source units ${manifest.sourceUnits.length}`)
  if (manifest.metrics.cacheHits) parts.push(`cache hits ${manifest.metrics.cacheHits}`)
  if (manifest.metrics.unsupported) parts.push(`unsupported ${manifest.metrics.unsupported}`)
  if (manifest.metrics.skipped) parts.push(`skipped ${manifest.metrics.skipped}`)
  if (manifest.metrics.failed) parts.push(`failed ${manifest.metrics.failed}`)
  return parts.length ? parts.join(', ') : ''
}
