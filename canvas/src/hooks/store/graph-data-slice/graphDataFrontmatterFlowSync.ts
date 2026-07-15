import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/store/types'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { extractYamlFrontmatterBlock } from '@/lib/markdown/frontmatter'
import { isMarkdownLikeFileName } from 'grph-shared/markdown/mermaidInput'
import { recordDocumentVersionSnapshot } from '@/features/document-versioning/documentVersioning'
import yaml from 'js-yaml'
import {
  normalizeComposedSourcePath,
  readComposedSourceFilePath,
  resolvePreferredComposedSourceFileFromState,
} from '@/features/source-files/composedSourceSelection'
import {
  buildStrybldrCardOverridePatchFromGraphNodeChange,
  isStrybldrStoryboardMarkdown,
  updateStrybldrStoryboardMarkdownCardOverride,
  syncStrybldrStoryboardMarkdownWorkflowEdges,
} from '@/features/strybldr/strybldrStoryboard'
import { appendStrybldrStoryboardNodeSource, isStrybldrStoryboardNodeSourceOwned } from '@/hooks/store/graph-data-slice/strybldrStoryboardNodeSourceSync'
import { normalizeGeneratedRichMediaTableProperties } from '@/features/rich-media/richMediaTablePersistence'; import { containsMarkdownPipeTable } from '@/features/markdown/ui/markdownDataViewSerialize'; import { enqueueWorkspaceSourceTextWrite } from './workspaceSourceTextWriteQueue'
const FLOW_YAML_PLAIN_KEY_RE = /^[A-Za-z0-9_.-]+$/
const FLOW_EDGE_SOURCE_PORT_KEY = 'flow:sourcePortKey'
const FLOW_EDGE_TARGET_PORT_KEY = 'flow:targetPortKey'
const FLOW_COMPUTE_PROPERTY_KEY = 'flow:compute'
const FLOW_PORT_TYPES_PROPERTY_KEY = 'flow:portTypes'
const FRONTMATTER_HANDLES_PROPERTY_KEY = 'frontmatter:handles'
const FRONTMATTER_WIDGET_FIELDS_PROPERTY_KEY = 'frontmatter:widgetFields'
type FrontmatterWidgetFieldSpec = {
  fieldKey: string
  fieldType: string
  schemaPath?: string
}
function flowYamlKey(key: string): string {
  return FLOW_YAML_PLAIN_KEY_RE.test(key) ? key : JSON.stringify(key)
}
function flowYamlInlineValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value == null) return 'null'
  try {
    return JSON.stringify(value)
  } catch {
    return 'null'
  }
}
function flowYamlInlineStringValue(value: string): string {
  return FLOW_YAML_PLAIN_KEY_RE.test(value) ? value : JSON.stringify(value)
}
function appendFlowYamlFieldLines(lines: string[], indent: string, key: string, value: unknown): void {
  if (typeof value === 'undefined') return
  const yamlKey = flowYamlKey(key)
  if (typeof value === 'string' && value.includes('\n')) {
    lines.push(`${indent}${yamlKey}: |`)
    for (const row of value.split('\n')) lines.push(`${indent}  ${row}`)
    return
  }
  lines.push(`${indent}${yamlKey}: ${flowYamlInlineValue(value)}`)
}
function inferFrontmatterFlowFieldType(value: unknown): string {
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'array'
  if (value && typeof value === 'object') return 'object'
  return 'string'
}
function readFrontmatterWidgetFieldSpecs(node: GraphNode): FrontmatterWidgetFieldSpec[] {
  const props = (node.properties || {}) as Record<string, unknown>
  const raw = props[FRONTMATTER_WIDGET_FIELDS_PROPERTY_KEY]
  if (!Array.isArray(raw)) return []
  const out: FrontmatterWidgetFieldSpec[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const spec = raw[i]
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) continue
    const rec = spec as Record<string, unknown>
    const fieldKey = String(rec.fieldKey || '').trim()
    const fieldType = String(rec.fieldType || '').trim()
    const schemaPath = String(rec.schemaPath || '').trim()
    if (!fieldKey || !fieldType) continue
    out.push({
      fieldKey,
      fieldType,
      ...(schemaPath ? { schemaPath } : {}),
    })
  }
  return out
}
function readFrontmatterFlowFieldType(node: GraphNode, fieldName: string, value: unknown): string {
  const normalizedFieldName = String(fieldName || '').trim()
  if (!normalizedFieldName) return inferFrontmatterFlowFieldType(value)
  if (normalizedFieldName === 'id' || normalizedFieldName === 'type' || normalizedFieldName === 'label') return 'string'
  if (normalizedFieldName === 'position') return 'object'
  if (normalizedFieldName === 'handles') return 'object'
  if (normalizedFieldName === 'compute') return 'string'
  const specs = readFrontmatterWidgetFieldSpecs(node)
  for (let i = 0; i < specs.length; i += 1) {
    const spec = specs[i]
    if (!spec) continue
    const schemaPath = String(spec.schemaPath || '').trim()
    if (schemaPath === normalizedFieldName || schemaPath === `properties.${normalizedFieldName}` || spec.fieldKey === normalizedFieldName) {
      return spec.fieldType
    }
  }
  return inferFrontmatterFlowFieldType(value)
}
function appendFlowYamlEnvelopeFieldLines(
  lines: string[],
  indent: string,
  key: string,
  value: unknown,
  fieldType?: string,
): void {
  if (typeof value === 'undefined') return
  const yamlKey = flowYamlKey(key)
  const normalizedType = String(fieldType || '').trim() || inferFrontmatterFlowFieldType(value)
  if (typeof value === 'string' && value.includes('\n')) {
    const blockIndicator = key === 'output' && containsMarkdownPipeTable(value) ? '|-' : '|'
    lines.push(`${indent}${yamlKey}:`)
    lines.push(`${indent}  key: ${flowYamlInlineStringValue(String(key || '').trim() || key)}`)
    lines.push(`${indent}  type: ${flowYamlInlineStringValue(normalizedType)}`)
    lines.push(`${indent}  value: ${blockIndicator}`)
    for (const row of value.split('\n')) lines.push(`${indent}    ${row}`)
    return
  }
  lines.push(
    `${indent}${yamlKey}: {key: ${flowYamlInlineStringValue(String(key || '').trim() || key)}, type: ${flowYamlInlineStringValue(normalizedType)}, value: ${flowYamlInlineValue(value)}}`,
  )
}
function readFlowHandlesFromNode(node: GraphNode): Record<string, unknown> | null {
  const props = (node.properties || {}) as Record<string, unknown>
  const explicit = props[FRONTMATTER_HANDLES_PROPERTY_KEY]
  if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
    return explicit as Record<string, unknown>
  }
  const rawPortTypes = props[FLOW_PORT_TYPES_PROPERTY_KEY]
  if (!rawPortTypes || typeof rawPortTypes !== 'object' || Array.isArray(rawPortTypes)) return null
  const portTypes = rawPortTypes as Record<string, unknown>
  const target = portTypes.in && typeof portTypes.in === 'object' && !Array.isArray(portTypes.in)
    ? Object.keys(portTypes.in as Record<string, unknown>).filter(Boolean)
    : []
  const source = portTypes.out && typeof portTypes.out === 'object' && !Array.isArray(portTypes.out)
    ? Object.keys(portTypes.out as Record<string, unknown>).filter(Boolean)
    : []
  const out: Record<string, unknown> = {}
  if (target.length > 0) out.target = target
  if (source.length > 0) out.source = source
  return Object.keys(out).length > 0 ? out : null
}
function buildFrontmatterFlowBlockLines(graphData: GraphData): string[] {
  const lines: string[] = ['flow:']
  const meta = (graphData.metadata || {}) as Record<string, unknown>
  const settings = meta.frontmatterFlowSettings && typeof meta.frontmatterFlowSettings === 'object' && !Array.isArray(meta.frontmatterFlowSettings)
    ? (meta.frontmatterFlowSettings as Record<string, unknown>)
    : null
  if (settings) {
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'direction', settings.direction, 'string')
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'edgeType', settings.edgeType, 'string')
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'balancedViewportPreset', settings.balancedViewportPreset, 'string')
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'computed', settings.computed, 'boolean')
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'snapToGrid', settings.snapToGrid, 'boolean')
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'gridSize', settings.gridSize, 'number')
  }
  lines.push('  nodes:')
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  for (const node of nodes) {
    const originalProps = (node.properties || {}) as Record<string, unknown>
    const normalizedProps = normalizeGeneratedRichMediaTableProperties({ nodeType: node.type, nodeLabel: node.label, properties: originalProps })
    const normalizedNode: GraphNode = normalizedProps === originalProps ? node : { ...node, properties: normalizedProps as GraphNode['properties'] }
    appendFlowYamlEnvelopeFieldLines(lines, '    - ', 'id', String(node.id || ''), 'string')
    appendFlowYamlEnvelopeFieldLines(lines, '      ', 'type', String(node.type || 'Node'), 'string')
    appendFlowYamlEnvelopeFieldLines(lines, '      ', 'label', String(node.label || node.id || ''), 'string')
    const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : null
    const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : null
    if (x != null || y != null) {
      const position: Record<string, number> = {}
      if (x != null) position.x = x
      if (y != null) position.y = y
      appendFlowYamlEnvelopeFieldLines(lines, '      ', 'position', position, 'object')
    }
    const handles = readFlowHandlesFromNode(normalizedNode)
    if (handles) appendFlowYamlEnvelopeFieldLines(lines, '      ', 'handles', handles, 'object')
    const props = normalizedProps
    const propEntries = Object.entries(props)
      .filter(([key, value]) => {
        if (typeof value === 'undefined') return false
        if (key === FRONTMATTER_HANDLES_PROPERTY_KEY) return false
        if (key === FRONTMATTER_WIDGET_FIELDS_PROPERTY_KEY) return false
        if (key === FLOW_COMPUTE_PROPERTY_KEY) return false
        return true
      })
      .sort(([a], [b]) => a.localeCompare(b))
    for (const [key, value] of propEntries) {
      appendFlowYamlEnvelopeFieldLines(lines, '      ', key, value, readFrontmatterFlowFieldType(normalizedNode, key, value))
    }
    const compute = typeof props[FLOW_COMPUTE_PROPERTY_KEY] === 'string' ? String(props[FLOW_COMPUTE_PROPERTY_KEY] || '') : ''
    if (compute.trim()) appendFlowYamlEnvelopeFieldLines(lines, '      ', 'compute', compute, 'string')
  }
  lines.push('  edges:')
  const edges = Array.isArray(graphData.edges) ? graphData.edges : []
  for (const edge of edges) {
    const props = (edge.properties || {}) as Record<string, unknown>
    const source = String(edge.source || '').trim()
    const target = String(edge.target || '').trim()
    const sourceHandle = String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '').trim()
    const targetHandle = String(props[FLOW_EDGE_TARGET_PORT_KEY] || '').trim()
    const row: Record<string, unknown> = {
      id: String(edge.id || ''),
      source,
      ...(sourceHandle ? { sourceHandle } : {}),
      target,
      ...(targetHandle ? { targetHandle } : {}),
    }
    const label = String(edge.label || '').trim()
    if (label) row.label = label
    if (typeof props.animated === 'boolean') row.animated = props.animated
    const socketType = String(props['flow:socketType'] || '').trim()
    if (socketType) row.type = socketType
    lines.push(`    - ${flowYamlInlineValue(row)}`)
  }
  return lines
}
function replaceTopLevelYamlSectionLines(args: {
  yamlLines: string[]
  sectionKey: string
  sectionLines: string[]
}): string[] {
  const sectionKey = String(args.sectionKey || '').trim()
  if (!sectionKey) return args.yamlLines
  const escapedSectionKey = sectionKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const sectionHeaderRe = new RegExp(`^${escapedSectionKey}\\s*:\\s*$`)
  let start = -1
  let end = args.yamlLines.length
  for (let i = 0; i < args.yamlLines.length; i += 1) {
    const trimmed = String(args.yamlLines[i] || '').trim()
    if (!sectionHeaderRe.test(trimmed)) continue
    start = i
    break
  }
  if (start >= 0) {
    end = args.yamlLines.length
    for (let i = start + 1; i < args.yamlLines.length; i += 1) {
      const rawLine = String(args.yamlLines[i] || '')
      const trimmed = rawLine.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const indent = rawLine.match(/^\s*/)?.[0]?.length || 0
      if (indent === 0 && /^[A-Za-z0-9_.-]+\s*:/.test(trimmed)) {
        end = i
        break
      }
    }
  }
  return start >= 0
    ? [...args.yamlLines.slice(0, start), ...args.sectionLines, ...args.yamlLines.slice(end)]
    : [...args.yamlLines.filter((line, index, arr) => !(arr.length === 1 && line.trim() === '')), ...args.sectionLines]
}
function buildTopLevelYamlSectionLines(sectionKey: string, sectionValue: unknown): string[] {
  const key = String(sectionKey || '').trim()
  if (!key || typeof sectionValue === 'undefined') return []
  const dumped = String(
    yaml.dump(
      { [key]: sectionValue },
      {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      },
    ) || '',
  ).trimEnd()
  return dumped ? dumped.split('\n') : []
}
function readFrontmatterTimelineSectionValue(graphData: GraphData): unknown {
  const metadata = graphData.metadata && typeof graphData.metadata === 'object' && !Array.isArray(graphData.metadata)
    ? (graphData.metadata as Record<string, unknown>)
    : null
  const frontmatterMeta = metadata?.frontmatterMeta && typeof metadata.frontmatterMeta === 'object' && !Array.isArray(metadata.frontmatterMeta)
    ? (metadata.frontmatterMeta as Record<string, unknown>)
    : null
  return frontmatterMeta?.timeline
}
function graphDataHasFlowTopology(graphData: GraphData | null | undefined): boolean {
  return (Array.isArray(graphData?.nodes) && graphData!.nodes.length > 0)
    || (Array.isArray(graphData?.edges) && graphData!.edges.length > 0)
}
function frontmatterTextHasFlowTopology(rawText: string): boolean {
  const block = extractYamlFrontmatterBlock(rawText)
  if (!block) return false
  try {
    const parsed = yaml.load(String(block.yamlText || ''))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    const flow = (parsed as Record<string, unknown>).flow
    if (!flow || typeof flow !== 'object' || Array.isArray(flow)) return false
    const record = flow as Record<string, unknown>
    return (Array.isArray(record.nodes) && record.nodes.length > 0)
      || (Array.isArray(record.edges) && record.edges.length > 0)
  } catch {
    return false
  }
}
function upsertTopLevelFrontmatterSectionMarkdownText(args: {
  rawText: string
  sectionKey: string
  sectionValue: unknown
}): string {
  const sectionLines = buildTopLevelYamlSectionLines(args.sectionKey, args.sectionValue)
  if (sectionLines.length === 0) return args.rawText
  const block = extractYamlFrontmatterBlock(args.rawText)
  if (!block) {
    const prefix = ['---', ...sectionLines, '---', ''].join('\n')
    return args.rawText ? `${prefix}\n${args.rawText}` : `${prefix}\n`
  }
  const yamlLines = String(block.yamlText || '').split('\n')
  const nextYamlLines = replaceTopLevelYamlSectionLines({
    yamlLines,
    sectionKey: args.sectionKey,
    sectionLines,
  })
  const nextYaml = nextYamlLines.filter((line, index, arr) => !(arr.length > 1 && index === 0 && line === '')).join('\n')
  const suffix = args.rawText.slice(block.rawBlock.length)
  return `---\n${nextYaml}\n---${suffix}`
}

export function upsertFrontmatterFlowMarkdownText(rawText: string, graphData: GraphData): string {
  const text = String(rawText || '')
  if (!graphDataHasFlowTopology(graphData) && frontmatterTextHasFlowTopology(text)) return text
  const flowLines = buildFrontmatterFlowBlockLines(graphData)
  const block = extractYamlFrontmatterBlock(text)
  if (!block) {
    const prefix = ['---', ...flowLines, '---', ''].join('\n')
    return text ? `${prefix}\n${text}` : `${prefix}\n`
  }
  const yamlLines = String(block.yamlText || '').split('\n')
  let start = -1
  let end = yamlLines.length
  for (let i = 0; i < yamlLines.length; i += 1) {
    const trimmed = String(yamlLines[i] || '').trim()
    if (/^flow\s*:\s*$/.test(trimmed)) {
      start = i
      break
    }
  }
  if (start >= 0) {
    end = yamlLines.length
    for (let i = start + 1; i < yamlLines.length; i += 1) {
      const rawLine = String(yamlLines[i] || '')
      const trimmed = rawLine.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const indent = rawLine.match(/^\s*/)?.[0]?.length || 0
      if (indent === 0 && /^[A-Za-z0-9_.-]+\s*:/.test(trimmed)) {
        end = i
        break
      }
    }
  }
  const nextYamlLines = start >= 0
    ? [...yamlLines.slice(0, start), ...flowLines, ...yamlLines.slice(end)]
    : [...yamlLines.filter((line, index, arr) => !(arr.length === 1 && line.trim() === '')), ...flowLines]
  const nextYaml = nextYamlLines.filter((line, index, arr) => !(arr.length > 1 && index === 0 && line === '')).join('\n')
  const suffix = text.slice(block.rawBlock.length)
  const nextText = `---\n${nextYaml}\n---${suffix}`
  const timelineSectionValue = readFrontmatterTimelineSectionValue(graphData)
  return upsertTopLevelFrontmatterSectionMarkdownText({
    rawText: nextText,
    sectionKey: 'timeline',
    sectionValue: timelineSectionValue,
  })
}

export function sourceFileShouldWriteFrontmatterFlow(file: GraphState['sourceFiles'][number]): boolean {
  const name = String(file?.name || '').trim()
  const path = String(file?.source?.path || '').trim()
  return isMarkdownLikeFileName(name) || isMarkdownLikeFileName(path)
}

export function isActiveMarkdownSourceFile(state: GraphState, file: GraphState['sourceFiles'][number]): boolean {
  const preferred = resolvePreferredComposedSourceFileFromState({
    state,
    fallbackName: state.markdownDocumentName,
  })
  if (!preferred || !file) return false
  const preferredId = String(preferred.id || '').trim()
  const fileId = String(file.id || '').trim()
  if (preferredId && fileId && preferredId === fileId) return true
  const preferredPath = readComposedSourceFilePath(preferred)
  const filePath = readComposedSourceFilePath(file)
  return !!preferredPath && preferredPath === filePath
}

export function findSourceFileForMarkdownDocument(state: GraphState, name: string): GraphState['sourceFiles'][number] | null {
  return resolvePreferredComposedSourceFileFromState({
    state,
    fallbackName: name,
  })
}

export function writeWorkspaceSourceTextIfPresent(
  file: GraphState['sourceFiles'][number],
  text: string,
  label = 'Source file update',
  source: 'sourceFiles' | 'gitGraph' = 'sourceFiles',
): Promise<boolean> {
  const workspacePath = normalizeComposedSourcePath(readComposedSourceFilePath(file))
  if (!workspacePath) return Promise.resolve(false)
  recordDocumentVersionSnapshot({
    path: workspacePath,
    text,
    label,
    source,
  })
  return enqueueWorkspaceSourceTextWrite(workspacePath, text)
}

function isFrontmatterFlowGraphData(graphData: GraphData | null | undefined): boolean {
  return isFrontmatterFlowGraph(graphData)
}

function syncStrybldrStoryboardMarkdownFromParsedGraph(args: {
  text: string
  graphData: GraphData | null | undefined
  previousNode?: GraphNode | null
  nextNode?: GraphNode | null
}): string | null {
  let nextText = args.text
  if (!args.previousNode && args.nextNode) {
    nextText = appendStrybldrStoryboardNodeSource(nextText, args.nextNode)
  }
  const nodeId = String(args.nextNode?.id || args.previousNode?.id || '').trim()
  const sourceOwnedNode = args.nextNode || args.previousNode
  if (nodeId && (!args.previousNode || isStrybldrStoryboardNodeSourceOwned(sourceOwnedNode))) {
    const cardPatch = buildStrybldrCardOverridePatchFromGraphNodeChange({
      previousNode: args.previousNode,
      nextNode: args.nextNode,
    })
    if (Object.keys(cardPatch).length > 0) {
      nextText = updateStrybldrStoryboardMarkdownCardOverride({
        text: nextText,
        nodeId,
        patch: cardPatch,
      }) || nextText
    }
  }
  return syncStrybldrStoryboardMarkdownWorkflowEdges({
    text: nextText,
    graphData: args.graphData,
  }) || nextText
}
function findActiveMarkdownDocumentSourceFile(args: {
  state: GraphState
  sourceFiles: GraphState['sourceFiles']
}): { index: number; file: GraphState['sourceFiles'][number] } | null {
  const activeName = String(args.state.markdownDocumentName || '').trim()
  if (!activeName) return null
  const activePath = normalizeComposedSourcePath(activeName)
  if (!activePath) return null
  for (let i = 0; i < args.sourceFiles.length; i += 1) {
    const file = args.sourceFiles[i]
    if (!file) continue
    const filePath = normalizeComposedSourcePath(readComposedSourceFilePath(file))
    if (filePath && filePath === activePath) {
      return { index: i, file }
    }
  }
  return null
}

export function syncActiveMarkdownDocumentTextFromParsedGraph(args: {
  state: GraphState
  sourceFiles: GraphState['sourceFiles']
  parsedGraphData: GraphData
  previousNode?: GraphNode | null
  nextNode?: GraphNode | null
}): {
  sourceFiles: GraphState['sourceFiles']
  markdownDocumentText?: string | null
  markdownDocumentName?: string | null
} {
  const activeName = String(args.state.markdownDocumentName || '').trim()
  const activeText = String(args.state.markdownDocumentText || '')
  if (!activeName || !activeText) return { sourceFiles: args.sourceFiles }
  if (!isMarkdownLikeFileName(activeName)) return { sourceFiles: args.sourceFiles }
  if (isStrybldrStoryboardMarkdown(activeText)) {
    const nextText = syncStrybldrStoryboardMarkdownFromParsedGraph({
      text: activeText,
      graphData: args.parsedGraphData,
      previousNode: args.previousNode,
      nextNode: args.nextNode,
    })
    if (!nextText || nextText === activeText) return { sourceFiles: args.sourceFiles }
    const activeFileMatch = findActiveMarkdownDocumentSourceFile(args)
    if (!activeFileMatch) {
      return {
        sourceFiles: args.sourceFiles,
        markdownDocumentText: nextText,
        markdownDocumentName: activeName,
      }
    }
    const nextSourceFiles = args.sourceFiles.slice()
    nextSourceFiles[activeFileMatch.index] = {
      ...activeFileMatch.file,
      text: nextText,
      parsedTextHash: '',
    }
    return {
      sourceFiles: nextSourceFiles,
      markdownDocumentText: nextText,
      markdownDocumentName: activeName,
    }
  }
  if (!isFrontmatterFlowGraphData(args.parsedGraphData)) return { sourceFiles: args.sourceFiles }
  const nextText = upsertFrontmatterFlowMarkdownText(activeText, args.parsedGraphData)
  if (nextText === activeText) return { sourceFiles: args.sourceFiles }
  const activeFileMatch = findActiveMarkdownDocumentSourceFile(args)
  if (!activeFileMatch) {
    return {
      sourceFiles: args.sourceFiles,
      markdownDocumentText: nextText,
      markdownDocumentName: activeName,
    }
  }
  const nextSourceFiles = args.sourceFiles.slice()
  nextSourceFiles[activeFileMatch.index] = {
    ...activeFileMatch.file,
    text: nextText,
    parsedTextHash: '',
  }
  return {
    sourceFiles: nextSourceFiles,
    markdownDocumentText: nextText,
    markdownDocumentName: activeName,
  }
}

export function writeActiveMarkdownDocumentTextIfPresent(args: {
  state: GraphState
  sourceFiles: GraphState['sourceFiles']
  text: string
  label?: string
  source?: 'sourceFiles' | 'gitGraph'
}): Promise<boolean> {
  const activeFileMatch = findActiveMarkdownDocumentSourceFile(args)
  if (activeFileMatch?.file) {
    return writeWorkspaceSourceTextIfPresent(activeFileMatch.file, args.text, args.label || 'Source file update', args.source || 'sourceFiles')
  }
  const activePath = normalizeComposedSourcePath(String(args.state.markdownDocumentName || '').trim())
  if (!activePath) return Promise.resolve(false)
  if (!isMarkdownLikeFileName(activePath)) return Promise.resolve(false)
  recordDocumentVersionSnapshot({
    path: activePath,
    text: args.text,
    label: args.label || 'Markdown document update',
    source: args.source || 'sourceFiles',
  })
  return enqueueWorkspaceSourceTextWrite(activePath, args.text)
}

export function syncSourceFileTextFromParsedGraph(args: {
  state: GraphState
  sourceFiles: GraphState['sourceFiles']
  fileIndex: number
  parsedGraphData: GraphData
  previousNode?: GraphNode | null
  nextNode?: GraphNode | null
}): { sourceFiles: GraphState['sourceFiles']; markdownDocumentText?: string | null } {
  const file = args.sourceFiles[args.fileIndex]
  if (!file || !sourceFileShouldWriteFrontmatterFlow(file)) return { sourceFiles: args.sourceFiles }
  const currentText = String(file.text || '')
  if (isStrybldrStoryboardMarkdown(currentText)) {
    const nextText = syncStrybldrStoryboardMarkdownFromParsedGraph({
      text: currentText,
      graphData: args.parsedGraphData,
      previousNode: args.previousNode,
      nextNode: args.nextNode,
    })
    if (!nextText || nextText === currentText) return { sourceFiles: args.sourceFiles }
    const nextSourceFiles = args.sourceFiles.slice()
    nextSourceFiles[args.fileIndex] = {
      ...file,
      text: nextText,
      parsedTextHash: '',
    }
    return {
      sourceFiles: nextSourceFiles,
      ...(isActiveMarkdownSourceFile(args.state, file) ? { markdownDocumentText: nextText } : {}),
    }
  }
  const nextText = upsertFrontmatterFlowMarkdownText(currentText, args.parsedGraphData)
  if (nextText === currentText) return { sourceFiles: args.sourceFiles }
  const nextSourceFiles = args.sourceFiles.slice()
  nextSourceFiles[args.fileIndex] = {
    ...file,
    text: nextText,
    parsedTextHash: '',
  }
  return {
    sourceFiles: nextSourceFiles,
    ...(isActiveMarkdownSourceFile(args.state, file) ? { markdownDocumentText: nextText } : {}),
  }
}
