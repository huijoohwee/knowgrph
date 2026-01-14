import type { GetGraph } from '@/hooks/store/graphDataSlice'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { parseLayoutMode, parseTreeMetadata } from './graphDataSliceParsers'
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

  const treeRaw = metadata['canvas:tree'] ?? metadata['tree']
  const treeSuggestion = parseTreeMetadata(treeRaw)

  if (!modeSuggestion && !treeSuggestion) return

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

  if (treeSuggestion && !modeSuggestion && (curLayout.mode || 'force') === 'force') {
    nextLayout = { ...nextLayout, mode: 'tree' }
    changed = true
  }

  if (treeSuggestion) {
    const curTree = curLayout.tree || {}
    const nextTree: typeof curTree = { ...curTree }
    if ((curTree.edgeLabels || []).length === 0 && (treeSuggestion.edgeLabels || []).length > 0) {
      nextTree.edgeLabels = treeSuggestion.edgeLabels
    }
    if (curTree.direction == null && treeSuggestion.direction != null) nextTree.direction = treeSuggestion.direction
    if (curTree.orientation == null && treeSuggestion.orientation != null) nextTree.orientation = treeSuggestion.orientation
    if (curTree.nodeSize == null && treeSuggestion.nodeSize != null) nextTree.nodeSize = treeSuggestion.nodeSize
    if (curTree.separation == null && treeSuggestion.separation != null) nextTree.separation = treeSuggestion.separation
    if (curTree.sortBy == null && treeSuggestion.sortBy != null) nextTree.sortBy = treeSuggestion.sortBy
    if (curTree.curve == null && treeSuggestion.curve != null) nextTree.curve = treeSuggestion.curve
    if (curTree.colorMode == null && treeSuggestion.colorMode != null) nextTree.colorMode = treeSuggestion.colorMode
    if (!String(curTree.linkStroke || '').trim() && treeSuggestion.linkStroke != null) nextTree.linkStroke = treeSuggestion.linkStroke
    if (curTree.linkOpacity == null && treeSuggestion.linkOpacity != null) nextTree.linkOpacity = treeSuggestion.linkOpacity
    if (curTree.linkWidth == null && treeSuggestion.linkWidth != null) nextTree.linkWidth = treeSuggestion.linkWidth
    if (curTree.nodeRadius == null && treeSuggestion.nodeRadius != null) nextTree.nodeRadius = treeSuggestion.nodeRadius
    if (!String(curTree.internalFill || '').trim() && treeSuggestion.internalFill != null) nextTree.internalFill = treeSuggestion.internalFill
    if (!String(curTree.leafFill || '').trim() && treeSuggestion.leafFill != null) nextTree.leafFill = treeSuggestion.leafFill
    if (curTree.labelFontSize == null && treeSuggestion.labelFontSize != null) nextTree.labelFontSize = treeSuggestion.labelFontSize
    if (!String(curTree.labelFontFamily || '').trim() && treeSuggestion.labelFontFamily != null) {
      nextTree.labelFontFamily = treeSuggestion.labelFontFamily
    }
    const treeChanged = JSON.stringify(curTree) !== JSON.stringify(nextTree)
    if (treeChanged) {
      nextLayout = { ...nextLayout, tree: nextTree }
      changed = true
    }
  }

  const treeMeta = isRecord(treeRaw) ? treeRaw : null
  if (treeMeta && isRecord(treeMeta.mermaidDensity)) {
    const mermaidDensity = treeMeta.mermaidDensity as Record<string, unknown>
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
      const curTreeLod = (curLod.tree || {}) as NonNullable<NonNullable<GraphSchema['performance']>['lod']>['tree']
      const nextTreeLod = { ...curTreeLod }

      if (curTreeLod.collapseMode == null) {
        nextTreeLod.collapseMode = 'depth'
      }
      const maxDepthRaw = typeof curTreeLod.maxDepth === 'number' && Number.isFinite(curTreeLod.maxDepth) ? curTreeLod.maxDepth : null
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
        nextTreeLod.maxDepth = maxDepth

        if (isVeryDense) {
          const curLayoutTree = (nextLayout.tree || {}) as NonNullable<NonNullable<GraphSchema['layout']>['tree']>
          const sepRaw =
            typeof curLayoutTree.separation === 'number' &&
            Number.isFinite(curLayoutTree.separation) &&
            curLayoutTree.separation > 0
              ? curLayoutTree.separation
              : null
          if (sepRaw != null) {
            const boosted = sepRaw * 1.1
            const nextTreeLayout = { ...curLayoutTree, separation: boosted }
            nextLayout = { ...nextLayout, tree: nextTreeLayout }
            changed = true
          }
        }
      }

      const treeLodChanged = JSON.stringify(curTreeLod) !== JSON.stringify(nextTreeLod)
      if (treeLodChanged) {
        const nextLod = { ...curLod, tree: nextTreeLod }
        nextPerformance = { ...curPerformance, lod: nextLod }
        changed = true
      }
    }
  }

  if (!changed) return
  get().setSchema({ ...schema, layout: nextLayout, performance: nextPerformance })
  if ((nextLayout.mode || schema.layout?.mode) === 'radial' || (nextLayout.mode || schema.layout?.mode) === 'tree') {
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
