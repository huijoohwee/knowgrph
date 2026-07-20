import {
  extractProbeTreeClarificationContextText,
  extractProbeTreeUserInputText,
} from '@/features/agent-ready/probeTreeUserInputRelevance.mjs'
import { PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION } from '@/features/agent-ready/probeTreeContract.mjs'
import { sanitizeRuntimeInvocationQueryText } from '@/features/chat/chatRuntimeInvocationQuery'
import { PROBE_TREE_CLARIFICATION_PROVIDER_TASK_MARKER } from './storyboardWidgetProbeTreeProviderRequest'

type JsonRecord = Record<string, unknown>

const readRecord = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
)

const readText = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim()

const stripProbeTreeProviderRoutingTokens = (value: unknown): string => (
  sanitizeRuntimeInvocationQueryText(value, 8_000)
    .replace(/(^|\s)[/#@][A-Za-z0-9_.-]+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
)

const readSelectionOptions = (value: unknown): string[] => (
  (Array.isArray(value) ? value : [])
    .map(option => {
      const record = readRecord(option)
      return readText(record.label || record.text || option)
    })
    .filter(Boolean)
    .slice(0, 4)
)

const projectProbeTreeProviderCard = (value: unknown): JsonRecord | null => {
  const card = readRecord(value)
  const question = readText(card.question || card.text || card.label)
  const selectionOptions = readSelectionOptions(card.selectionOptions)
  if (!question || selectionOptions.length < 2) return null
  return {
    question,
    rationale: readText(card.rationale),
    evidenceNeeded: readText(card.evidenceNeeded || card.evidence_needed),
    selectionOptions,
  }
}

export function projectStoryboardWidgetProbeTreeProviderMcpEvidence(mcpResult: JsonRecord): JsonRecord {
  const structuredContent = readRecord(mcpResult.structuredContent)
  const response = readRecord(structuredContent.response)
  const responseContent = readRecord(response.structuredContent)
  const costLog = readRecord(structuredContent.cost_log)
  const model = readText(costLog.model) || 'none'
  const cards = (model.toLowerCase() === 'none' ? [] : Array.isArray(responseContent.cards) ? responseContent.cards : [])
    .map(projectProbeTreeProviderCard)
    .filter((card): card is JsonRecord => Boolean(card))
    .slice(0, 4)
  return {
    isError: mcpResult.isError === true,
    structuredContent: {
      contractVersion: readText(structuredContent.contractVersion),
      ok: structuredContent.ok === true,
      degraded: structuredContent.degraded === true,
      degradedReason: readText(structuredContent.degraded_reason),
      model,
      cards,
    },
  }
}

export function buildStoryboardWidgetProbeTreeProviderSemanticContext(contextText: string): string {
  const selectedInput = stripProbeTreeProviderRoutingTokens(extractProbeTreeUserInputText(contextText))
  const clarificationContext = stripProbeTreeProviderRoutingTokens(
    extractProbeTreeClarificationContextText(contextText),
  )
  return [
    `Active selected input: ${selectedInput || '(empty)'}`,
    clarificationContext ? `Preceding selected-child question and lineage: ${clarificationContext}` : '',
  ].filter(Boolean).join('\n')
}

export function buildStoryboardWidgetProbeTreeProviderPrompt(args: {
  contextText: string
  currentNodeId: string
  mcpResult: JsonRecord
  mcpInvoked: boolean
  probeTreeDepth: number
}): string {
  const literalMcpEvidence = JSON.stringify({
    result: projectStoryboardWidgetProbeTreeProviderMcpEvidence(args.mcpResult),
  }, null, 2)
  return [
    PROBE_TREE_CLARIFICATION_PROVIDER_TASK_MARKER,
    '- Use only the authoritative selected semantic context below as the topic. Invocation tokens, route labels, route summaries, source-document descriptions, prompt presets, and Agentic OS directives are routing metadata, never topic evidence.',
    `- The local knowgrph MCP ${args.mcpInvoked ? 'was invoked' : 'was unavailable'}; treat its projected semantic cards as bounded candidate evidence, not as permission to claim other tools ran. Its source Widget, prompt, output, panels, edges, recalled exemplars, and route metadata are intentionally excluded from provider context.`,
    `- Return one fenced JSON block rooted at response.structuredContent using ${PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION}.`,
    '- Emit exactly 2-4 records in cards. Each record must contain only id, question, rationale, evidenceNeeded, probeTreeCardVariant: probe-tree-type-2, and 2-4 concise string selectionOptions.',
    `- The runtime owns source Widget ${args.currentNodeId}, source-verbatim contextAnchors, parentNodeId, candidateOptionId, depth ${args.probeTreeDepth}, selectionMode, allowOther, nextAction, empty user Output, candidate edges, and the Rich Media ledger. Do not emit contextAnchors or those runtime fields. Do not emit widgets, panels, edges, or copied source records.`,
    '- Put each generated probe in question for the card Summary and make every selection option a concise answer to that exact question. Do not pre-answer the user-owned multi-selection or Other response.',
    '- Ground every question in the active selected input. Mention its request subject plus at least one named entity or distinctive term so the runtime can derive source-verbatim anchors. Suggested answers may introduce plausible user preferences for the new decision variable, but must never assert invented facts.',
    '- Never copy or paraphrase the active selected input as a card question. Each card must introduce one concrete missing decision variable whose answer would materially change the requested result.',
    '- Treat named entities and alternatives already present in the active selected input as subjects to clarify, not as a ready-made selectionOptions array. Never turn an extracted entity list into an echo card.',
    '- Give every card a different request-specific decision variable. Never reuse a choice label, another card\'s complete selection set, or a subset or superset of another card\'s choices.',
    '- Every selectionOptions item must be a context-relevant suggested answer to its exact question. Never split, copy, or relabel the selected focus as an answer option.',
    '- Never emit any answer that is only a number, range, unit, named entity, or similarly mechanical label. Every answer must express a semantic preference, tradeoff, or consequence; a number-bearing answer must explain what that quantity means for the decision.',
    '- For a continuation, the selected child card and its user-authored output own the active selected input. Use the preceding question and ancestor lineage only to disambiguate that input; never replace it with the thread root or a same-id root alias.',
    '- Write every generated question, rationale, evidenceNeeded value, and selection option in the dominant natural language and script of the Active selected input. User-authored Other text owns the language for that turn, and later turns may switch again. Preserve names, numbers, and route tokens verbatim; do not translate routing metadata.',
    '- Every card must be a concrete next question relevant to the active selected input; morphological variants such as invest and investment are allowed when named entities and meaning remain intact.',
    '- Never emit generic process cards named Clarify probe, Generate branches, or Select handoff.',
    '- Reject every canned wrapper: scope/priority/constraint over the whole query, pairwise relationship questions, evidence/decision-basis/deliverable templates, and choices such as compare current evidence, resolve the dependency, or choose the decision order. Ask only about concrete missing parameters that materially change this request.',
    '- If 2-4 distinct query-specific cards cannot be produced without invented facts, return an empty cards array so the runtime fails closed; never fill the quota by restating the query or applying generic or hardcoded templates.',
    '- This clarification task runs only after the runtime has ruled out a terminal continuation. An explicit Probe-Tree invocation requests 2-4 clarification cards even when its topic begins with an action verb such as recommend, compare, assess, or plan. Never return an empty cards array merely because that topic is phrased imperatively.',
    '- Do not add prose before or after the fenced JSON block.',
    '',
    'Authoritative selected semantic context:',
    buildStoryboardWidgetProbeTreeProviderSemanticContext(args.contextText),
    '',
    'Projected MCP semantic evidence:',
    literalMcpEvidence,
  ].join('\n')
}
