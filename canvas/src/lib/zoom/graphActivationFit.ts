import { resolveFlowWidgetStateGraphKey } from '@/lib/storyboardWidget/widgetStateScope'
import type { ZoomRequest } from '@/lib/zoom/requests'

export type GraphActivationFitDecision = {
  graphKey: string
  request: ZoomRequest | null
}

export type GraphActivationFitRequest = Extract<ZoomRequest, { type: 'fit' }> & {
  origin: 'graphActivation'
  targetGraphKey: string
}

export function createGraphActivationFitRequest(args: {
  graphData: unknown
  now?: number
}): GraphActivationFitRequest | null {
  const graphKey = resolveFlowWidgetStateGraphKey({ graphData: args.graphData }) || ''
  if (!graphKey) return null
  return {
    type: 'fit',
    intent: 'fitToView',
    origin: 'graphActivation',
    targetGraphKey: graphKey,
    at: Number.isFinite(args.now) ? Number(args.now) : Date.now(),
  }
}

export function resolveGraphActivationFitDecision(args: {
  previousGraphKey?: string | null
  graphData: unknown
  fitEligible: boolean
  now?: number
}): GraphActivationFitDecision {
  const graphKey = resolveFlowWidgetStateGraphKey({ graphData: args.graphData }) || ''
  const previousGraphKey = String(args.previousGraphKey || '').trim()
  if (!graphKey || !args.fitEligible || graphKey === previousGraphKey) {
    return { graphKey, request: null }
  }
  return { graphKey, request: createGraphActivationFitRequest(args) }
}

export function isGraphActivationFitRequest(request: ZoomRequest): request is GraphActivationFitRequest {
  return request.type === 'fit'
    && request.origin === 'graphActivation'
    && String(request.targetGraphKey || '').trim().length > 0
}

export function graphActivationFitTargetsGraph(args: {
  request: ZoomRequest
  graphData: unknown
}): boolean {
  if (!isGraphActivationFitRequest(args.request)) return false
  return args.request.targetGraphKey === resolveFlowWidgetStateGraphKey({ graphData: args.graphData })
}
