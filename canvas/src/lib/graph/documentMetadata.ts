import { coerceCodebaseRelPath } from '@/lib/codebase/relPath'

export type GraphMetadataRecord = Record<string, unknown>

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
