function normalizeEdgeEndpointId(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  const dot = value.indexOf('.')
  return dot > 0 ? value.slice(0, dot).trim() : value
}

export function readEdgeEndpointId(raw: unknown): string {
  if (typeof raw === 'string') return normalizeEdgeEndpointId(raw)
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : ''
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const id = (raw as { id?: unknown }).id
    if (typeof id === 'string') return normalizeEdgeEndpointId(id)
    if (typeof id === 'number') return Number.isFinite(id) ? String(id) : ''
  }
  return ''
}

