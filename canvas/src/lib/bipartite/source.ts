import type { GraphEdge } from '@/lib/graph/types'

export type BipartiteSourceKind = 'api' | 'fixture' | 'workspace' | 'unknown'

export type BipartiteSourceMeta = {
  kind: BipartiteSourceKind
  id: string
  endpoint?: string
}

export const BIPARTITE_API_ENDPOINT = '/api/graph'
export const BIPARTITE_FIXTURE_ENDPOINT = '/__bipartite_fixture'
export const BIPARTITE_API_META_VIEW = 'meta'

export const UNKNOWN_BIPARTITE_SOURCE_META: BipartiteSourceMeta = {
  kind: 'unknown',
  id: 'unknown:bipartite',
}

const sanitizeSourcePart = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  if (!raw) return ''
  return raw.replace(/\s+/g, '-')
}

const sanitizeBipartiteQueryValue = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

export function buildBipartiteApiUrl(args?: {
  apiRunId?: string | null
  view?: string | null
}): string {
  const params = new URLSearchParams()
  const apiRunId = sanitizeBipartiteQueryValue(args?.apiRunId)
  const view = sanitizeBipartiteQueryValue(args?.view)
  if (apiRunId) params.set('run', apiRunId)
  if (view) params.set('view', view)
  const query = params.toString()
  return query ? `${BIPARTITE_API_ENDPOINT}?${query}` : BIPARTITE_API_ENDPOINT
}

export function buildBipartiteApiMetaUrl(): string {
  return buildBipartiteApiUrl({ view: BIPARTITE_API_META_VIEW })
}

export function buildBipartiteSourceMeta(args?: {
  kind?: BipartiteSourceKind
  apiRunId?: string | null
  documentName?: string | null
}): BipartiteSourceMeta {
  const kind = args?.kind || 'unknown'
  if (kind === 'api') {
    const runId = sanitizeSourcePart(args?.apiRunId)
    return {
      kind,
      id: runId ? `api:${runId}` : 'api:graph',
      endpoint: buildBipartiteApiUrl({ apiRunId: runId || null }),
    }
  }
  if (kind === 'fixture') {
    return {
      kind,
      id: 'fixture:bipartite',
      endpoint: BIPARTITE_FIXTURE_ENDPOINT,
    }
  }
  if (kind === 'workspace') {
    const documentName = sanitizeSourcePart(args?.documentName)
    return {
      kind,
      id: documentName ? `workspace:${documentName}` : 'workspace:bipartite',
    }
  }
  return UNKNOWN_BIPARTITE_SOURCE_META
}

export function isBipartiteCrossEdge(edge: GraphEdge): boolean {
  const props =
    edge?.properties && typeof edge.properties === 'object' && !Array.isArray(edge.properties)
      ? (edge.properties as Record<string, unknown>)
      : null
  const edgeRole = typeof props?.['bipartite:edgeRole'] === 'string' ? String(props?.['bipartite:edgeRole']).trim() : ''
  if (edgeRole) return edgeRole === 'cross'
  return String(edge?.label || '').trim() === 'linksTo'
}
