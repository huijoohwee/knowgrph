import { shouldPrimeWorkspaceDocumentSwitchCanvas } from '@/lib/markdown-workspace-runtime/markdownWorkspaceDocumentSwitchApply'
import { useGraphStore } from '@/hooks/useGraphStore'

export function testWorkspaceDocumentSwitchPrimesCanvasForUnhydratedFile() {
  const accepted = shouldPrimeWorkspaceDocumentSwitchCanvas({
    activePath: '/notes/empty.md' as never,
    pendingSwitchPath: '/notes/empty.md' as never,
    activeEntryKind: 'file',
    activeDocumentKey: '/notes/empty.md',
    inlineText: '',
  })
  if (accepted !== true) throw new Error(`expected an unhydrated file switch to clear stale Canvas content before storage resolves, got ${String(accepted)}`)
}

export function testWorkspaceDocumentSwitchDoesNotPrimeCanvasForHydratedFile() {
  const accepted = shouldPrimeWorkspaceDocumentSwitchCanvas({
    activePath: '/notes/ready.md' as never,
    pendingSwitchPath: '/notes/ready.md' as never,
    activeEntryKind: 'file',
    activeDocumentKey: '/notes/ready.md',
    inlineText: '# Ready',
  })
  if (accepted !== false) throw new Error(`expected a hydrated file switch to proceed directly to its selected content, got ${String(accepted)}`)
}

export function testWorkspaceDocumentSwitchDoesNotPrimeCanvasForStalePendingPath() {
  const accepted = shouldPrimeWorkspaceDocumentSwitchCanvas({
    activePath: '/notes/current.md' as never,
    pendingSwitchPath: '/notes/previous.md' as never,
    activeEntryKind: 'file',
    activeDocumentKey: '/notes/current.md',
    inlineText: '',
  })
  if (accepted !== false) throw new Error(`expected a superseded switch not to clear the current Canvas, got ${String(accepted)}`)
}

export async function testWorkspaceDocumentSwitchBlankPrimeClearsStaleGraph() {
  const state = useGraphStore.getState()
  state.resetAll()
  state.setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    metadata: { source: 'markdown:/notes/previous.md' },
    nodes: [{ id: 'stale-card', label: 'Stale card', type: 'Paragraph' }],
    edges: [],
  } as never)
  await useGraphStore.getState().setActiveMarkdownDocument({
    name: '/notes/empty.md',
    text: '',
    normalizeMermaidMmd: false,
    applyViewPreset: true,
    applyToGraph: true,
    forceApplyToGraph: true,
  })
  const graph = useGraphStore.getState().graphData
  const metadata = (graph?.metadata || {}) as Record<string, unknown>
  if ((graph?.nodes || []).length !== 0 || metadata.pending !== true || metadata.source !== 'markdown:/notes/empty.md') {
    throw new Error(`expected blank switch priming to replace stale graph content, got ${JSON.stringify(graph)}`)
  }
}
