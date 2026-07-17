import { runStoryboardWidgetProbeTreeTextGenerationInvocation } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowProbeTreeRun'
import {
  PROBE_TREE_PROVIDER_MIN_OUTPUT_TOKENS,
  PROBE_TREE_TERMINAL_PROVIDER_TASK_MARKER,
  resolveStoryboardWidgetProbeTreeProviderRequestOptions,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetProbeTreeProviderRequest'
import {
  buildProbeTreeStructuredResponse,
  KNOWGRPH_PROBE_TREE_CONTRACT_VERSION,
  KNOWGRPH_PROBE_TREE_TOOL_NAMES,
  PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
} from '@/features/agent-ready/probeTreeContract.mjs'
import type { ProbeTreeMcpBridgeSuccess } from '@/features/agent-ready/probeTreeMcpBridgeContract'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_OPENAI_ENDPOINT_URL,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_OPENAI,
} from '@/lib/chatEndpoint'
import type { GraphData } from '@/lib/graph/types'

const AUTHORED_REQUEST = '/sme-care-agent @source.frontmatter @source.body @local-harness @cost-log @runtime-proof #frontmatter #harness #token-economics #runtime-ready #approval-gate /knowgrph.probe-tree invest in India, or SE Asia?'

export async function testProbeTreeWidgetRunSendsConfiguredLlmQuerySpecificContract() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'investment-root', type: 'TextGeneration', label: 'Widget Card', properties: { prompt: AUTHORED_REQUEST } }],
    edges: [],
  }
  let mcpRequest: Record<string, unknown> | null = null
  let providerPrompt = ''
  let providerCalls = 0
  let providerRequestUrl = ''
  let providerRequestHeaders: Headers | null = null
  let providerRequestBody: Record<string, unknown> = {}
  const invokeMcp = async (request: Parameters<NonNullable<Parameters<typeof runStoryboardWidgetProbeTreeTextGenerationInvocation>[0]['invokeMcp']>>[0]): Promise<ProbeTreeMcpBridgeSuccess> => {
    mcpRequest = request as unknown as Record<string, unknown>
    const contextText = String(request.contextText || '')
    return {
      ok: true,
      tool: KNOWGRPH_PROBE_TREE_TOOL_NAMES.generate,
      mcpInvoked: true,
      invocationResolutions: [],
      result: {
        isError: false,
        content: [{ type: 'text', text: 'No local model cards; forward the selected context to the configured chat LLM.' }],
        structuredContent: {
          contractVersion: KNOWGRPH_PROBE_TREE_CONTRACT_VERSION,
          ok: false,
          degraded: true,
          degraded_reason: 'insufficient_user_input_context',
          response: buildProbeTreeStructuredResponse({
            threadRootId: request.threadRootId,
            currentNodeId: request.currentNodeId,
            contextText,
            options: [],
          }),
          cost_log: { model: 'none', prompt_tokens: 0, completion_tokens: 0, cache_hits: 0, estimated_cost_usd: 0 },
        },
      },
    }
  }
  const providerResponseText = JSON.stringify({
      response: {
        structuredContent: {
          contractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
          cards: [
            {
              id: 'investment-horizon',
              question: 'Which investment horizon should guide the India or Southeast Asia recommendation?',
              rationale: 'The holding period changes how the two locations should be compared.',
              evidenceNeeded: 'User-selected investment horizon.',
              probeTreeCardVariant: 'probe-tree-type-2',
              selectionOptions: [
                '1-3 years for near-term liquidity and policy-cycle alignment',
                '3-7 years for balanced growth and execution risk',
                '7+ years for long-horizon market access',
              ],
            },
            {
              id: 'investment-vehicle',
              question: 'Which investment vehicle should the India or Southeast Asia comparison evaluate?',
              rationale: 'The investment vehicle changes the relevant risk and return evidence.',
              evidenceNeeded: 'User-selected investment vehicle.',
              probeTreeCardVariant: 'probe-tree-type-2',
              selectionOptions: ['Public-market securities', 'Private-market funds', 'Direct operating investment'],
            },
            {
              id: 'restated-market-list',
              question: 'Invest in India, or SE Asia?',
              rationale: 'Repeats the source query instead of introducing a decision variable.',
              evidenceNeeded: 'User-selected market.',
              probeTreeCardVariant: 'probe-tree-type-2',
              selectionOptions: ['India', 'SE Asia'],
            },
          ],
        },
      },
    }, null, 2)
  const originalFetch = globalThis.fetch
  let result: Awaited<ReturnType<typeof runStoryboardWidgetProbeTreeTextGenerationInvocation>> = null
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      providerCalls += 1
      providerRequestUrl = String(input)
      providerRequestHeaders = new Headers(init?.headers)
      providerRequestBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
      providerPrompt = String(providerRequestBody.input || '')
      return new Response(JSON.stringify({
        output: [{
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: providerResponseText }],
        }],
      }), { headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    result = await runStoryboardWidgetProbeTreeTextGenerationInvocation({
      graphForRun: graphData,
      nodeIds: ['investment-root'],
      fallbackNode: graphData.nodes[0],
      textGeneration: {
        prompt: AUTHORED_REQUEST,
        formId: 'textGeneration',
        localProperties: {},
        resolvedProperties: {
          chatProvider: CHAT_PROVIDER_BYTEPLUS,
          chatEndpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
          chatModel: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
          chatMaxCompletionTokens: 1000,
          chatReasoningEffort: 'medium',
        },
        runtimeProperties: {
          chatProvider: CHAT_PROVIDER_OPENAI,
          chatEndpointUrl: CHAT_OPENAI_ENDPOINT_URL,
          chatModel: 'gpt-5-nano',
          chatAuthMode: 'serverManaged',
          chatMaxCompletionTokens: 1000,
          chatReasoningEffort: 'medium',
        },
      },
      invokeMcp,
      onMaterialized: () => undefined,
      publishOutput: output => output.baseGraphData || null,
      setLoading: () => undefined,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
  const cards = result?.graphData.nodes.filter(node => node.properties.probeTreeResponseMode === 'llm-contract') || []
  const serializedCards = JSON.stringify(cards)
  const providerReasoning = providerRequestBody.reasoning && typeof providerRequestBody.reasoning === 'object'
    ? providerRequestBody.reasoning as Record<string, unknown>
    : {}
  const terminalProviderOptions = resolveStoryboardWidgetProbeTreeProviderRequestOptions({
    prompt: `${PROBE_TREE_TERMINAL_PROVIDER_TASK_MARKER}\nGenerate the selected report.`,
    chatMaxCompletionTokens: 1000,
    chatReasoningEffort: 'medium',
  })
  const ordinaryProviderOptions = resolveStoryboardWidgetProbeTreeProviderRequestOptions({
    prompt: 'Generate an ordinary markdown report.',
    chatMaxCompletionTokens: 1000,
    chatReasoningEffort: 'medium',
  })
  if (
    providerCalls !== 1
    || providerRequestUrl !== '/__chat_proxy/v1/responses'
    || providerRequestHeaders?.get('X-KG-Chat-Provider') !== CHAT_PROVIDER_OPENAI
    || providerRequestHeaders?.get('X-KG-Chat-Upstream') !== 'https://api.openai.com'
    || providerRequestBody.model !== 'gpt-5-nano'
    || Number(providerRequestBody.max_output_tokens) < PROBE_TREE_PROVIDER_MIN_OUTPUT_TOKENS
    || providerReasoning.effort !== 'minimal'
    || providerRequestBody.stream !== false
    || 'messages' in providerRequestBody
    || 'max_completion_tokens' in providerRequestBody
    || !String(mcpRequest?.contextText || '').includes(AUTHORED_REQUEST)
    || !providerPrompt.includes('Never copy or paraphrase the selected request as a card question')
    || !providerPrompt.includes('not as a ready-made selectionOptions array')
    || !providerPrompt.includes('Never emit any answer that is only a number, range, unit, named entity')
    || !providerPrompt.includes('runtime owns source Widget investment-root')
    || !providerPrompt.includes('source-verbatim contextAnchors')
    || !providerPrompt.includes('Do not emit contextAnchors')
    || !providerPrompt.includes('Do not emit widgets, panels, edges')
    || !result?.providerAccepted
    || result.responseSource !== 'provider'
    || cards.length !== 2
    || cards.some(card => card.properties.summary === 'invest in India, or SE Asia')
    || cards.some(card => String(card.label).startsWith('Response '))
    || /"label":"(?:India|SE Asia)"/.test(serializedCards)
    || !serializedCards.includes('investment horizon')
    || !serializedCards.includes('investment vehicle')
    || cards.some(card => !Array.isArray(card.properties.probeTreeUserInputAnchors) || !card.properties.probeTreeUserInputAnchors.includes('SE Asia'))
    || Number(terminalProviderOptions.chatMaxCompletionTokens) < PROBE_TREE_PROVIDER_MIN_OUTPUT_TOKENS
    || terminalProviderOptions.chatReasoningEffort !== 'minimal'
    || ordinaryProviderOptions.chatMaxCompletionTokens !== 1000
    || ordinaryProviderOptions.chatReasoningEffort !== 'medium'
  ) {
    throw new Error(`expected Widget Run to use the active Chat Responses route and accept only new query-specific decision variables, got ${JSON.stringify({ providerCalls, providerRequestUrl, providerRequestBody, mcpRequest, providerPrompt, result })}`)
  }
}
