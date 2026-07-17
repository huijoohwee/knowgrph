import {
  KNOWGRPH_PROBE_TREE_GENERATE_TOOL_NAME,
  KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS,
  KNOWGRPH_PROBE_TREE_MAX_DEPTH,
  KNOWGRPH_PROBE_TREE_SELECT_TOOL_NAME,
  buildKnowgrphProbeTreePromptPreset,
} from '@/features/agentic-os/probeTreePromptPreset'
import {
  KNOWGRPH_PROBE_TREE_CONTRACT_VERSION,
  PROBE_TREE_CARD_VARIANTS,
  PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
  normalizeProbeTreeContextAnchors,
  normalizeProbeTreeSelectionOptions,
} from '@/features/agent-ready/probeTreeContract.mjs'
import { RICH_MEDIA_TEXT_MARKDOWN_SCHEMA } from '@/features/rich-media/richMediaTextMarkdownContract.mjs'
import { FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import type { JSONValue } from '@/lib/graph/types'
import { readFieldValue, readFirstString } from './chatResponseStructuredRecord'

export { PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION } from '@/features/agent-ready/probeTreeContract.mjs'

const PROBE_TREE_TOOL_PATTERN = /^knowgrph\.probe\.(?:generate|select)$/i
const PROBE_TREE_DIRECT_TOOL_PATTERN = /\bknowgrph\.probe\.(?:generate|select)\b/i

const hasProbeTreeInvocation = (userQuery: string): boolean => {
  if (PROBE_TREE_DIRECT_TOOL_PATTERN.test(userQuery)) return true
  const tokens = new Set(
    [...String(userQuery || '').matchAll(/(^|\s)([/#@][A-Za-z0-9_.-]+)/g)]
      .map(match => String(match[2] || '').toLowerCase()),
  )
  return KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS.some(token => tokens.has(token.toLowerCase()))
}

export function buildProbeTreeCardMaterializationPrompt(userQuery: string): string {
  if (!hasProbeTreeInvocation(userQuery)) return ''
  return [
    'Probe-Tree LLM response contract:',
    `- Contract: ${PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION}.`,
    '- Treat the active request or selected card as the current probe node.',
    '- Resolve authored /knowgrph.probe-tree, #knowgrph.probe-tree, or @knowgrph.probe-tree metadata through knowgrph.agentic_canvas_os.docs.invoke when that MCP tool is connected.',
    '- When the local knowgrph MCP tools are connected, invoke knowgrph.probe.generate once with thread_root_id, current_node_id, context_text, k between 2 and 4, and the bounded token_budget.',
    '- Accept a literal MCP result at result.structuredContent.response.structuredContent; otherwise produce the same response.structuredContent shape without claiming that a tool ran.',
    '- Return 2-4 concrete, context-specific next questions; do not emit generic process cards such as "Clarify probe", "Generate branches", or "Select handoff".',
    '- Reject every canned wrapper: scope/priority/constraint over the whole query, pairwise relationship questions, evidence/decision-basis/deliverable templates, and choices such as compare current evidence, resolve the dependency, or choose the decision order. Ask only about concrete missing parameters that materially change this request.',
    '- A selected or active imperative generation request (for example a request beginning with generate, create, draft, or produce) is terminal: fulfill the requested deliverable through normal generation, do not emit Probe-Tree cards, and do not continue Probe-Tree. This rule takes precedence over the card contract below.',
    '- The local no-model path never synthesizes clarification cards. If no approved/configured model yields 2-4 distinct cards, fail closed as insufficient context instead of producing canned or hardcoded content.',
    '- Give every card a different user-named focus; reject reused choice labels, repeated selection sets, and subset or superset variants of another card.',
    '- Make every selectionOptions item a suggested clarification answer to its card question; never split the focus phrase into bare word fragments.',
    '- Include one fenced yaml block rooted at `response.structuredContent`: put `contractVersion` at that root, exactly one copied source record in `response.structuredContent.widgets`, 2-4 branch records in `response.structuredContent.cards`, and one Probe-Tree Branches record in `response.structuredContent.panels`.',
    `- The Probe-Tree Branches panel must use \`kind: text\` and an \`output: |-\` Markdown document whose scalar begins with YAML frontmatter declaring \`schema: ${RICH_MEDIA_TEXT_MARKDOWN_SCHEMA}\`, \`media_kind: text\`, \`content_type: text/markdown\`, and \`source_contract: ${KNOWGRPH_PROBE_TREE_CONTRACT_VERSION}\`; never put text in \`html\`, \`srcDoc\`, or \`outputSrcDoc\`.`,
    '- Each card must include id, label, kind: text, parentNodeId, candidateOptionId, question, output: "", rationale, evidenceNeeded, confidence, probeTreeDepth, nextAction: knowgrph.probe.select, probeTreeCardVariant: probe-tree-type-2, selectionMode: multiple, 2-4 selectionOptions with unique id and label, 2-6 contextAnchors copied verbatim from the user input, and allowOther: true.',
    `- Put the model-generated probe question in question so the card renders it as Summary; keep probeTreeDepth at or below ${KNOWGRPH_PROBE_TREE_MAX_DEPTH}, leave output empty for the user-owned selection, and make every numbered choice a concise answer to that card's question.`,
    '- On continuation, the selected child card and its committed multi-selection own the next topic. Use preceding cards only as lineage context and never substitute the thread root or a same-id root alias.',
    '- Treat parentNodeId as the lineage SSOT and set every parentNodeId to the source widget id; omit duplicate candidateOption edges because the shared projector infers them into the visible tree.',
    '- Describe proposed tool handoffs without claiming execution, persistence, paid calls, approval, or MCP invocation unless a real tool result is present.',
  ].join('\n')
}

export function isProbeTreeStructuredResponseCard(
  record: Record<string, unknown>,
  role: string,
): boolean {
  if (role !== 'card') return false
  if (!readFirstString(record, ['question'])) return false
  if (readFirstString(record, ['probeTreeCardVariant']) !== PROBE_TREE_CARD_VARIANTS.boundedMultiSelect) return false
  if (readFirstString(record, ['selectionMode']) !== 'multiple') return false
  if (normalizeProbeTreeSelectionOptions(readFieldValue(record, 'selectionOptions')).length < 2) return false
  if (normalizeProbeTreeContextAnchors(readFieldValue(record, 'contextAnchors')).length < 2) return false
  if (readFieldValue(record, 'allowOther') !== true) return false
  const nextAction = readFirstString(record, ['nextAction', 'next_action', 'probeTreeTool', 'probe_tree_tool'])
  if (PROBE_TREE_TOOL_PATTERN.test(nextAction)) return true
  return Boolean(
    readFirstString(record, ['candidateOptionId', 'candidate_option_id'])
    && readFirstString(record, ['parentNodeId', 'parent_node_id', 'parentId', 'parent_id'])
    && readFirstString(record, ['rationale']),
  )
}

export function resolveProbeTreeStructuredResponseNodeTypeId(args: {
  record: Record<string, unknown>
  role: string
  fallbackNodeTypeId: string
}): string {
  return isProbeTreeStructuredResponseCard(args.record, args.role)
    ? FLOW_TEXT_GENERATION_NODE_TYPE_ID
    : args.fallbackNodeTypeId
}

const readProbeTreeDepth = (record: Record<string, unknown>): number => {
  const raw = readFieldValue(record, 'probeTreeDepth') ?? readFieldValue(record, 'probe_tree_depth')
  const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw || ''))
  if (!Number.isFinite(value)) return 1
  return Math.min(KNOWGRPH_PROBE_TREE_MAX_DEPTH, Math.max(1, Math.floor(value)))
}

export function buildProbeTreeStructuredResponseProperties(args: {
  record: Record<string, unknown>
  role: string
  index: number
}): Record<string, JSONValue> {
  if (!isProbeTreeStructuredResponseCard(args.record, args.role)) return {}
  const parentNodeId = readFirstString(args.record, ['parentNodeId', 'parent_node_id', 'parentId', 'parent_id'])
  const candidateOptionId = readFirstString(args.record, ['candidateOptionId', 'candidate_option_id']) || `candidate-${args.index + 1}`
  const question = readFirstString(args.record, ['question'])
  const rationale = readFirstString(args.record, ['rationale'])
  const evidenceNeeded = readFirstString(args.record, ['evidenceNeeded', 'evidence_needed'])
  const confidence = readFirstString(args.record, ['confidence']) || 'unspecified'
  const nextAction = readFirstString(args.record, ['nextAction', 'next_action']) || KNOWGRPH_PROBE_TREE_SELECT_TOOL_NAME
  const selectionOptions = normalizeProbeTreeSelectionOptions(readFieldValue(args.record, 'selectionOptions'))
  const contextAnchors = normalizeProbeTreeContextAnchors(readFieldValue(args.record, 'contextAnchors'))
  const action = evidenceNeeded
    ? `Verify ${evidenceNeeded}, then review ${nextAction}.`
    : `Review this branch, then ${nextAction}.`
  return {
    cardTypeLabel: 'Probe-Tree Card',
    probeTreeTypeLabel: 'Probe-Tree Type 2',
    probeTreeCardVariant: PROBE_TREE_CARD_VARIANTS.boundedMultiSelect,
    selectionMode: 'multiple',
    selectionOptions,
    contextAnchors,
    probeTreeUserInputAnchors: contextAnchors,
    allowOther: true,
    lane: 'PROBE',
    index: `P${args.index + 1}`,
    summary: question,
    action,
    prompt: buildKnowgrphProbeTreePromptPreset([question, rationale].filter(Boolean).join(' ')),
    invocationTokens: [...KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS],
    invocation: KNOWGRPH_PROBE_TREE_GENERATE_TOOL_NAME,
    responseContractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
    responseStructuredContentKind: 'cards',
    responseMaterialization: 'response.structuredContent.cards',
    probeTreeResponseMode: 'llm-contract',
    probeTreeCandidateKey: candidateOptionId,
    probeTreeTool: nextAction,
    nextAction,
    probeTreeDepth: readProbeTreeDepth(args.record),
    parentGraphNodeId: parentNodeId,
    parentNodeId,
    candidateStatus: 'selectable',
    branchStatus: 'candidate',
    rationale,
    evidenceNeeded,
    confidence,
    tags: ['probe-tree', 'candidateOption', 'llm-contract'],
  }
}
