export function readEdgeEndpointId(raw: unknown): string {
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw).trim()
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const id = (raw as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id).trim()
  }
  return ''
}

