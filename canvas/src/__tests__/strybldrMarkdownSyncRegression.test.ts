import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { buildStoryboardBoardModel, buildStoryboardInlineMediaCommandContext } from '@/components/StoryboardCanvas/storyboardModel'
import { collectInlineMediaCommandCandidates } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { syncActiveMarkdownDocumentTextFromParsedGraph } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import {
  appendStrybldrStoryboardMarkdownElement,
  applyStrybldrImageArtifactToGraphData,
  buildStrybldrGraphData,
  buildStrybldrStoryboardDocument,
  buildStrybldrWorkflowGanttCode,
  buildStrybldrImageHandoffMarkdown,
  buildStrybldrLocalImageDataUri,
  buildStrybldrVideoHandoffFromGraphData,
  buildStrybldrVideoHandoffMarkdown,
  applyStrybldrVideoArtifactToGraphData,
  clearStrybldrVideoArtifactMarkdownOverrides,
  isStrybldrImageGenerationIntent,
  mergeStrybldrElementsIntoGraphData,
  parseStrybldrStoryboardMarkdown,
  readStrybldrWorkflowGanttCodesFromMarkdown,
  removeStrybldrStoryboardMarkdownElement,
  resolveStrybldrVideoArtifactTargetNodeId,
  serializeStrybldrStoryboardMarkdown,
  syncStrybldrStoryboardMarkdownWorkflowEdges,
  updateStrybldrStoryboardMarkdownCardOverride,
} from '@/features/strybldr/strybldrStoryboard'
import { createStrybldrLocalVideoArtifactFromGraphData } from '@/features/strybldr/strybldrVideoHandoffArtifact'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { STRYBLDR_CAMERA_PROPERTY_KEY, readStrybldrCameraSettings, resolveStrybldrCameraOrbit, serializeStrybldrCameraSettings } from '@/features/strybldr/strybldrCamera'
import {
  resolveCameraOrbitFrameRay,
  resolveCameraOrbitSphereGridMeridianGeometry,
  resolveCameraOrbitSpherePointFromGridPoint,
  type CameraOrbitSphereConfig,
} from '@/lib/camera/orbitSphere'
import {
  createStrytreeCandidateRunAction,
  createStrytreeContinuationDraftAction,
  publishStrytreeCandidateAction,
  toggleStrytreeLikeAction,
  unlockStrytreeNodeAction,
} from '@/features/strybldr/strytreeWorkflow'
import { getCanvas2dSurfaceId, isStoryboardCanvas2dRenderer, resolveCanvas2dRendererId, supportsToolbarRunAll } from '@/lib/config.render'
import { parseWorkspaceStrybldrStoryboardGraphDataCached } from '@/hooks/active-graph-data/workspaceStructuredGraph'
import {
  FLOW_STORYBOARD_ELEMENT_FORM_ID,
  FLOW_STORYBOARD_ELEMENT_NODE_TYPE_ID,
  FLOW_STORYBOARD_ELEMENT_WIDGET_TYPE_ID,
} from '@/lib/config.storyboard-widget'
import { extractYamlFrontmatterHeaderBlock, readYamlFrontmatterValue } from '@/lib/markdown/frontmatter'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { readYamlFrontmatterMermaidDiagramCodes } from '@/lib/mermaid/mermaidDiagramCode'
import { RICH_MEDIA_PANEL_DEFAULT_HEIGHT_PX, RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX } from '@/lib/render/richMediaPanelDefaults'
import { resolveGraphNodeIdForGanttTaskSpan } from '@/features/gitgraph/ganttGraphNodeSelection'
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const readTypedValue = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || !('value' in value)) return value
  return (value as Record<string, unknown>).value
}

const readSource = (...parts: string[]): string => fs.readFileSync(path.resolve(process.cwd(), 'src', ...parts), 'utf8')
const STRYBLDR_STARTER_TEMPLATE_NAME = ['knowgrph-strybldr', 'starter-template.md'].join('-')
const STRYBLDR_STARTER_TEMPLATE_REFERENCE = ['docs', STRYBLDR_STARTER_TEMPLATE_NAME].join('/')

const resolveStrybldrStarterTemplatePath = (): string => {
  const externalValidationInput = String(process.env.KG_TEST_VALIDATION_FORBID_HARDCODE_IN_REPO || '').trim()
  if (externalValidationInput && path.basename(externalValidationInput) === STRYBLDR_STARTER_TEMPLATE_NAME) return externalValidationInput
  return path.resolve(process.cwd(), '../..', 'huijoohwee', 'docs', STRYBLDR_STARTER_TEMPLATE_NAME)
}

const readStrybldrStarterTemplateText = (): string => fs.readFileSync(resolveStrybldrStarterTemplatePath(), 'utf8')

const assertStrybldrStarterTemplateHasNoRepoHardcodedRuntimeMedia = (text: string): void => {
  const forbiddenRuntimeMediaPatterns: Array<[RegExp, string]> = [
    [/\bkg_media_token=/i, 'local media access tokens'],
    [/\blocalhost:\d+\/api\/storage\/media\//i, 'localhost storage media URLs'],
    [/\/api\/storage\/media\/[^ \n"'`]+\/runs\/upload-[^ \n"'`]+/i, 'persisted upload storage URLs'],
    [/\bupload-[a-z0-9]{8,}/i, 'source-specific upload ids'],
  ]
  for (const [pattern, label] of forbiddenRuntimeMediaPatterns) {
    assert(!pattern.test(text), `expected starter template not to store ${label}`)
  }
}

const readStrybldrDemoText = (): string => {
  const demoPath = path.resolve(process.cwd(), '../..', 'huijoohwee/docs/knowgrph-strybldr-demo.md')
  return fs.readFileSync(demoPath, 'utf8')
}

const readStrybldrDemoFrontmatterValue = (text: string, key: string): string => {
  const block = extractYamlFrontmatterHeaderBlock(text)
  return block ? readYamlFrontmatterValue(block.rawBlock, key).trim() : ''
}

const readStrybldrDemoVideoId = (text: string): string => {
  return readStrybldrDemoFrontmatterValue(text, 'kgYoutubeVideoId')
}

const readStrybldrDemoWatchUrl = (text: string): string => {
  return readStrybldrDemoFrontmatterValue(text, 'kgWebpageUrl')
}

export function testStrybldrStarterWorkflowGanttStaysSynchronizedWithStoryboardCards() {
  const text = readStrybldrStarterTemplateText()
  const parsedDoc = parseStrybldrStoryboardMarkdown(text)
  assert(parsedDoc, 'expected starter template to expose a structured Strybldr storyboard payload')
  const derivedCodes = readStrybldrWorkflowGanttCodesFromMarkdown(text)
  assert(derivedCodes.length === 1, `expected one Strybldr-derived workflow Gantt, got ${derivedCodes.length}`)
  assert(derivedCodes[0] === buildStrybldrWorkflowGanttCode(parsedDoc), 'expected markdown reader to derive workflow Gantt from the parsed Strybldr payload')
  const derivedModel = buildMermaidGanttTimelineModel(derivedCodes[0])
  const expectedLabels = parsedDoc.elements
    .slice()
    .sort((a, b) => {
      const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER
      const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) return orderA - orderB
      return String(a.label || '').localeCompare(String(b.label || ''))
    })
    .map(element => String(element.label || '').trim())
    .filter(Boolean)
  const derivedLabels = derivedModel.taskSpans.map(span => span.label)
  assert(
    derivedLabels.join('|') === expectedLabels.join('|'),
    `expected derived workflow Gantt rows to match Storyboard cards, got ${JSON.stringify({ derivedLabels, expectedLabels })}`,
  )
  assert(derivedLabels.length === 10, `expected starter workflow Gantt to expose 10 storyboard card rows, got ${derivedLabels.length}`)
  assert(
    derivedModel.taskSpans.every(span => /strybldr_/.test(span.raw) && Math.abs(span.durationMinutes - 0.167) < 0.0001),
    `expected derived workflow Gantt rows to reuse compact shared workflow timing, got ${JSON.stringify(derivedModel.taskSpans)}`,
  )
  const graph = buildStrybldrGraphData(parsedDoc)
  const generationSpan = derivedModel.taskSpans.find(span => span.label === 'Video-agent generation')
  assert(generationSpan, 'expected derived workflow Gantt to include Video-agent generation')
  assert(
    resolveGraphNodeIdForGanttTaskSpan({ graphData: graph, span: generationSpan }) === 'video-agent-generation-card',
    'expected derived workflow Gantt task id to resolve to the matching storyboard card for canvas focus',
  )
  assert(readYamlFrontmatterMermaidDiagramCodes(text, 'gantt').length === 0, 'expected starter template not to keep a duplicate authored mermaid_gantt workflow block')
  assert(!text.includes('video_agent_workflow:'), 'expected starter template to remove the stale static video_agent_workflow diagram')
  assert(text.includes('timelinePolicy: "Gantt-Timeline rows derive from strybldr_storyboard.elements'), 'expected starter template to declare Strybldr-owned Gantt derivation policy')
}

export async function testStrybldrStoryboardSummaryEditSyncPersistsCardOverride() {
  const text = readStrybldrStarterTemplateText()
  const parsed = await loadGraphDataFromTextViaParser(STRYBLDR_STARTER_TEMPLATE_NAME, text, {
    applyToStore: false,
    syncMarkdownDocument: false,
  })
  assert(parsed?.graphData, 'expected starter template graph before summary edit sync')
  const graph = parsed.graphData
  const previousNode = (graph.nodes || []).find(node => String(node.id || '') === 'strybldr:source:3725310941') as GraphNode | undefined
  assert(previousNode, 'expected starter source card node before summary edit sync')
  const nextTitle = 'Edited Strybldr Source'
  const nextSummary = 'Edited /source.ingest summary survives Strybldr reindex.'
  const nextAction = 'Review edited source evidence.'
  const nextPrompt = 'Use the edited source summary as the reference.'
  const nextOrder = 7
  const nextNode: GraphNode = {
    ...previousNode,
    label: nextTitle,
    properties: {
      ...(previousNode.properties || {}),
      title: nextTitle,
      summary: nextSummary,
      action: nextAction,
      prompt: nextPrompt,
      order: nextOrder,
    },
  }
  const nextGraphData: GraphData = {
    ...graph,
    nodes: (graph.nodes || []).map(node => String(node.id || '') === String(nextNode.id || '') ? nextNode : node),
  }
  const sourceFiles = [{
    id: 'strybldr-starter-template',
    enabled: true,
    name: STRYBLDR_STARTER_TEMPLATE_NAME,
    text,
    source: { path: STRYBLDR_STARTER_TEMPLATE_REFERENCE },
    parsedGraphData: graph,
  }] as never
  const textSync = syncActiveMarkdownDocumentTextFromParsedGraph({
    state: {
      markdownDocumentName: STRYBLDR_STARTER_TEMPLATE_REFERENCE,
      markdownDocumentText: text,
    } as never,
    sourceFiles,
    parsedGraphData: nextGraphData,
    previousNode,
    nextNode,
  })
  const nextText = String(textSync.markdownDocumentText || '')
  assert(nextText && nextText !== text, 'expected card edit sync to write a Strybldr card override into markdown text')
  assert(
    textSync.sourceFiles[0]?.text === nextText,
    'expected active source file text to receive the same card override markdown',
  )
  const reparsedDoc = parseStrybldrStoryboardMarkdown(nextText)
  const sourceCardOverride = (reparsedDoc?.cards || []).find(card => card.nodeId === 'strybldr:source:3725310941') || null
  assert(sourceCardOverride?.title === nextTitle, `expected source card title override to persist, got ${JSON.stringify(sourceCardOverride)}`)
  assert(sourceCardOverride?.summary === nextSummary, `expected source card summary override to persist, got ${JSON.stringify(sourceCardOverride)}`)
  assert(sourceCardOverride?.action === nextAction, `expected source card action override to persist, got ${JSON.stringify(sourceCardOverride)}`)
  assert(sourceCardOverride?.prompt === nextPrompt, `expected source card prompt override to persist, got ${JSON.stringify(sourceCardOverride)}`)
  assert(sourceCardOverride?.order === nextOrder, `expected source card order override to persist, got ${JSON.stringify(sourceCardOverride)}`)
  const reparsed = await loadGraphDataFromTextViaParser(STRYBLDR_STARTER_TEMPLATE_NAME, nextText, {
    applyToStore: false,
    syncMarkdownDocument: false,
  })
  const reparsedSourceNode = (reparsed.graphData.nodes || []).find(node => String(node.id || '') === 'strybldr:source:3725310941') || null
  assert(reparsedSourceNode?.label === nextTitle, `expected reindex to keep edited source title, got ${String(reparsedSourceNode?.label || '')}`)
  assert(reparsedSourceNode?.properties?.summary === nextSummary, `expected reindex to keep edited source summary, got ${String(reparsedSourceNode?.properties?.summary || '')}`)
  assert(reparsedSourceNode?.properties?.action === nextAction, `expected reindex to keep edited source action, got ${String(reparsedSourceNode?.properties?.action || '')}`)
  assert(reparsedSourceNode?.properties?.prompt === nextPrompt, `expected reindex to keep edited source prompt, got ${String(reparsedSourceNode?.properties?.prompt || '')}`)
  assert(reparsedSourceNode?.properties?.order === nextOrder, `expected reindex to keep edited source order, got ${String(reparsedSourceNode?.properties?.order || '')}`)
}

export function testStrybldrWorkflowEdgeSyncPersistsAuthoredStoryboardConnections() {
  const baseText = readStrybldrStarterTemplateText()
  const parsed = parseStrybldrStoryboardMarkdown(baseText)
  assert(parsed, 'expected starter template to parse before workflow-edge sync')
  const nextText = syncStrybldrStoryboardMarkdownWorkflowEdges({
    text: baseText,
    graphData: {
      context: 'strybldr-storyboard',
      type: 'Graph',
      nodes: [],
      edges: [
        {
          id: 'starter-edge-1',
          source: 'starter-source-brief-card',
          target: 'starter-storyboard-beats-card',
          label: 'linksTo', properties: {},
        },
        {
          id: 'ignore-structural-edge',
          source: 'strybldr:frame:3595615238',
          target: 'starter-source-brief-card',
          label: 'containsElement', properties: {},
        },
      ],
    },
  })
  assert(nextText && nextText !== baseText, 'expected storyboard workflow-edge sync to persist authored edges into the structured payload')
  const reparsed = parseStrybldrStoryboardMarkdown(String(nextText || ''))
  assert(reparsed, 'expected synced storyboard markdown to remain parseable')
  assert((reparsed?.edges || []).length === 1, `expected only authored element-to-element edges to persist, got ${JSON.stringify(reparsed?.edges || [])}`)
  const authoredEdge = reparsed?.edges?.[0] || null
  assert(authoredEdge?.id === 'starter-edge-1', `expected authored edge id to persist, got ${JSON.stringify(authoredEdge)}`)
  assert(authoredEdge?.source === 'starter-source-brief-card' && authoredEdge?.target === 'starter-storyboard-beats-card', `expected authored storyboard edge endpoints to persist, got ${JSON.stringify(authoredEdge)}`)
  assert(authoredEdge?.label === 'linksTo', `expected authored storyboard edge label to persist, got ${JSON.stringify(authoredEdge)}`)
}
