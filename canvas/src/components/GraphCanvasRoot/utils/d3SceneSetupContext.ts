import { withD3FlowchartSceneSchema } from '@/lib/canvas/d3FlowchartSchemaOverrides'
import { isD3Like2dRenderer } from '@/lib/config.render'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'

export type D3SceneSetupContext = {
  graphKind: string
  isD3LikeRenderer: boolean
  isFlowchart: boolean
  schemaForScene: GraphSchema
  hoverEnabled: boolean
  zoomOnDoubleClick: boolean
  graphMetaKey: string
  buildKey: string
  isMermaidLayout: boolean
}

export function buildD3SceneSetupContext(args: {
  sceneGraphData: GraphData
  schema: GraphSchema
  canvasRenderMode: '2d' | '3d'
  canvas2dRenderer: string | null
  coarsePointer: boolean
  sceneWidth: number
  sceneHeight: number
  schemaLayoutEngineJson: string
  effectiveFrontmatterModeEnabled: boolean
  documentSemanticMode: 'document' | 'keyword'
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  collapsedGroupIdsKey: string
  enableEditorGestures: boolean
  graphContentRevision: number
  infiniteCanvasInteractionMode: string
}): D3SceneSetupContext {
  const graphKind = (() => {
    const metadata = (args.sceneGraphData.metadata || {}) as Record<string, unknown>
    return typeof metadata.graphKind === 'string' ? metadata.graphKind : ''
  })()
  const isD3LikeRenderer = args.canvasRenderMode === '2d' && isD3Like2dRenderer((args.canvas2dRenderer || null) as never)
  const isFlowchart = isD3LikeRenderer && graphKind === 'flowchart'
  const schemaForScene = withD3FlowchartSceneSchema({
    schema: args.schema,
    graphData: args.sceneGraphData,
    canvasRenderMode: args.canvasRenderMode,
    canvas2dRenderer: String(args.canvas2dRenderer || ''),
  })
  const hoverEnabled = args.schema.behavior?.hover?.enabled !== false && !args.coarsePointer
  const expansionCfg = args.schema.behavior?.expansion || {}
  const expansionEnabled = expansionCfg.enabled !== false
  const zoomOnDoubleClick = expansionEnabled && expansionCfg.zoomOnDoubleClick !== false
  const graphMetaKey = buildGraphMetaKeyIgnoringPending(args.sceneGraphData)
  // Keep scene rebuilds semantic-only so panel/workspace gesture toggles do not drift layout.
  const buildKey = [
    String(args.graphContentRevision || 0),
    `${args.sceneWidth}x${args.sceneHeight}`,
    args.schemaLayoutEngineJson,
    String(args.effectiveFrontmatterModeEnabled ? 1 : 0),
    String(args.documentSemanticMode),
    graphMetaKey,
    `${String(args.sceneGraphData?.nodes?.length ?? 0)}:${String(args.sceneGraphData?.edges?.length ?? 0)}`,
    String(isFlowchart ? 0 : (args.renderMediaAsNodes ? 1 : 0)),
    String(isFlowchart ? '' : args.mediaPanelDensity),
    args.collapsedGroupIdsKey,
    String(args.infiniteCanvasInteractionMode),
  ].join('|')
  const isMermaidLayout = (() => {
    const graphData = args.sceneGraphData as unknown as { context?: unknown; metadata?: unknown } | null
    if (!graphData) return false
    if (String(graphData.context || '') === 'frontmatter-mermaid') return true
    const metadata = graphData.metadata
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
    return String((metadata as Record<string, unknown>).layoutEngine || '') === 'mermaid'
  })()

  return {
    graphKind,
    isD3LikeRenderer,
    isFlowchart,
    schemaForScene,
    hoverEnabled,
    zoomOnDoubleClick,
    graphMetaKey,
    buildKey,
    isMermaidLayout,
  }
}
