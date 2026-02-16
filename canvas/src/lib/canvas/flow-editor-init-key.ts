import type { GraphData } from '@/lib/graph/types'
import { hashStringToHex } from '@/lib/hash/stringHash'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function readGraphSignature(graphData: GraphData | null): string {
  const g = graphData as unknown as { metadata?: unknown; nodes?: unknown; edges?: unknown } | null
  const meta = isRecord(g?.metadata) ? (g!.metadata as Record<string, unknown>) : {}
  const kind = typeof meta.kind === 'string' ? meta.kind : ''
  const source = typeof meta.source === 'string' ? meta.source : ''

  const nodes = Array.isArray(g?.nodes) ? (g!.nodes as Array<{ id?: unknown; type?: unknown }>) : []
  const edges = Array.isArray((g as unknown as { edges?: unknown } | null)?.edges)
    ? (((g as unknown as { edges?: unknown }).edges as unknown) as Array<{ source?: unknown; target?: unknown }>)
    : []

  const nodeSig = nodes
    .slice(0, 240)
    .map(n => `${String(n?.id ?? '')}:${String(n?.type ?? '')}`)
    .sort()
    .join('|')
  const edgeSig = edges
    .slice(0, 240)
    .map(e => `${String(e?.source ?? '')}>${String(e?.target ?? '')}`)
    .sort()
    .join('|')

  return `${kind}:${source}:n=${nodes.length}:${nodeSig}:e=${edges.length}:${edgeSig}`
}

export function buildFlowEditorCameraInitKey(args: { datasetKey: string; graphData: GraphData | null }): string {
  const raw = String(args.datasetKey || '').trim()
  if (raw && !raw.startsWith('rev:')) return `flowEditor:${raw}`
  const sig = readGraphSignature(args.graphData)
  return `flowEditor:hash:${hashStringToHex(sig)}`
}

