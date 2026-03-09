import type { GetGraph } from '@/hooks/store/graphDataSlice'
import type { GraphData } from '@/lib/graph/types'
import { parseLayoutMode } from './graphDataSliceParsers'
import { computeDerivedFields, parseGraphFieldId } from '@/features/graph-fields/graphFields'
import {
  buildDefaultVisibleColumns,
  isGraphDataTablePropertyColumnKey,
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
} from '@/features/graph-data-table/graphDataTable'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'
import { validateNodeQuickEditorRegistryEntry } from '@/hooks/store/flowEditorManagerSlice'
import { hashStringToHex } from '@/lib/hash/stringHash'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function arraysEqual(a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function recordsShallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (let i = 0; i < ak.length; i += 1) {
    const k = ak[i]!
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false
    if (a[k] !== b[k]) return false
  }
  return true
}

function computeRegistrySignature(entries: Array<{ id: string; updatedAt: string }>): string {
  const pairs = entries
    .map(e => `${String(e.id || '').trim()}@${String(e.updatedAt || '').trim()}`)
    .filter(Boolean)
    .sort()
  return `${pairs.length}:${pairs.join('|')}`
}

const HASH_CACHE = new WeakMap<object, string>()

export function withGraphDataRevision(graphData: GraphData, nextRevision: number): GraphData {
  const base = graphData as unknown as { metadata?: unknown }
  const metaRaw = base.metadata
  const meta = isRecord(metaRaw) ? metaRaw : {}
  const nextMeta: Record<string, unknown> = {
    ...meta,
    graphDataRevision: nextRevision,
    hash: `rev:${nextRevision}`,
  }
  return { ...(graphData as unknown as Record<string, unknown>), metadata: nextMeta } as unknown as GraphData
}

export function hashGraphDataForPreviewSync(graphData: unknown): string {
  try {
    if (!graphData || typeof graphData !== 'object') return ''
    const cached = HASH_CACHE.get(graphData as object)
    if (cached) return cached
    const gd = graphData as unknown as { metadata?: unknown }
    const metaRaw = gd.metadata
    if (!isRecord(metaRaw)) {
      const out = hashStringToHex(JSON.stringify(graphData))
      HASH_CACHE.set(graphData as object, out)
      return out
    }
    const meta = metaRaw as Record<string, unknown>
    const nextMeta: Record<string, unknown> = { ...meta }
    delete nextMeta.hash
    delete nextMeta.graphDataRevision
    const sanitized = { ...(graphData as unknown as Record<string, unknown>), metadata: nextMeta }
    const out = hashStringToHex(JSON.stringify(sanitized))
    HASH_CACHE.set(graphData as object, out)
    return out
  } catch {
    return ''
  }
}

export function applyLayoutAutosuggestFromMetadata(get: GetGraph, metadata: unknown) {
  if (!isRecord(metadata)) return
  const rawMode =
    metadata['canvas:layoutMode'] ??
    metadata['canvas:layout.mode'] ??
    metadata['layoutMode'] ??
    (isRecord(metadata['canvas:layout']) ? metadata['canvas:layout'].mode : undefined)

  const modeSuggestion = parseLayoutMode(rawMode)
  if (!modeSuggestion) return

  const schema = get().schema
  const curLayout = schema.layout || {}
  if ((curLayout.mode || 'force') !== 'force') return
  if (modeSuggestion === 'force') return

  const nextLayout: NonNullable<typeof schema.layout> = { ...curLayout, mode: modeSuggestion }
  get().setSchema({ ...schema, layout: nextLayout })
  if ((nextLayout.mode || schema.layout?.mode) === 'radial') {
    const setCanvasRenderMode = get().setCanvasRenderMode
    if (typeof setCanvasRenderMode === 'function') setCanvasRenderMode('2d')

    const setCanvas2dRenderer = get().setCanvas2dRenderer
    if (typeof setCanvas2dRenderer === 'function') setCanvas2dRenderer('d3')
  }
}

export function applyNodeQuickEditorRegistryFromMetadata(get: GetGraph, metadata: unknown) {
  if (!isRecord(metadata)) return
  const raw = metadata[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  const rawArr = Array.isArray(raw) ? raw : []

  const validated = rawArr
    .map(item => validateNodeQuickEditorRegistryEntry(item))
    .filter((e): e is NonNullable<typeof e> => !!e)

  const current = Array.isArray(get().documentNodeQuickEditorRegistry) ? get().documentNodeQuickEditorRegistry : []
  const currentSig = computeRegistrySignature(current)
  const nextSig = computeRegistrySignature(validated)
  if (currentSig === nextSig) return

  const setRegistry = get().setDocumentNodeQuickEditorRegistry
  if (typeof setRegistry !== 'function') return
  setRegistry(validated)
}

export function syncGraphFieldsWithGraphData(
  get: GetGraph,
  graphData: GraphData,
  options?: { resetVisibleColumns?: boolean },
) {
  const derived = computeDerivedFields(graphData)
  const derivedFieldIds = new Set<string>(derived.map(f => f.id))
  const derivedPropColumnKeys = new Set<string>(derived.map(f => `prop:${f.scope}:${f.key}`))

  const currentSettings = get().graphFieldSettingsById || {}
  const customPropColumnKeys = new Set<string>()
  for (const [k, v] of Object.entries(currentSettings)) {
    if (!v || v.isCustom !== true) continue
    const parsed = parseGraphFieldId(k)
    if (parsed) customPropColumnKeys.add(`prop:${parsed.scope}:${parsed.key}`)
  }

  const activePropColumnKeys = new Set<string>([...derivedPropColumnKeys, ...customPropColumnKeys])

  const currentOrder = get().graphDataTableColumnOrder || []
  const baseAndActiveOrder = currentOrder.filter(
    k => !isGraphDataTablePropertyColumnKey(k) || activePropColumnKeys.has(k),
  )
  const missingPropKeys: GraphDataTableColumnKey[] = []
  for (const key of activePropColumnKeys) {
    const colKey = key as GraphDataTableColumnKey
    if (!baseAndActiveOrder.includes(colKey)) {
      missingPropKeys.push(colKey)
    }
  }
  const nextOrder = [...baseAndActiveOrder, ...missingPropKeys]
  if (!arraysEqual(currentOrder, nextOrder)) get().setGraphDataTableColumnOrder(nextOrder)

  const currentVisible = (get().graphDataTableVisibleColumns || {}) as Record<
    string,
    boolean | undefined
  >
  const nextVisible: Record<string, boolean | undefined> = options?.resetVisibleColumns
    ? { ...buildDefaultVisibleColumns() }
    : { ...currentVisible }
  for (const rawKey of Object.keys(nextVisible)) {
    if (!isGraphDataTablePropertyColumnKey(rawKey as GraphDataTableColumnKey)) continue
    if (!activePropColumnKeys.has(rawKey)) delete nextVisible[rawKey]
  }
  for (const key of activePropColumnKeys) {
    if (options?.resetVisibleColumns || nextVisible[key] === undefined) {
      const parsed = key.startsWith('prop:node:')
        ? { scope: 'node', id: `node:${key.slice('prop:node:'.length)}` }
        : key.startsWith('prop:edge:')
          ? { scope: 'edge', id: `edge:${key.slice('prop:edge:'.length)}` }
          : null
      const fieldId = parsed?.id
      const hidden = fieldId ? currentSettings[fieldId as keyof typeof currentSettings]?.isHidden : undefined
      nextVisible[key] = typeof hidden === 'boolean' ? !hidden : true
    }
  }
  if (!recordsShallowEqual(currentVisible, nextVisible)) {
    get().setGraphDataTableVisibleColumns(nextVisible as GraphDataTableColumnVisibilityByKey)
  }

  const nextSettings: typeof currentSettings = {}
  for (const [k, v] of Object.entries(currentSettings)) {
    if (!v) continue
    const isDerived = derivedFieldIds.has(k)
    if (!isDerived && v.isCustom !== true) continue
    nextSettings[k as keyof typeof currentSettings] = v
  }
  if (!recordsShallowEqual(currentSettings as Record<string, unknown>, nextSettings as Record<string, unknown>)) {
    get().setGraphFieldSettingsById(nextSettings)
  }
}

export function readGraphRagWorkflowJsonTextFromGraphData(graphData: GraphData): string | null {
  const meta = graphData.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const rawText = (meta as Record<string, unknown>).graphRagWorkflowJsonText as unknown
  if (typeof rawText === 'string') {
    const trimmed = rawText.trim()
    return trimmed ? rawText : null
  }
  const rawDoc = (meta as Record<string, unknown>).graphRagWorkflowJsonLd as unknown
  if (!rawDoc || typeof rawDoc !== 'object') return null
  if (Array.isArray(rawDoc)) return null
  try {
    const text = JSON.stringify(rawDoc, null, 2)
    return text && text.trim() ? text : null
  } catch {
    return null
  }
}
