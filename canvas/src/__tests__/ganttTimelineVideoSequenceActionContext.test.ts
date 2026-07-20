import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  resolveGanttTimelineVideoSequenceActionContext,
  resolveGanttTimelineVideoSequenceSelectedRowKey,
} from '@/features/gitgraph/ganttTimelineVideoSequenceActionContext'
import { commitTimelineDocumentMutation } from '@/components/timeline/timelineSurfaceBindings'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { readDocumentVersions } from '@/features/document-versioning/documentVersioning'

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

export async function testGanttTimelineDocumentMutationTracksAndRestoresSharedHistory() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })
  try {
    const store = useGraphStore.getState()
    store.resetAll()
    store.setHistoryDebounceMs(0)
    const beforeText = wrapMarkdown([
      'gantt',
      '  title Video Sequence Timeline',
      '  section Source video',
      '  Source video : source, 0, 1m',
    ].join('\n'))
    const afterText = beforeText.replace('source, 0, 1m', 'source, 0, 2m')
    const sourceFile = {
      id: 'gantt-source',
      name: 'timeline.md',
      text: beforeText,
      enabled: true,
      status: 'parsed' as const,
      source: { kind: 'local' as const, path: 'workspace:/timeline.md' },
    }
    useGraphStore.setState({
      graphData: { type: 'Graph', nodes: [], edges: [], metadata: {} },
      markdownDocumentName: 'timeline.md',
      markdownDocumentText: beforeText,
      sourceFiles: [sourceFile],
    })

    const committed = commitTimelineDocumentMutation({
      name: 'timeline.md',
      markdownText: afterText,
      applyViewPreset: false,
      historyLabel: 'Gantt Timeline edit',
    })
    if (!committed) throw new Error('expected changed Gantt document to commit')
    await new Promise<void>(resolve => setTimeout(resolve, 10))

    const committedState = useGraphStore.getState()
    if (committedState.history.length !== 2 || committedState.historyIndex !== 1) {
      throw new Error(`expected before/after Gantt versions in shared history, got ${committedState.history.length}@${committedState.historyIndex}`)
    }
    if (committedState.sourceFiles[0]?.text !== afterText) {
      throw new Error('expected Gantt edit to update the active Source File atomically')
    }
    if (!readDocumentVersions('timeline.md').some(entry => entry.text === afterText && entry.label === 'Gantt Timeline edit')) {
      throw new Error('expected Gantt edit to appear in persistent document versions')
    }

    committedState.undoHistory()
    const restoredState = useGraphStore.getState()
    if (restoredState.markdownDocumentText !== beforeText || restoredState.sourceFiles[0]?.text !== beforeText) {
      throw new Error('expected shared History/GitGraph undo to restore both document and Source File text')
    }
    if (!readDocumentVersions('timeline.md').some(entry => entry.text === beforeText && entry.label === 'History restore: Before Gantt Timeline edit')) {
      throw new Error('expected restored Gantt text to be persisted as a document version')
    }
  } finally {
    restore()
  }
}
