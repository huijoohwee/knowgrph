import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { setObjectPath } from '@/lib/data/objectPath'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { resolveRichMediaConnectedRenderSchemaPath } from '@/lib/flowEditor/widgetAutoRender'

const RICH_MEDIA_RENDER_SCHEMA_PATHS = new Set([
  'properties.output',
  'properties.outputSrcDoc',
  'properties.imageUrl',
  'properties.videoUrl',
])

function hasRenderableConnectedValue(value: unknown): boolean {
  if (typeof value === 'undefined' || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function clearRichMediaRenderDrivers(properties: Record<string, unknown>, opts?: { preserveOutput?: boolean }): Record<string, unknown> {
  const next = { ...properties }
  const preserveOutput = opts?.preserveOutput === true
  delete next.media_kind
  delete next.mediaKind
  delete next.media_url
  delete next.mediaUrl
  delete next.iframe_url
  delete next.iframeUrl
  delete next.image
  delete next.imageUrl
  delete next.image_url
  delete next.video
  delete next.videoUrl
  delete next.video_url
  delete next.media
  delete next.src
  delete next.url
  if (!preserveOutput) {
    delete next.output
    delete next.outputSrcDoc
    delete next.text
    delete next.markdown
  }
  delete next['dom:tag']
  delete next['dom:attrs:src']
  delete next['dom:attrs:srcdoc']
  return next
}

const connectedRenderNodeCacheByNode = new WeakMap<GraphNode, WeakMap<FlowConnectedValuesBySchemaPath, GraphNode>>()

function readConnectedRenderNodeCache(node: GraphNode, connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath): GraphNode | null {
  return connectedRenderNodeCacheByNode.get(node)?.get(connectedValuesBySchemaPath) || null
}

function writeConnectedRenderNodeCache(node: GraphNode, connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath, renderedNode: GraphNode): void {
  let byValues = connectedRenderNodeCacheByNode.get(node)
  if (!byValues) {
    byValues = new WeakMap<FlowConnectedValuesBySchemaPath, GraphNode>()
    connectedRenderNodeCacheByNode.set(node, byValues)
  }
  byValues.set(connectedValuesBySchemaPath, renderedNode)
}

export function applyConnectedValuesToNodeForRender(args: {
  node: GraphNode
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): GraphNode {
  const connectedValuesBySchemaPath = args.connectedValuesBySchemaPath
  if (!connectedValuesBySchemaPath || Object.keys(connectedValuesBySchemaPath).length === 0) return args.node
  const cached = readConnectedRenderNodeCache(args.node, connectedValuesBySchemaPath)
  if (cached) return cached

  let next = {
    ...args.node,
    properties: { ...((args.node.properties || {}) as Record<string, unknown>) },
  } as GraphNode
  let changed = false
  const connectedPaths = Object.keys(connectedValuesBySchemaPath)
    .map(path => String(path || '').trim())
    .filter(Boolean)
  const freezeConnectedOutput =
    String(args.node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    && Boolean(((args.node.properties || {}) as Record<string, unknown>).freezeConnectedOutput)
  const freezeConnectedOutputActive = (() => {
    if (!freezeConnectedOutput) return false
    const props = (args.node.properties || {}) as Record<string, unknown>
    const output = typeof props.output === 'string' ? props.output.trim() : ''
    const outputSrcDoc = typeof props.outputSrcDoc === 'string' ? props.outputSrcDoc.trim() : ''
    return Boolean(output || outputSrcDoc)
  })()
  const richMediaPanelHasConnectedRenderValue =
    String(args.node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    && connectedPaths.some(path => {
      if (!RICH_MEDIA_RENDER_SCHEMA_PATHS.has(path)) return false
      const rec = connectedValuesBySchemaPath[path]
      return rec ? hasRenderableConnectedValue(rec.value) : false
    })

  if (richMediaPanelHasConnectedRenderValue) {
    next = {
      ...next,
      properties: clearRichMediaRenderDrivers((next.properties || {}) as Record<string, unknown>, {
        preserveOutput: freezeConnectedOutputActive,
      }),
    } as GraphNode
    changed = true
  }

  for (const [path, connected] of Object.entries(connectedValuesBySchemaPath)) {
    const normalizedPath = String(path || '').trim()
    if (!normalizedPath || !connected) continue
    if (typeof connected.value === 'undefined') continue
    const renderPath =
      String(args.node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
        ? resolveRichMediaConnectedRenderSchemaPath({
            schemaPath: normalizedPath,
            connectedValue: connected,
          })
        : normalizedPath
    if (!renderPath) continue
    if (freezeConnectedOutputActive && (renderPath === 'properties.output' || renderPath === 'properties.outputSrcDoc')) continue
    next = setObjectPath(next as unknown as Record<string, unknown>, renderPath, connected.value) as unknown as GraphNode
    changed = true
  }

  const renderedNode = changed ? next : args.node
  writeConnectedRenderNodeCache(args.node, connectedValuesBySchemaPath, renderedNode)
  return renderedNode
}
