import { hashSchemaForPreviewSync } from '@/features/canvas/canvasSyncHashes'
import type { CanvasTabSyncSelectionSnapshot } from '@/features/canvas/canvasTabSyncShared'

export const canPublishCanvasTabSync = (applyingRemote: boolean): boolean => {
  if (applyingRemote) return false
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false
  if (typeof document !== 'undefined' && typeof document.hasFocus === 'function' && !document.hasFocus()) return false
  return true
}

export const buildCanvasTabSelectionTaskKey = (graphId: string | null | undefined, tabId: string | null | undefined): string =>
  `tab-sync:selection:${String(graphId || '')}:${String(tabId || '')}`

export const buildCanvasTabSelectionPublishPlan = (args: {
  selectedNodeId: string | null | undefined
  selectedEdgeId: string | null | undefined
  lastSelection: CanvasTabSyncSelectionSnapshot
}): { signature: string; nextLastSelection: { n: string | null; e: string | null } } | null => {
  const selectedNodeId = args.selectedNodeId || null
  const selectedEdgeId = args.selectedEdgeId || null
  const signature = `${selectedNodeId || ''}:${selectedEdgeId || ''}`
  const last = args.lastSelection
  if (last && last.n === selectedNodeId && last.e === selectedEdgeId) return null
  return {
    signature,
    nextLastSelection: { n: selectedNodeId, e: selectedEdgeId },
  }
}

export const buildCanvasTabSchemaTaskKey = (graphId: string | null | undefined, tabId: string | null | undefined): string =>
  `tab-sync:schema:${String(graphId || '')}:${String(tabId || '')}`

export const buildCanvasTabSchemaPublishPlan = (args: {
  schema: unknown
  lastSchemaHash: string | null
}): { signature: string | null; nextLastSchemaHash: string | null } | null => {
  const hash = hashSchemaForPreviewSync(args.schema)
  if (args.lastSchemaHash === hash) return null
  return {
    signature: hash || null,
    nextLastSchemaHash: hash || null,
  }
}
