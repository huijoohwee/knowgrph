import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'

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

  const schemaLayoutEngineJson = JSON.stringify({
    mode: schema ? readLayoutMode(schema) : 'force',
    forces: schema?.layout?.forces || null,
    fitPadding: schema?.layout?.fitPadding ?? null,
    flow: schema?.layout?.flow || null,
  })

  const schemaNodesPresentationJson = JSON.stringify({
    nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
    portHandles: schema?.behavior?.portHandles || null,
    nodeShapes: schema?.nodeShapes || null,
    allowNodeDrag: schema?.behavior?.allowNodeDrag !== false,
    hoverEnabled: schema?.behavior?.hover?.enabled !== false,
    expansion: schema?.behavior?.expansion || null,
    renderMediaAsNodes,
    mediaPanelDensity,
  })

  const schemaGroupsPresentationJson = JSON.stringify({
    groups: schema?.layout?.groups || null,
    labelStyles: schema?.labelStyles || null,
    nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
    portHandles: schema?.behavior?.portHandles || null,
  })

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
    schemaNodesPresentationJson,
    schemaGroupsPresentationJson,
  })
}

