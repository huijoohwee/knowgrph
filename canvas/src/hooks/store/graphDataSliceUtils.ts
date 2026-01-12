import type { GetGraph } from '@/hooks/store/graphDataSlice'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { parseLayoutMode, parseTidyTreeMetadata } from './graphDataSliceParsers'
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

export function applyLayoutAutosuggestFromMetadata(get: GetGraph, metadata: unknown) {
  if (!isRecord(metadata)) return
  const rawMode =
    metadata['canvas:layoutMode'] ??
    metadata['canvas:layout.mode'] ??
    metadata['layoutMode'] ??
    (isRecord(metadata['canvas:layout']) ? metadata['canvas:layout'].mode : undefined)

  const modeSuggestion = parseLayoutMode(rawMode)

  const tidyRaw = metadata['canvas:tidyTree'] ?? metadata['canvas:tidy-tree'] ?? metadata['tidyTree']
  const tidySuggestion = parseTidyTreeMetadata(tidyRaw)

  if (!modeSuggestion && !tidySuggestion) return

  const schema = get().schema
  const curLayout = schema.layout || {}
  let nextLayout = curLayout
  const curPerformance = schema.performance || {}
  let nextPerformance = curPerformance
  let changed = false

  if (modeSuggestion && (curLayout.mode || 'force') === 'force' && modeSuggestion !== 'force') {
    nextLayout = { ...nextLayout, mode: modeSuggestion }
    changed = true
  }

  if (tidySuggestion && !modeSuggestion && (curLayout.mode || 'force') === 'force') {
    nextLayout = { ...nextLayout, mode: 'tidy-tree' }
    changed = true
  }

  if (tidySuggestion) {
    const curTidy = curLayout.tidyTree || {}
    const nextTidy: typeof curTidy = { ...curTidy }
    if ((curTidy.edgeLabels || []).length === 0 && (tidySuggestion.edgeLabels || []).length > 0) {
      nextTidy.edgeLabels = tidySuggestion.edgeLabels
    }
    if (curTidy.direction == null && tidySuggestion.direction != null) nextTidy.direction = tidySuggestion.direction
    if (curTidy.orientation == null && tidySuggestion.orientation != null) nextTidy.orientation = tidySuggestion.orientation
    if (curTidy.nodeSize == null && tidySuggestion.nodeSize != null) nextTidy.nodeSize = tidySuggestion.nodeSize
    if (curTidy.separation == null && tidySuggestion.separation != null) nextTidy.separation = tidySuggestion.separation
    if (curTidy.sortBy == null && tidySuggestion.sortBy != null) nextTidy.sortBy = tidySuggestion.sortBy
    if (curTidy.curve == null && tidySuggestion.curve != null) nextTidy.curve = tidySuggestion.curve
    if (curTidy.colorMode == null && tidySuggestion.colorMode != null) nextTidy.colorMode = tidySuggestion.colorMode
    if (!String(curTidy.linkStroke || '').trim() && tidySuggestion.linkStroke != null) nextTidy.linkStroke = tidySuggestion.linkStroke
    if (curTidy.linkOpacity == null && tidySuggestion.linkOpacity != null) nextTidy.linkOpacity = tidySuggestion.linkOpacity
    if (curTidy.linkWidth == null && tidySuggestion.linkWidth != null) nextTidy.linkWidth = tidySuggestion.linkWidth
    if (curTidy.nodeRadius == null && tidySuggestion.nodeRadius != null) nextTidy.nodeRadius = tidySuggestion.nodeRadius
    if (!String(curTidy.internalFill || '').trim() && tidySuggestion.internalFill != null) nextTidy.internalFill = tidySuggestion.internalFill
    if (!String(curTidy.leafFill || '').trim() && tidySuggestion.leafFill != null) nextTidy.leafFill = tidySuggestion.leafFill
    if (curTidy.labelFontSize == null && tidySuggestion.labelFontSize != null) nextTidy.labelFontSize = tidySuggestion.labelFontSize
    if (!String(curTidy.labelFontFamily || '').trim() && tidySuggestion.labelFontFamily != null) {
      nextTidy.labelFontFamily = tidySuggestion.labelFontFamily
    }
    const tidyChanged = JSON.stringify(curTidy) !== JSON.stringify(nextTidy)
    if (tidyChanged) {
      nextLayout = { ...nextLayout, tidyTree: nextTidy }
      changed = true
    }
  }

  const tidyMeta = isRecord(tidyRaw) ? tidyRaw : null
  if (tidyMeta && isRecord(tidyMeta.mermaidDensity)) {
    const mermaidDensity = tidyMeta.mermaidDensity as Record<string, unknown>
    const densityLabelRaw = typeof mermaidDensity.density === 'string' ? mermaidDensity.density.trim() : ''
    const densityLabel =
      densityLabelRaw === 'none' || densityLabelRaw === 'sparse' || densityLabelRaw === 'medium' || densityLabelRaw === 'dense'
        ? densityLabelRaw
        : ''
    const statementCount =
      typeof mermaidDensity.statementCount === 'number' && Number.isFinite(mermaidDensity.statementCount) && mermaidDensity.statementCount > 0
        ? mermaidDensity.statementCount
        : null

    if (statementCount != null && (densityLabel === 'medium' || densityLabel === 'dense')) {
      const curLod = curPerformance.lod || {}
      const curTidyLod = (curLod.tidyTree || {}) as NonNullable<NonNullable<GraphSchema['performance']>['lod']>['tidyTree']
      const nextTidyLod = { ...curTidyLod }

      if (curTidyLod.collapseMode == null) {
        nextTidyLod.collapseMode = 'depth'
      }
      const maxDepthRaw = typeof curTidyLod.maxDepth === 'number' && Number.isFinite(curTidyLod.maxDepth) ? curTidyLod.maxDepth : null
      if (maxDepthRaw == null || maxDepthRaw <= 0) {
        let maxDepth = densityLabel === 'dense' ? 2 : 3
        const configRaw = mermaidDensity.config
        let isVeryDense = false
        if (densityLabel === 'dense' && configRaw && isRecord(configRaw)) {
          const denseMaxRaw = (configRaw.denseMaxStatements as unknown)
          const denseMax =
            typeof denseMaxRaw === 'number' && Number.isFinite(denseMaxRaw) && denseMaxRaw > 0 ? denseMaxRaw : null
          if (denseMax != null && statementCount >= denseMax * 2) {
            maxDepth = 1
            isVeryDense = true
          }
        }
        nextTidyLod.maxDepth = maxDepth

        if (isVeryDense) {
          const curLayoutTidy = (nextLayout.tidyTree || {}) as NonNullable<NonNullable<GraphSchema['layout']>['tidyTree']>
          const sepRaw =
            typeof curLayoutTidy.separation === 'number' &&
            Number.isFinite(curLayoutTidy.separation) &&
            curLayoutTidy.separation > 0
              ? curLayoutTidy.separation
              : null
          if (sepRaw != null) {
            const boosted = sepRaw * 1.1
            const nextTidyLayout = { ...curLayoutTidy, separation: boosted }
            nextLayout = { ...nextLayout, tidyTree: nextTidyLayout }
            changed = true
          }
        }
      }

      const tidyLodChanged = JSON.stringify(curTidyLod) !== JSON.stringify(nextTidyLod)
      if (tidyLodChanged) {
        const nextLod = { ...curLod, tidyTree: nextTidyLod }
        nextPerformance = { ...curPerformance, lod: nextLod }
        changed = true
      }
    }
  }

  if (!changed) return
  get().setSchema({ ...schema, layout: nextLayout, performance: nextPerformance })
  if ((nextLayout.mode || schema.layout?.mode) === 'radial' || (nextLayout.mode || schema.layout?.mode) === 'tidy-tree') {
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
