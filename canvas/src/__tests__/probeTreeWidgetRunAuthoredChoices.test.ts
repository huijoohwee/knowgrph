import { runStoryboardWidgetProbeTreeMcpInvocation } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowProbeTreeRun'
import {
  buildProbeTreeStructuredResponse,
  extractProbeTreeAuthoredChoiceOption,
  KNOWGRPH_PROBE_TREE_TOOL_NAMES,
} from '@/features/agent-ready/probeTreeContract.mjs'
import type { ProbeTreeMcpBridgeSuccess } from '@/features/agent-ready/probeTreeMcpBridgeContract'
import type { GraphData } from '@/lib/graph/types'

export async function testProbeTreeWidgetRunProjectsLiteralAuthoredChoicesWithoutProvider() {
  const authoredRequest = '/knowgrph.probe-tree recommend invest in India, China, or SE Asia'
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'investment-root', type: 'TextGeneration', label: 'Widget Card', properties: { prompt: authoredRequest } }],
    edges: [],
  }
  const contextText = ['Authored request:', authoredRequest, 'Selected Widget id: investment-root'].join('\n')
  const authoredOption = extractProbeTreeAuthoredChoiceOption(contextText)
  if (!authoredOption) throw new Error('expected the authored investment alternatives to be recognized')
  const bridge: ProbeTreeMcpBridgeSuccess = {
    ok: true,
    tool: KNOWGRPH_PROBE_TREE_TOOL_NAMES.generate,
    mcpInvoked: true,
    invocationResolutions: [],
    result: {
      isError: false,
      content: [{ type: 'text', text: 'Projected literal authored alternatives.' }],
      structuredContent: {
        contractVersion: 'knowgrph-probe-tree/v0.1',
        ok: true,
        degraded: true,
        degraded_reason: 'authored_choice_projection',
        response: buildProbeTreeStructuredResponse({
          threadRootId: 'investment-root',
          currentNodeId: 'investment-root',
          contextText,
          options: [authoredOption],
          degraded: true,
        }),
        cost_log: { model: 'probe-tree-authored-choices', prompt_tokens: 0, completion_tokens: 0, cache_hits: 0, estimated_cost_usd: 0 },
      },
    },
  }
  const result = await runStoryboardWidgetProbeTreeMcpInvocation({
    graphForRun: graphData,
    nodeIds: ['investment-root'],
    fallbackNode: graphData.nodes[0],
    invokeMcp: async () => bridge,
    onMaterialized: () => undefined,
    publishOutput: output => output.baseGraphData || null,
  })
  const cards = result?.graphData.nodes.filter(node => node.properties.probeTreeResponseMode === 'llm-contract') || []
  const selectionOptions = cards[0]?.properties.selectionOptions
  const labels = Array.isArray(selectionOptions)
    ? selectionOptions.map(option => String((option as { label?: unknown }).label || ''))
    : []
  if (
    !result?.mcpInvoked
    || result.providerAccepted
    || result.responseSource !== 'mcp'
    || cards.length !== 1
    || cards[0]?.properties.summary !== 'recommend invest in India, China, or SE Asia'
    || JSON.stringify(labels) !== JSON.stringify(['India', 'China', 'SE Asia'])
    || /scope choice|priority choice|relationship between|compare current evidence|resolve the dependency/i.test(JSON.stringify(result))
  ) {
    throw new Error(`expected Widget Run to publish one literal authored-choice MCP card without a provider, got ${JSON.stringify(result)}`)
  }
}
