import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { isStrybldrStoryboardGraphData, isStrybldrStoryboardMarkdown } from './strybldrStoryboard'

export function isStrybldrGraphData(graphData: GraphData | null | undefined): boolean {
  return isStrybldrStoryboardGraphData(graphData)
}

export function shouldActivateStrybldrImportSurface(args: {
  graphData?: GraphData | null
  rawText?: string | null
  canvas2dRenderer?: string | null
}): boolean {
  if (String(args.canvas2dRenderer || '') === 'storyboard') return true
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
  store.setCanvas2dRenderer('storyboard')
  if (args.openFloatingPanel !== false) {
    store.setFloatingPanelOpen(true)
    store.setFloatingPanelView('strybldr')
  }
  return true
}
