import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'

type StoryboardPayload = {
  sources?: Array<{ sourceUnitId?: string }>
  elements?: Array<{ id?: string; sourceUnitId?: string; order?: number }>
  edges?: Array<{ id?: string; source?: string; target?: string; label?: string }>
  workflow?: {
    fork?: { id?: string; branches?: string[] }
    publish?: { id?: string }
  }
  storytree?: unknown
}

const githubRoot = resolve(process.cwd(), '../..')
const strybldrDemoPath = resolve(githubRoot, 'huijoohwee/docs/knowgrph-strybldr-demo.md')
const legacyVideodbDemoPath = resolve(githubRoot, 'huijoohwee/docs/knowgrph-videodb-demo.md')

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

const demoText = readFileSync(strybldrDemoPath, 'utf8')
const flowEditorParseResult = tryParseMarkdownFrontmatterFlowGraph('knowgrph-strybldr-demo.md', demoText)

assert(!existsSync(legacyVideodbDemoPath), 'legacy knowgrph-videodb-demo.md must remain removed')

for (const requiredText of [
  'videodb_workflow_status: "VideoDB API + MCP workflow integrated into full SenseNova Text, Image, Video to VideoDB E2E pipeline"',
  'sensenova_workflow_status: "SenseNova API Text, Image, Video generation feeds VideoDB upload, index, search, stream, and local publish packet workflow; uncredentialed demo runs generate a local knowgrph animatic"',
  'sensenova_credential_policy: "Server Managed Key uses host SENSENOVA_API_KEY',
  'videodb_credential_policy: "Server Managed Key uses host VIDEODB_API_KEY',
  '2D Renderer: Storyboard',
  '2D Renderer: Storyboard',
  '2D Renderer: Flow Editor',
  'SenseNova API Lane (Text, Image, Video)',
  'VideoDB API + MCP Recreate 77FAnT935IE Lane',
  'Confirm MainPanel Integrations exposes SenseNova API readiness',
  'MainPanel MCP exposes `VideoDB Director MCP`',
  'kgWebpageUrl: "https://www.youtube.com/watch?v=77FAnT935IE"',
  'SenseNova API readiness',
  'VideoDB Director MCP',
  'videodbMcpApiDocs.ts',
  'videodb-recreate-77FAnT935IE-source',
  'Source, Storyboard, Elements, Runtime, Review, and Publish cards',
  'No Prod, Cloudflare, or external publication claim exists until the operator explicitly authorizes it',
]) {
  assert(demoText.includes(requiredText), `Strybldr demo missing VideoDB recreate workflow text: ${requiredText}`)
}

const storyboardMatch = demoText.match(/```json strybldr-storyboard\n([\s\S]*?)\n```/)
assert(storyboardMatch, 'Strybldr demo must include a strybldr-storyboard JSON payload')

const storyboard = JSON.parse(storyboardMatch[1] || '{}') as StoryboardPayload
const sources = storyboard.sources || []
const elements = storyboard.elements || []
const edges = storyboard.edges || []
const workflow = storyboard.workflow
const storytree = storyboard.storytree

assert(sources.length === 5, `expected five SenseNova+VideoDB E2E sources, got ${sources.length}`)
assert(elements.length === 19, `expected nineteen SenseNova+VideoDB E2E element cards, got ${elements.length}`)
assert(edges.length >= 8, `expected explicit Strybldr workflow edges for source/storyboard/elements/fork/publish, got ${edges.length}`)
assert(workflow?.fork?.id === 'workflow-fork-rest-or-mcp', 'storyboard must keep the operator-approved REST/MCP fork metadata')
assert(workflow?.publish?.id === 'workflow-local-publish-packet', 'storyboard must keep the local publish packet metadata')
assert(storytree === undefined, '77FAnT935IE-only demo must not include unrelated storytree payloads')

assert(
  sources.some(source => source.sourceUnitId === 'validation-input-import-url-source'),
  'storyboard must keep the Strybldr import URL source',
)
assert(
  elements.some(element => element.id === 'validation-videodb-review-card'),
  'storyboard must keep the VideoDB review card',
)
assert(
  sources.some(source => source.sourceUnitId === 'sensenova-api-contract'),
  'storyboard must include the SenseNova API PRD/TAD source',
)
assert(
  elements.some(element => element.id === 'sensenova-api-readiness-card' && element.sourceUnitId === 'sensenova-api-contract'),
  'storyboard must include the SenseNova API readiness card',
)
assert(
  sources.some(source => source.sourceUnitId === 'videodb-mcp-contract'),
  'storyboard must include the VideoDB MCP PRD/TAD source',
)
assert(
  elements.some(element => element.id === 'videodb-mcp-readiness-card' && element.sourceUnitId === 'videodb-mcp-contract'),
  'storyboard must include the VideoDB MCP readiness card',
)
assert(
  sources.some(source => source.sourceUnitId === 'videodb-api-reference-contract'),
  'storyboard must include the VideoDB API reference source',
)
assert(
  sources.some(source => source.sourceUnitId === 'videodb-recreate-77FAnT935IE-source'),
  'storyboard must include the VideoDB recreate source',
)
for (const requiredVideodbCard of [
  'videodb-api-reference-readiness-card',
  'videodb-recreate-source-setup-card',
  'videodb-recreate-storyboard-card',
  'videodb-recreate-api-mcp-execution-card',
  'sensenova-media-output-card',
  'workflow-fork-rest-mcp-card',
  'videodb-recreate-review-card',
  'videodb-recreate-publish-card',
]) {
  assert(
    elements.some(element => element.id === requiredVideodbCard),
    `storyboard must include the VideoDB API+MCP recreate card ${requiredVideodbCard}`,
  )
}

for (const requiredEdge of [
  ['validation-input-source-card', 'videodb-recreate-storyboard-card', 'source_to_storyboard'],
  ['videodb-recreate-api-mcp-execution-card', 'workflow-fork-rest-mcp-card', 'operator_fork'],
  ['videodb-recreate-review-card', 'videodb-recreate-publish-card', 'review_to_publish'],
] as const) {
  assert(
    edges.some(edge => edge.source === requiredEdge[0] && edge.target === requiredEdge[1] && edge.label === requiredEdge[2]),
    `storyboard must include workflow edge ${requiredEdge.join(' -> ')}`,
  )
}

assert(
  !/job-upload-|job-index-|job-generation-|stream\.videodb\.io|deployed_api_claim:\s*true|\bzapier\b|\bnotion\b|客家|strytree|storytree|ForkCompare|Frostline|strybldr-demo-image-|strybldr-demo-el-|https:\/\/[^`\s"]*generated[^`\s"]*|signed-jwt-/i.test(demoText),
  'Strybldr demo must not contain fabricated runtime SenseNova/VideoDB values or unrelated non-E2E workflow content',
)

assert(flowEditorParseResult, 'Strybldr demo must parse as frontmatter-flow for 2D Renderer: Flow Editor')
const flowEditorGraph = flowEditorParseResult?.graphData
assert(
  String(flowEditorGraph?.context || '').trim() === 'frontmatter-flow',
  `expected Strybldr demo Flow Editor graph context to be frontmatter-flow, got ${String(flowEditorGraph?.context || '')}`,
)
const flowNodeIds = new Set((flowEditorGraph?.nodes || []).map(node => String(node.id || '').trim()).filter(Boolean))
const flowEdges = flowEditorGraph?.edges || []
for (const requiredNodeId of [
  'strybldr_flow_source',
  'strybldr_flow_storyboard',
  'strybldr_flow_elements',
  'strybldr_flow_sensenova',
  'strybldr_flow_fork',
  'strybldr_flow_rest',
  'strybldr_flow_mcp',
  'strybldr_flow_review',
  'strybldr_flow_rich_media_panel',
  'strybldr_flow_publish',
]) {
  assert(flowNodeIds.has(requiredNodeId), `Strybldr Flow Editor graph missing node ${requiredNodeId}`)
}
const richMediaPanelNode = (flowEditorGraph?.nodes || []).find(node => String(node.id || '') === 'strybldr_flow_rich_media_panel') || null
assert(
  String(richMediaPanelNode?.type || '') === 'RichMediaPanel',
  `expected Strybldr Flow Editor rich media node type RichMediaPanel, got ${String(richMediaPanelNode?.type || '')}`,
)
const richMediaPanelProps = (richMediaPanelNode?.properties || {}) as Record<string, unknown>
assert(
  String(richMediaPanelProps['flow:widgetFormId'] || '') === 'richMediaPanel',
  'expected Strybldr Flow Editor rich media node to use shared richMediaPanel widget form',
)
assert(
  String(richMediaPanelProps.outputSrcDoc || '').includes('data-kg-strybldr-rich-media-panel'),
  'expected Strybldr Flow Editor rich media node to carry source-backed outputSrcDoc content',
)
for (const requiredEdge of [
  ['strybldr_flow_fork', 'strybldr_flow_rest', 'fork_to_rest'],
  ['strybldr_flow_fork', 'strybldr_flow_mcp', 'fork_to_mcp'],
  ['strybldr_flow_review', 'strybldr_flow_rich_media_panel', 'review_html_to_rich_media'],
  ['strybldr_flow_review', 'strybldr_flow_rich_media_panel', 'review_image_to_rich_media'],
  ['strybldr_flow_review', 'strybldr_flow_publish', 'review_to_publish'],
] as const) {
  assert(
    flowEdges.some(edge => (
      String(edge.source || '') === requiredEdge[0]
      && String(edge.target || '') === requiredEdge[1]
      && String(edge.label || '') === requiredEdge[2]
    )),
    `Strybldr Flow Editor graph missing edge ${requiredEdge.join(' -> ')}`,
  )
}
