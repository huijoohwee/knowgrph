import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AGENTIC_OS_DOC_INVOCATIONS,
  KNOWGRPH_DOCS_GITHUB_ROOT_URL,
  findAgenticOsInvocationByToken,
} from '@/features/agentic-os/agenticOsDocInvocations'
import {
  buildFloatingPanelChatComposerOverlayParts,
} from '@/features/chat/floatingPanelChat/FloatingPanelChatComposerMediaOverlay'
import { buildChatInvocationSystemPrompt, parseChatInvocationDirectives } from '@/features/chat/chatInvocationRegistry'
import { resolveChatRuntimeInvocationQuery } from '@/features/chat/chatRuntimeInvocationQuery'
import { buildAgenticOsRuntimeInvocationSystemPrompt } from '@/features/chat/chatRuntimeInvocationProfile'
import { extractChatResponseStructuredSurface } from '@/features/chat/chatResponseStructuredContent'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import {
  buildProbeTreeCardFromGraphNode,
  materializeProbeTreeBranchCardsFromGraphNode,
} from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import type { GraphData } from '@/lib/graph/types'

export function testKnowgrphProbeTreeDocInvocationResolvesAcrossSlashHashAt() {
  const doc = AGENTIC_OS_DOC_INVOCATIONS.find(invocation => invocation.id === 'knowgrph.probe-tree')
  if (!doc) throw new Error('expected Knowgrph probe-tree PRD/TAD doc invocation to be registered')
  if (doc.fileName !== 'knowgrph-probe-tree-prd-tad.md') {
    throw new Error(`expected probe-tree invocation to point at the PRD/TAD doc, got ${doc.fileName}`)
  }
  if (doc.sourcePath !== `${KNOWGRPH_DOCS_GITHUB_ROOT_URL}/knowgrph-probe-tree-prd-tad.md`) {
    throw new Error(`expected portable Knowgrph docs source URL, got ${doc.sourcePath}`)
  }
  if (doc.sourcePath.includes('/Users/') || doc.sourcePath.includes('localhost')) {
    throw new Error(`expected probe-tree source path to stay portable, got ${doc.sourcePath}`)
  }

  const expectedTokens = ['/knowgrph.probe-tree', '#knowgrph.probe-tree', '@knowgrph.probe-tree'] as const
  for (const token of expectedTokens) {
    const resolved = findAgenticOsInvocationByToken(token)
    if (resolved?.kind !== 'doc' || resolved.sourcePath !== doc.sourcePath) {
      throw new Error(`expected ${token} to resolve to the probe-tree doc, got ${JSON.stringify(resolved)}`)
    }
    const runtimeQuery = resolveChatRuntimeInvocationQuery(`${token} generate first branch questions`)
    if (runtimeQuery.leadingRoute?.sourcePath !== doc.sourcePath || runtimeQuery.query !== 'generate first branch questions') {
      throw new Error(`expected ${token} to split route from the live query, got ${JSON.stringify(runtimeQuery)}`)
    }
  }

  const directives = parseChatInvocationDirectives('Bind this response to #knowgrph.probe-tree and #runtime-ready.')
  if (!directives.some(directive => directive.id === 'knowgrph.probe-tree' && directive.sourcePath === doc.sourcePath)) {
    throw new Error(`expected #knowgrph.probe-tree to resolve as a chat invocation directive, got ${JSON.stringify(directives)}`)
  }
  const systemPrompt = buildChatInvocationSystemPrompt({
    userQuery: 'Bind this response to #knowgrph.probe-tree and #runtime-ready.',
    chatProvider: 'local',
    chatModel: 'probe-tree-harness',
  })
  for (const expected of ['#knowgrph.probe-tree', 'knowgrph-probe-tree-prd-tad.md', 'do not authorize Prod or Cloudflare deployment']) {
    if (!systemPrompt.includes(expected)) throw new Error(`expected Knowgrph invocation prompt to include ${expected}`)
  }
  for (const token of expectedTokens) {
    const runtimePrompt = buildAgenticOsRuntimeInvocationSystemPrompt(`${token} Generate branch choices for card care_source.`)
    for (const expected of ['response.structuredContent.cards', 'knowgrph.probe.generate', 'knowgrph.probe.select', 'candidateOption']) {
      if (!runtimePrompt.includes(expected)) throw new Error(`expected ${token} runtime prompt to include ${expected}`)
    }
  }

  const overlay = buildFloatingPanelChatComposerOverlayParts(expectedTokens.join(' '))
  const overlayTokens = overlay.parts.flatMap(part => part.kind === 'invocation' ? [`${part.tokenKind}:${part.text}`] : [])
  const expectedOverlayTokens = ['slash:/knowgrph.probe-tree', 'keyword:#knowgrph.probe-tree', 'binding:@knowgrph.probe-tree']
  if (!overlay.hasOverlay || JSON.stringify(overlayTokens) !== JSON.stringify(expectedOverlayTokens)) {
    throw new Error(`expected probe-tree / # @ tokens to render through shared invocation chips, got ${JSON.stringify(overlay)}`)
  }

  const surface = extractChatResponseStructuredSurface([
    'Probe-Tree branches:',
    '```yaml',
    'response:',
    '  structuredContent:',
    '    cards:',
    '      - id: care-source-safety',
    '        label: Safety boundary',
    '        kind: text',
    '        parentNodeId: care_source',
    '        candidateOptionId: ask-safety',
    '        rationale: Clarifies urgent risk before downstream planning.',
    '        nextAction: knowgrph.probe.select',
    '        output: "Any severe, worsening, or urgent symptoms?"',
    '```',
  ].join('\n'))
  const node = surface?.nodes[0]
  if (node?.properties['chat:structuredRole'] !== 'card' || node.properties.parentNodeId !== 'care_source' || node.properties.nextAction !== 'knowgrph.probe.select') {
    throw new Error(`expected Probe-Tree structured response cards to project as selectable card nodes, got ${JSON.stringify(surface)}`)
  }
  const candidateEdge = surface?.edges.find(edge => (
    edge.source === 'care_source'
    && edge.target === node?.id
    && edge.label === 'candidateOption'
  ))
  if (!candidateEdge) {
    throw new Error(`expected Probe-Tree structured response cards to infer a candidateOption edge from parentNodeId, got ${JSON.stringify(surface?.edges || [])}`)
  }

  const docMarkdown = readFileSync(resolve(process.cwd(), '..', 'docs', 'documents', 'knowgrph-probe-tree-prd-tad.md'), 'utf8')
  const parsedDoc = tryParseMarkdownFrontmatterFlowGraph('knowgrph-probe-tree-prd-tad.md', docMarkdown)
  const frontmatterMeta = (parsedDoc?.graphData.metadata || {}).frontmatterMeta as Record<string, unknown> | undefined
  if (!parsedDoc || frontmatterMeta?.kgCanvas2dRenderer !== 'storyboard' || frontmatterMeta?.kgCanvasRenderMode !== '2d') {
    throw new Error(`expected Probe-Tree PRD/TAD frontmatter to select 2D Renderer: Storyboard, got ${JSON.stringify(frontmatterMeta)}`)
  }
  const parsedIds = new Set((parsedDoc.graphData.nodes || []).map(parsedNode => String(parsedNode.id || '')))
  for (const expected of ['probe_root', 'probe_options', 'probe_selected', 'probe_terminal', 'probe_memory']) {
    if (!parsedIds.has(expected)) throw new Error(`expected PRD/TAD Mermaid seed to parse node ${expected}, got ${Array.from(parsedIds).join(',')}`)
  }
  if (!parsedDoc.graphData.edges.some(edge => edge.source === 'probe_options' && edge.target === 'probe_selected' && edge.label === 'probe.select')) {
    throw new Error(`expected PRD/TAD Mermaid seed to parse probe.select edge, got ${JSON.stringify(parsedDoc.graphData.edges)}`)
  }

  const propsPanelText = readFileSync(resolve(process.cwd(), 'src', 'features', 'toolbar', 'FloatingPropsPanel.tsx'), 'utf8')
  for (const expected of [
    'WidgetPalette',
    'data-kg-props-panel-surface="widget-palette"',
    'filter(isPropsPanelWidgetPaletteEntry)',
  ]) {
    if (!propsPanelText.includes(expected)) throw new Error(`expected Props Panel cleanup to retain palette-only snippet ${expected}`)
  }
  for (const staleSnippet of [
    'FloatingPropsPanelProbeTreeButton',
    'disabled={!canUseNodeContext}',
    'propsPanelProbeTree',
  ]) {
    if (propsPanelText.includes(staleSnippet)) throw new Error(`expected Props Panel cleanup to omit stale selected-card Probe-Tree snippet ${staleSnippet}`)
  }

  const propsPanelGraph: GraphData = {
    type: 'Graph',
    nodes: [{
      id: 'props_source',
      label: 'Props Panel Card',
      type: 'Card',
      x: 10,
      y: 20,
      properties: {
        summary: 'Clean-slate selected card context',
        action: 'Generate bounded next-step options',
        prompt: '/knowgrph.probe-tree #knowgrph.probe-tree @knowgrph.probe-tree',
        lane: 'Storyboard',
        tags: ['runtime-ready', 'props-panel'],
      },
    }],
    edges: [],
  }
  const propsPanelNode = propsPanelGraph.nodes[0]
  const propsPanelCard = buildProbeTreeCardFromGraphNode(propsPanelNode)
  if (propsPanelCard.id !== 'props_source' || propsPanelCard.title !== 'Props Panel Card' || propsPanelCard.lane !== 'Storyboard') {
    throw new Error(`expected Props Panel graph node to adapt into a Storyboard card, got ${JSON.stringify(propsPanelCard)}`)
  }
  const propsPanelMaterialized = materializeProbeTreeBranchCardsFromGraphNode({ graphData: propsPanelGraph, node: propsPanelNode })
  if (!propsPanelMaterialized.changed || propsPanelMaterialized.materializedNodeIds.length !== 3) {
    throw new Error(`expected Props Panel Probe-Tree invocation to materialize three downstream cards, got ${JSON.stringify(propsPanelMaterialized)}`)
  }
  const propsPanelProbeNodes = (propsPanelMaterialized.graphData?.nodes || []).filter(node => node.type === 'ProbeTreeCandidate')
  const propsPanelCandidateEdges = (propsPanelMaterialized.graphData?.edges || []).filter(edge => edge.source === 'props_source' && edge.label === 'candidateOption')
  if (propsPanelProbeNodes.length !== 3 || propsPanelCandidateEdges.length !== 3) {
    throw new Error(`expected Props Panel Probe-Tree path to produce candidate cards and edges, got ${JSON.stringify(propsPanelMaterialized.graphData)}`)
  }
  if (!propsPanelProbeNodes.every(node => (
    node.properties.slashCommand === '/knowgrph.probe-tree'
    && node.properties.hashToken === '#knowgrph.probe-tree'
    && node.properties.atToken === '@knowgrph.probe-tree'
    && String(node.properties.invocation || '').includes('/knowgrph.probe-tree #knowgrph.probe-tree @knowgrph.probe-tree')
  ))) {
    throw new Error(`expected Props Panel Probe-Tree downstream cards to preserve /, #, @ invocation grammar, got ${JSON.stringify(propsPanelProbeNodes)}`)
  }
}
