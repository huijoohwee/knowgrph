import fs from 'node:fs'
import path from 'node:path'

import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  buildImplicitFlowEdgePortKey,
} from '@/lib/graph/flowPorts'
import { mergeWorkspaceEntriesIntoSourceFiles, resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { buildRichMediaPanelOverlayState, buildRichMediaPanelPreviewSpec } from '@/lib/render/richMediaSsot'

const RESEARCH_AGENT_DEMO_BASENAME = 'knowgrph-research-agent-demo.md'
const RESEARCH_AGENT_DEMO_NODE_COUNT = 16
const RESEARCH_AGENT_DEMO_EDGE_COUNT = 13

function resolveResearchAgentDemoPath(): string {
  return path.resolve(process.cwd(), '..', '..', 'huijoohwee', 'docs', RESEARCH_AGENT_DEMO_BASENAME)
}

function readResearchAgentDemoText(): string {
  const demoPath = resolveResearchAgentDemoPath()
  if (!fs.existsSync(demoPath)) {
    throw new Error(`expected research agent demo markdown at ${demoPath}`)
  }
  const text = fs.readFileSync(demoPath, 'utf8')
  if (!text.trim()) throw new Error(`expected research agent demo markdown at ${demoPath} to be non-empty`)
  return text
}

export async function testResearchAgentDemoIngestsParsesAndBuildsFlowScene() {
  const demoText = readResearchAgentDemoText()
  const workspacePath = `/docs/${RESEARCH_AGENT_DEMO_BASENAME}`
  const sourcePath = resolveWorkspaceSourcePathKey(workspacePath)
  if (sourcePath !== `workspace:${workspacePath}`) {
    throw new Error(`expected docs mirror source path, got ${sourcePath}`)
  }

  const sourceFiles = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [],
    workspaceEntries: [{
      kind: 'file',
      path: workspacePath,
      parentPath: '/docs',
      name: RESEARCH_AGENT_DEMO_BASENAME,
      text: demoText,
      updatedAtMs: 1,
    }],
    sourcesByPath: {},
    workspaceDocsOnly: true,
    workspaceSourceRootPaths: ['/docs'],
  })
  const sourceFile = sourceFiles.find(entry => String(entry.source?.path || '') === sourcePath) || null
  if (!sourceFile) throw new Error('expected research agent demo to be visible through docs-mirror Source Files ingestion')
  if (sourceFile.enabled !== false) {
    throw new Error('expected docs-mirror Source Files ingestion to stay passive until selected, not force-enable a project-specific demo')
  }
  if (String(sourceFile.text || '') !== demoText) {
    throw new Error('expected docs-mirror Source Files ingestion to preserve research demo text')
  }

  const parsed = await loadGraphDataFromTextViaParser(RESEARCH_AGENT_DEMO_BASENAME, demoText, {
    applyToStore: false,
    syncMarkdownDocument: false,
  })
  if (!parsed?.graphData) throw new Error('expected research agent demo parser result')
  if (parsed.parserId !== 'markdown') throw new Error(`expected markdown parser, got ${String(parsed.parserId || '')}`)
  if ((parsed.warnings || []).length > 0) throw new Error(`expected no parser warnings, got ${(parsed.warnings || []).join(' | ')}`)
  if (String(parsed.graphData.context || '') !== 'frontmatter-flow') throw new Error('expected frontmatter-flow graph context')
  if ((parsed.graphData.nodes || []).length !== RESEARCH_AGENT_DEMO_NODE_COUNT) {
    throw new Error(`expected ${RESEARCH_AGENT_DEMO_NODE_COUNT} research demo nodes, got ${(parsed.graphData.nodes || []).length}`)
  }
  if ((parsed.graphData.edges || []).length !== RESEARCH_AGENT_DEMO_EDGE_COUNT) {
    throw new Error(`expected ${RESEARCH_AGENT_DEMO_EDGE_COUNT} research demo edges, got ${(parsed.graphData.edges || []).length}`)
  }

  const meta = (parsed.graphData.metadata || {}) as Record<string, unknown>
  if (String(meta.kind || '') !== 'frontmatter-flow') throw new Error('expected frontmatter-flow graph metadata')
  const frontmatterMeta = (meta.frontmatterMeta || {}) as Record<string, unknown>
  if (String(frontmatterMeta.demo_status || '') !== 'dev-source capability demo; no Prod or Cloudflare deploy claim') {
    throw new Error('expected demo deploy status to survive frontmatter parsing')
  }
  if (frontmatterMeta.deployed_api_claim !== false) {
    throw new Error('expected demo to preserve deployed_api_claim=false')
  }
  const researchDemo = (frontmatterMeta.research_thesis_demo || {}) as Record<string, unknown>
  if (!String(researchDemo.run_id || '').startsWith('kgra_run_')) {
    throw new Error(`expected semantic research run id, got ${String(researchDemo.run_id || '')}`)
  }

  const evidenceEdge = (parsed.graphData.edges || []).find(edge => String(edge.id || '') === 'edge_source_market_to_claim') || null
  if (!evidenceEdge) throw new Error('expected source-to-claim evidence edge')
  const evidenceProps = (evidenceEdge.properties || {}) as Record<string, unknown>
  const expectedSourcePort = buildImplicitFlowEdgePortKey({ socketType: 'source_ref_signal', side: 'source' })
  const expectedTargetPort = buildImplicitFlowEdgePortKey({ socketType: 'source_ref_signal', side: 'target' })
  if (String(evidenceProps[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== expectedSourcePort) {
    throw new Error(`expected source-to-claim edge to use implicit source port ${expectedSourcePort}`)
  }
  if (String(evidenceProps[FLOW_EDGE_TARGET_PORT_KEY] || '') !== expectedTargetPort) {
    throw new Error(`expected source-to-claim edge to use implicit target port ${expectedTargetPort}`)
  }

  const readPanelPreview = (id: string) => {
    const node = (parsed.graphData.nodes || []).find(candidate => String(candidate.id || '') === id) || null
    if (!node) throw new Error(`expected Rich Media Panel node ${id}`)
    if (String(node.type || '') !== 'RichMediaPanel') throw new Error(`expected ${id} to be a RichMediaPanel node`)
    const panel = buildRichMediaPanelOverlayState({ node })
    if (!panel) throw new Error(`expected Rich Media Panel state for ${id}`)
    const preview = buildRichMediaPanelPreviewSpec({ node, panel })
    if (!preview) throw new Error(`expected Rich Media Panel preview spec for ${id}`)
    return { node, panel, preview }
  }
  const textPanel = readPanelPreview('panel_text_research_brief')
  if (textPanel.panel.activeTab !== 'text' || textPanel.preview.kind !== 'iframe' || !String(textPanel.preview.srcDoc || '').includes('Review brief')) {
    throw new Error('expected text Rich Media Panel to render review brief output through iframe srcDoc')
  }
  const imagePanel = readPanelPreview('panel_image_evidence_map')
  if (imagePanel.panel.activeTab !== 'image' || imagePanel.preview.kind !== 'image' || !String(imagePanel.preview.url || '').startsWith('data:image/svg+xml,')) {
    throw new Error('expected image Rich Media Panel to render inline SVG imageUrl output')
  }
  const chartPanel = readPanelPreview('panel_chart_guardrails')
  if (chartPanel.preview.kind !== 'iframe' || !String(chartPanel.preview.srcDoc || '').includes('Research agent guardrail chart')) {
    throw new Error('expected chart Rich Media Panel to render outputSrcDoc through shared iframe preview')
  }
  if ((parsed.graphData.edges || []).filter(edge => String(edge.type || '').startsWith('rich_media_')).length !== 3) {
    throw new Error('expected three typed rich-media edges for text, image, and chart outputs')
  }

  const registry = meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  if (!Array.isArray(registry) || registry.length < 13) {
    throw new Error('expected frontmatter parser to build widget registry entries for the typed research demo nodes')
  }
  const registryFormIds = new Set(
    registry
      .map(entry => String((entry as Record<string, unknown>)?.formId || ''))
      .filter(Boolean),
  )
  for (const formId of ['fm:claim_market_need', 'fm:monitoring_spec', 'fm:kgc_apply_owner']) {
    if (!registryFormIds.has(formId)) {
      throw new Error(`expected typed research demo registry to include ${formId}`)
    }
  }

  const runtime = { rankdir: 'LR', scene: null, dirty: false } as unknown as {
    rankdir: 'TB' | 'LR'
    scene: unknown
    dirty: boolean
  }
  buildAndSetFlowNativeScene({
    runtime: runtime as never,
    graphData: parsed.graphData,
    positions: null,
    schema: null,
    forbidCircleNodes: false,
    flowConfig: readFlowConfig({ schema: null, rankdir: 'LR' }),
    sceneGroups: [],
    rankdir: 'LR',
    widgetRegistry: registry as never,
  })
  const scene = runtime.scene as { nodes?: unknown[]; edges?: unknown[] } | null
  if (!scene || !Array.isArray(scene.nodes) || scene.nodes.length !== RESEARCH_AGENT_DEMO_NODE_COUNT) {
    throw new Error(`expected Flow native scene to contain ${RESEARCH_AGENT_DEMO_NODE_COUNT} nodes, got ${scene?.nodes?.length || 0}`)
  }
  if (!Array.isArray(scene.edges) || scene.edges.length !== RESEARCH_AGENT_DEMO_EDGE_COUNT) {
    throw new Error(`expected Flow native scene to contain ${RESEARCH_AGENT_DEMO_EDGE_COUNT} edges, got ${scene.edges?.length || 0}`)
  }
}
