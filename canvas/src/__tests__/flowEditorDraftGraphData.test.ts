import { bumpFlowEditorDraftGraphDataRevision, resolveFlowEditorDraftGraphDataForBaseReset } from '@/lib/flowEditor/flowEditorDraftGraphData'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData } from '@/lib/graph/types'

const graph = (revision: number, ids: string[]): GraphData => ({
  type: 'Graph',
  nodes: ids.map(id => ({ id, label: id, type: 'Widget', properties: {} })) as never,
  edges: [],
  metadata: { graphDataRevision: revision },
})

export function testFlowEditorBaseResetPreservesNewerSameDocumentDraft() {
  const base = graph(3, ['source_input', 'compute_summary'])
  const draft = graph(4, ['source_input', 'compute_summary'])
  const resolved = resolveFlowEditorDraftGraphDataForBaseReset({
    activeDocumentKey: 'docs/example.md::',
    previousDocumentKey: 'docs/example.md::',
    currentDraftGraphData: draft,
    nextBaseGraphData: base,
  })
  if (resolved !== draft) throw new Error('expected same-document stale base reset to preserve the newer live draft graph')
}

export function testFlowEditorBaseResetReplacesDraftAcrossDocumentSwitchOrIncompatibleGraph() {
  const base = graph(3, ['source_input', 'compute_summary'])
  const switched = resolveFlowEditorDraftGraphDataForBaseReset({
    activeDocumentKey: 'docs/next.md::',
    previousDocumentKey: 'docs/example.md::',
    currentDraftGraphData: graph(4, ['source_input', 'compute_summary']),
    nextBaseGraphData: base,
  })
  const incompatible = resolveFlowEditorDraftGraphDataForBaseReset({
    activeDocumentKey: 'docs/example.md::',
    previousDocumentKey: 'docs/example.md::',
    currentDraftGraphData: graph(4, ['other_a', 'other_b']),
    nextBaseGraphData: base,
  })
  if (switched !== base || incompatible !== base) throw new Error('expected base reset to replace drafts across document switches or incompatible graph identities')
}

export function testFlowEditorDraftGraphRevisionBumpIsNeutral() {
  const bumped = bumpFlowEditorDraftGraphDataRevision(graph(5, ['n1']))
  if (readGraphDataRevision(bumped) !== 6) throw new Error('expected neutral Flow Editor draft revision bump to increment metadata graphDataRevision')
}
