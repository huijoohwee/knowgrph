import React from 'react'
import { hashText } from '@/features/parsers/hash'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { writeSubgraphs, type UserSubgraph } from '@/lib/graph/subgraphs'
import { useShallow } from 'zustand/react/shallow'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import {
  FLOWCHART_FIXTURE_ENDPOINT,
  buildFlowchartSourceMeta,
  buildFlowchartApiUrl,
  type FlowchartSourceMeta,
  UNKNOWN_FLOWCHART_SOURCE_META,
} from '@/lib/flowchart/source'
import { isPlainObject } from '@/lib/graph/value'

type ApiGraphNode = {
  id: string
  type: 'problem' | 'solution' | string
  label: string
  cluster?: string
  hub?: string
  gap_score?: number
  pmf_score?: number
  gap_velocity?: number
  source_count?: number
  specificity?: string
  color?: string
  x?: number
  y?: number
}

type ApiGraphEdge = {
  source?: string
  target?: string
  problem_id?: string
  solution_id?: string
  hub_id?: string
  member_id?: string
  type?: string
  force_strength?: number
  distance_px?: number
  strength?: number
}

type ApiGraphPayload = {
  nodes?: ApiGraphNode[]
  edges?: ApiGraphEdge[]
  member_nodes?: Array<Record<string, unknown>>
  hub_nodes?: Array<Record<string, unknown>>
  cross_edges?: Array<Record<string, unknown>>
  spoke_edges?: Array<Record<string, unknown>>
  meta?:
    | ({
        total_problems?: number
        total_solutions?: number
        last_updated?: string
        cluster_gap_ratios?: Record<string, number>
      } & Record<string, unknown>)
    | undefined
  clusters?: Array<Record<string, unknown>>
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const round2 = (v: number) => Math.round(v * 100) / 100

type FlowchartRenderSettings = {
  nodeSizeMetric: 'gap_score' | 'pmf_score' | 'gap_velocity' | 'source_count' | 'none'
  nodeGlowMetric: 'pmf_score' | 'gap_score' | 'none'
  nodePulseMetric: 'gap_velocity' | 'pmf_score' | 'none'
  nodeBorderMetric: 'source_count' | 'gap_score' | 'none'
  edgeOpacityMetric: 'strength' | 'none'
  showSpecificityBadges: boolean
  showGapScoreInLabel: boolean
  showClusterGapRatio: boolean
}

const DEFAULT_FLOWCHART_RENDER_SETTINGS: FlowchartRenderSettings = {
  nodeSizeMetric: 'gap_score',
  nodeGlowMetric: 'pmf_score',
  nodePulseMetric: 'gap_velocity',
  nodeBorderMetric: 'source_count',
  edgeOpacityMetric: 'strength',
  showSpecificityBadges: true,
  showGapScoreInLabel: true,
  showClusterGapRatio: true,
}

const createEmptyApiGraphPayload = (): ApiGraphPayload => ({
  nodes: [],
  edges: [],
  meta: {
    total_problems: 0,
    total_solutions: 0,
  },
})

const asString = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))

const asFiniteNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

const readPlainObject = (value: unknown): Record<string, unknown> | null => {
  return isPlainObject(value) ? (value as Record<string, unknown>) : null
}

const normalizeFlowchartSide = (value: unknown): 'problem' | 'solution' | null => {
  const raw = asString(value).trim().toLowerCase()
  if (!raw) return null
  if (
    raw === 'problem' ||
    raw === 'left' ||
    raw === 'source' ||
    raw === 'origin' ||
    raw === 'from' ||
    raw === 'a' ||
    raw === 'input'
  ) {
    return 'problem'
  }
  if (
    raw === 'solution' ||
    raw === 'right' ||
    raw === 'target' ||
    raw === 'destination' ||
    raw === 'to' ||
    raw === 'b' ||
    raw === 'output'
  ) {
    return 'solution'
  }
  return null
}

const normalizeFlowchartNodeType = (value: unknown): 'problem' | 'solution' | 'hub' | null => {
  const raw = asString(value).trim().toLowerCase()
  if (!raw) return null
  if (raw === 'hub') return 'hub'
  return normalizeFlowchartSide(raw)
}

function readApiGraphPayload(value: unknown): ApiGraphPayload | null {
  const obj = readPlainObject(value)
  if (!obj) return null
  const compositeMemberNodes = Array.isArray(obj.member_nodes) ? (obj.member_nodes as unknown[]).filter(Boolean) : []
  const compositeHubNodes = Array.isArray(obj.hub_nodes) ? (obj.hub_nodes as unknown[]).filter(Boolean) : []
  const compositeCrossEdges = Array.isArray(obj.cross_edges) ? (obj.cross_edges as unknown[]).filter(Boolean) : []
  const compositeSpokeEdges = Array.isArray(obj.spoke_edges) ? (obj.spoke_edges as unknown[]).filter(Boolean) : []
  const nodesRaw = Array.isArray(obj.nodes) ? obj.nodes : (compositeMemberNodes.length > 0 || compositeHubNodes.length > 0 ? [...compositeMemberNodes, ...compositeHubNodes] : null)
  const edgesRaw = Array.isArray(obj.edges) ? obj.edges : (compositeCrossEdges.length > 0 || compositeSpokeEdges.length > 0 ? [...compositeCrossEdges, ...compositeSpokeEdges] : null)
  const nodes = Array.isArray(nodesRaw) ? (nodesRaw as unknown[]).filter(Boolean) : null
  const edges = Array.isArray(edgesRaw) ? (edgesRaw as unknown[]).filter(Boolean) : null
  if (!nodes || !edges) return null
  const meta = readPlainObject(obj.meta)
  const clustersRaw = Array.isArray(obj.clusters) ? (obj.clusters as Array<Record<string, unknown>>) : []
  const clusterById = new Map<
    string,
    {
      name?: string
      color?: string
      side?: 'problem' | 'solution'
      ratio?: number
    }
  >()
  for (let i = 0; i < clustersRaw.length; i += 1) {
    const c = readPlainObject(clustersRaw[i])
    if (!c) continue
    const id = asString(c.id).trim()
    if (!id) continue
    const name = asString(c.name).trim()
    const color = asString(c.color).trim()
    const side = normalizeFlowchartSide(c.side) || undefined
    const ratio = asFiniteNumber(c.gap_ratio)
    clusterById.set(id, {
      ...(name ? { name } : {}),
      ...(color ? { color } : {}),
      ...(side ? { side } : {}),
      ...(ratio != null ? { ratio } : {}),
    })
  }
  return {
    nodes: nodes.map(n => {
      const o = readPlainObject(n)
      const id = o ? asString(o.id).trim() : ''
      const label = o ? asString(o.label).trim() : ''
      const clusterRaw = o ? asString(o.cluster).trim() : ''
      const clusterResolved = clusterRaw && clusterById.has(clusterRaw) ? (clusterById.get(clusterRaw)?.name || clusterRaw) : clusterRaw
      const clusterColor = clusterRaw && clusterById.has(clusterRaw) ? (clusterById.get(clusterRaw)?.color || '') : ''
      const gapScore = o ? asFiniteNumber(o.gap_score) : null
      const pmfScore = o ? asFiniteNumber(o.pmf_score) : null
      const gapVelocity = o ? asFiniteNumber(o.gap_velocity) : null
      const sourceCount = o ? asFiniteNumber(o.source_count) : null
      const specificity = o ? asString(o.specificity).trim() : ''
      const color = o ? asString(o.color).trim() : ''
      const x = o ? asFiniteNumber(o.x) : null
      const y = o ? asFiniteNumber(o.y) : null
      const hub = o ? asString((o as Record<string, unknown>).hub ?? (o as Record<string, unknown>).hub_id).trim() : ''
      const typeRaw = o ? asString(o.type).trim() : ''
      const sideFromCluster = clusterRaw && clusterById.has(clusterRaw) ? (clusterById.get(clusterRaw)?.side || '') : ''
      const sideFromNode = o
        ? normalizeFlowchartSide(o.side ?? o.partition ?? o.lane) || ''
        : ''
      const type = normalizeFlowchartNodeType(typeRaw || sideFromNode || sideFromCluster) || typeRaw || sideFromNode || sideFromCluster || ''
      return {
        id,
        type,
        label,
        cluster: clusterResolved || undefined,
        gap_score: gapScore ?? undefined,
        pmf_score: pmfScore ?? undefined,
        gap_velocity: gapVelocity ?? undefined,
        source_count: sourceCount ?? undefined,
        specificity: specificity || undefined,
        color: color || clusterColor || undefined,
        hub: hub || undefined,
        x: x ?? undefined,
        y: y ?? undefined,
      }
    }),
    edges: edges.map(e => {
      const o = readPlainObject(e)
      const source = o ? asString(o.source).trim() : ''
      const target = o ? asString(o.target).trim() : ''
      const problemId = o ? asString(o.problem_id).trim() : ''
      const solutionId = o ? asString(o.solution_id).trim() : ''
      const hubId = o ? asString(o.hub_id).trim() : ''
      const memberId = o ? asString(o.member_id).trim() : ''
      const type = o ? asString(o.type).trim() : ''
      const forceStrength = o ? asFiniteNumber(o.force_strength) : null
      const distancePx = o ? asFiniteNumber(o.distance_px) : null
      const strength = o ? asFiniteNumber(o.strength) : null
      return {
        source: source || undefined,
        target: target || undefined,
        problem_id: problemId || undefined,
        solution_id: solutionId || undefined,
        hub_id: hubId || undefined,
        member_id: memberId || undefined,
        type: type || undefined,
        force_strength: forceStrength ?? undefined,
        distance_px: distancePx ?? undefined,
        strength: strength ?? undefined,
      }
    }),
    meta: meta
      ? {
          total_problems: asFiniteNumber(meta.total_problems) ?? undefined,
          total_solutions: asFiniteNumber(meta.total_solutions) ?? undefined,
          last_updated: typeof meta.last_updated === 'string' ? meta.last_updated : undefined,
          ...meta,
        }
      : undefined,
    ...(clustersRaw.length > 0 ? { clusters: clustersRaw } : {}),
    ...(compositeMemberNodes.length > 0 ? { member_nodes: compositeMemberNodes as Array<Record<string, unknown>> } : {}),
    ...(compositeHubNodes.length > 0 ? { hub_nodes: compositeHubNodes as Array<Record<string, unknown>> } : {}),
    ...(compositeCrossEdges.length > 0 ? { cross_edges: compositeCrossEdges as Array<Record<string, unknown>> } : {}),
    ...(compositeSpokeEdges.length > 0 ? { spoke_edges: compositeSpokeEdges as Array<Record<string, unknown>> } : {}),
  }
}

export function parseFlowchartApiGraphPayload(value: unknown): ApiGraphPayload | null {
  return readApiGraphPayload(value)
}

function buildApiGraphSignature(payload: ApiGraphPayload): string {
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : []
  const edges = Array.isArray(payload.edges) ? payload.edges : []
  const updated = payload.meta && typeof payload.meta.last_updated === 'string' ? payload.meta.last_updated : ''
  const meta = readPlainObject(payload.meta)
  const takeSample = (values: string[], maxItems: number): string[] => {
    if (values.length <= maxItems) return values
    const headCount = Math.max(1, Math.floor(maxItems / 2))
    const tailCount = Math.max(1, maxItems - headCount)
    return [...values.slice(0, headCount), ...values.slice(values.length - tailCount)]
  }
  const nodeKeys = nodes
    .map(n => {
      const id = String(n?.id || '').trim()
      if (!id) return ''
      const strength = typeof n?.gap_score === 'number' && Number.isFinite(n.gap_score) ? n.gap_score.toFixed(4) : ''
      const pmf = typeof n?.pmf_score === 'number' && Number.isFinite(n.pmf_score) ? n.pmf_score.toFixed(4) : ''
      const velocity = typeof n?.gap_velocity === 'number' && Number.isFinite(n.gap_velocity) ? n.gap_velocity.toFixed(4) : ''
      const count = typeof n?.source_count === 'number' && Number.isFinite(n.source_count) ? String(Math.round(n.source_count)) : ''
      const label = String(n?.label || '').trim()
      const cluster = String(n?.cluster || '').trim()
      const type = String(n?.type || '').trim().toLowerCase()
      const specificity = String(n?.specificity || '').trim().toLowerCase()
      const color = String(n?.color || '').trim().toLowerCase()
      return `${id}|${type}|${cluster}|${label}|${specificity}|${color}|${strength}|${pmf}|${velocity}|${count}`
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
  const edgeKeys = edges
    .map(e => {
      const s = String(e?.source || e?.problem_id || e?.hub_id || '').trim()
      const t = String(e?.target || e?.solution_id || e?.member_id || '').trim()
      if (!s || !t) return ''
      const type = String(e?.type || '').trim().toLowerCase()
      const st = typeof e?.strength === 'number' && Number.isFinite(e.strength) ? e.strength.toFixed(4) : ''
      const force = typeof e?.force_strength === 'number' && Number.isFinite(e.force_strength) ? e.force_strength.toFixed(4) : ''
      const dist = typeof e?.distance_px === 'number' && Number.isFinite(e.distance_px) ? e.distance_px.toFixed(2) : ''
      return `${s}|${t}|${type}|${st}|${force}|${dist}`
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
  const sampledNodes = takeSample(nodeKeys, 1200)
  const sampledEdges = takeSample(edgeKeys, 1600)
  const clusterGapRatiosRaw = readPlainObject(meta?.cluster_gap_ratios)
  const clusterGapRatios = clusterGapRatiosRaw
    ? Object.entries(clusterGapRatiosRaw)
        .map(([key, value]) => `${String(key)}:${String(value)}`)
        .sort((a, b) => a.localeCompare(b))
        .join(',')
    : ''
  const core = [
    updated,
    `n${nodeKeys.length}`,
    `e${edgeKeys.length}`,
    sampledNodes.join(','),
    sampledEdges.join(','),
    clusterGapRatios,
  ].join('|')
  return hashText(core)
}

function normalizeApiGraphToFlowchartGraphData(
  payload: ApiGraphPayload,
  settings: FlowchartRenderSettings,
  sourceMeta: FlowchartSourceMeta,
): GraphData {
  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : []
  const rawEdges = Array.isArray(payload.edges) ? payload.edges : []
  const nodeById = new Map<string, ApiGraphNode>()
  for (let i = 0; i < rawNodes.length; i += 1) {
    const n = rawNodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    if (!nodeById.has(id)) nodeById.set(id, n)
  }

  const problemClusterCounts = new Map<string, number>()
  const solutionClusterCounts = new Map<string, number>()
  const clusterSideByName = new Map<string, 'problem' | 'solution'>()
  for (const n of nodeById.values()) {
    const type = normalizeFlowchartNodeType(n.type) || String(n.type || '').toLowerCase()
    const cluster = String(n.cluster || '').trim()
    if (!cluster) continue
    if (type === 'problem') clusterSideByName.set(cluster, 'problem')
    if (type === 'solution') clusterSideByName.set(cluster, 'solution')
    const map = type === 'problem' ? problemClusterCounts : type === 'solution' ? solutionClusterCounts : null
    if (!map) continue
    map.set(cluster, (map.get(cluster) || 0) + 1)
  }

  const meta = readPlainObject(payload.meta)

  const clusterGapRatiosFromMeta = (() => {
    const raw = readPlainObject(meta?.cluster_gap_ratios)
    if (!raw) return null
    const out = new Map<string, number>()
    Object.entries(raw).forEach(([k, v]) => {
      const ratioRecord = readPlainObject(v)
      const n =
        asFiniteNumber(v) ??
        (ratioRecord ? asFiniteNumber(ratioRecord.ratio) : null)
      if (n == null) return
      out.set(String(k), clamp(n, 0, 1))
    })
    return out
  })()

  if (clusterGapRatiosFromMeta) {
    const raw = readPlainObject(meta?.cluster_gap_ratios)
    if (raw) {
      Object.entries(raw).forEach(([k, v]) => {
        const record = readPlainObject(v)
        if (!record) return
        const side = normalizeFlowchartSide(record.side)
        if (side) clusterSideByName.set(String(k), side)
      })
    }
  }

  const hasHubNodes = Array.from(nodeById.values()).some(n => normalizeFlowchartNodeType(n.type) === 'hub')

  const sortClusters = (m: Map<string, number>, mode: 'gapThenCount' | 'countThenName') => {
    const gapOf = (cluster: string): number | null => {
      if (!clusterGapRatiosFromMeta) return null
      if (!clusterGapRatiosFromMeta.has(cluster)) return null
      return clusterGapRatiosFromMeta.get(cluster) ?? null
    }
    return Array.from(m.entries())
      .sort((a, b) => {
        if (mode === 'gapThenCount') {
          const ga = gapOf(a[0])
          const gb = gapOf(b[0])
          if (ga != null || gb != null) {
            const aa = ga ?? -1
            const bb = gb ?? -1
            if (bb !== aa) return bb - aa
          }
        }
        if (b[1] !== a[1]) return b[1] - a[1]
        return a[0].localeCompare(b[0])
      })
      .map(([k]) => k)
  }

  const problemClusters = sortClusters(problemClusterCounts, 'gapThenCount')
  const solutionClusters = sortClusters(solutionClusterCounts, 'countThenName')
  const yLaneByProblemCluster = new Map<string, number>(problemClusters.map((c, idx) => [c, idx]))
  const yLaneBySolutionCluster = new Map<string, number>(solutionClusters.map((c, idx) => [c, idx]))

  const nodes: GraphNode[] = []

  const metricUnit = (metric: string): number => {
    if (metric === 'gap_score') return 5
    if (metric === 'pmf_score') return 6
    if (metric === 'gap_velocity') return 1
    if (metric === 'source_count') return 10
    return 1
  }

  const readNodeMetric = (n: ApiGraphNode, metric: string): number => {
    if (metric === 'gap_score') return typeof n.gap_score === 'number' && Number.isFinite(n.gap_score) ? n.gap_score : 0
    if (metric === 'pmf_score') return typeof n.pmf_score === 'number' && Number.isFinite(n.pmf_score) ? n.pmf_score : 0
    if (metric === 'gap_velocity') return typeof n.gap_velocity === 'number' && Number.isFinite(n.gap_velocity) ? n.gap_velocity : 0
    if (metric === 'source_count') return typeof n.source_count === 'number' && Number.isFinite(n.source_count) ? n.source_count : 0
    return 0
  }

  const metricT = (value: number, metric: string): number => {
    const denom = metricUnit(metric)
    if (!(denom > 0)) return 0
    return clamp(value / denom, 0, 1)
  }

  const iconForSpecificity = (v: string): string => {
    const s = String(v || '').trim().toLowerCase()
    if (s === 'named_tool' || s === 'tool') return '🔧'
    if (s === 'domain') return '🏷'
    if (s === 'vague') return '💬'
    return ''
  }

  nodeById.forEach(n => {
    const typeRaw = String(n.type || '').trim()
    const typeCanonical = normalizeFlowchartNodeType(typeRaw)
    const typeLower = (typeCanonical || typeRaw).toLowerCase()
    const isProblem = typeLower === 'problem'
    const isSolution = typeLower === 'solution'
    const isHub = typeLower === 'hub'
    const type = isProblem ? 'problem' : isSolution ? 'solution' : isHub ? 'hub' : (typeRaw || 'node')
    const label = String(n.label || '').trim() || String(n.id || '').trim()
    const cluster = String(n.cluster || '').trim()
    const gapScore = typeof n.gap_score === 'number' && Number.isFinite(n.gap_score) ? n.gap_score : 0
    const pmfScore = typeof n.pmf_score === 'number' && Number.isFinite(n.pmf_score) ? n.pmf_score : 0
    const gapVelocity = typeof n.gap_velocity === 'number' && Number.isFinite(n.gap_velocity) ? n.gap_velocity : 0
    const sourceCount = typeof n.source_count === 'number' && Number.isFinite(n.source_count) ? n.source_count : 0
    const specificity = typeof n.specificity === 'string' ? n.specificity.trim() : ''
    const fill = typeof n.color === 'string' && n.color.trim() ? n.color.trim() : ''

    const sizeMetric = settings.nodeSizeMetric
    const sizeT = sizeMetric !== 'none' ? metricT(readNodeMetric(n, sizeMetric), sizeMetric) : null
    const radius = sizeT == null ? null : clamp(9 + sizeT * (isProblem ? 16 : 12), 7, 40)

    const baseW = isProblem ? 260 : isSolution ? 220 : 220
    const baseH = isProblem ? 96 : isSolution ? 84 : 84
    const width = Math.round(
      radius != null ? clamp(radius * (isProblem ? 12 : 10), 140, 420) : clamp(baseW * (isProblem ? clamp(1 + gapScore * 0.08, 0.9, 1.45) : 1), 140, 420),
    )
    const height = Math.round(radius != null ? clamp(radius * (isProblem ? 4 : 3.5), 56, 220) : clamp(baseH * (isProblem ? 1 : 0.95), 56, 220))

    const glowMetric = settings.nodeGlowMetric
    const glowT = glowMetric !== 'none' ? metricT(readNodeMetric(n, glowMetric), glowMetric) : 0
    const pulseMetric = settings.nodePulseMetric
    const pulseT = pulseMetric !== 'none' ? metricT(readNodeMetric(n, pulseMetric), pulseMetric) : 0
    const borderMetric = settings.nodeBorderMetric
    const borderT = borderMetric !== 'none' ? metricT(readNodeMetric(n, borderMetric), borderMetric) : null
    const strokeWidth = borderT == null ? null : round2(clamp(1.5 + borderT * 4.5, 0.5, 8))

    const labelPrefix = settings.showSpecificityBadges ? iconForSpecificity(specificity) : ''
    const labelGap = settings.showGapScoreInLabel && isProblem ? ` • ${round2(gapScore).toFixed(2)}` : ''
    const labelBase = label
    const nextLabel = `${labelPrefix ? `${labelPrefix} ` : ''}${labelBase}${labelGap}`

    const side = cluster ? (clusterSideByName.get(cluster) || null) : null
    const lane = isProblem || (isHub && side === 'problem')
      ? (cluster ? (yLaneByProblemCluster.get(cluster) ?? problemClusters.length) : 0)
      : isSolution || (isHub && side === 'solution')
        ? (cluster ? (yLaneBySolutionCluster.get(cluster) ?? solutionClusters.length) : 0)
        : 0

    const hubRef = String(n.hub || '').trim()
    const jitterSeed = Math.abs(String(n.id || '')
      .split('')
      .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), 0))
    const jitterAngle = ((jitterSeed % 360) * Math.PI) / 180
    const orbitX = Math.cos(jitterAngle) * 0.72
    const orbitY = Math.sin(jitterAngle) * 0.54
    const xIndex = isHub ? (side === 'solution' ? 6 : 2) : isSolution ? 8 : 0
    const xIndexWithOrbit = hasHubNodes && hubRef && !isHub ? xIndex + orbitX : xIndex
    const yIndex = hasHubNodes && hubRef && !isHub ? lane + orbitY : lane

    const props: Record<string, JSONValue> = {
      cluster: cluster || null,
      gap_score: gapScore,
      pmf_score: pmfScore,
      gap_velocity: gapVelocity,
      source_count: sourceCount,
      specificity: specificity || null,
      ...(fill ? { color: fill } : {}),
      'visual:shape': 'circle',
      'visual:width': width,
      'visual:height': height,
      'visual:xIndex': xIndexWithOrbit,
      'visual:yIndex': yIndex,
      ...(radius != null ? { 'visual:radius': round2(radius) } : {}),
      ...(glowT > 0 ? { 'visual:glowIntensity': round2(glowT) } : {}),
      ...(pulseT > 0 ? { 'visual:pulseSpeed': round2(pulseT) } : {}),
      ...(strokeWidth != null ? { 'visual:strokeWidth': strokeWidth } : {}),
      ...(fill ? { 'visual:fill': fill } : {}),
      'flowchart:source': sourceMeta.id,
      'flowchart:sourceKind': sourceMeta.kind,
      ...(isHub ? { 'flowchart:hub': true } : {}),
      ...(side ? { 'flowchart:side': side } : {}),
    }

    const sideCenterX = side === 'solution' ? 760 : -760
    const sideOuterX = side === 'solution' ? 980 : -980
    const laneY = lane * 360
    const jitterR = 86 + (jitterSeed % 38)
    const memberSeedX = sideCenterX + Math.cos(jitterAngle) * jitterR
    const memberSeedY = laneY + Math.sin(jitterAngle) * jitterR * 0.74

    const sideFixedX = isHub ? sideCenterX : hasHubNodes ? null : isProblem ? -980 : isSolution ? 980 : null
    const seedX = typeof n.x === 'number' && Number.isFinite(n.x)
      ? n.x
      : isHub
        ? sideCenterX
        : hasHubNodes && (isProblem || isSolution)
          ? (hubRef ? memberSeedX : sideOuterX)
          : sideFixedX
    const seedY = typeof n.y === 'number' && Number.isFinite(n.y)
      ? n.y
      : isHub
        ? laneY
        : hasHubNodes && (isProblem || isSolution)
          ? memberSeedY
          : null

    nodes.push({
      id: String(n.id || ''),
      label: nextLabel,
      type,
      ...(seedX != null ? { x: seedX } : {}),
      ...(seedY != null ? { y: seedY } : {}),
      ...(sideFixedX != null ? { fx: sideFixedX } : {}),
      ...(isHub ? { fy: laneY } : {}),
      properties: props,
    })
  })

  const assignClusterPackedY = (side: 'problem' | 'solution') => {
    const byCluster = new Map<string, GraphNode[]>()
    for (const n of nodes) {
      if (String(n.type || '') !== side) continue
      const props = (n.properties || {}) as Record<string, unknown>
      const cluster = String(props.cluster || '').trim()
      if (!cluster) continue
      const list = byCluster.get(cluster) || []
      list.push(n)
      byCluster.set(cluster, list)
    }

    for (const [cluster, list] of byCluster.entries()) {
      list.sort((a, b) => {
        const ap = (a.properties || {}) as Record<string, unknown>
        const bp = (b.properties || {}) as Record<string, unknown>
        if (side === 'problem') {
          const ag = typeof ap.gap_score === 'number' && Number.isFinite(ap.gap_score) ? (ap.gap_score as number) : 0
          const bg = typeof bp.gap_score === 'number' && Number.isFinite(bp.gap_score) ? (bp.gap_score as number) : 0
          if (bg !== ag) return bg - ag
        }
        const asc = typeof ap.source_count === 'number' && Number.isFinite(ap.source_count) ? (ap.source_count as number) : 0
        const bsc = typeof bp.source_count === 'number' && Number.isFinite(bp.source_count) ? (bp.source_count as number) : 0
        if (side === 'solution' && bsc !== asc) return bsc - asc
        return String(a.label || '').localeCompare(String(b.label || ''))
      })

      const lane = side === 'problem'
        ? (yLaneByProblemCluster.get(cluster) ?? 0)
        : (yLaneBySolutionCluster.get(cluster) ?? 0)
      const baseY = lane * 1.1
      const center = (list.length - 1) / 2
      for (let i = 0; i < list.length; i += 1) {
        const node = list[i]!
        const props = (node.properties || {}) as Record<string, JSONValue>
        const y = baseY + (i - center) * 0.18
        props['visual:yIndex'] = y
        node.properties = props
        if (!(typeof node.x === 'number' && Number.isFinite(node.x))) node.x = side === 'problem' ? -980 : 980
        if (node.fx == null) node.fx = side === 'problem' ? -980 : 980
        if (!(typeof node.y === 'number' && Number.isFinite(node.y))) node.y = y * 360
      }
    }
  }

  if (!hasHubNodes) {
    assignClusterPackedY('problem')
    assignClusterPackedY('solution')
  }

  const nodeIds = new Set<string>(nodes.map(n => n.id))
  const edgeCandidates = rawEdges
    .map(e => {
      const source = String(e?.source || e?.problem_id || '').trim()
      const target = String(e?.target || e?.solution_id || '').trim()
      const spokeSource = String(e?.hub_id || '').trim()
      const spokeTarget = String(e?.member_id || '').trim()
      const from = source || spokeSource
      const to = target || spokeTarget
      const isSpoke = !!(spokeSource && spokeTarget)
      const edgeLabel = isSpoke ? 'spokeTo' : 'linksTo'
      const edgeType = String(e?.type || '').trim().toLowerCase()
      const forceStrength = typeof e?.force_strength === 'number' && Number.isFinite(e.force_strength) ? clamp(e.force_strength, 0, 1) : null
      const distancePx = typeof e?.distance_px === 'number' && Number.isFinite(e.distance_px) ? Math.max(24, e.distance_px) : null
      if (!from || !to) return null
      if (!nodeIds.has(from) || !nodeIds.has(to)) return null
      const strength = typeof e?.strength === 'number' && Number.isFinite(e.strength) ? clamp(e.strength, 0, 1) : null
      const strengthKey = strength != null ? String(strength) : ''
      const key = `${from}|${to}|${edgeLabel}|${edgeType}|${strengthKey}`
      return { source: from, target: to, strength, key, label: edgeLabel, edgeType, forceStrength, distancePx, isSpoke }
    })
    .filter(Boolean) as Array<{ source: string; target: string; strength: number | null; key: string; label: string; edgeType: string; forceStrength: number | null; distancePx: number | null; isSpoke: boolean }>
  edgeCandidates.sort((a, b) => a.key.localeCompare(b.key))
  const edgeCounts = new Map<string, number>()
  const edges: GraphEdge[] = []
  for (let i = 0; i < edgeCandidates.length; i += 1) {
    const e = edgeCandidates[i]!
    const nextCount = (edgeCounts.get(e.key) || 0) + 1
    edgeCounts.set(e.key, nextCount)
    const id = `apiEdge:${hashText(`${e.key}|${nextCount}`)}`
    const visualOpacity = (() => {
      if (settings.edgeOpacityMetric !== 'strength') return null
      if (e.isSpoke) return 0.38
      if (e.strength == null) return null
      const t = clamp(e.strength, 0, 1)
      return round2(0.45 + 0.5 * t)
    })()
    const visualWidth = (() => {
      if (e.isSpoke) return 1.4
      const t = e.strength == null ? 0.5 : clamp(e.strength, 0, 1)
      return round2(1.6 + 2.8 * t)
    })()
    edges.push({
      id,
      source: e.source,
      target: e.target,
      label: e.label,
      properties: {
        ...(e.strength != null ? { strength: e.strength } : {}),
        ...(e.forceStrength != null ? { force_strength: e.forceStrength } : {}),
        ...(e.distancePx != null ? { distance_px: e.distancePx } : {}),
        ...(e.edgeType ? { edge_type: e.edgeType } : {}),
        ...(visualOpacity != null ? { 'visual:opacity': visualOpacity } : {}),
        'visual:width': visualWidth,
        'flowchart:edgeRole': e.isSpoke ? 'spoke' : 'cross',
        'flowchart:source': sourceMeta.id,
        'flowchart:sourceKind': sourceMeta.kind,
        ...(e.isSpoke ? { 'visual:dash': '3,6' } : {}),
      } as Record<string, JSONValue>,
    })
  }

  const updated = typeof meta?.last_updated === 'string' ? (meta.last_updated as string) : null
  const totalProblems = asFiniteNumber(meta?.total_problems) ?? null
  const totalSolutions = asFiniteNumber(meta?.total_solutions) ?? null

  const problemOutgoingCountByCluster = (() => {
    const byId = new Map<string, string>()
    for (const n of nodeById.values()) {
      const type = normalizeFlowchartNodeType(n.type) || String(n.type || '').toLowerCase()
      if (type !== 'problem') continue
      const cluster = String(n.cluster || '').trim()
      if (!cluster) continue
      const id = String(n.id || '').trim()
      if (!id) continue
      byId.set(id, cluster)
    }
    const outCount = new Map<string, number>()
    const outSeen = new Set<string>()
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]!
      const src = String(e.source || '').trim()
      const cluster = byId.get(src)
      if (!cluster) continue
      const key = `${cluster}|${src}`
      if (outSeen.has(key)) continue
      outSeen.add(key)
      outCount.set(cluster, (outCount.get(cluster) || 0) + 1)
    }
    return outCount
  })()

  const problemTotalByCluster = (() => {
    const out = new Map<string, number>()
    for (const n of nodeById.values()) {
      const type = normalizeFlowchartNodeType(n.type) || String(n.type || '').toLowerCase()
      if (type !== 'problem') continue
      const cluster = String(n.cluster || '').trim()
      if (!cluster) continue
      out.set(cluster, (out.get(cluster) || 0) + 1)
    }
    return out
  })()

  const clusterGapRatio = (cluster: string): number | null => {
    if (clusterGapRatiosFromMeta && clusterGapRatiosFromMeta.has(cluster)) return clusterGapRatiosFromMeta.get(cluster) ?? null
    const total = problemTotalByCluster.get(cluster) || 0
    if (!total) return null
    const withAny = problemOutgoingCountByCluster.get(cluster) || 0
    const gap = clamp((total - withAny) / total, 0, 1)
    return gap
  }

  const subgraphs: UserSubgraph[] = []
  const ROOT_SUPERGROUP_ID = 'flowchart:root'
  const SIDE_SUPERGROUP_ID = {
    problem: 'flowchart:side:problem',
    solution: 'flowchart:side:solution',
  } as const

  const pushSubgraph = (sg: UserSubgraph) => {
    if (!sg || !sg.id) return
    subgraphs.push({
      id: String(sg.id),
      label: String(sg.label || sg.id),
      memberNodeIds: Array.from(new Set((sg.memberNodeIds || []).map(x => String(x || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
      parentId: sg.parentId == null ? null : String(sg.parentId || '').trim() || null,
      kind: sg.kind === 'cluster' ? 'cluster' : 'subgraph',
    })
  }

  const pushClusterSubgraph = (args: { side: 'problem' | 'solution'; cluster: string; memberIds: string[] }) => {
    const c = String(args.cluster || '').trim()
    if (!c) return
    const memberNodeIds = args.memberIds.map(x => String(x || '').trim()).filter(Boolean)
    if (memberNodeIds.length === 0) return
    const r = args.side === 'problem' ? clusterGapRatio(c) : null
    const label = settings.showClusterGapRatio && args.side === 'problem' && r != null ? `${c} • ${Math.round(r * 100)}% gap` : c
    pushSubgraph({
      id: `flowchart:${args.side}:${c}`,
      label,
      memberNodeIds,
      parentId: SIDE_SUPERGROUP_ID[args.side],
      kind: 'cluster',
    })
  }

  const problemNodeIds = nodes
    .filter(n => String(n.type || '') === 'problem' || (String((n.properties || {})['flowchart:side'] || '') === 'problem' && String(n.type || '') === 'hub'))
    .map(n => String(n.id))
  const solutionNodeIds = nodes
    .filter(n => String(n.type || '') === 'solution' || (String((n.properties || {})['flowchart:side'] || '') === 'solution' && String(n.type || '') === 'hub'))
    .map(n => String(n.id))

  pushSubgraph({
    id: ROOT_SUPERGROUP_ID,
    label: 'Flowchart',
    memberNodeIds: [...problemNodeIds, ...solutionNodeIds],
    parentId: null,
    kind: 'subgraph',
  })
  pushSubgraph({
    id: SIDE_SUPERGROUP_ID.problem,
    label: 'Problems',
    memberNodeIds: problemNodeIds,
    parentId: ROOT_SUPERGROUP_ID,
    kind: 'subgraph',
  })
  pushSubgraph({
    id: SIDE_SUPERGROUP_ID.solution,
    label: 'Solutions',
    memberNodeIds: solutionNodeIds,
    parentId: ROOT_SUPERGROUP_ID,
    kind: 'subgraph',
  })

  if (problemClusters.length > 0) {
    for (const c of problemClusters) {
      const memberIds = nodes
        .filter(
          n =>
            String((n.properties || {}).cluster || '') === c &&
            (String(n.type || '') === 'problem' ||
              (String(n.type || '') === 'hub' && String((n.properties || {})['flowchart:side'] || '') === 'problem')),
        )
        .map(n => String(n.id))
      pushClusterSubgraph({ side: 'problem', cluster: c, memberIds })
    }
  }
  if (solutionClusters.length > 0) {
    for (const c of solutionClusters) {
      const memberIds = nodes
        .filter(
          n =>
            String((n.properties || {}).cluster || '') === c &&
            (String(n.type || '') === 'solution' ||
              (String(n.type || '') === 'hub' && String((n.properties || {})['flowchart:side'] || '') === 'solution')),
        )
        .map(n => String(n.id))
      pushClusterSubgraph({ side: 'solution', cluster: c, memberIds })
    }
  }

  const baseGraph: GraphData = {
    type: 'apiGraph',
    context: sourceMeta.id,
    metadata: {
      source: sourceMeta.id,
      sourceKind: sourceMeta.kind,
      ...(updated ? { last_updated: updated } : {}),
      ...(totalProblems != null ? { total_problems: totalProblems } : {}),
      ...(totalSolutions != null ? { total_solutions: totalSolutions } : {}),
      graphKind: 'flowchart',
    } as Record<string, JSONValue>,
    nodes,
    edges,
  }

  return subgraphs.length > 0 ? writeSubgraphs(baseGraph, subgraphs) : baseGraph
}

export function normalizeFlowchartApiGraphData(args: {
  payload: ApiGraphPayload
  settings?: Partial<FlowchartRenderSettings>
  sourceMeta?: FlowchartSourceMeta
}): GraphData {
  const settings: FlowchartRenderSettings = {
    ...DEFAULT_FLOWCHART_RENDER_SETTINGS,
    ...(args.settings || {}),
  }
  return normalizeApiGraphToFlowchartGraphData(args.payload, settings, args.sourceMeta || UNKNOWN_FLOWCHART_SOURCE_META)
}

async function fetchApiGraphPayload(apiRunId: string): Promise<ApiGraphPayload> {
  const url = buildFlowchartApiUrl({ apiRunId })
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('application/json')) {
    const preview = await res
      .text()
      .then(text => text.slice(0, 64).toLowerCase())
      .catch(() => '')
    const isHtml = preview.startsWith('<!doctype') || preview.startsWith('<html')
    throw new Error(isHtml ? 'Invalid flowchart payload: received HTML' : 'Invalid flowchart payload: expected JSON')
  }
  const json = (await res.json()) as unknown
  const parsed = readApiGraphPayload(json)
  if (!parsed) throw new Error('Invalid flowchart payload')
  return parsed
}

async function fetchFlowchartFixturePayload(): Promise<ApiGraphPayload> {
  const res = await fetch(FLOWCHART_FIXTURE_ENDPOINT, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as unknown
  const parsed = readApiGraphPayload(json)
  if (!parsed) throw new Error('Invalid fixture payload')
  return parsed
}

const isApiGraphUnavailableError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err || '')
  return (
    message.includes('HTTP 404') ||
    message.includes('Invalid flowchart payload: received HTML') ||
    message.includes('Invalid flowchart payload: expected JSON')
  )
}

const withTimeout = async <T>(factory: () => Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: number | null = null
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error('API graph request timeout')), timeoutMs)
    })
    return await Promise.race([factory(), timeoutPromise])
  } finally {
    if (timeoutId != null) window.clearTimeout(timeoutId)
  }
}

export function useApiGraphFlowchartGraphData(enabled: boolean): { graphData: GraphData | null } {
  const [payload, setPayload] = React.useState<ApiGraphPayload | null>(null)
  const lastSigRef = React.useRef<string>('')
  const inFlightRef = React.useRef(false)
  const mountedRef = React.useRef(true)
  const apiGraphUnavailableRef = React.useRef(false)

  const { dataSource, apiRunId, pollIntervalSec, markdownDocumentName, markdownDocumentText } = useGraphStore(
    useShallow(s => ({
      dataSource: s.flowchartDataSource,
      apiRunId: s.flowchartApiRunId,
      pollIntervalSec: s.flowchartPollIntervalSec,
      markdownDocumentName: s.markdownDocumentName || null,
      markdownDocumentText: s.markdownDocumentText || null,
    })),
  )

  const settings = useGraphStore(
    useShallow(s => ({
      nodeSizeMetric: s.flowchartNodeSizeMetric,
      nodeGlowMetric: s.flowchartNodeGlowMetric,
      nodePulseMetric: s.flowchartNodePulseMetric,
      nodeBorderMetric: s.flowchartNodeBorderMetric,
      edgeOpacityMetric: s.flowchartEdgeOpacityMetric,
      showSpecificityBadges: s.flowchartShowSpecificityBadges === true,
      showGapScoreInLabel: s.flowchartShowGapScoreInLabel === true,
      showClusterGapRatio: s.flowchartShowClusterGapRatio === true,
    })),
  )

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const debouncedWorkspaceText = useDebouncedValue(markdownDocumentText, 220, markdownDocumentName)
  const workspacePayload = React.useMemo((): ApiGraphPayload | null => {
    if (!enabled) return null
    const text = String(debouncedWorkspaceText || '')
    const trimmed = text.trim()
    if (!trimmed) return null
    const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
    if (!looksJson) return null
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return readApiGraphPayload(parsed)
    } catch {
      return null
    }
  }, [debouncedWorkspaceText, enabled])

  const effectiveWorkspaceSource = React.useMemo(() => {
    if (!workspacePayload) return false
    const source = String(dataSource || 'api')
    if (source === 'workspace') return true
    return source === 'api'
  }, [dataSource, workspacePayload])

  const sourceMeta = React.useMemo(() => {
    if (effectiveWorkspaceSource) {
      return buildFlowchartSourceMeta({
        kind: 'workspace',
        documentName: markdownDocumentName,
      })
    }
    const isFixtureSource = String(dataSource || 'api') === 'fixture' || (!!payload && apiGraphUnavailableRef.current)
    if (isFixtureSource) {
      return buildFlowchartSourceMeta({ kind: 'fixture' })
    }
    return buildFlowchartSourceMeta({
      kind: 'api',
      apiRunId,
    })
  }, [apiRunId, dataSource, effectiveWorkspaceSource, markdownDocumentName, payload])

  const graphData = React.useMemo(() => {
    if (!enabled) return null
    const effectivePayload = effectiveWorkspaceSource ? workspacePayload : payload
    if (!effectivePayload) return null
    try {
      return normalizeFlowchartApiGraphData({ payload: effectivePayload, settings, sourceMeta })
    } catch {
      return null
    }
  }, [effectiveWorkspaceSource, enabled, payload, settings, sourceMeta, workspacePayload])

  React.useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (effectiveWorkspaceSource) return

    let cancelled = false
    let intervalId: number | null = null

    const runOnce = async () => {
      if (cancelled || !mountedRef.current) return
      if (inFlightRef.current) return
      inFlightRef.current = true

      try {
        const loadFixturePayload = async (): Promise<ApiGraphPayload> =>
          withTimeout(() => fetchFlowchartFixturePayload(), 12_000).catch(() => createEmptyApiGraphPayload())
        const loadApiPayload = async (): Promise<ApiGraphPayload> => withTimeout(() => fetchApiGraphPayload(apiRunId), 12_000)
        const payload = await (async () => {
          if (dataSource === 'fixture') {
            return await loadFixturePayload()
          }
          if (apiGraphUnavailableRef.current) return await loadFixturePayload()
          return await loadApiPayload()
            .then(next => {
              apiGraphUnavailableRef.current = false
              return next
            })
            .catch(async err => {
              if (!isApiGraphUnavailableError(err)) throw err
              apiGraphUnavailableRef.current = true
              return await loadFixturePayload()
            })
        })()
        const sig = buildApiGraphSignature(payload)
        if (sig && sig === lastSigRef.current) return
        lastSigRef.current = sig
        if (cancelled || !mountedRef.current) return
        setPayload(payload)
      } catch (err) {
        if (cancelled || !mountedRef.current) return
        if (isApiGraphUnavailableError(err)) return
        console.error(err)
      } finally {
        inFlightRef.current = false
      }
    }

    void runOnce()
    intervalId = window.setInterval(() => {
      void runOnce()
    }, Math.max(3_000, Math.min(3_600_000, Math.floor((pollIntervalSec || 60) * 1000))))

    return () => {
      cancelled = true
      inFlightRef.current = false
      if (intervalId != null) window.clearInterval(intervalId)
    }
  }, [apiRunId, dataSource, effectiveWorkspaceSource, enabled, pollIntervalSec])

  return { graphData }
}
