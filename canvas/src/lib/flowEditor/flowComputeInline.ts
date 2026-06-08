import type { GraphNode } from '@/lib/graph/types'
import { readNodeProperties } from '@/lib/graph/nodeProperties'
import { isPlainObject } from '@/lib/graph/value'

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

const readPlainObject = (value: unknown): Record<string, unknown> | null => {
  return isPlainObject(value) ? (value as Record<string, unknown>) : null
}

export type FlowComputeContext = {
  node?: {
    id?: unknown
    type?: unknown
    label?: unknown
    properties?: unknown
    metadata?: unknown
  }
  connectedValuesBySchemaPath?: Record<string, unknown>
}

type FlowComputeFunction = (inputs: Record<string, unknown>, context: FlowComputeContext) => unknown

const FLOW_COMPUTE_FUNCTION_CACHE_MAX_SIZE = 120
const FLOW_COMPUTE_SOURCE_MAX_LENGTH = 12000
const FLOW_COMPUTE_FUNCTION_CACHE = new Map<string, FlowComputeFunction | null>()

function getCachedFlowComputeFunction(key: string): FlowComputeFunction | null | undefined {
  const cached = FLOW_COMPUTE_FUNCTION_CACHE.get(key)
  if (typeof cached === 'undefined') return undefined
  FLOW_COMPUTE_FUNCTION_CACHE.delete(key)
  FLOW_COMPUTE_FUNCTION_CACHE.set(key, cached)
  return cached
}

function setCachedFlowComputeFunction(key: string, fn: FlowComputeFunction | null): void {
  if (!key) return
  if (FLOW_COMPUTE_FUNCTION_CACHE.has(key)) {
    FLOW_COMPUTE_FUNCTION_CACHE.delete(key)
  }
  FLOW_COMPUTE_FUNCTION_CACHE.set(key, fn)
  if (FLOW_COMPUTE_FUNCTION_CACHE.size <= FLOW_COMPUTE_FUNCTION_CACHE_MAX_SIZE) return
  const oldestKey = FLOW_COMPUTE_FUNCTION_CACHE.keys().next().value
  if (typeof oldestKey === 'string' && oldestKey) {
    FLOW_COMPUTE_FUNCTION_CACHE.delete(oldestKey)
  }
}

export function isUnsafeFlowComputeSource(source: string): boolean {
  if (!source) return true
  if (source.length > FLOW_COMPUTE_SOURCE_MAX_LENGTH) return true
  const deny = /\b(window|document|globalThis|process|require|import|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|Function|eval|setTimeout|setInterval)\b/
  if (deny.test(source)) return true
  const normalized = source.replace(/\s+/g, ' ')
  const isArrow = /^(?:inputs|\(\s*inputs\s*(?:,\s*(?:context|ctx))?\s*\))\s*=>/.test(normalized)
  return !isArrow
}

function compileFlowComputeSource(source: string): FlowComputeFunction | null {
  const key = cleanString(source)
  if (!key) return null
  const cached = getCachedFlowComputeFunction(key)
  if (typeof cached !== 'undefined') return cached || null
  if (isUnsafeFlowComputeSource(key)) {
    setCachedFlowComputeFunction(key, null)
    return null
  }
  try {
    const fn = Function(`"use strict"; return (${key});`)() as unknown
    if (typeof fn !== 'function') {
      setCachedFlowComputeFunction(key, null)
      return null
    }
    const wrapped = (inputs: Record<string, unknown>, context: FlowComputeContext) => (fn as FlowComputeFunction)(inputs, context)
    setCachedFlowComputeFunction(key, wrapped)
    return wrapped
  } catch {
    setCachedFlowComputeFunction(key, null)
    return null
  }
}

export function readFlowComputeSource(node: GraphNode): string {
  const props = readNodeProperties(node)
  const readSourceValue = (value: unknown): string => {
    const direct = cleanString(value)
    if (direct) return direct
    const record = readPlainObject(value)
    return cleanString(record?.value)
  }
  return readSourceValue(props?.['flow:compute']) || readSourceValue(props?.compute)
}

export function runFlowComputeSource(
  source: string,
  inputs: Record<string, unknown>,
  context: FlowComputeContext = {},
): Record<string, unknown> | null {
  const computeFn = compileFlowComputeSource(source)
  if (!computeFn) return null
  try {
    const anyImportMeta = import.meta as unknown as { env?: { DEV?: boolean } }
    const computed = anyImportMeta?.env?.DEV
      ? computeFn(Object.freeze({ ...inputs }), Object.freeze({ ...context }))
      : computeFn(inputs, context)
    return readPlainObject(computed)
  } catch {
    return null
  }
}

export function invalidateFlowComputeSourceCache(source?: string): void {
  const key = cleanString(source)
  if (key) {
    FLOW_COMPUTE_FUNCTION_CACHE.delete(key)
    return
  }
  FLOW_COMPUTE_FUNCTION_CACHE.clear()
}
