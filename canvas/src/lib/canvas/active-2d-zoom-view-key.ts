import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { isFlowEditorCanvas2dRenderer } from '@/lib/config.render'

export function buildActive2dZoomViewKey(args: {
  canvasRenderMode: unknown
  canvas2dRenderer: unknown
  schema: GraphSchema | null
  graphData: GraphData | null
  documentSemanticMode: unknown
  frontmatterModeEnabled: unknown
  multiDimTableModeEnabled?: unknown
  documentStructureBaselineLock: unknown
  renderMediaAsNodes: unknown
  mediaPanelDensity: unknown
  collapsedGroupIds: unknown
  designRendererWebpageLayoutKey?: unknown
}): string | null {
  const canvasRenderMode = String(args.canvasRenderMode || '')
  if (canvasRenderMode !== '2d') return null
  const canvas2dRenderer = String(args.canvas2dRenderer || '')
  const schema = args.schema
  const graphData = args.graphData
  const documentSemanticMode = String(args.documentSemanticMode || '')
  const frontmatterModeEnabled = args.frontmatterModeEnabled === true
  const multiDimTableModeEnabled = args.multiDimTableModeEnabled === true
  const flowEditorStandalone = isFlowEditorCanvas2dRenderer(canvas2dRenderer as any)
  const graphKind = String(((graphData?.metadata || {}) as Record<string, unknown>).kind || '').trim()

  const effectiveFrontmatter = flowEditorStandalone
    ? graphKind === 'frontmatter-flow'
    : computeEffectiveFrontmatterMode({
        frontmatterModeEnabled,
        documentSemanticMode,
        graphData,
      })

  const mediaPanelDensity = String(args.mediaPanelDensity || '')
  const renderMediaAsNodes = args.renderMediaAsNodes === true

  const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(args.collapsedGroupIds)

  const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schema)

  const semanticKey = flowEditorStandalone
    ? 'flowEditor'
    : (multiDimTableModeEnabled ? `${documentSemanticMode}:mdtbl` : documentSemanticMode)

  const base = buildZoomViewKey({
    canvasRenderMode,
    canvas2dRenderer,
    schemaLayoutEngineJson,
    frontmatterModeEnabled: effectiveFrontmatter,
    documentSemanticMode: semanticKey,
    graphMetaKey: buildGraphMetaKeyIgnoringPending(graphData),
    renderMediaAsNodes,
    mediaPanelDensity,
    collapsedGroupIdsKey,
  })
  if (canvas2dRenderer !== 'design') return base
  const webpageKey = String(args.designRendererWebpageLayoutKey || '').trim()
  if (!webpageKey) return base
  return `${base}::webpage:${webpageKey}`
}
