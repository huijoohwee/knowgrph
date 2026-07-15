import { buildRichMediaPanelOverlayState } from '@/lib/render/richMediaSsot'

export function testNativeCrawlerRichMediaProgressAndTerminalRecovery() {
  const runningPanelNode = { id: 'panel', type: 'RichMediaPanel', label: 'Rich Media Panel', properties: { outputLoading: true, outputLoadingKind: 'text', lastRunAt: '2026-07-15T04:16:33.000Z' } } as any
  const crawlerProgressPanel = buildRichMediaPanelOverlayState({ node: { ...runningPanelNode, id: 'panel-native-crawler-progress', properties: { ...runningPanelNode.properties, outputLoadingLabel: 'Importing website pages • 48/100 • 47 successful • 1 error' } } })
  if (!crawlerProgressPanel || crawlerProgressPanel.loadingLabel !== 'Importing website pages • 48/100 • 47 successful • 1 error') throw new Error('expected native crawl progress to replace the generic Rich Media loading label')
  const terminalSourceNode = { id: 'widget-terminal', type: 'TextGeneration', label: 'Widget Card', properties: { output: 'Open the Markdown workspace before running the crawler invocation.', lastRunAt: '2026-07-15T04:16:33.000Z' } } as any
  const connected = { 'properties.output': { value: terminalSourceNode.properties.output, sources: [{ edgeId: 'widget-to-panel', nodeId: terminalSourceNode.id, portKey: 'text_out' }] } }
  const staleConnectedPanel = buildRichMediaPanelOverlayState({ node: runningPanelNode, connectedValuesBySchemaPath: connected, nodeById: new Map([[terminalSourceNode.id, terminalSourceNode]]) })
  if (!staleConnectedPanel || staleConnectedPanel.isLoading !== false || !staleConnectedPanel.connectedText.includes('Open the Markdown workspace')) throw new Error('expected a terminal connected Widget output to backfill stale Rich Media loading')
  const activeSourceNode = { ...terminalSourceNode, properties: { ...terminalSourceNode.properties, outputLoading: true, outputLoadingKind: 'text' } } as any
  const activelyConnectedPanel = buildRichMediaPanelOverlayState({ node: runningPanelNode, connectedValuesBySchemaPath: connected, nodeById: new Map([[activeSourceNode.id, activeSourceNode]]) })
  if (!activelyConnectedPanel || activelyConnectedPanel.isLoading !== true || !activelyConnectedPanel.loadingLabel.includes('Widget Card')) throw new Error('expected an actively running connected Widget source to keep loading visible')
  const orphanedPanelNode = { id: 'orphaned-crawler-panel', type: 'RichMediaPanel', properties: { output: 'Crawling https://example.com/ with the native headless website importer…', outputLoading: true, outputLoadingKind: 'text', outputModel: 'native-web-crawler', outputSourceUrl: 'https://example.com/', lastRunAt: '2000-01-01T00:00:00.000Z' } } as any
  const orphanedTerminalSourceNode = { id: 'orphaned-crawler-widget', type: 'TextGeneration', label: 'Widget Card', properties: { output: 'Crawler finished with a terminal workspace error.', outputLoading: true, outputLoadingKind: 'text', outputModel: 'native-web-crawler', outputSourceUrl: 'https://example.com/', lastRunAt: '2000-01-01T00:00:01.000Z' } } as any
  const orphanedBackfillPanel = buildRichMediaPanelOverlayState({ node: orphanedPanelNode, nodeById: new Map([[orphanedPanelNode.id, orphanedPanelNode], [orphanedTerminalSourceNode.id, orphanedTerminalSourceNode]]) })
  if (!orphanedBackfillPanel || orphanedBackfillPanel.isLoading !== false || orphanedBackfillPanel.connectedText !== orphanedTerminalSourceNode.properties.output) throw new Error('expected a stale unconnected Rich Media publisher panel to backfill terminal Widget text')
}
