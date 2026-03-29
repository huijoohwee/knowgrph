import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { isRadarGraphNode, isRadarHubNode } from '@/lib/graph/radarForces'

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

export const computeRadarGalaxyPositions2d = (args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  centerX?: number
  centerY?: number
  paddingPx?: number
}): Record<string, { x: number; y: number }> | null => {
  const nodes = args.nodes
  if (!Array.isArray(nodes) || nodes.length === 0) return null

  const radarNodes: GraphNode[] = []
  const hubs: GraphNode[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (!isRadarGraphNode(n)) continue
    radarNodes.push(n)
    if (isRadarHubNode(n)) hubs.push(n)
  }
  if (radarNodes.length < 2 || hubs.length === 0) return null

  const viewW = Math.max(1, Number.isFinite(args.width) ? args.width : 1)
  const viewH = Math.max(1, Number.isFinite(args.height) ? args.height : 1)
  const centerX = Number.isFinite(args.centerX) ? Number(args.centerX) : viewW * 0.5
  const centerY = Number.isFinite(args.centerY) ? Number(args.centerY) : viewH * 0.5
  const pad = Math.max(0, Number.isFinite(args.paddingPx) ? Number(args.paddingPx) : 24)
  const halfW = Math.max(1, viewW * 0.5 - pad)
  const halfH = Math.max(1, viewH * 0.5 - pad)
  const outerRadius = Math.max(80, Math.min(halfW, halfH) * 0.76)
  const localBase = clamp(Math.min(halfW, halfH) * 0.16, 70, 280)
  const localGap = clamp(localBase * 0.42, 42, 180)

  const hubsSorted = [...hubs].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const hubByCluster = new Map<string, GraphNode>()
  for (let i = 0; i < hubsSorted.length; i += 1) {
    const h = hubsSorted[i]!
    const props = (h.properties || {}) as Record<string, unknown>
    const cluster = String(props['kg:radarCluster'] || h.id || '').trim()
    if (!cluster) continue
    if (!hubByCluster.has(cluster)) hubByCluster.set(cluster, h)
  }

  const membersByHubId = new Map<string, GraphNode[]>()
  const hubIdSet = new Set<string>()
  for (let i = 0; i < hubsSorted.length; i += 1) hubIdSet.add(String(hubsSorted[i]!.id))
  const radarNodeById = new Map<string, GraphNode>()
  for (let i = 0; i < radarNodes.length; i += 1) {
    const n = radarNodes[i]!
    radarNodeById.set(String(n.id), n)
    if (isRadarHubNode(n)) continue
    const props = (n.properties || {}) as Record<string, unknown>
    const cluster = String(props['kg:radarCluster'] || '').trim()
    const owner = (cluster && hubByCluster.get(cluster)) || hubsSorted[i % hubsSorted.length]!
    const ownerId = String(owner.id)
    const arr = membersByHubId.get(ownerId) || []
    arr.push(n)
    membersByHubId.set(ownerId, arr)
  }

  for (let i = 0; i < args.edges.length; i += 1) {
    const e = args.edges[i]!
    const props = ((e as unknown as { properties?: unknown }).properties || {}) as Record<string, unknown>
    if (props['kg:radarSpoke'] !== true && String(e.label || '').trim() !== 'spokeTo') continue
    const src = String(e.source || '').trim()
    const tgt = String(e.target || '').trim()
    if (!src || !tgt) continue
    const hubId = hubIdSet.has(src) ? src : hubIdSet.has(tgt) ? tgt : ''
    const nodeId = hubId === src ? tgt : hubId === tgt ? src : ''
    if (!hubId || !nodeId) continue
    const member = radarNodeById.get(nodeId)
    if (!member || isRadarHubNode(member)) continue
    const arr = membersByHubId.get(hubId) || []
    if (!arr.some(n => String(n.id) === nodeId)) arr.push(member)
    membersByHubId.set(hubId, arr)
  }

  const out: Record<string, { x: number; y: number }> = {}
  const usedIds = new Set<string>()
  const hubCount = Math.max(1, hubsSorted.length)
  for (let i = 0; i < hubsSorted.length; i += 1) {
    const hub = hubsSorted[i]!
    const angle = (Math.PI * 2 * i) / hubCount - Math.PI / 2
    const hubX = centerX + Math.cos(angle) * outerRadius
    const hubY = centerY + Math.sin(angle) * outerRadius
    const hubId = String(hub.id)
    out[hubId] = { x: hubX, y: hubY }
    usedIds.add(hubId)

    const members = [...(membersByHubId.get(hubId) || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    if (members.length === 0) continue
    const capBase = 8
    for (let m = 0; m < members.length; m += 1) {
      const node = members[m]!
      const ring = Math.floor(m / capBase)
      const inRing = m % capBase
      const ringSize = Math.min(14, Math.max(capBase, members.length - ring * capBase))
      const localAngle = angle + ((Math.PI * 2) / Math.max(1, ringSize)) * inRing + (ring % 2 === 0 ? 0 : Math.PI / Math.max(3, ringSize))
      const r = localBase + ring * localGap + (inRing % 2 === 0 ? 0 : localGap * 0.16)
      out[String(node.id)] = { x: hubX + Math.cos(localAngle) * r, y: hubY + Math.sin(localAngle) * r }
      usedIds.add(String(node.id))
    }
  }

  const remaining: GraphNode[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (usedIds.has(String(n.id))) continue
    remaining.push(n)
  }
  if (remaining.length > 0) {
    const baseR = clamp(Math.min(halfW, halfH) * 0.24, 40, 220)
    const gapR = clamp(baseR * 0.36, 28, 120)
    const stepA = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < remaining.length; i += 1) {
      const n = remaining[i]!
      const ring = Math.floor(i / 14)
      const r = baseR + ring * gapR
      const a = stepA * i
      out[String(n.id)] = { x: centerX + Math.cos(a) * r, y: centerY + Math.sin(a) * r }
    }
  }

  return out
}
