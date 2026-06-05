import fs from 'node:fs'
import path from 'node:path'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { hasRegisteredFlowWidgetCompute } from '@/lib/flowEditor/widgetComputeRegistry'
import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { isCanvas2dRendererId } from '@/lib/config.render'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'

const FLOW_DIAGRAM_SAMPLE_PATHS_ENV = 'FLOW_DIAGRAM_SAMPLE_PATHS'

const parsePathList = (raw: string): string[] => (
  String(raw || '')
    .split(new RegExp(`[${path.delimiter === ';' ? ';' : ':'},\\n]`))
    .map(item => item.trim())
    .filter(Boolean)
)

const isFile = (filePath: string): boolean => {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

const isDirectory = (dirPath: string): boolean => {
  try {
    return fs.statSync(dirPath).isDirectory()
  } catch {
    return false
  }
}

const readPublishedDocsRootCandidates = (): string[] => {
  const candidates = [
    String(process.env.KNOWGRPH_PUBLISHED_DOCS_ROOT || '').trim(),
    path.resolve(process.cwd(), '..', 'huijoohwee', 'docs'),
    path.resolve(process.cwd(), '..', '..', 'huijoohwee', 'docs'),
  ].filter(Boolean)
  return Array.from(new Set(candidates.map(candidate => path.resolve(candidate))))
}

const includesTypedFlowDiagrams = (text: string): boolean => (
  /\bflow_diagrams\s*:/m.test(text)
  && /\btype\s*:\s*mermaid_gitgraph\b/i.test(text)
  && /\btype\s*:\s*mermaid_gantt\b/i.test(text)
)

const assertNoStaleRenderablePanelAuthority = (samplePath: string, text: string): void => {
  const forbidden = [
    /\boutput\s*:\s*\{[^}\n]*\bvalue\s*:\s*"Waiting for connected\b/i,
    /\boutput\s*:\s*\{[^}\n]*\bvalue\s*:\s*"[^"]*\bfallback copy\b/i,
    /\boutput\s*:\s*\{[^}\n]*\bvalue\s*:\s*"[^"]*\bstatic fallback\b/i,
  ]
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`expected ${samplePath} to keep Rich Media Panel fallback fields empty for computed flow_diagrams samples`)
    }
  }
}

const assertNoAuthoredGeneratedFlowDiagramBackfill = (samplePath: string, text: string): void => {
  const forbidden = [
    /^\s{4}- id:\s*\{key:\s*id,\s*type:\s*string,\s*value:\s*"flow-diagram-(?:gitgraph|gantt)-(?:source|compute|panel)"/m,
    /^\s{4}- \{[^}\n]*"source":"flow-diagram-(?:gitgraph|gantt)-(?:source|compute|panel)"/m,
    /^\s{4}- \{[^}\n]*"target":"flow-diagram-(?:gitgraph|gantt)-(?:source|compute|panel)"/m,
  ]
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`expected ${samplePath} to keep flow_diagrams as frontmatter source data and let the parser derive diagram panel nodes`)
    }
  }
}

const listMarkdownFiles = (root: string, limit = 240): string[] => {
  if (!isDirectory(root)) return []
  const out: string[] = []
  const stack = [root]
  while (stack.length && out.length < limit) {
    const dir = stack.shift()!
    let entries: string[] = []
    try {
      entries = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const filePath = path.join(dir, entry)
      if (isDirectory(filePath)) {
        stack.push(filePath)
        continue
      }
      if (/\.md$/i.test(entry) && isFile(filePath)) out.push(filePath)
      if (out.length >= limit) break
    }
  }
  return out
}

const readPublishedFlowDiagramSamplePaths = (): string[] => {
  const explicit = parsePathList(String(process.env[FLOW_DIAGRAM_SAMPLE_PATHS_ENV] || ''))
    .map(item => path.resolve(item))
    .filter(isFile)
  if (explicit.length) return Array.from(new Set(explicit))

  const discovered: string[] = []
  for (const root of readPublishedDocsRootCandidates()) {
    for (const filePath of listMarkdownFiles(root)) {
      let text = ''
      try {
        text = fs.readFileSync(filePath, 'utf8')
      } catch {
        continue
      }
      if (includesTypedFlowDiagrams(text)) discovered.push(filePath)
    }
  }
  return Array.from(new Set(discovered)).sort((a, b) => a.localeCompare(b))
}

const RENDER_PORT_KEYS = ['output', 'imageUrl', 'audioUrl', 'videoUrl', 'outputSrcDoc'] as const

const readProps = (node: GraphNode | null | undefined): Record<string, unknown> => (
  node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
    ? node.properties as Record<string, unknown>
    : {}
)

const readEdgePort = (edge: GraphEdge, key: string): string => {
  const props = edge.properties && typeof edge.properties === 'object' && !Array.isArray(edge.properties)
    ? edge.properties as Record<string, unknown>
    : {}
  return String(props[key] || '').trim()
}

const isRenderablePort = (portKey: string): boolean => RENDER_PORT_KEYS.includes(portKey as never)

const isRichMediaPanelNode = (node: GraphNode): boolean => {
  const props = readProps(node)
  return String(node.type || '') === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    || String(props['flow:widgetFormId'] || '').toLowerCase() === 'richmediapanel'
}

const hasInlineCompute = (node: GraphNode | null | undefined): boolean => {
  return typeof readProps(node)['flow:compute'] === 'string' && String(readProps(node)['flow:compute'] || '').trim().length > 0
}

const readRenderableValue = (node: GraphNode, portKey: string): string => {
  const value = readProps(node)[portKey]
  return typeof value === 'string' ? value.trim() : ''
}

const validateDynamicRichMediaDataflow = (args: {
  graphData: GraphData
  registry: WidgetRegistryEntry[]
  samplePath: string
}): {
  connectedPanelCount: number
  inlineComputeBackedPanelCount: number
  diagramPanelCount: number
  diagramKinds: Set<string>
} => {
  const nodesById = new Map(args.graphData.nodes.map(node => [String(node.id || ''), node] as const))
  const panelTargets = new Map<string, Array<{ edge: GraphEdge; portKey: string }>>()
  for (const edge of args.graphData.edges) {
    const targetNode = nodesById.get(String(edge.target || ''))
    if (!targetNode || !isRichMediaPanelNode(targetNode)) continue
    const targetPort = readEdgePort(edge, FLOW_EDGE_TARGET_PORT_KEY)
    if (!isRenderablePort(targetPort)) continue
    const sourcePort = readEdgePort(edge, FLOW_EDGE_SOURCE_PORT_KEY)
    if (!sourcePort || !isRenderablePort(sourcePort)) continue
    const targetId = String(targetNode.id || '')
    if (!panelTargets.has(targetId)) panelTargets.set(targetId, [])
    panelTargets.get(targetId)!.push({ edge, portKey: targetPort })
  }
  if (panelTargets.size === 0) {
    throw new Error(`expected ${args.samplePath} to declare connected Rich Media Panel render targets`)
  }

  const connected = computeFlowConnectedValuesBySchemaPath({
    graphData: args.graphData,
    registry: args.registry,
    targetNodeIds: new Set(Array.from(panelTargets.keys())),
  })
  let connectedPanelCount = 0
  let inlineComputeBackedPanelCount = 0
  let diagramPanelCount = 0
  const diagramKinds = new Set<string>()
  for (const [panelId, edges] of Array.from(panelTargets.entries())) {
    const targetNode = nodesById.get(panelId)
    if (!targetNode) continue
    const targetProps = readProps(targetNode)
    const diagramKind = String(targetProps.diagramKind || '').trim()
    const connectedValues = connected.get(panelId) || {}
    let panelHasConnectedValue = false
    for (const { edge, portKey } of edges) {
      const schemaPath = `properties.${portKey}`
      const value = connectedValues[schemaPath]
      const rendered = typeof value?.value === 'string' ? value.value.trim() : ''
      if (!rendered) continue
      if (!value.sources.some(source => source.edgeId === edge.id && source.nodeId === edge.source && source.portKey === readEdgePort(edge, FLOW_EDGE_SOURCE_PORT_KEY))) {
        throw new Error(`expected ${args.samplePath} panel ${panelId}.${portKey} to source from its declared dataflow edge`)
      }
      const localFallback = readRenderableValue(targetNode, portKey)
      if (localFallback) {
        throw new Error(`expected ${args.samplePath} panel ${panelId}.${portKey} to keep local render field empty and receive connected dataflow output`)
      }
      const sourceNode = nodesById.get(String(edge.source || ''))
      const sourceUsesInlineCompute = hasInlineCompute(sourceNode)
      const sourceUsesRegisteredCompute = hasRegisteredFlowWidgetCompute({
        node: sourceNode,
        registryEntry: sourceNode
          ? resolveWidgetRegistryEntry({ node: sourceNode, registry: args.registry })
          : null,
      })
      if (!sourceUsesInlineCompute && !sourceUsesRegisteredCompute) {
        throw new Error(`expected ${args.samplePath} source ${String(edge.source || '')}.${readEdgePort(edge, FLOW_EDGE_SOURCE_PORT_KEY)} to use inline or registered compute before feeding Rich Media Panel ${panelId}.${portKey}`)
      }
      if (sourceNode) {
        const sourceLocalFallback = readRenderableValue(sourceNode, readEdgePort(edge, FLOW_EDGE_SOURCE_PORT_KEY))
        if (sourceLocalFallback) {
          throw new Error(`expected ${args.samplePath} source ${String(edge.source || '')}.${readEdgePort(edge, FLOW_EDGE_SOURCE_PORT_KEY)} to keep local render field empty and compute connected panel output`)
        }
      }
      if (diagramKind && portKey === 'outputSrcDoc') {
        if (
          !rendered.includes(`data-kg-flow-diagram-kind="${diagramKind}"`)
          || !rendered.includes('First-class terms')
          || !rendered.includes("data-kg-flow-diagram-chart='1'")
          || !rendered.includes('data-kg-mermaid-source="1"')
        ) {
          throw new Error(`expected ${args.samplePath} diagram panel ${panelId} to render computed ${diagramKind} chart, source, and term coverage`)
        }
        diagramKinds.add(diagramKind)
      }
      panelHasConnectedValue = true
      if (sourceUsesInlineCompute) inlineComputeBackedPanelCount += 1
    }
    if (panelHasConnectedValue) {
      connectedPanelCount += 1
      if (diagramKind) diagramPanelCount += 1
    }
  }
  if (connectedPanelCount === 0) {
    throw new Error(`expected ${args.samplePath} to produce at least one connected Rich Media Panel value`)
  }
  return { connectedPanelCount, inlineComputeBackedPanelCount, diagramPanelCount, diagramKinds }
}

export function testMarkdownFrontmatterFlowGraphFidelityPublishedFlowDiagramDocsDynamicPanels() {
  const samplePaths = readPublishedFlowDiagramSamplePaths()
  let checked = 0
  let totalConnectedPanels = 0
  let totalInlineComputeBackedPanels = 0
  let samplesWithGitGraphAndGanttPanels = 0
  for (const samplePath of samplePaths) {
    if (!fs.existsSync(samplePath)) continue
    checked += 1
    const md = fs.readFileSync(samplePath, 'utf8')
    assertNoStaleRenderablePanelAuthority(samplePath, md)
    assertNoAuthoredGeneratedFlowDiagramBackfill(samplePath, md)
    const res = tryParseMarkdownFrontmatterFlowGraph(path.basename(samplePath), md)
    if (!res) throw new Error(`expected frontmatter parse result for ${samplePath}`)
    const g = res.graphData
    if (String(g.context || '').trim() !== 'frontmatter-flow') throw new Error(`expected frontmatter-flow context for ${samplePath}`)
    const preset = parseCanvasWorkspaceFrontmatterPreset(md)
    if (!isCanvas2dRendererId(preset?.canvas2dRenderer)) {
      throw new Error(`expected ${samplePath} source frontmatter to select a current 2D renderer, got ${String(preset?.canvas2dRenderer || '')}`)
    }
    const flowSettings = ((g.metadata || {}) as Record<string, unknown>).frontmatterFlowSettings as Record<string, unknown> | null
    if (flowSettings?.computed !== true) throw new Error(`expected ${samplePath} parsed flow settings to enable computed frontmatter flow`)
    const frontmatterMeta = ((g.metadata || {}) as Record<string, unknown>).frontmatterMeta as Record<string, unknown> | null
    if (!frontmatterMeta?.flow_diagrams) throw new Error(`expected ${samplePath} to preserve flow_diagrams frontmatter`)

    const registry = Array.isArray((g.metadata || {})[FLOW_WIDGET_REGISTRY_METADATA_KEY])
      ? (g.metadata || {})[FLOW_WIDGET_REGISTRY_METADATA_KEY] as WidgetRegistryEntry[]
      : []
    const result = validateDynamicRichMediaDataflow({ graphData: g, registry, samplePath })
    totalConnectedPanels += result.connectedPanelCount
    totalInlineComputeBackedPanels += result.inlineComputeBackedPanelCount
    if (result.diagramKinds.has('gitgraph') && result.diagramKinds.has('gantt')) samplesWithGitGraphAndGanttPanels += 1
  }
  if (checked === 0) return
  if (totalConnectedPanels < checked) {
    throw new Error(`expected every available published sample to produce connected Rich Media Panel values, got ${totalConnectedPanels} across ${checked}`)
  }
  if (totalInlineComputeBackedPanels === 0) {
    throw new Error('expected at least one published sample to prove inline compute fan-out into Rich Media Panels')
  }
  if (samplesWithGitGraphAndGanttPanels < checked) {
    throw new Error(`expected every available published sample to compute GitGraph and Gantt Rich Media Panels, got ${samplesWithGitGraphAndGanttPanels} across ${checked}`)
  }
}
