export function buildGraphMetaKey(graph: { metadata?: unknown } | null): string {
  const meta = graph?.metadata
  if (!meta || typeof meta !== 'object') return ''
  const rec = meta as Record<string, unknown>
  const kind = String(rec.kind ?? '')
  const source = String(rec.source ?? '')
  const layerHash = typeof rec.sourceLayerHash === 'string' ? rec.sourceLayerHash.trim() : ''
  return layerHash ? `${kind}:${source}:${layerHash}` : `${kind}:${source}`
}
