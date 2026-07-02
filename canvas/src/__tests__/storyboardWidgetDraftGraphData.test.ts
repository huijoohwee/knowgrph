import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bumpStoryboardWidgetDraftGraphDataRevision, resolveStoryboardWidgetDraftGraphDataForBaseReset } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData } from '@/lib/graph/types'

const graph = (revision: number, ids: string[]): GraphData => ({
  type: 'Graph',
  nodes: ids.map(id => ({ id, label: id, type: 'Widget', properties: {} })) as never,
  edges: [],
  metadata: { graphDataRevision: revision },
})

export function testStoryboardWidgetBaseResetPreservesNewerSameDocumentDraft() {
  const base = graph(3, ['source_input', 'compute_summary'])
  const draft = graph(4, ['source_input', 'compute_summary'])
  const resolved = resolveStoryboardWidgetDraftGraphDataForBaseReset({
    activeDocumentKey: 'docs/example.md::',
    previousDocumentKey: 'docs/example.md::',
    currentDraftGraphData: draft,
    nextBaseGraphData: base,
  })
  if (resolved !== draft) throw new Error('expected same-document stale base reset to preserve the newer live draft graph')
}

export function testStoryboardWidgetBaseResetReplacesDraftAcrossDocumentSwitchOrIncompatibleGraph() {
  const base = graph(3, ['source_input', 'compute_summary'])
  const switched = resolveStoryboardWidgetDraftGraphDataForBaseReset({
    activeDocumentKey: 'docs/next.md::',
    previousDocumentKey: 'docs/example.md::',
    currentDraftGraphData: graph(4, ['source_input', 'compute_summary']),
    nextBaseGraphData: base,
  })
  const incompatible = resolveStoryboardWidgetDraftGraphDataForBaseReset({
    activeDocumentKey: 'docs/example.md::',
    previousDocumentKey: 'docs/example.md::',
    currentDraftGraphData: graph(4, ['other_a', 'other_b']),
    nextBaseGraphData: base,
  })
  if (switched !== base || incompatible !== base) throw new Error('expected base reset to replace drafts across document switches or incompatible graph identities')
}

export function testStoryboardWidgetDraftGraphRevisionBumpIsNeutral() {
  const bumped = bumpStoryboardWidgetDraftGraphDataRevision(graph(5, ['n1']))
  if (readGraphDataRevision(bumped) !== 6) throw new Error('expected neutral Storyboard Widget draft revision bump to increment metadata graphDataRevision')
}

export function testStoryboardWidgetDraftGraphRevisionBumpOutranksRevisionFloor() {
  const bumped = bumpStoryboardWidgetDraftGraphDataRevision(graph(5, ['n1']), { revisionFloor: 42 })
  if (readGraphDataRevision(bumped) !== 43) throw new Error('expected Storyboard Widget draft revision bump to outrank the store/base graph revision floor')
}

export function testStoryboardWidgetBaseResetPreservesEqualRevisionSameDocumentDraft() {
  const base = graph(7, ['source_input', 'compute_summary'])
  const draft = graph(7, ['source_input', 'compute_summary'])
  const resolved = resolveStoryboardWidgetDraftGraphDataForBaseReset({
    activeDocumentKey: 'docs/example.md::',
    previousDocumentKey: 'docs/example.md::',
    currentDraftGraphData: draft,
    nextBaseGraphData: base,
  })
  if (resolved !== draft) throw new Error('expected same-document equal-revision reset to preserve the live draft after store writeback')
}

export function testStoryboardWidgetBaseResetEffectKeysOffRevisionInsteadOfDerivedGraphIdentity() {
  const source = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetRenderState.ts'), 'utf8')
  if (!source.includes('const storyboardWidgetBaseGraphDataRef = React.useRef(args.storyboardWidgetBaseGraphData)')) {
    throw new Error('expected the draft reset effect to read the latest derived base graph through a stable ref')
  }
  if (source.includes('[args.activeDocumentKey, args.baseGraphDataRevision, args.editorRuntimeActive, args.storyboardWidgetBaseGraphData]')) {
    throw new Error('expected derived graph object identity to stay out of the draft reset effect dependencies')
  }
}
