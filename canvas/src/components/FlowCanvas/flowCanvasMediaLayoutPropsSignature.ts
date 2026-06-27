import type { GraphData } from '@/lib/graph/types'
import { hashSignatureParts } from '@/lib/hash/signature'

const readMeasureKey = (value: unknown): string => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? String(Math.round(number)) : ''
}

export function readMediaLayoutNodePropsSignature(ids: string[], graphData: GraphData | null): string {
  if (ids.length === 0) return ''
  const wanted = new Set(ids)
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const parts: string[] = []
  for (const node of nodes) {
    const id = String(node?.id || '').trim()
    if (!id || !wanted.has(id)) continue
    const properties = node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
      ? node.properties as Record<string, unknown>
      : {}
    parts.push([
      id,
      readMeasureKey(properties['visual:width']),
      readMeasureKey(properties['visual:height']),
      String(properties.outputLoadingKind || '').trim(),
      typeof properties.output === 'string' && properties.output.trim() ? 'text' : '',
      typeof properties.imageUrl === 'string' && properties.imageUrl.trim() ? 'image' : '',
      typeof properties.videoUrl === 'string' && properties.videoUrl.trim() ? 'video' : '',
      typeof properties.audioUrl === 'string' && properties.audioUrl.trim() ? 'audio' : '',
      typeof properties.outputPath === 'string' && properties.outputPath.trim() ? properties.outputPath.trim() : '',
      String(properties.richMediaActiveTab || '').trim(),
    ].join(':'))
  }
  parts.sort((left, right) => left.localeCompare(right))
  return hashSignatureParts(['flow-canvas-media-layout-props', ids.length, ...parts])
}
