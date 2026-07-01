import { buildVideoAgentUrlImportMarkdown } from '@/features/markdown-workspace/workspaceImport/videoAgentUrlImport'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'

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
  ]) {
    if (!markdown.includes(token)) throw new Error(`expected imported Markdown body to share frame table token ${token}`)
  }
  const parsed = await loadGraphDataFromTextViaParser('table.video-agent.md', markdown, { applyToStore: false })
  const nodes = Array.isArray(parsed?.graphData?.nodes) ? parsed.graphData.nodes : []
  const tablePanel = nodes.find(node => String(node.id || '') === 'video_agent_multi_dimensional_table_panel')
  if (!tablePanel) throw new Error('expected video-agent import to add a Multi-dimensional Table Rich Media panel')
  const mediaSpec = getNodeMediaSpec(tablePanel)
  const srcDoc = String(mediaSpec && 'srcDoc' in mediaSpec ? mediaSpec.srcDoc || '' : '')
  for (const token of [
    'data-kg-video-agent-frame-table-panel',
    'data-kg-rich-media-panel-scroll-owner="panel"',
    '<table>',
    'Time',
    'Frame (Thumbnail)',
    '(Transcript) Text',
    'Objects (identified in bounding box)',
    'data-kg-video-agent-frame-table-row',
    'Frame table transcript evidence.',
    'tracked subject',
    '<img src="/__video_frame?',
    'data-kg-video-agent-frame-table-scroll',
    'overscroll-behavior:contain',
    'overflow:visible',
    'userScrollUntilMs',
    "scroller.addEventListener('wheel',markUserScroll",
    "window.addEventListener('scroll',markUserScroll",
    "if(Date.now()>userScrollUntilMs)",
    'knowgrph:render-frame',
  ]) {
    if (!srcDoc.includes(token)) throw new Error(`expected Multi-dimensional Table srcdoc token ${token}`)
  }
  if (mediaSpec?.kind !== 'iframe') throw new Error(`expected table panel to resolve as iframe media spec, got ${JSON.stringify(mediaSpec)}`)
}
