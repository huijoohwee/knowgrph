import { ORCHESTRATOR_AGENTIC_COPY } from '@/features/panels/config'
import { UI_COPY } from '@/lib/config'
import {
  isGraphRagPathValue,
  toParsedTraversePath,
  toParsedExamplePath,
} from '@/lib/graph/graphragTraversal'
import type {
  AgenticGraphRagPathValue,
  ParsedAgenticGraphRagTraversePath,
  ParsedAgenticGraphRagExamplePath,
  GraphData,
  JSONValue,
} from '@/lib/graph/types'

type GraphRagPathSummary = {
  ownerNodeId: string | number
  ownerNodeLabel: string
  graphRAGPath: AgenticGraphRagPathValue
  traversePath: ParsedAgenticGraphRagTraversePath | null
  examplePath: ParsedAgenticGraphRagExamplePath | null
}

export function buildOrchestratorPathEditorText(
  data: GraphData | null,
  selectedNodeId: string | null,
): string {
  if (!data || !Array.isArray(data.nodes)) {
    return UI_COPY.orchestratorNoGraphDataLoaded
  }
  const nodes = data.nodes
  const preferredId = selectedNodeId ? String(selectedNodeId) : ''

  const summaries: GraphRagPathSummary[] = []

  nodes.forEach(node => {
    const props = node.properties ?? {}
    const raw = (props as Record<string, JSONValue>).graphRAGPath as AgenticGraphRagPathValue | undefined
    if (!isGraphRagPathValue(raw)) return
    const traversePath = toParsedTraversePath(raw)
    const examplePath = toParsedExamplePath(raw)
    summaries.push({
      ownerNodeId: node.id,
      ownerNodeLabel: typeof node.label === 'string' ? node.label : String(node.id),
      graphRAGPath: raw,
      traversePath,
      examplePath,
    })
  })

  if (summaries.length === 0) {
    return ORCHESTRATOR_AGENTIC_COPY.traversalMetadataMissingText
  }

  const active =
    summaries.find(entry => String(entry.ownerNodeId) === preferredId) ??
    summaries[0]

  const payload = {
    activePath: active,
    availablePaths: summaries.map(entry => {
      const traversePath = entry.traversePath
      const examplePath = entry.examplePath
      const query = traversePath && typeof traversePath.query === 'string' ? traversePath.query : null
      const example =
        examplePath && typeof examplePath.example === 'string' ? examplePath.example : null
      const hasTraverse = Boolean(traversePath && Array.isArray(traversePath.traverse) && traversePath.traverse.length > 0)
      const hasHops = Boolean(examplePath && Array.isArray(examplePath.hops) && examplePath.hops.length > 0)
      const hasMultiHop = Boolean(traversePath && Array.isArray(traversePath.multiHop) && traversePath.multiHop.length > 0)
      let pathType: 'traverse' | 'example' | 'mixed' = 'mixed'
      if (hasTraverse && !hasHops) pathType = 'traverse'
      else if (hasHops && !hasTraverse) pathType = 'example'
      return {
        ownerNodeId: entry.ownerNodeId,
        ownerNodeLabel: entry.ownerNodeLabel,
        query,
        example,
        hasTraverse,
        hasMultiHop,
        hasHops,
        pathType,
      }
    }),
  }

  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return 'graphRAGPath traversal metadata is present but could not be serialized.'
  }
}

export function buildOrchestratorPathLegend(draftText: string): string {
  let legend = ORCHESTRATOR_AGENTIC_COPY.pathLegendEmptyText
  try {
    const parsed = JSON.parse(draftText) as {
      activePath?: { graphRAGPath?: Record<string, JSONValue> }
      availablePaths?: Array<{ pathType?: string }>
    }
    const activePathType = Array.isArray(parsed.availablePaths) && parsed.availablePaths.length > 0
      ? parsed.availablePaths[0]?.pathType
      : undefined
    if (activePathType === 'traverse') {
      legend = ORCHESTRATOR_AGENTIC_COPY.pathLegendTraverseText
    } else if (activePathType === 'example') {
      legend = ORCHESTRATOR_AGENTIC_COPY.pathLegendExampleText
    } else if (activePathType === 'mixed') {
      legend = ORCHESTRATOR_AGENTIC_COPY.pathLegendMixedText
    }
  } catch {
    legend = ORCHESTRATOR_AGENTIC_COPY.pathLegendParseErrorText
  }
  return legend
}

export type OrchestratorTraversalSummary = {
  mode?: string | null
  edgeIds?: ReadonlyArray<string | number> | null
}

export type OrchestratorTraversalLegendConfig = {
  graphRagMaxFullSteps: number
  graphRagHeadWhenTruncated: number
  genericMaxFullSteps: number
  genericHeadWhenTruncated: number
  tailStepsWhenTruncated: number
}

export function buildTraversalStepLegend(
  graph: GraphData | null,
  traversal: OrchestratorTraversalSummary | null,
  config: OrchestratorTraversalLegendConfig,
): string {
  if (!graph || !Array.isArray(graph.edges)) return ''
  if (!traversal || !Array.isArray(traversal.edgeIds) || traversal.edgeIds.length === 0) {
    return ''
  }
  const nodeLabels: Record<string, string> = {}
  if (Array.isArray(graph.nodes)) {
    graph.nodes.forEach(node => {
      const id = String(node.id)
      const label = typeof node.label === 'string' && node.label.length > 0 ? node.label : id
      nodeLabels[id] = label
    })
  }
  const edgesById: Record<string, { source: string; target: string; label: string }> = {}
  graph.edges.forEach(edge => {
    const id = String(edge.id)
    const source = String(edge.source)
    const target = String(edge.target)
    const label = String(edge.label ?? '')
    edgesById[id] = { source, target, label }
  })
  const steps: string[] = []
  traversal.edgeIds.forEach((edgeId, index) => {
    const edge = edgesById[String(edgeId)]
    if (!edge) return
    const sourceLabel = nodeLabels[edge.source] || edge.source
    const targetLabel = nodeLabels[edge.target] || edge.target
    const label = edge.label
    const prefix = `Step ${index + 1}:`
    if (label && label.length > 0) {
      steps.push(`${prefix} ${sourceLabel} ${label} ${targetLabel}`)
    } else {
      steps.push(`${prefix} ${sourceLabel} → ${targetLabel}`)
    }
  })
  if (!steps.length) return ''
  const total = steps.length
  const mode = traversal.mode
  const tailConfig = config.tailStepsWhenTruncated > 0 ? config.tailStepsWhenTruncated : 1
  if (mode === 'graphRag') {
    const maxFull = config.graphRagMaxFullSteps > 0 ? config.graphRagMaxFullSteps : 1
    if (total <= maxFull) {
      return `Traversal steps (${total}): ${steps.join(' → ')}`
    }
    const configuredHead = config.graphRagHeadWhenTruncated > 0 ? config.graphRagHeadWhenTruncated : 1
    const headCount = Math.min(configuredHead, total - 1)
    const tailCount = Math.min(tailConfig, total - headCount)
    const head = steps.slice(0, headCount)
    const tail = steps.slice(total - tailCount)
    return `Traversal steps (${total}): ${head.join(' → ')} → … → ${tail.join(' → ')}`
  }
  const maxFullGeneric = config.genericMaxFullSteps > 0 ? config.genericMaxFullSteps : 1
  if (total <= maxFullGeneric) {
    return `Traversal steps (${total}): ${steps.join(' → ')}`
  }
  const configuredHead = config.genericHeadWhenTruncated > 0 ? config.genericHeadWhenTruncated : 1
  const headCount = Math.min(configuredHead, total - 1)
  const tailCount = Math.min(tailConfig, total - headCount)
  const head = steps.slice(0, headCount)
  const tail = steps.slice(total - tailCount)
  return `Traversal steps (${total}): ${head.join(' → ')} → … → ${tail.join(' → ')}`
}

type ApplyDraftResult =
  | { ok: true; nextGraph: GraphData }
  | { ok: false; error: string }

export function applyOrchestratorPathDraft(data: GraphData | null, draftText: string): ApplyDraftResult {
  if (!data || !Array.isArray(data.nodes)) {
    return { ok: false, error: UI_COPY.orchestratorNoGraphDataToUpdate }
  }
  let parsed: {
    activePath?: {
      ownerNodeId?: string | number
      graphRAGPath?: AgenticGraphRagPathValue
    }
  } | null = null
  try {
    parsed = JSON.parse(draftText)
  } catch {
    return { ok: false, error: UI_COPY.orchestratorTextInvalidJson }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: UI_COPY.orchestratorTextExpectedTopLevelObject }
  }
  const active = parsed.activePath
  if (!active || typeof active !== 'object') {
    return { ok: false, error: UI_COPY.orchestratorTextExpectedActivePathObject }
  }
  const ownerNodeId = active.ownerNodeId
  const rawPath = active.graphRAGPath
  const ownerIdStr = ownerNodeId != null ? String(ownerNodeId) : ''
  if (!ownerIdStr) {
    return { ok: false, error: UI_COPY.orchestratorTextOwnerNodeIdRequired }
  }
  if (!rawPath || !isGraphRagPathValue(rawPath as JSONValue)) {
    return { ok: false, error: UI_COPY.orchestratorTextGraphRagPathInvalid }
  }
  const traversePath = toParsedTraversePath(rawPath)
  const examplePath = toParsedExamplePath(rawPath)
  if (!traversePath && !examplePath) {
    return { ok: false, error: UI_COPY.orchestratorTextGraphRagPathMissingParts }
  }
  const nodeIds = new Set<string>()
  data.nodes.forEach(node => {
    nodeIds.add(String(node.id))
  })
  if (!nodeIds.has(ownerIdStr)) {
    return { ok: false, error: UI_COPY.orchestratorTextNoNodeWithId(ownerIdStr) }
  }
  if (traversePath && Array.isArray(traversePath.traverse) && traversePath.traverse.length > 0) {
    const missingTraverse = traversePath.traverse.filter(id => !nodeIds.has(String(id)))
    if (missingTraverse.length > 0) {
      return {
        ok: false,
        error: UI_COPY.orchestratorTextTraverseIdsMissing(missingTraverse.map(id => String(id))),
      }
    }
  }
  const nextNodes = data.nodes.map(node => {
    if (String(node.id) !== ownerIdStr) return node
    const props = node.properties ?? {}
    const nextProps: Record<string, JSONValue> = {
      ...props,
      graphRAGPath: rawPath as JSONValue,
    }
    return { ...node, properties: nextProps }
  })
  const nextGraph: GraphData = { ...data, nodes: nextNodes }
  return { ok: true, nextGraph }
}

