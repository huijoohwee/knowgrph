import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { normalizeSelectionAnchorIds } from '@/lib/selection/anchorIds'

export function testSelectionAnchorIdsNormalizeSingleAndMultiSelectionInputs() {
  const single = normalizeSelectionAnchorIds({
    selectedNodeId: 'node-1',
    selectedEdgeId: 'edge-1',
    selectedNodeIds: [],
    selectedEdgeIds: [],
  })
  if (single.selectionNodeIds.join(',') !== 'node-1') {
    throw new Error(`expected single selected node id fallback, got ${single.selectionNodeIds.join(',')}`)
  }
  if (single.selectionEdgeIds.join(',') !== 'edge-1') {
    throw new Error(`expected single selected edge id fallback, got ${single.selectionEdgeIds.join(',')}`)
  }

  const multi = normalizeSelectionAnchorIds({
    selectedNodeId: 'ignored-node',
    selectedEdgeId: 'ignored-edge',
    selectedNodeIds: ['node-a', 'node-b'],
    selectedEdgeIds: ['edge-a'],
  })
  if (multi.selectionNodeIds.join(',') !== 'node-a,node-b') {
    throw new Error(`expected explicit selected node ids to win, got ${multi.selectionNodeIds.join(',')}`)
  }
  if (multi.selectionEdgeIds.join(',') !== 'edge-a') {
    throw new Error(`expected explicit selected edge ids to win, got ${multi.selectionEdgeIds.join(',')}`)
  }
}

export function testSelectionNormalizationReuseAdoptsSharedHookAcrossPanelConsumers() {
  const anchorIdsText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'selection', 'anchorIds.ts'),
    'utf8',
  )
  const highlightText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'highlight.ts'),
    'utf8',
  )
  const datasetInspectorText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'DatasetInspectorSection.tsx'),
    'utf8',
  )
  const statsSelectionText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'hooks', 'useStatsSelection.ts'),
    'utf8',
  )
  const fieldAggregatesText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'hooks', 'useBottomPanelCuratorFieldAggregates.ts'),
    'utf8',
  )
  const visibleRowsText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'hooks', 'useBottomPanelCuratorVisibleRows.ts'),
    'utf8',
  )

  if (
    !anchorIdsText.includes('export function normalizeSelectionAnchorIds(')
    || !anchorIdsText.includes('export function useSelectionAnchorIds(')
  ) {
    throw new Error('expected shared selection normalization helper and hook in the upstream selection SSOT layer')
  }

  if (
    !highlightText.includes('export const normalizeSelectionIds = normalizeSelectionAnchorIds')
    || !highlightText.includes('export { useSelectionAnchorIds }')
  ) {
    throw new Error('expected GraphCanvas highlight helpers to reuse and re-export the shared selection normalization SSOT')
  }

  if (
    !datasetInspectorText.includes('const selectionAnchorIds = useSelectionAnchorIds({')
    || datasetInspectorText.includes('React.useMemo<SelectionAnchorIds>(')
    || datasetInspectorText.includes('normalizeSelectionIds({')
  ) {
    throw new Error('expected DatasetInspectorSection to reuse the shared selection anchor hook instead of local normalization memo blocks')
  }

  if (
    !statsSelectionText.includes('const selectionAnchorIds = useSelectionAnchorIds({')
    || statsSelectionText.includes('React.useMemo<SelectionAnchorIds>(')
    || statsSelectionText.includes('normalizeSelectionIds({')
  ) {
    throw new Error('expected useStatsSelection to reuse the shared selection anchor hook instead of local normalization memo blocks')
  }

  if (
    !fieldAggregatesText.includes('const selectionAnchorIds = useSelectionAnchorIds({')
    || fieldAggregatesText.includes('normalizeSelectionIds({')
  ) {
    throw new Error('expected useBottomPanelCuratorFieldAggregates to reuse the shared selection anchor hook')
  }

  if (
    !visibleRowsText.includes('const selectionAnchorIds = useSelectionAnchorIds({')
    || visibleRowsText.includes('const selectionAnchorIds: SelectionAnchorIds = normalizeSelectionIds({')
  ) {
    throw new Error('expected useBottomPanelCuratorVisibleRows to reuse the shared selection anchor hook')
  }
}
