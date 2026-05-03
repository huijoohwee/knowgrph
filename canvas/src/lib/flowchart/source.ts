import type { GraphEdge } from '@/lib/graph/types'

export type FlowchartSourceKind = 'api' | 'fixture' | 'workspace' | 'unknown'

export type FlowchartSourceMeta = {
  kind: FlowchartSourceKind
  id: string
  endpoint?: string
}

export const FLOWCHART_API_ENDPOINT = '/api/graph'
export const FLOWCHART_FIXTURE_ENDPOINT = '/__flowchart_fixture'
export const FLOWCHART_API_META_VIEW = 'meta'

export const UNKNOWN_FLOWCHART_SOURCE_META: FlowchartSourceMeta = {
  kind: 'unknown',
  id: 'unknown:flowchart',
}

const sanitizeSourcePart = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  if (!raw) return ''
  return raw.replace(/\s+/g, '-')
}

const sanitizeFlowchartQueryValue = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

export function buildFlowchartApiUrl(args?: {
  apiRunId?: string | null
  view?: string | null
}): string {
  const params = new URLSearchParams()
  const apiRunId = sanitizeFlowchartQueryValue(args?.apiRunId)
  const view = sanitizeFlowchartQueryValue(args?.view)
  if (apiRunId) params.set('run', apiRunId)
  if (view) params.set('view', view)
  const query = params.toString()
  return query ? `${FLOWCHART_API_ENDPOINT}?${query}` : FLOWCHART_API_ENDPOINT
}

export function buildFlowchartApiMetaUrl(): string {
  return buildFlowchartApiUrl({ view: FLOWCHART_API_META_VIEW })
}

export function buildFlowchartSourceMeta(args?: {
  kind?: FlowchartSourceKind
  apiRunId?: string | null
  documentName?: string | null
}): FlowchartSourceMeta {
  const kind = args?.kind || 'unknown'
  if (kind === 'api') {
    const runId = sanitizeSourcePart(args?.apiRunId)
    return {
      kind,
      id: runId ? `api:${runId}` : 'api:graph',
      endpoint: buildFlowchartApiUrl({ apiRunId: runId || null }),
    }
  }
  if (kind === 'fixture') {
    return {
      kind,
      id: 'fixture:flowchart',
      endpoint: FLOWCHART_FIXTURE_ENDPOINT,
    }
  }
  if (kind === 'workspace') {
    const documentName = sanitizeSourcePart(args?.documentName)
    return {
      kind,
      id: documentName ? `workspace:${documentName}` : 'workspace:flowchart',
    }
  }
  return UNKNOWN_FLOWCHART_SOURCE_META
}

export function isFlowchartCrossEdge(edge: GraphEdge): boolean {
  const props =
    edge?.properties && typeof edge.properties === 'object' && !Array.isArray(edge.properties)
      ? (edge.properties as Record<string, unknown>)
      : null
  const edgeRole = typeof props?.['flowchart:edgeRole'] === 'string' ? String(props?.['flowchart:edgeRole']).trim() : ''
  if (edgeRole) return edgeRole === 'cross'
  return String(edge?.label || '').trim() === 'linksTo'
}
