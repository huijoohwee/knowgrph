import { invokeAgenticOsDocsMcpBridge } from '@/features/agent-ready/agenticOsDocsMcpClient'
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
import { persistFinancialModelWorkbook } from '@/features/rich-media/financialModelWorkbookArtifact'
import {
  createRichMediaDeliverablesWithExternalMcp,
  readCreatedExternalMcpReceipt,
} from '@/features/rich-media/richMediaDeliverablesExternalMcp'
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
  workspacePath?: string | null
  requireDurablePersistence?: boolean
  model: unknown
  generateText: (prompt: string) => Promise<string>
  publishOutput: StoryboardWidgetTextRunOutputPublisher
  readGraph: () => GraphData | null
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
    const workbook = await persistFinancialModelWorkbook({
      markdown: deliverables.financialModelMarkdown,
      workspacePath: args.workspacePath,
      requireDurablePersistence: args.requireDurablePersistence,
    })
    const externalMcp = await createRichMediaDeliverablesWithExternalMcp({
      properties: args.rawNodeProperties,
      slideDeckMarkdown: deliverables.slideDeckMarkdown,
      financialModelMarkdown: deliverables.financialModelMarkdown,
      workbook,
    })
    const externalSlideReceipt = readCreatedExternalMcpReceipt(externalMcp.slideDeck)
    const externalSpreadsheetReceipt = readCreatedExternalMcpReceipt(externalMcp.spreadsheet)
    const externalCreatedCount = [externalSlideReceipt, externalSpreadsheetReceipt].filter(Boolean).length
    const commonPanelProperties = {
      freezeConnectedOutput: true,
      richMediaDeliverablesMode: true,
      richMediaDeliverablesSourceNodeId: args.connectedSourceNodeId,
      mcpInvoked: mcpResponse?.mcpInvoked === true,
      mcpTool: mcpResponse?.tool || '',
      mcpInvocationTokens: invocationTokens,
      externalMcpEnabled: externalMcp.enabled,
      externalMcpErrors: externalMcp.errors,
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
        externalArtifactReceipt: externalSlideReceipt || undefined,
      },
      sourceUrl: externalSlideReceipt?.url,
      outputIndex: 0,
      allowCreateStandaloneOutput: true,
      connectCreatedOutputToAnchor: true,
      ownedOutputOnly: true,
      // Stage both artifacts before the outer Run persists one complete graph.
      deferPublishedGraphCommit: true,
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
        workbookPath: workbook.path || undefined,
        workbookManifestPath: workbook.manifestPath || undefined,
        workbookDownloadUrl: workbook.downloadUrl || undefined,
        workbookStorageUrl: workbook.storageUrl || undefined,
        workbookFileName: workbook.fileName,
        workbookMimeType: workbook.mimeType,
        workbookSha256: workbook.sha256,
        workbookSizeBytes: workbook.sizeBytes,
        workbookSheetName: workbook.sheetName,
        workbookRowCount: workbook.rowCount,
        workbookColumnCount: workbook.columnCount,
        externalArtifactReceipt: externalSpreadsheetReceipt || undefined,
      },
      sourceUrl: externalSpreadsheetReceipt?.url || workbook.downloadUrl || undefined,
      outputPath: workbook.path,
      outputIndex: 1,
      allowCreateStandaloneOutput: true,
      connectCreatedOutputToAnchor: true,
      ownedOutputOnly: true,
      deferPublishedGraphCommit: true,
    })
    if (!financialModelGraph) throw new Error('Financial Model Rich Media panel could not be published.')
    args.upsertToast({
      id: `storyboard-widget-run-${args.id}`,
      kind: 'success',
      message: `Generated Slide Deck, Markdown Financial Model, and XLSX workbook${externalCreatedCount ? ` plus ${externalCreatedCount} external MCP artifact${externalCreatedCount === 1 ? '' : 's'}` : ''}.`,
      ttlMs: 3600,
    })
    return { handled: true, graphData: args.readGraph() || financialModelGraph }
  } finally {
    args.setLoading(false)
  }
}
