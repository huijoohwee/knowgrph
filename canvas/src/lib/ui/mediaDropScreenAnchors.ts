export type MediaDropScreenAnchor = {
  clientX: number
  clientY: number
  createdAtMs: number
}

const MEDIA_DROP_SCREEN_ANCHOR_TTL_MS = 3000
const anchorsByNodeId = new Map<string, MediaDropScreenAnchor>()

export function recordMediaDropScreenAnchor(nodeId: string, anchor: { clientX: number; clientY: number }): void {
  const id = String(nodeId || '').trim()
  if (!id || !Number.isFinite(anchor.clientX) || !Number.isFinite(anchor.clientY)) return
  anchorsByNodeId.set(id, {
    clientX: anchor.clientX,
    clientY: anchor.clientY,
    createdAtMs: Date.now(),
  })
}

export function readMediaDropScreenAnchor(nodeId: string, nowMs = Date.now()): MediaDropScreenAnchor | null {
  const id = String(nodeId || '').trim()
  if (!id) return null
  const anchor = anchorsByNodeId.get(id) || null
  if (!anchor) return null
  if (nowMs - anchor.createdAtMs > MEDIA_DROP_SCREEN_ANCHOR_TTL_MS) {
    anchorsByNodeId.delete(id)
    return null
  }
  return anchor
}
