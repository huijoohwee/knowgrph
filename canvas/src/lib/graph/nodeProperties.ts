import type { GraphNode } from '@/lib/graph/types'

const EMPTY_NODE_PROPERTIES: Record<string, unknown> = Object.freeze({})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readNodeProperties(
  node: Pick<GraphNode, 'properties'> | null | undefined,
): Record<string, unknown> {
  const props = node?.properties
  return isRecord(props) ? (props as Record<string, unknown>) : EMPTY_NODE_PROPERTIES
}

export function readRecordPathValue(root: Record<string, unknown>, pathRaw: string): unknown {
  const raw = String(pathRaw || '').trim()
  if (!raw) return undefined
  const normalized = raw.startsWith('properties.') ? raw.slice('properties.'.length) : raw
  if (Object.prototype.hasOwnProperty.call(root, normalized)) return root[normalized]
  const parts = normalized.split('.').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return undefined
  let current: unknown = root
  for (let i = 0; i < parts.length; i += 1) {
    if (!isRecord(current)) return undefined
    current = current[parts[i]]
  }
  return current
}

export function readNodePropertyPathValue(
  node: Pick<GraphNode, 'properties'> | null | undefined,
  pathRaw: string,
): unknown {
  return readRecordPathValue(readNodeProperties(node), pathRaw)
}
