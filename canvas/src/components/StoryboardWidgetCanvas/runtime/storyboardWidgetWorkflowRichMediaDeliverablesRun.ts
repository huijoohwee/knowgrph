import { invokeAgenticOsDocsMcpBridge } from '@/features/agent-ready/agenticOsDocsMcpClient'
import { clearRichMediaOutputProperties } from '@/features/chat/richMediaRun'
import {
  RICH_MEDIA_FINANCIAL_MODEL_OUTPUT_KEY,
  RICH_MEDIA_SLIDE_DECK_OUTPUT_KEY,
  buildRichMediaDeliverablesGenerationPrompt,
  collectRichMediaDeliverablesInvocationTokens,
  isRichMediaDeliverablesWidget,
  parseRichMediaDeliverablesResponse,
} from '@/features/rich-media/richMediaDeliverablesRun'
import {
  GENERATED_MARKDOWN_PIPE_TABLE_FORMAT,
  GENERATED_MARKDOWN_PIPE_TABLE_MIME_TYPE,
} from '@/features/rich-media/richMediaTablePersistence'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { StoryboardWidgetTextRunOutputPublisher } from './storyboardWidgetWorkflowRichMediaPublication'

export async function runStoryboardWidgetRichMediaDeliverables(args: {
  id: string
  node: GraphNode
  graphForRun: GraphData
  rawNodeProperties: Record<string, unknown>
  authoredPrompt: string
  connectedPrompt: string
  connectedSourceNodeId: string
  model: unknown
  generateText: (prompt: string) => Promise<string>
  publishOutput: StoryboardWidgetTextRunOutputPublisher
  readGraph: () => GraphData | null
  updateOutput: (buildPatch: (properties: Record<string, unknown>) => Record<string, unknown>) => void
  setLoading: (loading: boolean) => void
  reportFailure: (message: string, ttlMs?: number) => void
  upsertToast: (toast: { id: string; kind: 'success'; message: string; ttlMs: number }) => void
}): Promise<{ handled: boolean; graphData: GraphData | null }> {
  if (!isRichMediaDeliverablesWidget(args.rawNodeProperties)) return { handled: false, graphData: null }
  if (!args.connectedPrompt) {
    args.reportFailure('Connect a Rich Media output to this Widget Card input before Run.', 3200)
    return { handled: true, graphData: null }
  }
  args.setLoading(true)
  try {
    const invocationTokens = collectRichMediaDeliverablesInvocationTokens(args.authoredPrompt)
    const mcpResponse = invocationTokens.length > 0
      ? await invokeAgenticOsDocsMcpBridge({ invocationTokens })
      : null
    const failedInvocation = mcpResponse?.invocations.find(invocation => invocation.ok !== true)
    if (failedInvocation) {
      throw new Error(failedInvocation.error || `MCP invocation ${failedInvocation.token} did not resolve.`)
    }
    const generated = await args.generateText(buildRichMediaDeliverablesGenerationPrompt({
      sourceMarkdown: args.connectedPrompt,
      instructions: args.authoredPrompt,
      mcpResponse,
    }))
    if (!generated) throw new Error('Deliverables generation returned no output.')
    const deliverables = parseRichMediaDeliverablesResponse(generated)
    const commonPanelProperties = {
      richMediaDeliverablesMode: true,
      richMediaDeliverablesSourceNodeId: args.connectedSourceNodeId,
      mcpInvoked: mcpResponse?.mcpInvoked === true,
      mcpTool: mcpResponse?.tool || '',
      mcpInvocationTokens: invocationTokens,
    }
    const slideDeckGraph = args.publishOutput({
      anchorNode: args.node,
      baseGraphData: args.graphForRun,
      outputText: deliverables.slideDeckMarkdown,
      title: 'Slide Deck',
      model: args.model,
      outputKey: RICH_MEDIA_SLIDE_DECK_OUTPUT_KEY,
      panelLabel: 'Slide Deck',
      panelProperties: {
        ...commonPanelProperties,
        richMediaDocumentKind: 'markdown-slide-deck',
        markdownPresentationMode: true,
        outputMimeType: 'text/markdown; charset=utf-8',
      },
      outputIndex: 0,
      allowCreateStandaloneOutput: true,
      connectCreatedOutputToAnchor: true,
      ownedOutputOnly: true,
    })
    if (!slideDeckGraph) throw new Error('Slide Deck Rich Media panel could not be published.')
    const financialModelGraph = args.publishOutput({
      anchorNode: args.node,
      baseGraphData: slideDeckGraph,
      outputText: deliverables.financialModelMarkdown,
      title: 'Financial Model',
      model: args.model,
      outputKey: RICH_MEDIA_FINANCIAL_MODEL_OUTPUT_KEY,
      panelLabel: 'Financial Model',
      panelProperties: {
        ...commonPanelProperties,
        richMediaDocumentKind: 'financial-model-spreadsheet',
        tableFormat: GENERATED_MARKDOWN_PIPE_TABLE_FORMAT,
        outputMimeType: GENERATED_MARKDOWN_PIPE_TABLE_MIME_TYPE,
        kind: 'markdown-table',
        richMediaActiveTab: 'text',
        media_interactive: false,
      },
      outputIndex: 1,
      allowCreateStandaloneOutput: true,
      connectCreatedOutputToAnchor: true,
      ownedOutputOnly: true,
    })
    if (!financialModelGraph) throw new Error('Financial Model Rich Media panel could not be published.')
    args.updateOutput(properties => ({
      ...clearRichMediaOutputProperties(properties),
      output: `Generated Slide Deck and Financial Model${mcpResponse ? ' with MCP evidence' : ''}.`,
      outputMimeType: 'text/markdown; charset=utf-8',
      outputModel: args.model,
      mcpInvoked: mcpResponse?.mcpInvoked === true,
      mcpTool: mcpResponse?.tool || '',
      mcpInvocationTokens: invocationTokens,
      lastRunAt: new Date().toISOString(),
    }))
    args.upsertToast({
      id: `storyboard-widget-run-${args.id}`,
      kind: 'success',
      message: `Generated Slide Deck and Financial Model${mcpResponse ? ' via MCP-backed instructions' : ''}.`,
      ttlMs: 3600,
    })
    return { handled: true, graphData: args.readGraph() || financialModelGraph }
  } finally {
    args.setLoading(false)
  }
}
