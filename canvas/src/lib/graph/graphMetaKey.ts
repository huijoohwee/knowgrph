export function buildGraphMetaKey(graph: { metadata?: unknown } | null): string {
  const meta = graph?.metadata
  if (!meta || typeof meta !== 'object') return ''
  const rec = meta as Record<string, unknown>
  const kind = String(rec.kind ?? '')
  const source = String(rec.source ?? '')
  const layerHash = typeof rec.sourceLayerHash === 'string' ? rec.sourceLayerHash.trim() : ''
  const pending = rec.pending === true
  const base = `${kind}:${source}${pending ? ':pending' : ''}`
  return layerHash ? `${base}:${layerHash}` : base
}

export function buildGraphMetaKeyIgnoringPending(graph: { metadata?: unknown } | null): string {
  const meta = graph?.metadata
  if (!meta || typeof meta !== 'object') return ''
  const rec = meta as Record<string, unknown>
  const kind = String(rec.kind ?? '')
  const source = String(rec.source ?? '')
  const layerHash = typeof rec.sourceLayerHash === 'string' ? rec.sourceLayerHash.trim() : ''
  const base = `${kind}:${source}`
  return layerHash ? `${base}:${layerHash}` : base
}
