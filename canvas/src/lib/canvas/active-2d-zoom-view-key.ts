import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'

export function buildActive2dZoomViewKey(args: {
  canvasRenderMode: unknown
  canvas2dRenderer: unknown
  schema: GraphSchema | null
  graphData: GraphData | null
  documentSemanticMode: unknown
  frontmatterModeEnabled: unknown
  documentStructureBaselineLock: unknown
  renderMediaAsNodes: unknown
  mediaPanelDensity: unknown
  collapsedGroupIds: unknown
}): string | null {
  const canvasRenderMode = String(args.canvasRenderMode || '')
  if (canvasRenderMode !== '2d') return null
  const canvas2dRenderer = String(args.canvas2dRenderer || '')
  const schema = args.schema
  const graphData = args.graphData
  const documentSemanticMode = String(args.documentSemanticMode || '')
  const frontmatterModeEnabled = args.frontmatterModeEnabled === true && args.documentStructureBaselineLock !== true

  const effectiveFrontmatter = computeEffectiveFrontmatterMode({
    frontmatterModeEnabled,
    documentSemanticMode,
    graphData,
  })

  const mediaPanelDensity = String(args.mediaPanelDensity || '')
  const renderMediaAsNodes = args.renderMediaAsNodes === true

  const collapsedIds = Array.isArray(args.collapsedGroupIds) ? args.collapsedGroupIds : []
  const normalized = collapsedIds.map(x => String(x || '').trim()).filter(Boolean)
  normalized.sort((a, b) => a.localeCompare(b))
  const collapsedGroupIdsKey = normalized.join('|')

  const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schema)

  return buildZoomViewKey({
    canvasRenderMode,
    canvas2dRenderer,
    schemaLayoutEngineJson,
    frontmatterModeEnabled: effectiveFrontmatter,
    documentSemanticMode,
    graphMetaKey: buildGraphMetaKey(graphData),
    renderMediaAsNodes,
    mediaPanelDensity,
    collapsedGroupIdsKey,
  })
}
