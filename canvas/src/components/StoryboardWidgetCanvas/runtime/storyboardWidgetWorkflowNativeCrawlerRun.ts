import { clearRichMediaOutputProperties } from '@/features/chat/richMediaRun'
import { executeNativeCrawlerInvocation, parseNativeCrawlerInvocation, resolveNativeCrawlerGenerationToken } from '@/features/chat/nativeCrawlerInvocation'
import { formatMarkdownWorkspaceStatusLabel } from '@/features/markdown-workspace/markdownWorkspaceStatusUi'
import type { GraphNode } from '@/lib/graph/types'
import type { StoryboardWidgetTextRunOutputPublisher } from './storyboardWidgetWorkflowRichMediaPublication'

type OutputUpdater = (buildPatch: (nodeProps: Record<string, unknown>) => Record<string, unknown>) => void

export async function runStoryboardWidgetNativeCrawlerInvocation(args: {
  id: string
  prompt: string
  node: GraphNode
  nodeProperties: Record<string, unknown>
  workspacePath: string | null
  recoveryOnly: boolean
  updateOutput: OutputUpdater
  publishOutput: StoryboardWidgetTextRunOutputPublisher
  upsertToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
  reportFailure: (message: string, ttlMs?: number) => void
}): Promise<boolean> {
  const invocation = parseNativeCrawlerInvocation(args.prompt)
  if (!invocation) return false
  const title = args.node.label || 'Website crawl'
  const generationToken = resolveNativeCrawlerGenerationToken({ nodeProperties: args.nodeProperties, workspacePath: args.workspacePath })
  const loadingText = `Crawling ${invocation.url} with the native headless website importer…`
  let terminalOutput = loadingText
  let terminalOutputPath: string | null = null
  let terminalMarkdown: string | null = null
  let terminalSourceUrl = invocation.url
  let lastProgressLabel = ''
  const updateStatus = (status: 'running' | 'done' | 'error') => args.updateOutput(nodeProps => ({
    ...clearRichMediaOutputProperties(nodeProps), websiteImportGenerationToken: generationToken,
    workflowOutputPanelOnly: true, workflowRunStatus: status, lastRunAt: new Date().toISOString(),
  }))
  updateStatus('running')
  try {
    args.publishOutput({ anchorNode: args.node, outputText: loadingText, title, model: 'native-web-crawler', sourceUrl: invocation.url, loading: true, loadingLabel: 'Starting native website crawl…', outputKey: 'crawl-report', panelLabel: 'Crawl generation report', outputIndex: 0 })
    const run = await executeNativeCrawlerInvocation(invocation, {
      generationToken,
      recoveryOnly: args.recoveryOnly,
      onProgress: progress => {
        const hasPageCounts = typeof progress.processed === 'number' && typeof progress.total === 'number' && progress.total > 0
        const stageLabel = progress.stage === 'discovering' ? 'Discovering website pages' : progress.stage === 'crawling' ? 'Crawling website pages' : 'Importing website pages'
        const resultLabels = [typeof progress.ok === 'number' ? `${progress.ok} successful` : '', typeof progress.error === 'number' && progress.error > 0 ? `${progress.error} ${progress.error === 1 ? 'error' : 'errors'}` : ''].filter(Boolean)
        const sharedLabel = formatMarkdownWorkspaceStatusLabel({ kind: 'progress', label: stageLabel, current: hasPageCounts ? progress.processed : null, total: hasPageCounts ? progress.total : null })
        const progressLabel = `${sharedLabel}${resultLabels.length ? ` • ${resultLabels.join(' • ')}` : ''}`
        if (progressLabel === lastProgressLabel) return
        lastProgressLabel = progressLabel
        terminalOutput = ['# Website crawl in progress', '', `- Source URL: ${invocation.url}`, `- Progress: ${progressLabel}`, `- Generation: ${generationToken}`].join('\n')
        args.publishOutput({ anchorNode: args.node, outputText: terminalOutput, title, model: 'native-web-crawler', sourceUrl: invocation.url, loading: true, loadingLabel: progressLabel, outputKey: 'crawl-report', panelLabel: 'Crawl generation report', outputIndex: 0 })
      },
    })
    terminalOutput = run.outputText
    terminalOutputPath = run.outputPath
    terminalMarkdown = run.panelMarkdown
    terminalSourceUrl = run.invocation.url
    updateStatus('done')
    args.upsertToast({ id: `storyboard-widget-run-${args.id}`, kind: 'success', message: 'Imported website crawl to Canvas.', ttlMs: 3000 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Native website crawl failed.'
    terminalOutput = message
    terminalOutputPath = null
    terminalMarkdown = null
    updateStatus('error')
    args.reportFailure(message, 4200)
  } finally {
    try {
      args.publishOutput({ anchorNode: args.node, outputText: terminalOutput, title, model: 'native-web-crawler', sourceUrl: terminalSourceUrl, outputPath: terminalOutputPath, loading: false, outputKey: 'crawl-report', panelLabel: 'Crawl generation report', outputIndex: 0 })
      if (terminalMarkdown) args.publishOutput({ anchorNode: args.node, outputText: terminalMarkdown, title: `${title} data`, model: 'native-web-crawler', sourceUrl: terminalSourceUrl, outputPath: terminalOutputPath, loading: false, outputKey: 'crawl-table', panelLabel: 'Crawl multi-dimensional table', outputIndex: 1 })
    } catch {
      // The Rich Media Panel remains the output authority if teardown writeback is transiently unavailable.
    }
  }
  return true
}
