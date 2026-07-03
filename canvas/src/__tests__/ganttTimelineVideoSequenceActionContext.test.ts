import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  resolveGanttTimelineVideoSequenceActionContext,
  resolveGanttTimelineVideoSequenceSelectedRowKey,
} from '@/features/gitgraph/ganttTimelineVideoSequenceActionContext'

const readSource = (...parts: string[]): string => readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')

const wrapMarkdown = (code: string): string => [
  '---',
  'flow_diagrams:',
  '  video_sequence:',
  '    key: video_sequence',
  '    type: mermaid_gantt',
  '    value: |-',
  ...code.split('\n').map(line => `      ${line}`),
  '---',
  '',
].join('\n')

export function testGanttTimelineVideoSequenceActionContextRebasesOntoCurrentDocument() {
  const staleCode = [
    'gantt',
    '  title Video Sequence Timeline',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Source video',
    '  Source video : operator_source_video, kgpos_0, 1m',
  ].join('\n')
  const currentCode = staleCode.replace('operator_source_video, kgpos_0, 1m', 'kgmedia_video_1, kgsrc_0_0_252, kgpos_0_158, 0.252m')
  const staleSpan = buildMermaidGanttTimelineModel(staleCode).taskSpans[0]
  const context = resolveGanttTimelineVideoSequenceActionContext({
    code: staleCode,
    markdownDocumentName: 'demo.md',
    markdownText: wrapMarkdown(staleCode),
    maxMinutes: 1,
    readDocumentSnapshot: () => ({
      markdownDocumentName: 'demo.md',
      markdownText: wrapMarkdown(currentCode),
    }),
    selectedSpan: staleSpan,
  })
  if (!context || context.code !== currentCode || context.selectedSpan.label !== 'Source video') {
    throw new Error(`expected action context to use current document code: ${JSON.stringify(context)}`)
  }
}

export function testGanttTimelineVideoSequenceSelectedRowKeyClearsMissingTask() {
  const code = [
    'gantt',
    '  title Video Sequence Timeline',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Source video',
  ].join('\n')
  const rowKey = resolveGanttTimelineVideoSequenceSelectedRowKey({ code, lineIndex: 5 })
  if (rowKey) throw new Error(`expected missing deleted task selection to clear, got ${rowKey}`)
}

export function testTimelineDocumentSnapshotReaderUsesCurrentStoreDocument() {
  const text = readSource('components', 'timeline', 'timelineSurfaceBindings.ts')
  const requiredTokens = [
    "useGraphStoreKeyRef('markdownDocumentName')",
    "useGraphStoreKeyRef('markdownDocumentText')",
    'String(storeMarkdownDocumentTextRef.current || \'\')',
  ]
  for (const token of requiredTokens) {
    if (!text.includes(token)) throw new Error(`expected timeline snapshot reader to include ${token}`)
  }
}
