import type { GraphData, JSONValue } from '@/lib/graph/types'

export function makeBlankGraphData(args: { reason: string; source?: string }): GraphData {
  const reason = String(args.reason || '').trim() || 'blank'
  const source = String(args.source || '').trim()
  const meta: Record<string, JSONValue> = {
    kind: 'blank',
    reason,
    ...(source ? ({ source } as unknown as Record<string, JSONValue>) : {}),
  }
  return {
    type: 'Graph',
    context: 'blank',
    nodes: [],
    edges: [],
    metadata: meta,
  }
}

