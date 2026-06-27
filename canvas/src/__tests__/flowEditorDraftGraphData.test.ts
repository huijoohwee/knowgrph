import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

export function testFlowEditorDraftGraphRevisionBumpOutranksRevisionFloor() {
  const bumped = bumpFlowEditorDraftGraphDataRevision(graph(5, ['n1']), { revisionFloor: 42 })
  if (readGraphDataRevision(bumped) !== 43) throw new Error('expected Flow Editor draft revision bump to outrank the store/base graph revision floor')
}

export function testFlowEditorBaseResetPreservesEqualRevisionSameDocumentDraft() {
  const base = graph(7, ['source_input', 'compute_summary'])
  const draft = graph(7, ['source_input', 'compute_summary'])
  const resolved = resolveFlowEditorDraftGraphDataForBaseReset({
    activeDocumentKey: 'docs/example.md::',
    previousDocumentKey: 'docs/example.md::',
    currentDraftGraphData: draft,
    nextBaseGraphData: base,
  })
  if (resolved !== draft) throw new Error('expected same-document equal-revision reset to preserve the live draft after store writeback')
}

export function testFlowEditorBaseResetEffectKeysOffRevisionInsteadOfDerivedGraphIdentity() {
  const source = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/useFlowEditorRenderState.ts'), 'utf8')
  if (!source.includes('const flowEditorBaseGraphDataRef = React.useRef(args.flowEditorBaseGraphData)')) {
    throw new Error('expected the draft reset effect to read the latest derived base graph through a stable ref')
  }
  if (source.includes('[args.activeDocumentKey, args.baseGraphDataRevision, args.editorRuntimeActive, args.flowEditorBaseGraphData]')) {
    throw new Error('expected derived graph object identity to stay out of the draft reset effect dependencies')
  }
}
