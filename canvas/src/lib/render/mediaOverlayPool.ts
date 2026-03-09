import type { GraphNode } from '@/lib/graph/types'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'

export type MediaOverlayKind = 'iframe' | 'image' | 'svg' | 'video'

export type MediaOverlayNode = {
  id: string
  title: string
  url: string
  interactive: boolean
  kind: MediaOverlayKind
}

export function listMediaOverlayNodes(args: {
  enabled: boolean
  nodes: GraphNode[]
  poolMax: number
  kinds?: readonly MediaOverlayKind[]
}): MediaOverlayNode[] {
  if (!args.enabled) return []
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const poolMax = Number.isFinite(args.poolMax) ? Math.max(0, Math.floor(args.poolMax)) : 0
  if (poolMax <= 0) return []
  const kinds = new Set<MediaOverlayKind>((args.kinds || ['iframe', 'image', 'svg', 'video']) as MediaOverlayKind[])
  const out: MediaOverlayNode[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    const spec = getNodeMediaSpec(n)
    if (!spec) continue
    const kind = spec.kind as MediaOverlayKind
    if (!kinds.has(kind)) continue
    const rawLabel = String(n.label || n.id || '').trim()
    const rawType = String(n.type || '').trim()
    const baseLabel = rawLabel || id
    const title = rawType ? `${baseLabel} (${rawType})` : baseLabel || 'Media node'
    out.push({ id, title, url: spec.url, interactive: spec.interactive, kind })
    if (out.length >= poolMax) break
  }
  return out
}

