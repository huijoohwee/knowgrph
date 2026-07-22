import { runStoryboardWidgetProbeTreeMcpInvocation } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowProbeTreeRun'
import { KNOWGRPH_PROBE_TREE_TOOL_NAMES, PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION } from '@/features/agent-ready/probeTreeContract.mjs'
import type { ProbeTreeMcpBridgeSuccess } from '@/features/agent-ready/probeTreeMcpBridgeContract'
import type { GraphData } from '@/lib/graph/types'

const providerCards = (cards: Array<Record<string, unknown>>): string => [
  '```json',
  JSON.stringify({
    response: {
      structuredContent: {
        contractVersion: PROBE_TREE_LLM_RESPONSE_CONTRACT_VERSION,
        cards: cards.map((card, index) => ({
          id: `provider-card-${index + 1}`,
          probeTreeCardVariant: 'probe-tree-type-2',
          ...card,
        })),
      },
    },
  }),
  '```',
].join('\n')

const zeroModelBridge = (): ProbeTreeMcpBridgeSuccess => ({
  ok: true,
  tool: KNOWGRPH_PROBE_TREE_TOOL_NAMES.generate,
  mcpInvoked: true,
  invocationResolutions: [],
  result: {
    isError: false,
    content: [{ type: 'text', text: 'No local model cards.' }],
    structuredContent: {
      contractVersion: 'knowgrph-probe-tree/v0.1',
      ok: false,
      degraded: true,
      degraded_reason: 'model_unavailable',
      cost_log: { model: 'none', prompt_tokens: 0, completion_tokens: 0, cache_hits: 0, estimated_cost_usd: 0 },
    },
  },
})

export async function testProbeTreeWidgetRunRepairsRejectedFoodStallCardsOnce() {
  const authoredRequest = '/sme-care-agent @knowgrph.probe-tree better buy food stall in Singapore or Malaysia with SGD10,000?'
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'food-stall-root', type: 'TextGeneration', label: 'Widget Card', properties: { prompt: authoredRequest } }],
    edges: [],
  }
  const prompts: string[] = []
  const responses = [
    providerCards([
      {
        question: 'Should you buy a food stall in Singapore or Malaysia with SGD10,000?',
        rationale: 'Repeats the source choice.',
        evidenceNeeded: 'Country choice.',
        selectionOptions: ['Singapore', 'Malaysia'],
      },
      {
        question: 'Which SGD10,000 budget should guide the Singapore or Malaysia food stall?',
        rationale: 'Buckets the source amount.',
        evidenceNeeded: 'Budget choice.',
        selectionOptions: ['SGD10,000', 'SGD20,000'],
      },
    ]),
    providerCards([
      {
        question: 'Which operating involvement should guide the Singapore or Malaysia food-stall decision?',
        rationale: 'Owner involvement changes staffing, control, and operating cost.',
        evidenceNeeded: 'Preferred operating role.',
        selectionOptions: ['Prioritize hands-on daily owner operation', 'Prefer manager-led semi-passive oversight'],
      },
      {
        question: 'Which customer demand should guide the Singapore or Malaysia food-stall comparison?',
        rationale: 'Demand timing changes location and menu economics.',
        evidenceNeeded: 'Preferred demand profile.',
        selectionOptions: ['Target steady weekday office-worker traffic', 'Favor destination-led evening and weekend demand'],
      },
    ]),
  ]
  const result = await runStoryboardWidgetProbeTreeMcpInvocation({
    graphForRun: graphData,
    nodeIds: ['food-stall-root'],
    fallbackNode: graphData.nodes[0],
    invokeMcp: async () => zeroModelBridge(),
    generateProviderResponse: async prompt => {
      prompts.push(prompt)
      return responses[prompts.length - 1] || null
    },
    providerModel: 'test-provider',
    onMaterialized: () => undefined,
    publishOutput: output => output.baseGraphData || null,
  })
  const cards = (result?.graphData.nodes || []).filter(node => node.properties.probeTreeResponseMode === 'llm-contract')
  if (
    prompts.length !== 2
    || !prompts[1]?.includes('previous provider response was rejected')
    || !prompts[1]?.includes('Only 0 of 2 cards remained')
    || result?.providerAttempts !== 2
    || !result.providerAccepted
    || result.responseSource !== 'provider'
    || cards.length !== 2
    || cards.some(card => /Should you buy|SGD10,000 budget/i.test(String(card.label || '')))
  ) {
    throw new Error(`expected one bounded provider repair to replace rejected echo cards, got ${JSON.stringify({ prompts, result, cards })}`)
  }
}

export async function testProbeTreeWidgetRunAcceptsMalayAffixGrounding() {
  const authoredRequest = '/knowgrph.probe-tree beli dekat Johor, atau negeri lain?'
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'johor-sourcing', type: 'TextGeneration', label: 'Widget Card', properties: { prompt: authoredRequest } }],
    edges: [],
  }
  const response = providerCards([
    {
      question: 'Semasa membeli, sejauh mana pembekal perlu berdekatan supaya pemeriksaan stok mudah?',
      rationale: 'Jarak pembekal mengubah kos dan kualiti pemeriksaan sebelum pesanan.',
      evidenceNeeded: 'Keutamaan pengguna untuk pemeriksaan stok.',
      selectionOptions: [
        'Utamakan lawatan pemeriksaan sebelum membuat pesanan',
        'Benarkan semakan video untuk menjimatkan perjalanan',
      ],
    },
    {
      question: 'Untuk membeli stok ulangan, adakah gudang perlu berdekatan bagi penghantaran lebih pantas?',
      rationale: 'Kelajuan bekalan semula mengubah jumlah stok yang perlu disimpan.',
      evidenceNeeded: 'Keutamaan pengguna untuk kelajuan bekalan semula.',
      selectionOptions: [
        'Utamakan penghantaran hari sama walaupun pilihan produk terhad',
        'Terima penghantaran lebih lambat untuk pilihan produk lebih luas',
      ],
    },
  ])
  let providerCalls = 0
  const result = await runStoryboardWidgetProbeTreeMcpInvocation({
    graphForRun: graphData,
    nodeIds: ['johor-sourcing'],
    fallbackNode: graphData.nodes[0]!,
    invokeMcp: async () => zeroModelBridge(),
    generateProviderResponse: async () => {
      providerCalls += 1
      return response
    },
    providerModel: 'test-provider',
    onMaterialized: () => undefined,
    publishOutput: output => output.baseGraphData || null,
  })
  const cards = (result?.graphData.nodes || []).filter(node => node.properties.probeTreeResponseMode === 'llm-contract')
  if (
    providerCalls !== 1
    || result?.providerAttempts !== 1
    || !result.providerAccepted
    || cards.length !== 2
    || cards.some(card => !Array.isArray(card.properties.probeTreeUserInputAnchors)
      || !card.properties.probeTreeUserInputAnchors.includes('beli')
      || !card.properties.probeTreeUserInputAnchors.includes('dekat'))
  ) {
    throw new Error(`expected Malay derivational forms such as membeli and berdekatan to retain source-verbatim Probe-Tree anchors, got ${JSON.stringify({ providerCalls, result, cards })}`)
  }
}
