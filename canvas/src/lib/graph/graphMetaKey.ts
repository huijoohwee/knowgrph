function readGraphMetaRecord(graph: { metadata?: unknown } | null | undefined): Record<string, unknown> | null {
  const meta = graph?.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  return meta as Record<string, unknown>
}

export function buildGraphMetaKey(graph: { metadata?: unknown } | null): string {
  const rec = readGraphMetaRecord(graph)
  if (!rec) return ''
  const kind = String(rec.kind ?? '')
  const source = String(rec.source ?? '')
  const layerHash = typeof rec.sourceLayerHash === 'string' ? rec.sourceLayerHash.trim() : ''
  const pending = rec.pending === true
  const base = `${kind}:${source}${pending ? ':pending' : ''}`
  return layerHash ? `${base}:${layerHash}` : base
}

export function buildGraphMetaKeyIgnoringPending(graph: { metadata?: unknown } | null): string {
  const rec = readGraphMetaRecord(graph)
  if (!rec) return ''
  const kind = String(rec.kind ?? '')
  const source = String(rec.source ?? '')
  const layerHash = typeof rec.sourceLayerHash === 'string' ? rec.sourceLayerHash.trim() : ''
  const base = `${kind}:${source}`
  return layerHash ? `${base}:${layerHash}` : base
}

export function readBaselineGraphMetaKey(
  graph: { metadata?: unknown } | null | undefined,
  fallbackGraphMetaKey: string,
): string {
  const meta = readGraphMetaRecord(graph)
  if (!meta) return fallbackGraphMetaKey
  const raw = typeof meta.baselineGraphMetaKey === 'string'
    ? String(meta.baselineGraphMetaKey || '').trim()
    : ''
  return raw || fallbackGraphMetaKey
}
