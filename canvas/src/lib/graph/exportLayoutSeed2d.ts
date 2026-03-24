import { getGraphDataForDisplay } from '@/components/GraphCanvas/displayFilter'
import { determineLayoutPositions, buildLayoutViewKey, computeLayoutDatasetKey } from '@/components/GraphCanvas/layout/positioning'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

export type LayoutSeedPosById = Record<string, { x: number; y: number }>

export function pickLayoutSeedPositions2dForExport(args: {
  graphData: GraphData
  graphDataRevision?: number
  schema: GraphSchema
  documentSemanticModeKey: string
  frontmatterModeEnabled: boolean
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  collapsedGroupIds?: unknown
  layoutPositionCacheByMode?: Record<string, Record<string, { x: number; y: number }>> | null
  canvas2dRenderer?: string
}): LayoutSeedPosById | null {
  const graphData = args.graphData
  const schema = args.schema
  if (!graphData || !schema) return null

  const graphDataForDisplay = getGraphDataForDisplay({ graphData, edges: null })
  const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(args.collapsedGroupIds)
  const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schema)
  const graphMetaKey = buildGraphMetaKeyIgnoringPending(graphDataForDisplay)
  const datasetKey = computeLayoutDatasetKey({
    graphData: graphDataForDisplay,
    graphDataRevision: typeof args.graphDataRevision === 'number' && Number.isFinite(args.graphDataRevision) ? Math.floor(args.graphDataRevision) : 0,
  })
  const layoutMode = readLayoutMode(schema)
  const semanticModeKey = String(args.documentSemanticModeKey || 'document')
  const layoutViewKey = buildLayoutViewKey({
    schemaLayoutEngineJson,
    frontmatterModeEnabled: args.frontmatterModeEnabled,
    documentSemanticMode: semanticModeKey,
    graphMetaKey,
    renderMediaAsNodes: args.renderMediaAsNodes,
    mediaPanelDensity: String(args.mediaPanelDensity),
    collapsedGroupIdsKey,
  })

  const renderVariant = String(args.canvas2dRenderer || 'd3')
  const layoutVariant = ''

  const picked = determineLayoutPositions({
    datasetKey,
    mode: layoutMode,
    frontmatterMode: args.frontmatterModeEnabled,
    semanticMode: semanticModeKey,
    renderMode: '2d',
    renderVariant,
    layoutVariant,
    viewKey: layoutViewKey,
    prevViewKey: null,
    prevDatasetKey: null,
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    prevRenderVariant: null,
    prevLayoutVariant: null,
    nodes: Array.isArray(graphDataForDisplay.nodes) ? graphDataForDisplay.nodes : [],
    layoutPositionCacheByMode: args.layoutPositionCacheByMode ?? null,
  })

  const seeded = picked.layoutPositionsForMode
  if (!seeded || Object.keys(seeded).length === 0) return null
  return seeded
}

