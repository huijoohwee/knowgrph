import type { GraphData, JSONValue } from '@/lib/graph/types'
import { FLOW_NODE_QUICK_EDITOR_BUNDLE_KIND, FLOW_NODE_QUICK_EDITOR_BUNDLE_VERSION } from '@/lib/config'

type JsonRecord = Record<string, JSONValue>

export type NodeQuickEditorBundleV1 = {
  kind: typeof FLOW_NODE_QUICK_EDITOR_BUNDLE_KIND
  version: typeof FLOW_NODE_QUICK_EDITOR_BUNDLE_VERSION
  registry: JSONValue[]
  graph?: GraphData
}

function isJsonRecord(v: unknown): v is JsonRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function toJsonValueOrNull(v: unknown): JSONValue | null {
  if (v === null) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (Array.isArray(v)) {
    const out: JSONValue[] = []
    for (let i = 0; i < v.length; i += 1) {
      const item = toJsonValueOrNull(v[i])
      if (item === null) out.push(null)
      else out.push(item)
    }
    return out
  }
  if (isJsonRecord(v)) {
    const out: JsonRecord = {}
    for (const [k, val] of Object.entries(v)) {
      const next = toJsonValueOrNull(val)
      if (next === null) out[k] = null
      else out[k] = next
    }
    return out
  }
  return null
}

export function buildNodeQuickEditorBundleV1(args: {
  registryEntries: unknown[]
  graphData?: GraphData | null
}): NodeQuickEditorBundleV1 {
  const registryEntries = Array.isArray(args.registryEntries) ? args.registryEntries : []
  const registry: JSONValue[] = []
  for (let i = 0; i < registryEntries.length; i += 1) {
    const v = toJsonValueOrNull(registryEntries[i])
    if (!v) continue
    registry.push(v)
  }
  const graph = args.graphData || undefined
  return {
    kind: FLOW_NODE_QUICK_EDITOR_BUNDLE_KIND,
    version: FLOW_NODE_QUICK_EDITOR_BUNDLE_VERSION,
    registry,
    ...(graph ? { graph } : {}),
  }
}

export function nodeQuickEditorBundleToJsonText(bundle: NodeQuickEditorBundleV1): string {
  return JSON.stringify(bundle, null, 2)
}

export function nodeQuickEditorBundleToJsonBlob(bundle: NodeQuickEditorBundleV1): Blob {
  return new Blob([nodeQuickEditorBundleToJsonText(bundle)], { type: 'application/json' })
}

