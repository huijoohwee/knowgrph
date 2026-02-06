import type { GraphSchema } from '@/lib/graph/schema'

export function isPortHandlesShowAllInputsEnabled(schema: GraphSchema | null | undefined): boolean {
  const port = schema?.behavior?.portHandles || null
  if (!port) return false
  return Boolean((port as { enabled?: unknown }).enabled) && Boolean((port as { showAllInputs?: unknown }).showAllInputs)
}

export function shouldInjectDefaultFlowHandles(schema: GraphSchema | null | undefined): boolean {
  const port = schema?.behavior?.portHandles || null
  if (!port) return false
  if (!Boolean((port as { enabled?: unknown }).enabled)) return false
  const showAllInputs = (port as { showAllInputs?: unknown }).showAllInputs
  if (typeof showAllInputs === 'boolean') return showAllInputs
  return true
}

export function togglePortHandlesEnabledInSchema(schema: GraphSchema): { changed: boolean; schema: GraphSchema } {
  const behavior = schema.behavior || ({} as GraphSchema['behavior'])
  const prevPort = (behavior.portHandles || {}) as NonNullable<GraphSchema['behavior']>['portHandles']
  const enabled = Boolean((prevPort as { enabled?: unknown }).enabled)
  const nextPort = { ...prevPort, enabled: !enabled }
  const nextBehavior = { ...behavior, portHandles: nextPort }
  return { changed: true, schema: { ...schema, behavior: nextBehavior } }
}
