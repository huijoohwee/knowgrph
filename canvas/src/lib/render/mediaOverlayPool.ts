import type { GraphNode } from '@/lib/graph/types'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'

export type MediaOverlayKind = 'iframe' | 'image' | 'svg' | 'video'

export type MediaOverlayNode = {
  id: string
  title: string
  url: string
  srcDoc?: string
  openUrl: string
  interactive: boolean
  kind: MediaOverlayKind
}

type RankedMediaNode = {
  id: string
  title: string
  url: string
  srcDoc?: string
  openUrl: string
  interactive: boolean
  kind: MediaOverlayKind
  rank: number
  idx: number
}

type Candidate = {
  id: string
  title: string
  url: string
  srcDoc?: string
  openUrl: string
  interactive: boolean
  kind: MediaOverlayKind
  rank: number
  idx: number
  preferred: boolean
}

function extractStandaloneMarkdownLinkUrlFromText(rawText: unknown): string {
  if (typeof rawText !== 'string') return ''
  const m = rawText.match(/^\s*\[[^\]]+\]\(([^)]+)\)\s*$/)
  if (!m || !m[1]) return ''
  return String(m[1]).trim()
}

function chooseOpenUrl(node: GraphNode, specUrl: string): string {
  const props = (node.properties || {}) as Record<string, unknown>
  const fromUrl = typeof props.url === 'string' ? String(props.url || '').trim() : ''
  if (fromUrl) return fromUrl

  const fromText = extractStandaloneMarkdownLinkUrlFromText(props.text)
  if (fromText) return fromText

  const fromMarkdown = extractStandaloneMarkdownLinkUrlFromText(props.markdown)
  if (fromMarkdown) return fromMarkdown

  return String(specUrl || '').trim()
}

function computeMediaRank(node: GraphNode, spec: { kind: string; url: string }): number {
  const props = (node.properties || {}) as Record<string, unknown>
  let score = 0

  const hasExplicit =
    typeof props.media_url === 'string' ||
    typeof props.iframe_url === 'string' ||
    typeof props.image === 'string' ||
    typeof props.video === 'string' ||
    typeof props.media === 'string'
  if (hasExplicit) score += 100

  const hasLegacy = typeof props.image_url === 'string' || typeof props.video_url === 'string'
  if (hasLegacy) score += 50

  const typeRaw = String(node.type || '').toLowerCase()
  if (typeRaw === 'image' || typeRaw === 'video' || typeRaw === 'iframe' || typeRaw === 'webpageelement' || typeRaw === 'link') {
    score += 20
  }

  const domTag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag']).trim().toUpperCase() : ''
  if (domTag === 'IMG' || domTag === 'VIDEO' || domTag === 'IFRAME' || domTag === 'SVG') score += 20

  const url = String(spec.url || '').toLowerCase()
  if (url.includes('mmbiz.qpic.cn') || url.includes('wx_fmt=')) score += 220

  const kind = String(spec.kind || '').toLowerCase()
  if (kind === 'image' || kind === 'svg') score += 10
  else if (kind === 'video') score += 8
  else if (kind === 'iframe') score += 6

  return score
}

function pushTopRanked(list: RankedMediaNode[], item: RankedMediaNode, limit: number) {
  if (limit <= 0) return
  if (list.length < limit) {
    list.push(item)
  } else {
    const worst = list[list.length - 1]!
    if (item.rank < worst.rank) return
    if (item.rank === worst.rank && item.idx >= worst.idx) return
    list[list.length - 1] = item
  }
  for (let i = list.length - 1; i > 0; i -= 1) {
    const a = list[i - 1]!
    const b = list[i]!
    if (a.rank > b.rank) break
    if (a.rank === b.rank && a.idx <= b.idx) break
    list[i - 1] = b
    list[i] = a
  }
}

export function listMediaOverlayNodes(args: {
  enabled: boolean
  nodes: GraphNode[]
  poolMax: number
  kinds?: readonly MediaOverlayKind[]
  preferredNodeIds?: readonly string[]
  excludeNodeIdSet?: Set<string>
}): MediaOverlayNode[] {
  if (!args.enabled) return []
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const poolMax = Number.isFinite(args.poolMax) ? Math.max(0, Math.floor(args.poolMax)) : 0
  const kinds = new Set<MediaOverlayKind>((args.kinds || ['iframe', 'image', 'svg', 'video']) as MediaOverlayKind[])
  if (poolMax <= 0) return []
  const preferred = (args.preferredNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
  const preferredSet = preferred.length ? new Set(preferred) : null
  const exclude = args.excludeNodeIdSet || null

  const candidates: Candidate[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    if (exclude?.has(id)) continue
    const spec = getNodeMediaSpec(n)
    if (!spec) continue
    const kind = spec.kind as MediaOverlayKind
    if (!kinds.has(kind)) continue
    const rawLabel = String(n.label || n.id || '').trim()
    const rawType = String(n.type || '').trim()
    const baseLabel = rawLabel || id
    const title = rawType ? `${baseLabel} (${rawType})` : baseLabel || 'Media node'
    const openUrl = chooseOpenUrl(n, spec.url)
    const preferredHit = preferredSet?.has(id) === true
    const rankBase = computeMediaRank(n, spec)
    const rank = preferredHit ? rankBase + 1000 : rankBase
    candidates.push({
      id,
      title,
      url: spec.url,
      ...(typeof (spec as { srcDoc?: unknown }).srcDoc === 'string' && String((spec as { srcDoc?: string }).srcDoc || '').trim()
        ? { srcDoc: String((spec as { srcDoc?: string }).srcDoc || '') }
        : {}),
      openUrl,
      interactive: spec.interactive,
      kind,
      rank,
      idx: i,
      preferred: preferredHit,
    })
  }

  const bestByKey = new Map<string, Candidate>()
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i]!
    const keyUrl = c.openUrl || c.url
    const key = `${c.kind}\n${keyUrl || c.id}`
    const prev = bestByKey.get(key)
    if (!prev) {
      bestByKey.set(key, c)
      continue
    }
    if (c.rank > prev.rank) {
      bestByKey.set(key, c)
      continue
    }
    if (c.rank === prev.rank && c.idx < prev.idx) {
      bestByKey.set(key, c)
    }
  }

  const unique = Array.from(bestByKey.values())
  unique.sort((a, b) => {
    if (a.rank !== b.rank) return b.rank - a.rank
    return a.idx - b.idx
  })

  return unique.slice(0, poolMax).map(n => ({
    id: n.id,
    title: n.title,
    url: n.url,
    ...(n.srcDoc ? { srcDoc: n.srcDoc } : {}),
    openUrl: n.openUrl,
    interactive: n.interactive,
    kind: n.kind,
  }))
}
