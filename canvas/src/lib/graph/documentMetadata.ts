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
  if (primary) return primary
  const fallbackRaw = typeof record.codebaseRelPath === 'string' ? record.codebaseRelPath.trim() : ''
  const fallback = fallbackRaw ? stripLineFragment(fallbackRaw) : ''
  if (fallback) return fallback
  return null
}

