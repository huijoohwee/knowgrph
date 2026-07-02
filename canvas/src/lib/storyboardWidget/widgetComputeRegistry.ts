import type { GraphNode } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import {
  FLOW_SWARM_PREDICTION_FORM_ID,
  FLOW_SWARM_PREDICTION_NODE_TYPE_ID,
  FLOW_SWARM_PREDICTION_WIDGET_TYPE_ID,
} from '@/lib/config.storyboard-widget'
import { runSwarmPredictionWidgetProperties } from '@/features/swarm-prediction/swarmPredictionWidget'

type FlowWidgetComputeIdentity = {
  nodeTypeId: string
  widgetTypeId: string
  formId: string
}

type FlowWidgetComputeRunner = {
  matches: (identity: FlowWidgetComputeIdentity) => boolean
  run: (properties: Record<string, unknown>) => Record<string, unknown> | null
}

const cleanString = (value: unknown): string => String(value || '').trim()

const FLOW_WIDGET_COMPUTE_RUNNERS: ReadonlyArray<FlowWidgetComputeRunner> = [
  {
    matches: identity => (
      identity.nodeTypeId === FLOW_SWARM_PREDICTION_NODE_TYPE_ID
      && identity.widgetTypeId === FLOW_SWARM_PREDICTION_WIDGET_TYPE_ID
      && identity.formId === FLOW_SWARM_PREDICTION_FORM_ID
    ),
    run: properties => runSwarmPredictionWidgetProperties(properties),
  },
]

function resolveFlowWidgetComputeIdentity(args: {
  node: GraphNode | null | undefined
  registryEntry?: WidgetRegistryEntry | null | undefined
}): FlowWidgetComputeIdentity {
  const props = args.node?.properties && typeof args.node.properties === 'object' && !Array.isArray(args.node.properties)
    ? args.node.properties as Record<string, unknown>
    : {}
  return {
    nodeTypeId: cleanString(args.registryEntry?.nodeTypeId) || cleanString(args.node?.type),
    widgetTypeId: cleanString(args.registryEntry?.widgetTypeId) || cleanString(props['flow:widgetTypeId']),
    formId: cleanString(args.registryEntry?.formId) || cleanString(props['flow:widgetFormId']),
  }
}

function resolveFlowWidgetComputeRunner(args: {
  node: GraphNode | null | undefined
  registryEntry?: WidgetRegistryEntry | null | undefined
}): FlowWidgetComputeRunner | null {
  const identity = resolveFlowWidgetComputeIdentity(args)
  for (let i = 0; i < FLOW_WIDGET_COMPUTE_RUNNERS.length; i += 1) {
    const runner = FLOW_WIDGET_COMPUTE_RUNNERS[i]
    if (runner.matches(identity)) return runner
  }
  return null
}

export function hasRegisteredFlowWidgetCompute(args: {
  node: GraphNode | null | undefined
  registryEntry?: WidgetRegistryEntry | null | undefined
}): boolean {
  return Boolean(resolveFlowWidgetComputeRunner(args))
}

export function runRegisteredFlowWidgetCompute(args: {
  node: GraphNode
  registryEntry?: WidgetRegistryEntry | null | undefined
  properties: Record<string, unknown>
}): Record<string, unknown> | null {
  const runner = resolveFlowWidgetComputeRunner({
    node: args.node,
    registryEntry: args.registryEntry,
  })
  if (!runner) return null
  try {
    const computed = runner.run({ ...args.properties })
    return computed && typeof computed === 'object' && !Array.isArray(computed)
      ? computed
      : null
  } catch {
    return null
  }
}
