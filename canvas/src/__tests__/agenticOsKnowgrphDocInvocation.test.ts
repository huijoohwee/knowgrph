import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { findAgenticOsInvocationByToken } from '@/features/agentic-os/agenticOsDocInvocations'
import { buildAgenticOsRuntimeInvocationSystemPrompt } from '@/features/chat/chatRuntimeInvocationProfile'
import { resolveChatRuntimeInvocationQuery } from '@/features/chat/chatRuntimeInvocationQuery'
import { extractChatResponseStructuredSurface } from '@/features/chat/chatResponseStructuredContent'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import {
  buildProbeTreeCardFromGraphNode,
  materializeProbeTreeBranchCardsFromGraphNode,
} from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import type { GraphData } from '@/lib/graph/types'

export function testKnowgrphProbeTreeInvocationGrammarUsesDocAliasesAndToolIdentity() {
  for (const token of ['/knowgrph.probe-tree', '#knowgrph.probe-tree', '@knowgrph.probe-tree']) {
    const invocation = findAgenticOsInvocationByToken(token)
    if (!invocation || invocation.kind !== 'doc' || invocation.token !== token || invocation.label !== 'Knowgrph Probe-Tree') {
      throw new Error(`expected Probe-Tree alias ${token} to resolve through the document catalog, got ${JSON.stringify(invocation)}`)
    }
    const route = resolveChatRuntimeInvocationQuery(`${token} generate bounded branch choices`)
    if (route.leadingRoute?.kind !== 'agentic-os' || route.leadingRoute.token !== token || route.query !== 'generate bounded branch choices') {
      throw new Error(`expected Probe-Tree alias ${token} to resolve as the leading route, got ${JSON.stringify(route)}`)
    }
    const aliasPrompt = buildAgenticOsRuntimeInvocationSystemPrompt(`${token} generate bounded branch choices`)
    if (!aliasPrompt.includes(`Directives: ${token}`) || !aliasPrompt.includes('Knowgrph Probe-Tree')) {
      throw new Error(`expected Probe-Tree alias ${token} to contribute runtime context, got ${aliasPrompt}`)
    }
  }

  const runtimePrompt = buildAgenticOsRuntimeInvocationSystemPrompt('knowgrph.probe.generate Generate branch choices for card care_source.')
  for (const expected of ['response.structuredContent.cards', 'knowgrph.probe.generate', 'knowgrph.probe.select', 'candidateOption']) {
    if (!runtimePrompt.includes(expected)) throw new Error(`expected Probe-Tree runtime prompt to include ${expected}`)
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
        prompt: 'knowgrph.probe.generate',
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
    node.properties.invocation === 'knowgrph.probe.generate'
    && !Object.prototype.hasOwnProperty.call(node.properties, 'slashCommand')
    && !Object.prototype.hasOwnProperty.call(node.properties, 'hashToken')
    && !Object.prototype.hasOwnProperty.call(node.properties, 'atToken')
  ))) {
    throw new Error(`expected Probe-Tree cards to use the MCP tool identity without invented grammar aliases, got ${JSON.stringify(propsPanelProbeNodes)}`)
  }
}
