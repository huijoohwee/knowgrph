import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { setObjectPath } from '@/lib/data/objectPath'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { resolveRichMediaConnectedRenderSchemaPath } from '@/lib/flowEditor/widgetAutoRender'
import { hashRecordSignature32, hashSignatureParts } from '@/lib/hash/signature'

const RICH_MEDIA_RENDER_SCHEMA_PATHS = new Set([
  'properties.output',
  'properties.outputSrcDoc',
  'properties.imageUrl',
  'properties.videoUrl',
  'properties.audioUrl',
])
export const RICH_MEDIA_CONNECTED_RENDER_PATHS_KEY = '__kg:richMediaConnectedRenderPaths' as const

function hasRenderableConnectedValue(value: unknown): boolean {
  if (typeof value === 'undefined' || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function clearRichMediaGenericRenderDrivers(properties: Record<string, unknown>): Record<string, unknown> {
  const next = { ...properties }
  delete next.media_kind
  delete next.mediaKind
  delete next.media_url
  delete next.mediaUrl
  delete next.iframe_url
  delete next.media
  delete next.src
  delete next.url
  delete next['dom:tag']
  delete next['dom:attrs:src']
  delete next['dom:attrs:srcdoc']
  return next
}

function clearRichMediaRenderChannel(args: {
  properties: Record<string, unknown>
  renderPath: string
  preserveOutput?: boolean
  preserveOutputSrcDoc?: boolean
}): Record<string, unknown> {
  const next = { ...args.properties }
  if (args.renderPath === 'properties.imageUrl') {
    delete next.image
    delete next.imageUrl
    return next
  }
  if (args.renderPath === 'properties.videoUrl') {
    delete next.video
    delete next.videoUrl
    return next
  }
  if (args.renderPath === 'properties.audioUrl') {
    delete next.audio
    delete next.audioUrl
    delete next.audio_url
    return next
  }
  if (args.renderPath === 'properties.output' || args.renderPath === 'properties.outputSrcDoc') {
    delete next.image
    delete next.imageUrl
    delete next.video
    delete next.videoUrl
    delete next.audio
    delete next.audioUrl
    delete next.audio_url
    if (args.renderPath === 'properties.output') {
      delete next.output
      if (args.preserveOutputSrcDoc !== true) delete next.outputSrcDoc
      return next
    }
    if (args.preserveOutput !== true) delete next.output
    delete next.outputSrcDoc
    return next
  }
  return next
}

const CONNECTED_RENDER_NODE_CACHE_LIMIT = 48
const connectedRenderNodeCacheByNode = new WeakMap<GraphNode, Map<string, GraphNode>>()
const connectedSchemaPathCache = new WeakMap<FlowConnectedValuesBySchemaPath, string[]>()

function baseRenderNodeSignature(node: GraphNode): string {
  const props = (node.properties || {}) as Record<string, unknown>
  return hashSignatureParts([
    String(node.id || '').trim(),
    String(node.type || '').trim(),
    hashRecordSignature32({
      media_kind: props.media_kind,
      mediaKind: props.mediaKind,
      media_url: props.media_url,
      mediaUrl: props.mediaUrl,
      iframe_url: props.iframe_url,
      image: props.image,
      imageUrl: props.imageUrl,
      video: props.video,
      videoUrl: props.videoUrl,
      audio: props.audio,
      audioUrl: props.audioUrl,
      audio_url: props.audio_url,
      media: props.media,
      src: props.src,
      url: props.url,
      output: props.output,
      outputSrcDoc: props.outputSrcDoc,
      text: props.text,
      markdown: props.markdown,
      richMediaActiveTab: props.richMediaActiveTab,
      freezeConnectedOutput: props.freezeConnectedOutput,
      domTag: props['dom:tag'],
      domSrc: props['dom:attrs:src'],
      domSrcDoc: props['dom:attrs:srcdoc'],
    }, { maxEntries: 32, maxDepth: 2 }),
  ])
}

function connectedRenderValueSignature(connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath): string {
  const paths = listConnectedSchemaPaths(connectedValuesBySchemaPath).slice().sort()
  const parts: Array<string | number | boolean> = ['paths', paths.length]
  for (let i = 0; i < paths.length; i += 1) {
    const path = paths[i]
    const connected = connectedValuesBySchemaPath[path]
    const sources = Array.isArray(connected?.sources) ? connected.sources : []
    const sourceParts: string[] = []
    for (let j = 0; j < sources.length; j += 1) {
      const source = sources[j]
      sourceParts.push(`${String(source.edgeId || '').trim()}|${String(source.nodeId || '').trim()}|${String(source.portKey || '').trim()}`)
    }
    parts.push(path, hashRecordSignature32({ value: connected?.value }, { maxEntries: 1, maxDepth: 3 }), sourceParts.join(','))
  }
  return hashSignatureParts(parts)
}

export function listConnectedSchemaPaths(connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath): string[] {
  if (!connectedValuesBySchemaPath) return []
  const cached = connectedSchemaPathCache.get(connectedValuesBySchemaPath)
  if (cached) return cached
  const paths = Object.keys(connectedValuesBySchemaPath)
    .map(path => String(path || '').trim())
    .filter(Boolean)
  connectedSchemaPathCache.set(connectedValuesBySchemaPath, paths)
  return paths
}

export function hasConnectedValuesBySchemaPath(connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath): boolean {
  return listConnectedSchemaPaths(connectedValuesBySchemaPath).length > 0
}

function readConnectedRenderNodeCache(node: GraphNode, signature: string): GraphNode | null {
  return connectedRenderNodeCacheByNode.get(node)?.get(signature) || null
}

function writeConnectedRenderNodeCache(node: GraphNode, signature: string, renderedNode: GraphNode): void {
  let bySignature = connectedRenderNodeCacheByNode.get(node)
  if (!bySignature) {
    bySignature = new Map<string, GraphNode>()
    connectedRenderNodeCacheByNode.set(node, bySignature)
  }
  if (!bySignature.has(signature) && bySignature.size >= CONNECTED_RENDER_NODE_CACHE_LIMIT) {
    const oldestKey = bySignature.keys().next().value
    if (typeof oldestKey === 'string') bySignature.delete(oldestKey)
  }
  bySignature.set(signature, renderedNode)
}

export function applyConnectedValuesToNodeForRender(args: {
  node: GraphNode
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): GraphNode {
  const connectedValuesBySchemaPath = args.connectedValuesBySchemaPath
  if (!hasConnectedValuesBySchemaPath(connectedValuesBySchemaPath)) return args.node
  const cacheSignature = hashSignatureParts([
    baseRenderNodeSignature(args.node),
    connectedRenderValueSignature(connectedValuesBySchemaPath),
  ])
  const cached = readConnectedRenderNodeCache(args.node, cacheSignature)
  if (cached) return cached

  let next = {
    ...args.node,
    properties: { ...((args.node.properties || {}) as Record<string, unknown>) },
  } as GraphNode
  let changed = false
  const connectedPaths = listConnectedSchemaPaths(connectedValuesBySchemaPath)
  const connectedRenderPathsForSpec = new Set<string>()
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
  const incomingRichMediaRenderPaths = new Set<string>()
  if (String(args.node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
    for (const [path, connected] of Object.entries(connectedValuesBySchemaPath)) {
      const normalizedPath = String(path || '').trim()
      if (!normalizedPath || !connected || !hasRenderableConnectedValue(connected.value)) continue
      const renderPath = resolveRichMediaConnectedRenderSchemaPath({
        schemaPath: normalizedPath,
        connectedValue: connected,
      })
      if (renderPath) incomingRichMediaRenderPaths.add(renderPath)
    }
  }

  if (richMediaPanelHasConnectedRenderValue) {
    next = {
      ...next,
      // Preserve authored variants that are not being replaced by connected render output.
      properties: clearRichMediaGenericRenderDrivers((next.properties || {}) as Record<string, unknown>),
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
    if (String(args.node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID && hasRenderableConnectedValue(connected.value)) {
      connectedRenderPathsForSpec.add(renderPath)
    }
    if (String(args.node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
      next = {
        ...next,
        properties: clearRichMediaRenderChannel({
          properties: (next.properties || {}) as Record<string, unknown>,
          renderPath,
          preserveOutput: freezeConnectedOutputActive || incomingRichMediaRenderPaths.has('properties.output'),
          preserveOutputSrcDoc: incomingRichMediaRenderPaths.has('properties.outputSrcDoc'),
        }),
      } as GraphNode
    }
    next = setObjectPath(next as unknown as Record<string, unknown>, renderPath, connected.value) as unknown as GraphNode
    changed = true
  }
  if (String(args.node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
    const connectedRenderPathsSig = Array.from(connectedRenderPathsForSpec).sort().join('|')
    const props = (next.properties || {}) as Record<string, unknown>
    const prevSig = typeof props[RICH_MEDIA_CONNECTED_RENDER_PATHS_KEY] === 'string'
      ? String(props[RICH_MEDIA_CONNECTED_RENDER_PATHS_KEY] || '')
      : ''
    if (connectedRenderPathsSig) {
      if (prevSig !== connectedRenderPathsSig) {
        next = {
          ...next,
          properties: {
            ...props,
            [RICH_MEDIA_CONNECTED_RENDER_PATHS_KEY]: connectedRenderPathsSig,
          },
        } as GraphNode
        changed = true
      }
    } else if (prevSig) {
      const nextProps = { ...props }
      delete nextProps[RICH_MEDIA_CONNECTED_RENDER_PATHS_KEY]
      next = {
        ...next,
        properties: nextProps,
      } as GraphNode
      changed = true
    }
  }

  const renderedNode = changed ? next : args.node
  writeConnectedRenderNodeCache(args.node, cacheSignature, renderedNode)
  return renderedNode
}
