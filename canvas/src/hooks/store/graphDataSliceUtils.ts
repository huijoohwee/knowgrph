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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function readStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const out: string[] = []
  for (const item of v) {
    if (typeof item !== 'string') continue
    const s = item.trim()
    if (!s || out.includes(s)) continue
    out.push(s)
  }
  return out.length > 0 ? out : null
}

function readLayoutHintsFromMetadata(metadata: Record<string, unknown>): {
  edgeLabels: string[] | null
  orientation: 'vertical' | 'horizontal' | null
} {
  const tree = isRecord(metadata.tree) ? metadata.tree : null
  const mermaid = isRecord(metadata.mermaid) ? metadata.mermaid : null
  const edgeLabels = readStringArray(tree?.edgeLabels) || readStringArray(mermaid?.edgeLabels)
  const rawOrientation = typeof tree?.orientation === 'string' ? tree.orientation : typeof mermaid?.orientation === 'string' ? mermaid.orientation : ''
  const orientation = rawOrientation.trim().toLowerCase() === 'horizontal' ? 'horizontal' : rawOrientation.trim().toLowerCase() === 'vertical' ? 'vertical' : null
  return { edgeLabels, orientation }
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
  if (modeSuggestion === 'stratify') {
    const hints = readLayoutHintsFromMetadata(metadata)
    const curStratify = isRecord(nextLayout.stratify) ? nextLayout.stratify : null
    const edgeLabelsMissing = !curStratify || !Array.isArray(curStratify.edgeLabels) || curStratify.edgeLabels.length === 0
    const orientationMissing = !curStratify || (curStratify.orientation !== 'horizontal' && curStratify.orientation !== 'vertical')
    if (hints.edgeLabels && edgeLabelsMissing) {
      nextLayout.stratify = { ...(curStratify || {}), edgeLabels: hints.edgeLabels }
    }
    if (hints.orientation && orientationMissing) {
      nextLayout.stratify = { ...(isRecord(nextLayout.stratify) ? nextLayout.stratify : {}), orientation: hints.orientation }
    }
  }
  get().setSchema({ ...schema, layout: nextLayout })
  if ((nextLayout.mode || schema.layout?.mode) === 'radial') {
    const setCanvasRenderMode = get().setCanvasRenderMode
    if (typeof setCanvasRenderMode === 'function') setCanvasRenderMode('2d')
  }
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
  get().setGraphDataTableColumnOrder(nextOrder)

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
  get().setGraphDataTableVisibleColumns(nextVisible as GraphDataTableColumnVisibilityByKey)

  const nextSettings: typeof currentSettings = {}
  for (const [k, v] of Object.entries(currentSettings)) {
    if (!v) continue
    const isDerived = derivedFieldIds.has(k)
    if (!isDerived && v.isCustom !== true) continue
    nextSettings[k as keyof typeof currentSettings] = v
  }
  get().setGraphFieldSettingsById(nextSettings)
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
