import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildStoryboardWidgetDraftGraphBaseSignature,
  bumpStoryboardWidgetDraftGraphDataRevision,
  resolveStoryboardWidgetDraftGraphDataForBaseReset,
} from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData } from '@/lib/graph/types'

const graph = (revision: number, ids: string[]): GraphData => ({
  type: 'Graph',
  nodes: ids.map(id => ({ id, label: id, type: 'Widget', properties: {} })) as never,
  edges: [],
  metadata: { graphDataRevision: revision },
})

const graphWithNodeProperties = (revision: number, props: Record<string, unknown>): GraphData => ({
  type: 'Graph',
  context: 'markdown',
  nodes: [{ id: 'source_input', label: 'Source Input', type: 'Widget', properties: props }] as never,
  edges: [],
  metadata: { graphDataRevision: revision, kind: 'markdown', source: 'markdown:chat-log/session.md' },
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

export function testStoryboardWidgetBaseResetSkipsEquivalentNewerBaseRefresh() {
  const draft = graphWithNodeProperties(4, { value: 'same', nested: { count: 1 } })
  const base = graphWithNodeProperties(5, { value: 'same', nested: { count: 1 } })
  const changedBase = graphWithNodeProperties(6, { value: 'changed', nested: { count: 1 } })
  const resolved = resolveStoryboardWidgetDraftGraphDataForBaseReset({
    activeDocumentKey: 'chat-log/session.md::5',
    previousDocumentKey: 'chat-log/session.md::5',
    currentDraftGraphData: draft,
    nextBaseGraphData: base,
  })
  const changedResolved = resolveStoryboardWidgetDraftGraphDataForBaseReset({
    activeDocumentKey: 'chat-log/session.md::6',
    previousDocumentKey: 'chat-log/session.md::6',
    currentDraftGraphData: draft,
    nextBaseGraphData: changedBase,
  })
  if (buildStoryboardWidgetDraftGraphBaseSignature(draft) !== buildStoryboardWidgetDraftGraphBaseSignature(base)) {
    throw new Error('expected equivalent draft/base graph refreshes to share a reset signature')
  }
  if (resolved !== draft) throw new Error('expected equivalent newer base refresh to avoid replacing the active draft graph')
  if (changedResolved !== changedBase) throw new Error('expected changed newer base graph to replace the active draft graph')
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
