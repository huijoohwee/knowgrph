import type { GraphNode } from '@/lib/graph/types'

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const FLOW_COMPUTE_FUNCTION_CACHE_MAX_SIZE = 120
const FLOW_COMPUTE_FUNCTION_CACHE = new Map<string, ((inputs: Record<string, unknown>) => unknown) | null>()

function getCachedFlowComputeFunction(key: string): ((inputs: Record<string, unknown>) => unknown) | null | undefined {
  const cached = FLOW_COMPUTE_FUNCTION_CACHE.get(key)
  if (typeof cached === 'undefined') return undefined
  FLOW_COMPUTE_FUNCTION_CACHE.delete(key)
  FLOW_COMPUTE_FUNCTION_CACHE.set(key, cached)
  return cached
}

function setCachedFlowComputeFunction(key: string, fn: ((inputs: Record<string, unknown>) => unknown) | null): void {
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
  if (source.length > 4000) return true
  const deny = /\b(window|document|globalThis|process|require|import|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|Function|eval|setTimeout|setInterval)\b/
  if (deny.test(source)) return true
  const normalized = source.replace(/\s+/g, ' ')
  const isArrow = /^\(?\s*inputs\s*\)?\s*=>/.test(normalized)
  return !isArrow
}

function compileFlowComputeSource(source: string): ((inputs: Record<string, unknown>) => unknown) | null {
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
    const wrapped = (inputs: Record<string, unknown>) => (fn as (arg: Record<string, unknown>) => unknown)(inputs)
    setCachedFlowComputeFunction(key, wrapped)
    return wrapped
  } catch {
    setCachedFlowComputeFunction(key, null)
    return null
  }
}

export function readFlowComputeSource(node: GraphNode): string {
  const props = isRecord(node?.properties) ? (node.properties as Record<string, unknown>) : null
  return cleanString(props?.['flow:compute'])
}

export function runFlowComputeSource(source: string, inputs: Record<string, unknown>): Record<string, unknown> | null {
  const computeFn = compileFlowComputeSource(source)
  if (!computeFn) return null
  try {
    const anyImportMeta = import.meta as unknown as { env?: { DEV?: boolean } }
    const computed = anyImportMeta?.env?.DEV ? computeFn(Object.freeze({ ...inputs })) : computeFn(inputs)
    if (!isRecord(computed)) return null
    return computed
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
