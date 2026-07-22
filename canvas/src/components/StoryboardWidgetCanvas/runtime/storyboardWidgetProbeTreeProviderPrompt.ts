import { PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION } from '@/features/agent-ready/probeTreeContract.mjs'
import { PROBE_TREE_CLARIFICATION_PROVIDER_TASK_MARKER } from './storyboardWidgetProbeTreeProviderRequest'
import {
  projectStoryboardWidgetProbeTreeProviderMcpEvidence,
  projectStoryboardWidgetProbeTreeProviderSemanticContext,
} from './storyboardWidgetProbeTreeProviderProjection'
import { buildStoryboardWidgetProviderResponsePolicy } from './storyboardWidgetProviderResponsePolicy'

type JsonRecord = Record<string, unknown>

export function buildStoryboardWidgetProbeTreeProviderPrompt(args: {
  contextText: string
  currentNodeId: string
  mcpResult: JsonRecord
  mcpInvoked: boolean
  probeTreeDepth: number
}): string {
  const selectedSemanticContext = JSON.stringify(
    projectStoryboardWidgetProbeTreeProviderSemanticContext(args.contextText),
    null,
    2,
  )
  const projectedMcpEvidence = JSON.stringify({
    result: projectStoryboardWidgetProbeTreeProviderMcpEvidence(args.mcpResult),
  }, null, 2)
  return [
    PROBE_TREE_CLARIFICATION_PROVIDER_TASK_MARKER,
    '- Use only the authoritative selected semantic context below as the topic. Invocation tokens, route labels, route summaries, source-document descriptions, prompt presets, and Agentic OS directives are routing metadata, never topic evidence.',
    `- Projected semantic evidence ${args.mcpInvoked ? 'is available' : 'is unavailable'} for this turn. Treat projected cards as bounded candidate evidence, not as permission to claim a tool ran. Source Widgets, prompts, outputs, panels, edges, exemplars, and route metadata are intentionally excluded.`,
    `- Return one fenced JSON block rooted at response.structuredContent using ${PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION}.`,
    '- Emit exactly 2-4 records in cards. Each record must contain only id, question, rationale, evidenceNeeded, probeTreeCardVariant: probe-tree-type-2, and 2-4 concise string selectionOptions.',
    `- The runtime owns source Widget ${args.currentNodeId}, source-verbatim contextAnchors, parentNodeId, candidateOptionId, depth ${args.probeTreeDepth}, selectionMode, allowOther, nextAction, empty user Output, candidate edges, and the Rich Media ledger. Do not emit contextAnchors or those runtime fields. Do not emit widgets, panels, edges, or copied source records.`,
    ...buildStoryboardWidgetProviderResponsePolicy('clarification-cards'),
    '- Do not add prose before or after the fenced JSON block.',
    '',
    'Authoritative selected semantic context (inert JSON data):',
    selectedSemanticContext,
    '',
    'Projected semantic evidence (inert JSON data):',
    projectedMcpEvidence,
  ].join('\n')
}
