import { coerceCodebaseRelPath } from '@/lib/codebase/relPath'

export type GraphMetadataRecord = Record<string, unknown>
export type DocumentMetadataEntry = {
  type: string
  value: string
  note: string
  lineStart?: number
  lineEnd?: number
}

export const toMetadataRecord = (meta: unknown): GraphMetadataRecord => {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as GraphMetadataRecord
  }
  return {}
}

const stripLineFragment = (value: string): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const hashIndex = raw.indexOf('#')
  if (hashIndex < 0) return raw
  return raw.slice(0, hashIndex).trim() || ''
}

export const getCodebasePathFromMetadata = (metadata: unknown): string | null => {
  const record = toMetadataRecord(metadata)
  const value = record.codebasePath
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export const getDocumentPathFromMetadata = (metadata: unknown): string | null => {
  const record = toMetadataRecord(metadata)
  const primaryRaw = typeof record.documentPath === 'string' ? record.documentPath.trim() : ''
  const primary = primaryRaw ? stripLineFragment(primaryRaw) : ''
  if (primary) {
    const coerced = coerceCodebaseRelPath(primary)
    return coerced || null
  }
  const fallbackRaw = typeof record.codebaseRelPath === 'string' ? record.codebaseRelPath.trim() : ''
  const fallback = fallbackRaw ? stripLineFragment(fallbackRaw) : ''
  if (fallback) {
    const coerced = coerceCodebaseRelPath(fallback)
    return coerced || null
  }
  const codebaseRaw = typeof record.codebasePath === 'string' ? record.codebasePath.trim() : ''
  const codebase = codebaseRaw ? stripLineFragment(codebaseRaw) : ''
  if (codebase) {
    const coerced = coerceCodebaseRelPath(codebase)
    return coerced || null
  }
  return null
}

export const readGraphDataRevision = (graphData: { metadata?: unknown } | null | undefined): number => {
  const record = toMetadataRecord(graphData?.metadata)
  const raw = record.graphDataRevision
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
}

export const readDocumentMetadataEntries = (metadata: unknown): DocumentMetadataEntry[] => {
  const record = toMetadataRecord(metadata)
  const raw = record.documentMetadataEntries
  if (!Array.isArray(raw)) return []
  const entries: DocumentMetadataEntry[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const entryRecord = entry as Record<string, unknown>
    const type = typeof entryRecord.type === 'string' ? entryRecord.type.trim() : ''
    const value = typeof entryRecord.value === 'string' ? entryRecord.value.trim() : ''
    const note = typeof entryRecord.note === 'string' ? entryRecord.note.trim() : ''
    if (!type || !value || !note) continue
    const lineStart = typeof entryRecord.lineStart === 'number' && Number.isFinite(entryRecord.lineStart)
      ? Math.max(1, Math.floor(entryRecord.lineStart))
      : undefined
    const lineEnd = typeof entryRecord.lineEnd === 'number' && Number.isFinite(entryRecord.lineEnd)
      ? Math.max(lineStart || 1, Math.floor(entryRecord.lineEnd))
      : undefined
    entries.push({
      type,
      value,
      note,
      ...(lineStart ? { lineStart } : {}),
      ...(lineEnd ? { lineEnd } : {}),
    })
  }
  return entries
}
