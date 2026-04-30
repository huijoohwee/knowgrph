import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/store/types'
import type { GetGraph, SetGraph } from './graphDataSliceAccess'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { buildSourceLayerKeys } from '@/lib/graph/sourceLayers'

type ParsedComposedId = { layerId: string; innerId: string }

const COMPOSED_NODE_POSITION_KEYS = new Set(['x', 'y', 'vx', 'vy', 'fx', 'fy'])

export function normalizeComposedSourcePath(raw: unknown): string {
  const text = String(raw || '').trim().replace(/\\/g, '/')
  if (!text) return ''
  const withoutWorkspace = text.startsWith('workspace:') ? text.slice('workspace:'.length) : text
  return withoutWorkspace.replace(/^\/+/, '')
}

export function resolvePreferredComposedLayerId(args: { get: GetGraph; explicitLayerId?: string | null }): string | null {
  const explicit = String(args.explicitLayerId || '').trim()
  if (explicit) return explicit
  const state = args.get()
  const sourceFiles = state.sourceFiles || []
  const explorerActivePath = normalizeComposedSourcePath(useMarkdownExplorerStore.getState().activePath)
  const activeDocPath = normalizeComposedSourcePath(state.markdownDocumentName) || explorerActivePath
  if (activeDocPath) {
    const activeFile = sourceFiles.find(f => {
      if (!f?.enabled) return false
      const sourcePath = normalizeComposedSourcePath(f.source?.path || f.name || '')
      return sourcePath === activeDocPath
    })
    if (activeFile?.id) return String(activeFile.id)
  }
  const selectedLayerId = parseComposedId(state.selectedNodeId || '')?.layerId || ''
  if (selectedLayerId) return selectedLayerId
  const fallbackLayerId = sourceFiles.find(f => f.enabled && !!f.parsedGraphData)?.id || null
  return fallbackLayerId ? String(fallbackLayerId) : null
}

export function ensureSourceFileGraphData(file: GraphState['sourceFiles'][number]): GraphData {
  const parsed = file?.parsedGraphData
  if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) return parsed
  return { type: 'Graph', nodes: [], edges: [], metadata: {} }
}

export function isPositionOnlyNodeUpdate(updates: Partial<GraphNode>): boolean {
  const keys = Object.keys(updates || {})
  if (keys.length === 0) return false
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i]
    if (!k) continue
    if (!COMPOSED_NODE_POSITION_KEYS.has(k)) return false
  }
  return true
}

export function mergeNodeForUpdate(current: GraphNode, updates: Partial<GraphNode>): GraphNode {
  const hasX = Object.prototype.hasOwnProperty.call(updates, 'x')
  const hasY = Object.prototype.hasOwnProperty.call(updates, 'y')
  const isPositionCommit = hasX || hasY
  if (!isPositionCommit) return { ...current, ...updates }

  const hasFx = Object.prototype.hasOwnProperty.call(updates, 'fx')
  const hasFy = Object.prototype.hasOwnProperty.call(updates, 'fy')
  const hasVx = Object.prototype.hasOwnProperty.call(updates, 'vx')
  const hasVy = Object.prototype.hasOwnProperty.call(updates, 'vy')
  const clearPins = !hasFx && !hasFy
  const clearVelocity = !hasVx && !hasVy

  if (!clearPins && !clearVelocity) return { ...current, ...updates }

  const any = current as unknown as Record<string, unknown>
  const rest: Record<string, unknown> = { ...any }
  if (clearPins) {
    delete rest.fx
    delete rest.fy
  }
  if (clearVelocity) {
    delete rest.vx
    delete rest.vy
  }
  return { ...(rest as unknown as GraphNode), ...updates }
}

let composedPendingPositionWrites: Record<string, Record<string, Partial<GraphNode>>> = {}
let composedPendingPositionWriteGraphKey = ''

function readComposedPositionWriteGraphKey(graphData: GraphData | null): string {
  if (!graphData || !isComposedGraphData(graphData)) return ''
  const meta = (graphData.metadata || {}) as Record<string, unknown>
  const content = typeof meta.sourceLayerHash === 'string' ? meta.sourceLayerHash : ''
  const order = typeof meta.sourceLayerOrderHash === 'string' ? meta.sourceLayerOrderHash : ''
  return `${content}|${order}`
}

export function isPureComposedNodePositionUpdate(updates: Partial<GraphNode>): boolean {
  const keys = Object.keys(updates || {})
  if (keys.length === 0) return false
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i]
    if (!k) continue
    if (!COMPOSED_NODE_POSITION_KEYS.has(k)) return false
  }
  return true
}

export function flushComposedPositionWritesNow(args: { set: SetGraph; get: GetGraph }): void {
  const stateForKey = args.get()
  const currentKey = readComposedPositionWriteGraphKey(stateForKey.graphData)
  if (composedPendingPositionWriteGraphKey && currentKey && composedPendingPositionWriteGraphKey !== currentKey) {
    composedPendingPositionWrites = {}
    composedPendingPositionWriteGraphKey = ''
    return
  }
  const pending = composedPendingPositionWrites
  composedPendingPositionWrites = {}
  composedPendingPositionWriteGraphKey = ''
  const sourceFiles = args.get().sourceFiles || []
  if (sourceFiles.length === 0) return

  let changed = false
  const nextSourceFiles = sourceFiles.map(f => {
    const byInnerId = pending[String(f.id || '')]
    if (!byInnerId) return f
    const pg = f.parsedGraphData
    if (!pg || !Array.isArray(pg.nodes)) return f

    let touched = false
    const nextNodes = pg.nodes.map(n => {
      const u = byInnerId[String(n.id || '')]
      if (!u) return n
      touched = true
      return mergeNodeForUpdate(n as unknown as GraphNode, u)
    })
    if (!touched) return f
    changed = true
    return {
      ...f,
      parsedGraphData: { ...pg, nodes: nextNodes },
      parsedGraphRevision: (f.parsedGraphRevision || 0) + 1,
    }
  })

  if (!changed) return
  const state = args.get()
  const currentGraphData = state.graphData
  if (currentGraphData && isComposedGraphData(currentGraphData)) {
    try {
      const layers = buildLayersFromSourceFiles(nextSourceFiles)
      const { contentKey, orderKey } = buildSourceLayerKeys(layers)
      const currentMeta = (currentGraphData.metadata && typeof currentGraphData.metadata === 'object'
        ? (currentGraphData.metadata as Record<string, unknown>)
        : {}) as Record<string, unknown>
      const prevContentKey = typeof currentMeta.sourceLayerHash === 'string' ? currentMeta.sourceLayerHash : ''
      const prevOrderKey = typeof currentMeta.sourceLayerOrderHash === 'string' ? currentMeta.sourceLayerOrderHash : ''
      if (prevContentKey === contentKey && prevOrderKey === orderKey) {
        args.set({ sourceFiles: nextSourceFiles })
        return
      }
      args.set({
        sourceFiles: nextSourceFiles,
        graphData: {
          ...currentGraphData,
          metadata: {
            ...(currentGraphData.metadata && typeof currentGraphData.metadata === 'object' ? currentGraphData.metadata : {}),
            sourceLayerHash: contentKey,
            sourceLayerOrderHash: orderKey,
          } as unknown as GraphData['metadata'],
        },
      })
      return
    } catch {
      void 0
    }
  }
  args.set({ sourceFiles: nextSourceFiles })
}

export function resetComposedPositionWrites(): void {
  composedPendingPositionWrites = {}
  composedPendingPositionWriteGraphKey = ''
}

export function queueComposedPositionWrite(args: {
  graphData: GraphData
  layerId: string
  innerId: string
  updates: Partial<GraphNode>
}): void {
  const keyNow = readComposedPositionWriteGraphKey(args.graphData)
  if (!composedPendingPositionWriteGraphKey) {
    composedPendingPositionWriteGraphKey = keyNow
  } else if (keyNow && composedPendingPositionWriteGraphKey !== keyNow) {
    composedPendingPositionWrites = {}
    composedPendingPositionWriteGraphKey = keyNow
  }
  const byLayer = composedPendingPositionWrites[args.layerId] || (composedPendingPositionWrites[args.layerId] = {})
  byLayer[args.innerId] = { ...(byLayer[args.innerId] || {}), ...args.updates }
}

export function parseComposedId(id: string | null | undefined): ParsedComposedId | null {
  const text = String(id || '')
  const idx = text.indexOf('::')
  if (idx <= 0) return null
  const layerId = text.slice(0, idx).trim()
  const innerId = text.slice(idx + 2)
  if (!layerId || !innerId) return null
  return { layerId, innerId }
}

export function isComposedGraphData(graphData: GraphData | null): boolean {
  const meta = (graphData?.metadata || {}) as Record<string, unknown>
  return String(meta.sourceLayerComposition || '') === 'compose'
}


export function buildLayersFromSourceFiles(sourceFiles: GraphState['sourceFiles']) {
  return (sourceFiles || []).map(f => ({
    id: f.id,
    name: f.name,
    enabled: Boolean(f.enabled),
    status: f.status,
    source: f.source,
    text: f.text,
    parsedTextHash: f.parsedTextHash,
    parsedGraphRevision: f.parsedGraphRevision,
    parsedGraphData: f.parsedGraphData,
  }))
}
