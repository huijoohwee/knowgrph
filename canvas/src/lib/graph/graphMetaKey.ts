export function buildGraphMetaKey(graph: { metadata?: unknown } | null): string {
  const meta = graph?.metadata
  if (!meta || typeof meta !== 'object') return ''
  const rec = meta as Record<string, unknown>
  return `${String(rec.kind ?? '')}:${String(rec.source ?? '')}`
}

