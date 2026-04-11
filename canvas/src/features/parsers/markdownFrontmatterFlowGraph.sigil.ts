import type { GraphEdge, JSONValue } from '@/lib/graph/types'
import { parseMarkdownFrontmatter } from '@/lib/markdown'
import { hashText } from '@/features/parsers/hash'

const FRONTMATTER_PRIMITIVE_KEY = 'frontmatter:primitive' as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function escapeRegex(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePatternKind(raw: string): 'node' | 'edge' | 'cluster' {
  const s = String(raw || '').trim()
  if (s.startsWith('@cluster:')) return 'cluster'
  if (s.startsWith('@edge:')) return 'edge'
  return 'node'
}

function resolveSigilPattern(raw: unknown): string {
  const source = String(raw || '').trim()
  if (!source) return ''
  const kind = parsePatternKind(source)
  return normalizeSigilId(source, kind)
}

function expandSigilPattern(pattern: string, candidates: ReadonlyArray<string>): string[] {
  const token = String(pattern || '').trim()
  if (!token) return []
  if (!token.includes('*')) return [token]
  const rx = new RegExp(`^${escapeRegex(token).replace(/\\\*/g, '.*')}$`)
  const out: string[] = []
  for (let i = 0; i < candidates.length; i += 1) {
    const id = String(candidates[i] || '').trim()
    if (!id) continue
    if (rx.test(id)) out.push(id)
  }
  return out
}

function mergeFrontmatterMeta(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a }
  for (const k of Object.keys(b)) {
    const av = out[k]
    const bv = b[k]
    if (Array.isArray(av) && Array.isArray(bv)) {
      out[k] = [...av, ...bv]
      continue
    }
    if (isRecord(av) && isRecord(bv)) {
      out[k] = mergeFrontmatterMeta(av, bv)
      continue
    }
    out[k] = bv
  }
  return out
}

function findFrontmatterEndIndex(lines: string[], startDashLine: number): number {
  for (let i = startDashLine + 1; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() === '---') return i
  }
  return -1
}

function parseInlineScalar(raw: string): unknown {
  const s = String(raw || '').trim()
  if (!s) return ''
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  if (s === 'true') return true
  if (s === 'false') return false
  const n = Number(s)
  if (Number.isFinite(n) && String(n) === s) return n
  return s
}

function splitInlineObjectPairs(text: string): string[] {
  const source = String(text || '')
  if (!source) return []
  const out: string[] = []
  let token = ''
  let quote: '"' | "'" | null = null
  let escapeNext = false
  let depthBrace = 0
  let depthBracket = 0
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (escapeNext) {
      token += ch
      escapeNext = false
      continue
    }
    if (quote) {
      token += ch
      if (ch === '\\') {
        escapeNext = true
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      token += ch
      continue
    }
    if (ch === '{') {
      depthBrace += 1
      token += ch
      continue
    }
    if (ch === '}') {
      depthBrace = Math.max(0, depthBrace - 1)
      token += ch
      continue
    }
    if (ch === '[') {
      depthBracket += 1
      token += ch
      continue
    }
    if (ch === ']') {
      depthBracket = Math.max(0, depthBracket - 1)
      token += ch
      continue
    }
    if (ch === ',' && depthBrace === 0 && depthBracket === 0) {
      const pair = token.trim()
      if (pair) out.push(pair)
      token = ''
      continue
    }
    token += ch
  }
  const tail = token.trim()
  if (tail) out.push(tail)
  return out
}

function parseInlineObject(raw: string): Record<string, unknown> {
  const text = String(raw || '').trim()
  if (!text) return {}
  const pairs = splitInlineObjectPairs(text)
  const out: Record<string, unknown> = {}
  for (let i = 0; i < pairs.length; i += 1) {
    const part = pairs[i]
    const idx = part.indexOf(':')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    if (!key) continue
    out[key] = parseInlineScalar(val)
  }
  return out
}

function parseSigilEdgeLine(raw: string): {
  id: string
  source: string
  target: string
  fromPort: string
  toPort: string
} | null {
  const m = /^\s*-\s*@edge:([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)\s*(?:→|->|-->|=>|⟶)\s*([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)\s*$/.exec(raw)
  if (!m) return null
  const sourceNode = asString(m[1])
  const fromPort = asString(m[2])
  const targetNode = asString(m[3])
  const toPort = asString(m[4])
  if (!sourceNode || !fromPort || !targetNode || !toPort) return null
  return {
    id: `@edge:${sourceNode}:${fromPort}->${targetNode}:${toPort}`,
    source: `@node:${sourceNode}`,
    target: `@node:${targetNode}`,
    fromPort,
    toPort,
  }
}

export function normalizeSigilId(raw: unknown, fallbackKind?: 'node' | 'edge' | 'cluster'): string {
  const src = String(raw || '').trim()
  if (!src) return ''
  const plain = src.startsWith('@') ? src.slice(1) : src
  const prefixed = /^([a-zA-Z]+):(.*)$/.exec(plain)
  if (prefixed) {
    const kindRaw = String(prefixed[1] || '').trim().toLowerCase()
    const rest = String(prefixed[2] || '').trim().replace(/:+$/, '')
    if (!rest) return ''
    const kind =
      kindRaw === 'node' || kindRaw === 'edge' || kindRaw === 'cluster'
        ? kindRaw
        : fallbackKind || 'node'
    return `@${kind}:${rest}`
  }
  const rest = plain.trim().replace(/:+$/, '')
  if (!rest) return ''
  const kind = fallbackKind || 'node'
  return `@${kind}:${rest}`
}

export function normalizeEdgesFromSigilSpecs(args: {
  meta: Record<string, unknown>
  nodeIds: ReadonlyArray<string>
}): GraphEdge[] {
  const rawEdges = Array.isArray(args.meta.edges) ? args.meta.edges : []
  if (rawEdges.length === 0) return []
  const out: GraphEdge[] = []
  const seen = new Set<string>()
  const candidates = args.nodeIds
  for (let i = 0; i < rawEdges.length; i += 1) {
    const row = rawEdges[i]
    if (!isRecord(row)) continue
    const baseId = normalizeSigilId(row.id, 'edge') || `@edge:auto-${i + 1}`
    const sourcePattern = resolveSigilPattern(row.source)
    const targetPattern = resolveSigilPattern(row.target)
    if (!sourcePattern || !targetPattern) continue
    const rel = asString(row.rel)
    const explicitLabel = asString(row.label)
    const label = rel || explicitLabel
    const sourceIds = expandSigilPattern(sourcePattern, candidates)
    const targetIds = expandSigilPattern(targetPattern, candidates)
    if (sourceIds.length === 0 || targetIds.length === 0) continue
    let edgeOrdinal = 0
    for (let s = 0; s < sourceIds.length; s += 1) {
      const source = sourceIds[s]
      for (let t = 0; t < targetIds.length; t += 1) {
        const target = targetIds[t]
        if (!source || !target || source === target) continue
        const uniq = `${source}|${target}|${label}`
        if (seen.has(uniq)) continue
        seen.add(uniq)
        edgeOrdinal += 1
        const nextId = edgeOrdinal === 1 && sourceIds.length === 1 && targetIds.length === 1 ? baseId : `${baseId}#${edgeOrdinal}`
        out.push({
          id: nextId,
          source,
          target,
          label,
          properties: {
            [FRONTMATTER_PRIMITIVE_KEY]: 'edge',
            'frontmatter:sigilId': baseId,
            ...(rel ? ({ 'frontmatter:rel': rel } as unknown as Record<string, JSONValue>) : {}),
          },
        })
      }
    }
  }
  return out
}

export function extractFrontmatterBodyAnnotations(lines: string[], startIndex: number): {
  refs: Array<{ kind: 'node' | 'edge' | 'cluster'; id: string; line: number }>
  nodeIds: string[]
  edgeIds: string[]
  clusterIds: string[]
} {
  const refs: Array<{ kind: 'node' | 'edge' | 'cluster'; id: string; line: number }> = []
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const clusterIds = new Set<string>()
  const rx = /<!--\s*@(node|edge|cluster):([^\s>]+)\s*-->/g
  for (let i = Math.max(0, startIndex); i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (!line.includes('<!-- @')) continue
    rx.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = rx.exec(line)) !== null) {
      const kind = String(m[1] || '').trim().toLowerCase()
      const token = String(m[2] || '').trim()
      if (!token) continue
      const normalized =
        kind === 'node'
          ? normalizeSigilId(`@node:${token}`, 'node')
          : kind === 'edge'
            ? normalizeSigilId(`@edge:${token}`, 'edge')
            : normalizeSigilId(`@cluster:${token}`, 'cluster')
      if (!normalized) continue
      if (kind === 'node') nodeIds.add(normalized)
      else if (kind === 'edge') edgeIds.add(normalized)
      else clusterIds.add(normalized)
      refs.push({
        kind: kind === 'node' ? 'node' : kind === 'edge' ? 'edge' : 'cluster',
        id: normalized,
        line: i + 1,
      })
    }
  }
  return {
    refs,
    nodeIds: Array.from(nodeIds).sort((a, b) => a.localeCompare(b)),
    edgeIds: Array.from(edgeIds).sort((a, b) => a.localeCompare(b)),
    clusterIds: Array.from(clusterIds).sort((a, b) => a.localeCompare(b)),
  }
}

export function extractEdgesFromFrontmatterMermaidWiring(args: {
  lines: string[]
  frontmatterStartLine: number
  frontmatterEndLineExclusive: number
}): { edges: GraphEdge[]; edgeNodeIds: string[] } {
  const aliasToSigil = new Map<string, string>()
  const edgeNodeIds = new Set<string>()
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  const normalizeKindFromSigil = (sigil: string): 'node' | 'edge' | 'cluster' => {
    const s = String(sigil || '').trim()
    if (s.startsWith('@edge:')) return 'edge'
    if (s.startsWith('@cluster:')) return 'cluster'
    return 'node'
  }

  const resolveEndpoint = (raw: string): string => {
    const key = String(raw || '').trim()
    if (!key) return ''
    if (key.startsWith('@')) {
      const kind = normalizeKindFromSigil(key)
      return normalizeSigilId(key, kind)
    }
    const viaAlias = aliasToSigil.get(key)
    if (!viaAlias) return ''
    const kind = normalizeKindFromSigil(viaAlias)
    return normalizeSigilId(viaAlias, kind)
  }

  const addAliasFromSigilLine = (line: string) => {
    const trimmed = String(line || '').trim()
    if (!trimmed || trimmed.startsWith('%%')) return
    const subgraphMatch = /^subgraph\s+([A-Za-z0-9_.-]+).*"(@(?:node|edge|cluster):[^"·\s]+)[^"]*"/.exec(trimmed)
    if (subgraphMatch) {
      const alias = String(subgraphMatch[1] || '').trim()
      const sigilRaw = String(subgraphMatch[2] || '').trim()
      const sigil = normalizeSigilId(sigilRaw, normalizeKindFromSigil(sigilRaw))
      if (alias && sigil) aliasToSigil.set(alias, sigil)
      if (sigil.startsWith('@edge:')) edgeNodeIds.add(sigil)
      return
    }
    const nodeMatch = /^([A-Za-z0-9_.-]+)\s*.*"(@(?:node|edge|cluster):[^"·\s]+)[^"]*"/.exec(trimmed)
    if (!nodeMatch) return
    const alias = String(nodeMatch[1] || '').trim()
    const sigilRaw = String(nodeMatch[2] || '').trim()
    const sigil = normalizeSigilId(sigilRaw, normalizeKindFromSigil(sigilRaw))
    if (alias && sigil) aliasToSigil.set(alias, sigil)
    if (sigil.startsWith('@edge:')) edgeNodeIds.add(sigil)
  }

  for (let i = args.frontmatterStartLine + 1; i < args.frontmatterEndLineExclusive; i += 1) {
    addAliasFromSigilLine(args.lines[i] || '')
  }

  let edgeCounter = 0
  for (let i = args.frontmatterStartLine + 1; i < args.frontmatterEndLineExclusive; i += 1) {
    const raw = String(args.lines[i] || '')
    const line = raw.trim()
    if (!line || line.startsWith('%%')) continue
    if (!line.includes('-->')) continue
    const parts = line
      .split(/(-->\s*(?:\|[^|]*\|)?\s*)/g)
      .map(v => String(v || ''))
    const endpoints = parts
      .filter((_, idx) => idx % 2 === 0)
      .map(v => v.trim())
      .filter(Boolean)
    const labels = parts
      .filter((_, idx) => idx % 2 === 1)
      .map(token => {
        const m = /-->\s*(?:\|([^|]*)\|)?\s*/.exec(token)
        return String(m?.[1] || '').trim()
      })
    const partsCount = Math.min(endpoints.length - 1, labels.length)
    if (partsCount < 1) continue
    for (let j = 0; j < partsCount; j += 1) {
      const src = resolveEndpoint(endpoints[j] || '')
      const tgt = resolveEndpoint(endpoints[j + 1] || '')
      if (!src || !tgt || src === tgt) continue
      const edgeLabel = String(labels[j] || '').trim()
      const uniq = `${src}|${tgt}|${edgeLabel}|line:${i + 1}|idx:${j}`
      if (seen.has(uniq)) continue
      seen.add(uniq)
      const id = `fm-mmd-e${String(++edgeCounter).padStart(3, '0')}-${hashText(uniq)}`
      edges.push({
        id,
        source: src,
        target: tgt,
        label: edgeLabel,
        properties: {
          [FRONTMATTER_PRIMITIVE_KEY]: 'edge',
          'frontmatter:edgeSource': 'mermaid-wiring',
          'frontmatter:line': i + 1,
          ...(edgeLabel ? ({ 'frontmatter:displayLabel': edgeLabel } as unknown as Record<string, JSONValue>) : {}),
        },
      })
      if (src.startsWith('@edge:')) edgeNodeIds.add(src)
      if (tgt.startsWith('@edge:')) edgeNodeIds.add(tgt)
    }
  }

  return {
    edges,
    edgeNodeIds: Array.from(edgeNodeIds).sort((a, b) => a.localeCompare(b)),
  }
}

export function tryParseSigilFrontmatter(lines: string[], startDashLine: number): { meta: Record<string, unknown>; startIndex: number } | null {
  const end = findFrontmatterEndIndex(lines, startDashLine)
  if (end < 0) return null
  const nodes: unknown[] = []
  const edges: Array<Record<string, unknown>> = []
  const connections: Array<Record<string, unknown>> = []
  const clusters: Array<Record<string, unknown>> = []
  let section: '' | 'nodes' | 'edges' | 'clusters' = ''
  let currentEdge: Record<string, unknown> | null = null
  let currentCluster: { id: string; label?: string; color?: string; members: string[]; inMembers: boolean } | null = null
  for (let i = startDashLine + 1; i < end; i += 1) {
    const raw = String(lines[i] || '')
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (/^[A-Za-z0-9_-]+\s*:\s*$/.test(trimmed)) {
      const key = trimmed.slice(0, trimmed.indexOf(':')).trim().toLowerCase()
      if (key === 'nodes' || key === 'edges' || key === 'clusters') {
        if (currentEdge) {
          edges.push(currentEdge)
          currentEdge = null
        }
        if (currentCluster) {
          clusters.push({
            [currentCluster.id]: {
              ...(currentCluster.label ? { label: currentCluster.label } : {}),
              ...(currentCluster.color ? { color: currentCluster.color } : {}),
              ...(currentCluster.members.length > 0 ? { members: currentCluster.members } : {}),
            },
          })
          currentCluster = null
        }
        section = key
      } else {
        section = ''
      }
      continue
    }
    if (section === 'nodes') {
      const m = /^\s*-\s*(@node:[^:]+(?::[^:]+)*)\s*:\s*\{(.*)\}\s*$/.exec(raw)
      if (!m) continue
      const id = normalizeSigilId(m[1], 'node')
      if (!id) continue
      const attrs = parseInlineObject(m[2] || '')
      nodes.push({ [id]: attrs })
      continue
    }
    if (section === 'edges') {
      const edgeLine = parseSigilEdgeLine(raw)
      if (edgeLine) {
        edges.push({
          id: edgeLine.id,
          source: edgeLine.source,
          target: edgeLine.target,
          rel: `${edgeLine.fromPort} → ${edgeLine.toPort}`,
        })
        connections.push({
          id: edgeLine.id,
          from_node: edgeLine.source.slice('@node:'.length),
          from_port: edgeLine.fromPort,
          to_node: edgeLine.target.slice('@node:'.length),
          to_port: edgeLine.toPort,
          label: `${edgeLine.fromPort} → ${edgeLine.toPort}`,
        })
        continue
      }
      const start = /^\s*-\s*id\s*:\s*(.+)$/.exec(raw)
      if (start) {
        if (currentEdge) edges.push(currentEdge)
        currentEdge = { id: parseInlineScalar(start[1] || '') }
        continue
      }
      if (!currentEdge) continue
      const m = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/.exec(raw)
      if (!m) continue
      const key = String(m[1] || '').trim()
      if (!key) continue
      currentEdge[key] = parseInlineScalar(m[2] || '')
      continue
    }
    if (section === 'clusters') {
      const start = /^\s*-\s*(@cluster:[^:]+(?::[^:]+)*)\s*:\s*$/.exec(raw)
      if (start) {
        if (currentCluster) {
          clusters.push({
            [currentCluster.id]: {
              ...(currentCluster.label ? { label: currentCluster.label } : {}),
              ...(currentCluster.color ? { color: currentCluster.color } : {}),
              ...(currentCluster.members.length > 0 ? { members: currentCluster.members } : {}),
            },
          })
        }
        const id = normalizeSigilId(start[1], 'cluster')
        if (!id) {
          currentCluster = null
          continue
        }
        currentCluster = { id, members: [], inMembers: false }
        continue
      }
      if (!currentCluster) continue
      const membersHeader = /^\s*members\s*:\s*$/.exec(trimmed)
      if (membersHeader) {
        currentCluster.inMembers = true
        continue
      }
      if (currentCluster.inMembers) {
        const member = /^\s*-\s*(.+)$/.exec(trimmed)
        if (member) {
          const normalizedMember = normalizeSigilId(parseInlineScalar(member[1] || ''), 'node')
          if (normalizedMember) currentCluster.members.push(normalizedMember)
          continue
        }
      }
      const m = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/.exec(trimmed)
      if (!m) continue
      const key = String(m[1] || '').trim()
      const val = String(parseInlineScalar(m[2] || '') || '').trim()
      if (!key || !val) continue
      if (key === 'label') currentCluster.label = val
      if (key === 'color') currentCluster.color = val
    }
  }
  if (currentEdge) edges.push(currentEdge)
  if (currentCluster) {
    clusters.push({
      [currentCluster.id]: {
        ...(currentCluster.label ? { label: currentCluster.label } : {}),
        ...(currentCluster.color ? { color: currentCluster.color } : {}),
        ...(currentCluster.members.length > 0 ? { members: currentCluster.members } : {}),
      },
    })
  }
  if (nodes.length === 0 && edges.length === 0 && clusters.length === 0) return null
  const meta: Record<string, unknown> = {}
  if (nodes.length > 0) meta.nodes = nodes
  if (edges.length > 0) meta.edges = edges
  if (connections.length > 0) meta.connections = connections
  if (clusters.length > 0) meta.clusters = clusters
  return { meta, startIndex: end + 1 }
}

export function tryParseMergedFrontmatterMetaWithNodes(lines: string[]): { meta: Record<string, unknown>; startIndex: number } | null {
  const dashIdx: number[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() === '---') dashIdx.push(i)
    if (dashIdx.length >= 10) break
  }
  if (dashIdx.length < 4) return null

  let merged: Record<string, unknown> = {}
  for (let seg = 0; seg < dashIdx.length - 1; seg += 1) {
    const a = dashIdx[seg] ?? -1
    const b = dashIdx[seg + 1] ?? -1
    if (a < 0 || b < 0) continue
    if (b <= a + 1) continue
    const segmentLines = ['---', ...lines.slice(a + 1, b), '---']
    const parsed = parseMarkdownFrontmatter(segmentLines).meta
    if (!isRecord(parsed)) continue
    merged = mergeFrontmatterMeta(merged, parsed)
    if (Array.isArray(merged.nodes) && merged.nodes.length > 0) {
      return { meta: merged, startIndex: b + 1 }
    }
  }
  return null
}
