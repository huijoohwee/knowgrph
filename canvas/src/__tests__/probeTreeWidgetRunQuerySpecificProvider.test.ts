import { runStoryboardWidgetProbeTreeTextGenerationInvocation } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowProbeTreeRun'
import {
  buildProbeTreeStructuredResponse,
  KNOWGRPH_PROBE_TREE_CONTRACT_VERSION,
  KNOWGRPH_PROBE_TREE_TOOL_NAMES,
  PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
} from '@/features/agent-ready/probeTreeContract.mjs'
import type { ProbeTreeMcpBridgeSuccess } from '@/features/agent-ready/probeTreeMcpBridgeContract'
import type { GraphData } from '@/lib/graph/types'

const AUTHORED_REQUEST = '/knowgrph.probe-tree recommend invest in India, China, or SE Asia'

export async function testProbeTreeWidgetRunSendsConfiguredLlmQuerySpecificContract() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'investment-root', type: 'TextGeneration', label: 'Widget Card', properties: { prompt: AUTHORED_REQUEST } }],
    edges: [],
  }
  let mcpRequest: Record<string, unknown> | null = null
  let providerPrompt = ''
  let providerCalls = 0
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
  const generateProviderResponse = async (prompt: string): Promise<string> => {
    providerCalls += 1
    providerPrompt = prompt
    return JSON.stringify({
      response: {
        structuredContent: {
          contractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
          cards: [
            {
              id: 'investment-objective',
              question: 'Which investment objective should drive the India, China, or SE Asia recommendation?',
              rationale: 'The preferred outcome changes how the three markets should be compared.',
              evidenceNeeded: 'User-selected investment objective.',
              probeTreeCardVariant: 'probe-tree-type-2',
              selectionOptions: ['Long-term capital growth', 'Recurring income yield', 'Strategic market access'],
              contextAnchors: ['India', 'China', 'SE Asia'],
            },
            {
              id: 'investment-vehicle',
              question: 'Which investment vehicle should the India, China, and SE Asia comparison evaluate?',
              rationale: 'The investment vehicle changes the relevant risk and return evidence.',
              evidenceNeeded: 'User-selected investment vehicle.',
              probeTreeCardVariant: 'probe-tree-type-2',
              selectionOptions: ['Public-market securities', 'Private-market funds', 'Direct operating investment'],
              contextAnchors: ['India', 'China', 'SE Asia'],
            },
            {
              id: 'restated-market-list',
              question: 'Invest in India, China, or SE Asia?',
              rationale: 'Repeats the source query instead of introducing a decision variable.',
              evidenceNeeded: 'User-selected market.',
              probeTreeCardVariant: 'probe-tree-type-2',
              selectionOptions: ['India', 'China', 'SE Asia'],
              contextAnchors: ['India', 'China', 'SE Asia'],
            },
          ],
        },
      },
    }, null, 2)
  }

  const result = await runStoryboardWidgetProbeTreeTextGenerationInvocation({
    graphForRun: graphData,
    nodeIds: ['investment-root'],
    fallbackNode: graphData.nodes[0],
    textGeneration: {
      prompt: AUTHORED_REQUEST,
      formId: 'textGeneration',
      localProperties: {},
      resolvedProperties: { chatModel: 'query-specific-test-llm' },
      runtimeProperties: {},
    },
    invokeMcp,
    generateProviderResponse,
    onMaterialized: () => undefined,
    publishOutput: output => output.baseGraphData || null,
    setLoading: () => undefined,
  })
  const cards = result?.graphData.nodes.filter(node => node.properties.probeTreeResponseMode === 'llm-contract') || []
  const serializedCards = JSON.stringify(cards)
  if (
    providerCalls !== 1
    || !String(mcpRequest?.contextText || '').includes(AUTHORED_REQUEST)
    || !providerPrompt.includes('Never copy or paraphrase the selected request as a card question')
    || !providerPrompt.includes('not as a ready-made selectionOptions array')
    || !providerPrompt.includes('runtime owns source Widget investment-root')
    || !providerPrompt.includes('Do not emit widgets, panels, edges')
    || !result?.providerAccepted
    || result.responseSource !== 'provider'
    || cards.length !== 2
    || cards.some(card => card.properties.summary === 'recommend invest in India, China, or SE Asia')
    || cards.some(card => String(card.label).startsWith('Response '))
    || /"label":"(?:India|China|SE Asia)"/.test(serializedCards)
    || !serializedCards.includes('investment objective')
    || !serializedCards.includes('investment vehicle')
  ) {
    throw new Error(`expected Widget Run to send the source context to the configured LLM and accept only new query-specific decision variables, got ${JSON.stringify({ providerCalls, mcpRequest, providerPrompt, result })}`)
  }
}
