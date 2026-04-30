import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (relativePath: string): string => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

export function testUiSlicesReuseSharedStartupStorageSnapshot() {
  const uiSliceText = readUtf8('src/hooks/store/uiSlice.ts')
  const uiSettingsSliceText = readUtf8('src/hooks/store/uiSettingsSlice.ts')

  if (!uiSliceText.includes('const storage = getLocalStorage()')) {
    throw new Error('expected uiSlice startup hydration to capture localStorage once and reuse it across initial persisted reads')
  }
  if (!uiSliceText.includes('readBoolFromStorage(storage, key, fallback)')) {
    throw new Error('expected uiSlice startup hydration to reuse shared bool readers against one storage snapshot')
  }
  if (!uiSliceText.includes('readJsonFromStorage(storage, key, fallback, parse)')) {
    throw new Error('expected uiSlice startup hydration to reuse shared json readers against one storage snapshot')
  }

  if (!uiSettingsSliceText.includes('const storage = getLocalStorage()')) {
    throw new Error('expected uiSettingsSlice startup hydration to capture localStorage once and reuse it across initial persisted reads')
  }
  if (!uiSettingsSliceText.includes('const themeMode = getInitialThemeMode(storage)')) {
    throw new Error('expected uiSettingsSlice theme hydration to reuse the same storage snapshot as the rest of startup settings')
  }
  if (!uiSettingsSliceText.includes('readBoolFromStorage(storage, key, fallback)')) {
    throw new Error('expected uiSettingsSlice startup hydration to reuse shared bool readers against one storage snapshot')
  }
}

export function testGraphDataPersistenceUsesCoalescedLocalStorageWrites() {
  const text = readUtf8('src/hooks/store/graphDataPersistence.ts')

  if (!text.includes('const GRAPH_DATA_LS_PERSIST_DELAY_MS = 160')) {
    throw new Error('expected graph data localStorage persistence to define one shared coalescing delay')
  }
  if (!text.includes('lsSetJsonCoalesced(LS_KEYS.graphData, graphData, { delayMs: GRAPH_DATA_LS_PERSIST_DELAY_MS })')) {
    throw new Error('expected graph data localStorage persistence to use the shared coalesced json writer')
  }
  if (text.includes('lsSetJson(LS_KEYS.graphData, graphData)')) {
    throw new Error('expected graph data localStorage persistence to avoid direct full-snapshot localStorage writes on every mutation')
  }
}

export function testSchemaAndHistoryUseSharedDedupeAtPersistenceFunnels() {
  const schemaText = readUtf8('src/hooks/store/schemaSlice.ts')
  const historyText = readUtf8('src/hooks/store/historySlice.ts')
  const schemaTabText = readUtf8('src/features/schema-editor/useSchemaTab.ts')

  if (!schemaText.includes('const SCHEMA_LS_PERSIST_DELAY_MS = 180')) {
    throw new Error('expected schema persistence to define one shared coalescing delay')
  }
  if (!schemaText.includes('lsSetJsonCoalesced(LS_KEYS.graphSchema, canonical, { delayMs: SCHEMA_LS_PERSIST_DELAY_MS })')) {
    throw new Error('expected schema persistence to use the shared coalesced json writer with canonicalized schema payloads')
  }
  if (!schemaText.includes('const getSchemaStorageSignature = (schema: GraphSchema | null): string =>')) {
    throw new Error('expected schema persistence to compute a shared semantic signature before writing')
  }
  if (!schemaText.includes('canonicalizeSchemaForPersistence(schema)')) {
    throw new Error('expected schema persistence to canonicalize schema semantics before storage writes')
  }
  if (!schemaTabText.includes('return stringifyCanonicalSchema(schema)')) {
    throw new Error('expected schema editor dirty-state detection to use the shared canonical schema serializer')
  }
  if (!historyText.includes('const getHistorySnapshotSignature = (')) {
    throw new Error('expected history slice to compute one shared semantic signature for snapshot commits')
  }
  if (!historyText.includes('const shouldSkipHistoryCommit = (history: HistoryEntry[], nextSignature: string): boolean =>')) {
    throw new Error('expected history slice to skip redundant snapshot commits through one shared helper')
  }
}

export function testLargePayloadPersistenceUsesShardsInsteadOfWholeMapRewrites() {
  const perDocumentText = readUtf8('src/lib/persistence/perDocumentUiState.ts')
  const graphViewText = readUtf8('src/hooks/store/graphViewSlice.ts')
  const graphFieldSettingsText = readUtf8('src/hooks/store/graphFieldSettingsPersistence.ts')
  const panelLayoutSliceText = readUtf8('src/hooks/store/panelLayoutUiSlice.ts')

  if (!perDocumentText.includes("const getPerDocumentUiStateOrderKey = (): string => `${LS_KEYS.perDocumentUiStateMap}:order`")) {
    throw new Error('expected per-document UI persistence to separate the LRU order key from per-document state shards')
  }
  if (!perDocumentText.includes('const getPerDocumentUiStateEntryKey = (documentKey: string)')) {
    throw new Error('expected per-document UI persistence to derive one storage key per document shard')
  }
  if (!perDocumentText.includes('storage.removeItem(LS_KEYS.perDocumentUiStateMap)')) {
    throw new Error('expected per-document UI persistence to remove the legacy whole-map payload after sharded writes')
  }

  if (!graphViewText.includes('const getFlowWidgetGraphIndexStorageKey = (baseKey: string)')) {
    throw new Error('expected flow widget persistence to track graph shards through a dedicated graph-key index')
  }
  if (!graphViewText.includes('const writeShardedFlowWidgetGraphState = <T extends Record<string, unknown>>(')) {
    throw new Error('expected flow widget persistence to write only the touched graph shard instead of rewriting the whole cross-graph map')
  }
  if (graphViewText.includes('lsSetJson(LS_KEYS.flowWidgetPinnedByGraphMetaKey, pending.pinnedByGraph)')) {
    throw new Error('expected flow widget pinned-state persistence to stop rewriting the full cross-graph payload')
  }
  if (graphViewText.includes('lsSetJson(LS_KEYS.flowWidgetPosByGraphMetaKey, pending.posByGraph)')) {
    throw new Error('expected flow widget position persistence to stop rewriting the full cross-graph payload')
  }
  if (graphViewText.includes('lsSetJson(LS_KEYS.flowWidgetWorldPosByGraphMetaKey, pending.worldByGraph)')) {
    throw new Error('expected flow widget world-position persistence to stop rewriting the full cross-graph payload')
  }

  if (!graphFieldSettingsText.includes("const getGraphFieldSettingsIndexKey = (): string => `${LS_KEYS.graphFieldSettingsById}:index`")) {
    throw new Error('expected graph field settings persistence to separate the field index key from per-field shards')
  }
  if (!graphFieldSettingsText.includes('const getGraphFieldSettingsEntryKey = (fieldId: GraphFieldId)')) {
    throw new Error('expected graph field settings persistence to derive one storage key per field shard')
  }
  if (!panelLayoutSliceText.includes('patchGraphFieldSetting: (fieldId: GraphFieldId, patch: Partial<GraphFieldSettings>) =>')) {
    throw new Error('expected panel layout slice to expose a patch-based graph field settings API instead of requiring whole-map writes')
  }
  if (!panelLayoutSliceText.includes('removeGraphFieldSetting: (fieldId: GraphFieldId) =>')) {
    throw new Error('expected panel layout slice to expose a remove-based graph field settings API instead of whole-map deletes')
  }
}
