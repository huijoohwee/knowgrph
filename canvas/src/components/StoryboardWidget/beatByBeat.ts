import type { GraphNode } from '@/lib/graph/types'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
}

export function parseBeatIndexFromNodeId(nodeId: string): number | null {
  const m = /^NODE_(?:CLIP|OVERLAY)_(\d{1,2})$/.exec(String(nodeId || '').trim())
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  if (n <= 0 || n > 99) return null
  return Math.floor(n)
}

export function readBeatRefFromParams(node: GraphNode): string {
  const props = (node.properties || {}) as Record<string, unknown>
  const params = isRecord(props.params) ? (props.params as Record<string, unknown>) : null
  const beatRef = typeof params?.beat_ref === 'string' ? params.beat_ref.trim() : ''
  return beatRef
}

export function resolveBeatRefForNode(node: GraphNode): string | null {
  const nodeId = String(node.id || '').trim()
  const beatRefFromParams = readBeatRefFromParams(node)
  if (beatRefFromParams) return beatRefFromParams
  const beatIndex = parseBeatIndexFromNodeId(nodeId)
  if (beatIndex == null) return null
  return `beat_${pad2(beatIndex)}`
}

export function resolveBeatClipOverlayIdsForNode(node: GraphNode): { clipNodeId: string; overlayNodeId: string } | null {
  const nodeId = String(node.id || '').trim()
  const beatIndex = parseBeatIndexFromNodeId(nodeId)
  const beatRefFromParams = readBeatRefFromParams(node)
  const beatRef = beatRefFromParams || (beatIndex != null ? `beat_${pad2(beatIndex)}` : '')
  if (!beatRef) return null
  const beatNo = beatIndex != null ? pad2(beatIndex) : beatRef.replace(/^beat_/, '')
  if (!beatNo) return null
  return {
    clipNodeId: `NODE_CLIP_${beatNo}`,
    overlayNodeId: `WIDGET_${beatNo}`,
  }
}

