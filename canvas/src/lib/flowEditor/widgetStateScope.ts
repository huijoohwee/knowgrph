import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'

export function resolveFlowWidgetStateGraphKey(args: {
  graphMetaKey?: string | null
  graphData?: unknown
}): string | null {
  const explicit = String(args.graphMetaKey || '').trim()
  if (explicit) return explicit
  const derived = buildGraphMetaKeyIgnoringPending((args.graphData || null) as never)
  return String(derived || '').trim() || null
}

export function resolveScopedFlowWidgetNodeMap<T>(args: {
  graphMetaKey?: string | null
  graphData?: unknown
  keyedByGraphMetaKey?: Record<string, Record<string, T>> | null
  globalByNodeId?: Record<string, T> | null
}): Record<string, T> {
  const graphKey = resolveFlowWidgetStateGraphKey({
    graphMetaKey: args.graphMetaKey,
    graphData: args.graphData,
  })
  if (graphKey) return args.keyedByGraphMetaKey?.[graphKey] || {}
  return args.globalByNodeId || {}
}

export function readScopedFlowWidgetNodeValue<T>(args: {
  nodeId: string
  graphMetaKey?: string | null
  graphData?: unknown
  keyedByGraphMetaKey?: Record<string, Record<string, T>> | null
  globalByNodeId?: Record<string, T> | null
}): T | undefined {
  const nodeId = String(args.nodeId || '').trim()
  if (!nodeId) return undefined
  return resolveScopedFlowWidgetNodeMap({
    graphMetaKey: args.graphMetaKey,
    graphData: args.graphData,
    keyedByGraphMetaKey: args.keyedByGraphMetaKey,
    globalByNodeId: args.globalByNodeId,
  })[nodeId]
}
