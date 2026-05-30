import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { isStrybldrStoryboardMarkdown } from './strybldrStoryboard'

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function isStrybldrGraphData(graphData: GraphData | null | undefined): boolean {
  const metadata = readRecord(graphData?.metadata)
  if (String(metadata?.kind || '') === 'strybldr-storyboard') return true
  if (String(metadata?.parserId || '') === 'strybldr-storyboard') return true
  if (String(metadata?.kgCanvas2dRenderer || '') === 'strybldr') return true
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  return nodes.some(node => String(node?.properties?.strybldrRunId || node?.properties?.strybldrSourceUnitId || '').trim().length > 0)
}

export function shouldActivateStrybldrImportSurface(args: {
  graphData?: GraphData | null
  rawText?: string | null
  canvas2dRenderer?: string | null
}): boolean {
  if (String(args.canvas2dRenderer || '') === 'strybldr') return true
  if (isStrybldrGraphData(args.graphData)) return true
  return isStrybldrStoryboardMarkdown(String(args.rawText || ''))
}

export function activateStrybldrImportSurface(args: {
  graphData?: GraphData | null
  rawText?: string | null
  canvas2dRenderer?: string | null
  openFloatingPanel?: boolean
}): boolean {
  if (!shouldActivateStrybldrImportSurface(args)) return false
  const store = useGraphStore.getState()
  store.setCanvasRenderMode('2d')
  store.setCanvas2dRenderer('strybldr')
  if (args.openFloatingPanel !== false) {
    store.setFloatingPanelOpen(true)
    store.setFloatingPanelView('strybldr')
  }
  return true
}
