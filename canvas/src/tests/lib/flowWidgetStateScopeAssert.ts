import { useGraphStore } from '@/hooks/useGraphStore'

export function assertFlowWidgetStateScopedToEligibleIds(args: {
  eligibleWidgetIds: ReadonlyArray<string>
  messagePrefix: string
}) {
  const state = useGraphStore.getState() as unknown as {
    flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
    flowWidgetPosByNodeId?: Record<string, { top: number; left: number }>
  }
  const eligible = new Set(args.eligibleWidgetIds.map(id => String(id || '').trim()).filter(Boolean))
  const unexpected = Array.from(new Set([
    ...Object.keys(state.flowWidgetWorldPosByNodeId || {}),
    ...Object.keys(state.flowWidgetPosByNodeId || {}),
  ])).filter(id => !eligible.has(id))
  if (unexpected.length > 0) {
    throw new Error(`${args.messagePrefix}; got ${unexpected.slice(0, 8).join(',')}`)
  }
}
