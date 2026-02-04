import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware'
import { defaultSchema } from '@/lib/graph/schema';
import { createGraphDataSlice } from '@/hooks/store/graphDataSlice';
import { createMinimapSlice } from '@/features/minimap/store';
import { createSelectionSlice } from '@/hooks/store/selectionSlice';
import { createHistorySlice } from '@/hooks/store/historySlice';
import { createUiSlice } from '@/hooks/store/uiSlice';
import { createCanvasSlice } from '@/hooks/store/canvasSlice';
import { createGraphViewSlice } from '@/hooks/store/graphViewSlice';
import { createSchemaSlice, readSchemaFromStorage } from '@/hooks/store/schemaSlice';
import { createUiSettingsSlice } from '@/hooks/store/uiSettingsSlice';
import { createUiToastSlice } from '@/hooks/store/uiToastSlice';
import { createSourceFilesSlice } from '@/hooks/store/sourceFilesSlice';
import { createLocalMarkdownFolderSlice } from '@/hooks/store/localMarkdownFolderSlice'
import { getLocalStorage } from '@/lib/persistence';
import type { GraphState, NodePosition2d } from '@/hooks/store/types';
import type { GraphSchema } from '@/lib/graph/schema'

const positionsMatch = (
  a: Record<string, NodePosition2d> | null | undefined,
  b: Record<string, NodePosition2d> | null | undefined,
): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i += 1) {
    const key = aKeys[i]
    const aPos = a[key]
    const bPos = b[key]
    if (!bPos) return false
    if (aPos.x !== bPos.x || aPos.y !== bPos.y) return false
  }
  return true
}

export type { GraphState } from '@/hooks/store/types';

const applyCanvasDefaultInitSchema = (schema: GraphSchema): GraphSchema => {
  const behavior = schema.behavior || { allowEdgeCreation: true, allowNodeDrag: true }
  const portHandles = behavior.portHandles
    ? { ...behavior.portHandles }
    : { enabled: false, placement: 'cardinal' as const, size: 4, offset: 2, strokeWidth: 1.5 }
  const rawNodeShapeMode = behavior.nodeShapeMode
  const nodeShapeMode: NonNullable<GraphSchema['behavior']>['nodeShapeMode'] =
    rawNodeShapeMode === 'rect' || rawNodeShapeMode === 'diamond' || rawNodeShapeMode === 'hex'
      ? rawNodeShapeMode
      : 'circle'
  const nextBehavior = { ...behavior, nodeShapeMode, portHandles }
  const nextLayout = { ...(schema.layout || {}), mode: 'force' as const }
  return { ...schema, behavior: nextBehavior, layout: nextLayout }
}

const initialSchema: GraphSchema = (() => {
  try {
    const storage = getLocalStorage();
    const fromStorage = readSchemaFromStorage(storage)
    return applyCanvasDefaultInitSchema(fromStorage || defaultSchema);
  } catch {
    return applyCanvasDefaultInitSchema(defaultSchema);
  }
})()

export const useGraphStore = create<GraphState>()(
  subscribeWithSelector((set, get, api) => ({
  schema: initialSchema,
  schemaBySemanticMode: { document: initialSchema, keyword: initialSchema },
  layoutPositionCacheByMode: {},
  graphFieldsOpOk: null,
  graphFieldsOpMsg: '',
  orchestratorOpOk: null,
  orchestratorOpMsg: '',
  renderOpOk: null,
  renderOpMsg: '',
  graphValidationStatus: null,
  graphValidationTimestamp: null,
  setGraphValidationResult: (status, timestamp) => {
    set({
      graphValidationStatus: status,
      graphValidationTimestamp: timestamp,
    })
  },
  setLayoutPositionsForMode: (key: string, positions: Record<string, NodePosition2d> | null) => {
    const prev = get().layoutPositionCacheByMode || {}
    const prevEntry = prev[key] || null
    if (!positions || Object.keys(positions).length === 0) {
      if (!prevEntry) return
      const next: typeof prev = { ...prev }
      delete next[key]
      set({ layoutPositionCacheByMode: next })
      return
    }
    if (positionsMatch(prevEntry, positions)) return
    set({ layoutPositionCacheByMode: { ...prev, [key]: positions } })
  },
  setGraphFieldsOpStatus: (ok, msg) => {
    set({ graphFieldsOpOk: ok, graphFieldsOpMsg: String(msg || '') })
  },
  setOrchestratorOpStatus: (ok, msg) => {
    set({ orchestratorOpOk: ok, orchestratorOpMsg: String(msg || '') })
  },
  setRenderOpStatus: (ok, msg) => {
    set({ renderOpOk: ok, renderOpMsg: String(msg || '') })
  },
  lifecycleStage: 'idle',
  setLifecycleStage: (v) => set({ lifecycleStage: v }),
  resetAll: () => {
    const schema = applyCanvasDefaultInitSchema(defaultSchema)
    set({
      graphData: { nodes: [], edges: [], type: 'application/json' },
      schema,
      schemaBySemanticMode: { document: schema, keyword: schema },
      layoutPositionCacheByMode: {},
      history: [],
      historyIndex: -1,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedGroupId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      collapsedGroupIds: [],
      graphFieldsOpOk: null,
      graphFieldsOpMsg: '',
      orchestratorOpOk: null,
      orchestratorOpMsg: '',
      renderOpOk: null,
      renderOpMsg: '',
      lifecycleStage: 'idle',
      documentSemanticMode: 'document',
      frontmatterModeEnabled: true,
    });
  },
  ...createUiSettingsSlice(set, get),
  ...createGraphDataSlice(set, get),
  ...createMinimapSlice(set, get),
  ...createSelectionSlice(set, get),
  ...createGraphViewSlice(set, get),
  ...createHistorySlice(set, get),
  ...createUiSlice(set),
  ...createUiToastSlice(set),
  ...createSourceFilesSlice(set, get, api),
  ...createLocalMarkdownFolderSlice(set, get, api),
  ...createCanvasSlice(set, get),
  ...createSchemaSlice(set, get),
})),
)

try {
  const w = typeof window !== 'undefined' ? (window as unknown as { localStorage?: Storage; __KG_MARKDOWN_EMPTY_TRACE__?: unknown; __KG_MARKDOWN_EMPTY_TRACE_SUB__?: unknown }) : null
  const enabled = !!(w?.localStorage && w.localStorage.getItem('kg:debug:markdownEmptyTrace') === '1')
  if (w && enabled && !w.__KG_MARKDOWN_EMPTY_TRACE_SUB__) {
    w.__KG_MARKDOWN_EMPTY_TRACE_SUB__ = true
    const buf: Array<{ ts: number; prevName: string; nextName: string; prevLen: number; nextLen: number; stack: string }> = []
    w.__KG_MARKDOWN_EMPTY_TRACE__ = buf
    let prevName = String(useGraphStore.getState().markdownDocumentName || '')
    let prevText = String(useGraphStore.getState().markdownDocumentText || '')
    useGraphStore.subscribe(
      s => [s.markdownDocumentName, s.markdownDocumentText] as const,
      next => {
        const nextName = String(next[0] || '')
        const nextText = String(next[1] || '')
        const prevLen = prevText.trim().length
        const nextLen = nextText.trim().length
        if (prevLen > 0 && nextLen === 0) {
          const stack = String(new Error('markdownDocumentText emptied').stack || '')
          buf.push({ ts: Date.now(), prevName, nextName, prevLen, nextLen, stack })
          if (buf.length > 20) buf.splice(0, buf.length - 20)
        }
        prevName = nextName
        prevText = nextText
      },
    )
  }
} catch {
  void 0
}
