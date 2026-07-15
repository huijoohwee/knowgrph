import { buildVideoAgentUrlImportMarkdown } from '@/features/markdown-workspace/workspaceImport/videoAgentUrlImport'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'

export async function testVideoAgentImportUrlAddsMultiDimensionalFrameTablePanel() {
  const sourceUrl = ['https://', 'youtu.be/', 'TablePanel01'].join('')
  const transcript = {
    segments: [
      { text: 'Frame table transcript evidence.', start: 0, duration: 2 },
      { text: 'Objects are aligned to thumbnails.', start: 2, duration: 2 },
    ],
  }
  const markdown = buildVideoAgentUrlImportMarkdown({
    sourceTranscriptJsonText: JSON.stringify(transcript),
    sourceText: '# Table panel source',
    sourceUrl,
  })
  for (const token of [
    '## Multi-dimensional Frame Table',
    '| Time | Frame (Thumbnail) | (Transcript) Text | Objects (identified in bounding box) |',
    '![Frame 0 thumbnail](/__video_frame?',
    '| 0:00 |',
    'Frame table transcript evidence.',
    'tracked subject',
    '        tableFormat: "markdown-pipe-table"',
    '        outputMimeType: "text/markdown; charset=utf-8"',
    '        output: |',
  ]) {
    if (!markdown.includes(token)) throw new Error(`expected imported Markdown body to share frame table token ${token}`)
  }
  if (/<table\b/i.test(markdown)) {
    throw new Error('expected generated video-agent table artifacts to persist only as Markdown pipe tables')
  }
  const parsed = await loadGraphDataFromTextViaParser('table.video-agent.md', markdown, { applyToStore: false })
  const nodes = Array.isArray(parsed?.graphData?.nodes) ? parsed.graphData.nodes : []
  const tablePanel = nodes.find(node => String(node.id || '') === 'video_agent_multi_dimensional_table_panel')
  if (!tablePanel) throw new Error('expected video-agent import to add a Multi-dimensional Table Rich Media panel')
  const properties = (tablePanel.properties || {}) as Record<string, unknown>
  const tableOutput = String(unwrapGraphCellValue(properties.output) || '')
  if (!tableOutput.includes('| Time | Frame (Thumbnail) | (Transcript) Text | Objects (identified in bounding box) |')) {
    throw new Error('expected parsed table panel output to retain its canonical Markdown pipe table')
  }
  if (unwrapGraphCellValue(properties.outputSrcDoc) || unwrapGraphCellValue(properties.srcDoc)) {
    throw new Error('expected parsed table panel to omit authored table srcDoc properties')
  }
  if (String(unwrapGraphCellValue(properties.tableFormat) || '') !== 'markdown-pipe-table') {
    throw new Error('expected parsed table panel to identify the Markdown pipe-table persistence format')
  }
  const mediaSpec = getNodeMediaSpec(tablePanel)
  if (mediaSpec?.kind !== 'iframe') throw new Error(`expected table panel to resolve as iframe media spec, got ${JSON.stringify(mediaSpec)}`)
  if (mediaSpec.srcDoc) throw new Error('expected Markdown table DOM to be renderer-derived instead of persisted as iframe srcDoc')
}
