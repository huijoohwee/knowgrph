import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'

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

  const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(args.collapsedGroupIds)

  const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schema)

  return buildZoomViewKey({
    canvasRenderMode,
    canvas2dRenderer,
    schemaLayoutEngineJson,
    frontmatterModeEnabled: effectiveFrontmatter,
    documentSemanticMode,
    graphMetaKey: buildGraphMetaKeyIgnoringPending(graphData),
    renderMediaAsNodes,
    mediaPanelDensity,
    collapsedGroupIdsKey,
  })
}
