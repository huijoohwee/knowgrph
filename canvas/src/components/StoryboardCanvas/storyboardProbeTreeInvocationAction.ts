import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import {
  STORYBOARD_ACTION_PROPERTY_KEYS,
  STORYBOARD_EMPTY_LANE,
  STORYBOARD_OUTPUT_PROPERTY_KEYS,
  STORYBOARD_PROMPT_PROPERTY_KEYS,
  STORYBOARD_SUMMARY_PROPERTY_KEYS,
  STORYBOARD_TITLE_PROPERTY_KEYS,
} from '@/components/StoryboardCanvas/storyboardModel'
import {
  AGENTIC_OS_DOC_INVOCATIONS,
  buildAgenticOsDocInvocationMarkdown,
  KNOWGRPH_PROBE_TREE_DOC_INVOCATION_ID,
} from '@/features/agentic-os/agenticOsDocInvocations'
import { hashText } from '@/features/parsers/hash'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import {
  readGraphNodeCanonicalTextProperty,
  readGraphNodeCardTitle,
  readGraphNodeProperties,
} from '@/lib/cards/graphNodeCardFields'
import {
  buildProbeTreeStoryboardMermaidFlowchart,
  PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND,
} from '@/components/StoryboardCanvas/storyboardProbeTreeMermaidFlowchart'

type ProbeTreeResultKind = 'success' | 'neutral' | 'warning'

export type ProbeTreeBranchCardMaterializationResult = {
  graphData: GraphData | null
  changed: boolean
  kind: ProbeTreeResultKind
  message: string
  materializedNodeIds: string[]
  invocationText: string
}

const PROBE_TREE_EDGE_LABEL = 'candidateOption'
const PROBE_TREE_NODE_TYPE = 'ProbeTreeCandidate'

const PROBE_TREE_BRANCH_HEURISTICS = [
  {
    key: 'clarify',
    title: 'Clarify probe',
    summary: 'Resolve missing intent, source, or constraint context before selecting a branch.',
    action: 'Select when the next step needs one bounded clarification before tool execution.',
  },
  {
    key: 'generate',
    title: 'Generate branches',
    summary: 'Run the Probe-Tree contract against the selected card and produce bounded next-step options.',
    action: 'Select when the card is ready for branch generation through the Probe-Tree harness.',
  },
  {
    key: 'select',
    title: 'Select handoff',
    summary: 'Promote the strongest branch into the canvas as the next editable step.',
    action: 'Select after comparing branch cards and approving one next step for execution.',
  },
] as const

const cleanPromptValue = (value: unknown, maxLength = 180): string => (
  String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
)

const asJson = (value: unknown): JSONValue => value as JSONValue

const readCardTextProperty = (properties: Record<string, unknown>, keys: readonly string[]): string => (
  cleanPromptValue(readGraphNodeCanonicalTextProperty(properties, keys), 320)
)

const readCardNumberProperty = (properties: Record<string, unknown>, keys: readonly string[]): number => {
  for (const key of keys) {
    const value = properties[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return 0
}

const readCardStringArrayProperty = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(item => cleanPromptValue(item, 80)).filter(Boolean)
  const text = cleanPromptValue(value, 160)
  return text ? [text] : []
}

const cloneGraphNodes = (graphData: GraphData): GraphNode[] => (
  (Array.isArray(graphData.nodes) ? graphData.nodes : []).map(node => ({
    ...node,
    properties: { ...(node.properties || {}) },
  }))
)

const cloneGraphEdges = (graphData: GraphData): GraphEdge[] => (
  (Array.isArray(graphData.edges) ? graphData.edges : []).map(edge => ({
    ...edge,
    properties: { ...(edge.properties || {}) },
  }))
)

const makeProbeTreeEdge = (source: string, target: string): GraphEdge => ({
  id: `probe-tree:edge:${hashText(`${source}:${PROBE_TREE_EDGE_LABEL}:${target}`).slice(0, 12)}`,
  source,
  target,
  label: PROBE_TREE_EDGE_LABEL,
  properties: {
    evidenceKind: asJson('runtime-action'),
    confidence: asJson('medium'),
  },
})

const readSelectedCardText = (card: StoryboardCardModel): string => (
  [
    card.title,
    card.summary,
    card.action,
    card.prompt,
    card.lane,
    card.typeLabel,
  ].map(value => cleanPromptValue(value, 240)).filter(Boolean).join(' ')
)

const buildProbeTreeRequestSignature = (card: StoryboardCardModel): string => (
  hashText([
    card.id,
    card.title,
    card.summary,
    card.action,
    card.prompt,
    card.lane,
    card.typeLabel,
  ].map(value => cleanPromptValue(value, 240)).join('\n')).slice(0, 12)
)

const buildSelectedCardPromptContext = (card?: StoryboardCardModel | null): string => {
  if (!card) return 'Generate selectable Probe-Tree next-step cards for the active canvas context.'
  const lines = [
    `Selected card id: ${cleanPromptValue(card.id, 80)}`,
    `Selected card title: ${cleanPromptValue(card.title || card.id)}`,
    card.lane ? `Selected card lane: ${cleanPromptValue(card.lane, 80)}` : '',
    card.typeLabel ? `Selected card type: ${cleanPromptValue(card.typeLabel, 80)}` : '',
    card.summary ? `Selected card summary: ${cleanPromptValue(card.summary)}` : '',
    card.action ? `Selected card action: ${cleanPromptValue(card.action)}` : '',
    card.prompt ? `Selected card prompt: ${cleanPromptValue(card.prompt)}` : '',
  ].filter(Boolean)
  return [
    'Generate selectable Probe-Tree next-step cards from this selected card.',
    ...lines,
  ].join(' ')
}

export function buildProbeTreeCardFromGraphNode(node: GraphNode, inputIndex = 0): StoryboardCardModel {
  const properties = readGraphNodeProperties(node)
  const lane = cleanPromptValue(properties.lane || properties.stage || properties.status, 80) || STORYBOARD_EMPTY_LANE
  const typeLabel = cleanPromptValue(properties.cardTypeLabel || properties.typeLabel || properties.kind || node.type, 80) || 'Card'
  const order = readCardNumberProperty(properties, ['order', 'sort', 'sequence', 'index', 'rank'])
  return {
    id: String(node.id || ''),
    title: cleanPromptValue(readGraphNodeCardTitle(node), 160),
    summary: readCardTextProperty(properties, STORYBOARD_SUMMARY_PROPERTY_KEYS),
    output: readCardTextProperty(properties, STORYBOARD_OUTPUT_PROPERTY_KEYS),
    lane,
    lanePropertyKey: 'lane',
    typeLabel,
    indexLabel: cleanPromptValue(properties.index || properties.step || properties.position, 80),
    slugline: cleanPromptValue(properties.slugline, 180),
    action: readCardTextProperty(properties, STORYBOARD_ACTION_PROPERTY_KEYS),
    dialogue: cleanPromptValue(properties.dialogue || properties.voiceover || properties.narration, 320),
    prompt: readCardTextProperty(properties, STORYBOARD_PROMPT_PROPERTY_KEYS),
    style: cleanPromptValue(properties.style || properties.preset || properties.variant, 180),
    tags: readCardStringArrayProperty(properties.tags),
    meta: readCardStringArrayProperty(properties.meta),
    invocationTokens: readCardStringArrayProperty(properties.invocationTokens),
    sourceModelLabel: cleanPromptValue(properties.sourceModel || properties.modelLabel, 120),
    sourcePromptLabel: cleanPromptValue(properties.sourcePromptLabel || properties.promptLabel, 120),
    href: cleanPromptValue(properties.href || properties.url || properties.sourceUrl, 240),
    media: null,
    references: [],
    order,
    inputIndex,
    candidateScore: 0,
    structural: false,
  }
}

export function resolveProbeTreeCardMaterializationRequestText(card?: StoryboardCardModel | null): string {
  const doc = AGENTIC_OS_DOC_INVOCATIONS.find(invocation => invocation.id === KNOWGRPH_PROBE_TREE_DOC_INVOCATION_ID)
  if (!doc) return ''
  return [
    buildAgenticOsDocInvocationMarkdown(doc),
    doc.hashToken,
    buildSelectedCardPromptContext(card),
    'Return the AI/LLM response as `response.structuredContent.cards` so the canvas response projector can materialize editable branch cards for the user to select next steps.',
  ].join(' ')
}

export function materializeProbeTreeBranchCards(args: {
  graphData: GraphData | null | undefined
  card?: StoryboardCardModel | null
}): ProbeTreeBranchCardMaterializationResult {
  const invocation = AGENTIC_OS_DOC_INVOCATIONS.find(entry => entry.id === KNOWGRPH_PROBE_TREE_DOC_INVOCATION_ID)
  const invocationText = resolveProbeTreeCardMaterializationRequestText(args.card)
  if (!args.graphData || !args.card || !invocation || !invocationText) {
    return {
      graphData: args.graphData || null,
      changed: false,
      kind: 'warning',
      message: 'Probe-Tree needs an active graph card.',
      materializedNodeIds: [],
      invocationText,
    }
  }

  const graphData = args.graphData
  const card = args.card
  const nodes = cloneGraphNodes(graphData)
  const edges = cloneGraphEdges(graphData)
  const parent = nodes.find(node => node.id === card.id) || null
  if (!parent) {
    return {
      graphData,
      changed: false,
      kind: 'warning',
      message: 'Probe-Tree could not resolve the selected card in the active graph.',
      materializedNodeIds: [],
      invocationText,
    }
  }

  const requestSignature = buildProbeTreeRequestSignature(card)
  const parentTitle = cleanPromptValue(card.title || parent.label || card.id, 120)
  const parentSummary = cleanPromptValue(readSelectedCardText(card), 320)
  const parentX = typeof parent.x === 'number' && Number.isFinite(parent.x) ? parent.x : null
  const parentY = typeof parent.y === 'number' && Number.isFinite(parent.y) ? parent.y : null
  const materializedNodeIds: string[] = []
  let changed = false

  PROBE_TREE_BRANCH_HEURISTICS.forEach((heuristic, index) => {
    const nodeId = `probe-tree:${heuristic.key}:${hashText(`${card.id}:${requestSignature}:${heuristic.key}`).slice(0, 12)}`
    materializedNodeIds.push(nodeId)
    const existingNode = nodes.find(node => node.id === nodeId)
    if (!existingNode) {
      const title = `${heuristic.title}: ${parentTitle}`
      nodes.push({
        id: nodeId,
        label: title,
        type: PROBE_TREE_NODE_TYPE,
        ...(parentX != null ? { x: parentX + 360 + index * 28 } : {}),
        ...(parentY != null ? { y: parentY + (index - 1) * 150 } : {}),
        properties: {
          title: asJson(title),
          lane: asJson('PROBE'),
          order: asJson((Number.isFinite(card.order) ? card.order : index) + 0.1 + index / 100),
          index: asJson(`P${index + 1}`),
          cardTypeLabel: asJson('Probe-Tree Card'),
          summary: asJson(`${heuristic.summary} Source card: ${parentSummary || parentTitle}.`),
          action: asJson(heuristic.action),
          prompt: asJson(`${invocation.slashCommand} ${invocation.hashToken} ${invocation.atToken} ${heuristic.action} Parent card: ${parentTitle}. ${parentSummary}`.trim()),
          command: asJson(invocation.slashCommand),
          slashCommand: asJson(invocation.slashCommand),
          hashToken: asJson(invocation.hashToken),
          atToken: asJson(invocation.atToken),
          invocation: asJson(`${invocation.slashCommand} ${invocation.hashToken} ${invocation.atToken}`),
          responseStructuredContentKind: asJson('cards'),
          responseMaterialization: asJson('response.structuredContent.cards'),
          probeTreeCandidateKey: asJson(heuristic.key),
          probeTreeRequestSignature: asJson(requestSignature),
          probeTreeTool: asJson(heuristic.key === 'select' ? 'probe.select' : 'probe.generate'),
          nextAction: asJson(heuristic.key === 'select' ? 'knowgrph.probe.select' : 'knowgrph.probe.generate'),
          parentGraphNodeId: asJson(parent.id),
          parentNodeId: asJson(parent.id),
          candidateStatus: asJson('selectable'),
          branchStatus: asJson('candidate'),
          tags: asJson(['probe-tree', 'candidateOption', heuristic.key]),
        },
      })
      changed = true
    }

    const edge = makeProbeTreeEdge(parent.id, nodeId)
    if (!edges.some(existing => existing.id === edge.id || (
      existing.source === edge.source &&
      existing.target === edge.target &&
      existing.label === edge.label
    ))) {
      edges.push(edge)
      changed = true
    }
  })

  const nextGraphData = changed
    ? {
        ...graphData,
        nodes,
        edges,
        metadata: {
          ...(graphData.metadata || {}),
          probeTreeMaterializedAtMs: Date.now(),
          probeTreeInvocation: invocation.slashCommand,
          probeTreeSemantic: invocation.hashToken,
        } as GraphData['metadata'],
      }
    : graphData
  const probeTreeMermaidFlowchart = buildProbeTreeStoryboardMermaidFlowchart({
    graphData: nextGraphData,
    rootNodeId: parent.id,
  })
  const metadataChanged = (
    (nextGraphData.metadata || {}).probeTreeMermaidFlowchart !== probeTreeMermaidFlowchart
    || (nextGraphData.metadata || {}).probeTreeMermaidFlowchartKind !== PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND
  )
  const finalGraphData = metadataChanged
    ? {
        ...nextGraphData,
        metadata: {
          ...(nextGraphData.metadata || {}),
          probeTreeMermaidFlowchart,
          probeTreeMermaidFlowchartKind: PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND,
        } as GraphData['metadata'],
      }
    : nextGraphData
  const message = changed
    ? 'Probe-Tree branch cards materialized on canvas.'
    : metadataChanged
      ? 'Probe-Tree Mermaid flowchart mapping refreshed.'
      : 'Probe-Tree branch cards already exist for this selected card.'

  return {
    graphData: finalGraphData,
    changed: changed || metadataChanged,
    kind: changed || metadataChanged ? 'success' : 'neutral',
    message,
    materializedNodeIds,
    invocationText,
  }
}

export function materializeProbeTreeBranchCardsFromGraphNode(args: {
  graphData: GraphData | null | undefined
  node?: GraphNode | null
}): ProbeTreeBranchCardMaterializationResult {
  return materializeProbeTreeBranchCards({
    graphData: args.graphData,
    card: args.node ? buildProbeTreeCardFromGraphNode(args.node) : null,
  })
}

export function invokeProbeTreeFromStoryboardToolbar(card?: StoryboardCardModel | null): void {
  const store = useGraphStore.getState()
  const result = materializeProbeTreeBranchCards({ graphData: store.graphData, card })
  if (result.changed && result.graphData) {
    store.setGraphDataPreservingLayout(result.graphData)
    store.addHistory('Probe-Tree branch cards')
  }
  if (result.materializedNodeIds.length > 0) {
    store.selectNodesExpanded({
      nodeIds: result.materializedNodeIds,
      activeNodeId: result.materializedNodeIds[0],
    })
  }
  try {
    store.pushUiToast({
      id: 'probe-tree:toolbar-materialize',
      kind: result.kind,
      message: result.message,
      dismissible: result.kind !== 'success',
      ttlMs: result.kind === 'success' ? 2600 : 4000,
    })
  } catch {
    void 0
  }
}
