import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  buildKnowgrphVdeoxplnAgentSkillDefinitions,
  buildKnowgrphVdeoxplnMarkdown,
  buildKnowgrphVdeoxplnRegistry,
  buildKnowgrphVdeoxplnRoutingPlan,
  buildKnowgrphVdeoxplnRunManifestMarkdown,
  KNOWGRPH_VDEOXPLN_IDS,
  validateKnowgrphVdeoxplnRegistry,
} from '../canvas/src/features/agent-ready/knowgrphVdeoxplnContract.mjs'
import {
  buildKnowgrphLocalMcpToolDefinitions,
  KNOWGRPH_LOCAL_MCP_TOOL_NAMES,
} from '../mcp/local-tool-contract.js'

const repoRoot = process.cwd()
const registry = buildKnowgrphVdeoxplnRegistry()
const validation = validateKnowgrphVdeoxplnRegistry(registry)
const errors = [...validation.errors]

const fail = (message) => errors.push(message)

for (const vdeoxpln of registry) {
  for (const owner of vdeoxpln.owners) {
    const ownerPath = path.resolve(repoRoot, owner)
    if (!existsSync(ownerPath)) fail(`${vdeoxpln.id}: owner does not exist: ${owner}`)
  }
  const markdown = buildKnowgrphVdeoxplnMarkdown(vdeoxpln)
  if (!markdown.includes(`Vdeoxpln id: \`${vdeoxpln.id}\``)) {
    fail(`${vdeoxpln.id}: generated markdown missing canonical id`)
  }
  if (!markdown.includes(`Semantic key: \`${vdeoxpln.semanticKey}\``)) {
    fail(`${vdeoxpln.id}: generated markdown missing semantic key`)
  }
  if (/PaperMotion source|examples\/<demo>|legacy remap/i.test(markdown)) {
    fail(`${vdeoxpln.id}: generated markdown includes forbidden copied/stale wording`)
  }
  if (/compatibility alias/i.test(markdown) && !markdown.includes('Do not add compatibility aliases')) {
    fail(`${vdeoxpln.id}: generated markdown mentions compatibility aliases outside the guardrail`)
  }
  const graphMaterialization = String(vdeoxpln.artifactPolicy?.graphMaterialization || 'none')
  if (graphMaterialization !== 'none' && graphMaterialization !== 'tool-owned') {
    const ownerText = vdeoxpln.owners.join('\n')
    if (!ownerText.includes('workspace') && !ownerText.includes('source-files')) {
      fail(`${vdeoxpln.id}: graph-producing vdeoxpln must include workspace or Source Files owner`)
    }
    if (!ownerText.includes('semanticKey')) {
      fail(`${vdeoxpln.id}: graph-producing vdeoxpln must include shared semantic-key owner`)
    }
  }
}

const definitions = buildKnowgrphVdeoxplnAgentSkillDefinitions(registry)
if (definitions.length !== registry.length) {
  fail(`agent skill definitions length ${definitions.length} does not match registry length ${registry.length}`)
}
for (const definition of definitions) {
  if (definition.name !== definition.vdeoxpln.id) {
    fail(`${definition.name}: agent skill name must equal canonical vdeoxpln id`)
  }
  if (!definition.path.endsWith(`/${definition.name}.md`)) {
    fail(`${definition.name}: agent skill path must be canonical, got ${definition.path}`)
  }
}

const localToolNames = buildKnowgrphLocalMcpToolDefinitions().map((tool) => tool.name)
if (!localToolNames.includes(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList)) {
  fail('local MCP tool contract must expose knowgrph.vdeoxpln.list')
}

const routeOnlyPlan = buildKnowgrphVdeoxplnRoutingPlan({
  routePath: '/knowgrph/.well-known/agent-skills/knowgrph-chat-to-canvas.md',
  filePath: 'demo.md',
})
if (routeOnlyPlan.status !== 'declined') {
  fail(`route-only vdeoxpln routing must decline, got ${routeOnlyPlan.status}`)
}

const chatPlan = buildKnowgrphVdeoxplnRoutingPlan({
  intentText: 'Generate a graph from source evidence and apply validated KGC markdown to the canvas.',
  chatStorageTarget: 'chatKnowgrph',
  contentTypes: ['workspace document markdown', 'source evidence'],
  requestedOutputs: ['validated KGC Markdown', 'workspace artifact', 'GraphData', 'canvas topology snapshot'],
  stateSignals: ['FloatingPanel Chat', 'KGC validation', 'Source Files', 'Canvas apply'],
  sourceFileCount: 1,
  hasGraphData: true,
  hasWorkspaceDocument: true,
})
if (chatPlan.status !== 'selected' || chatPlan.selectedVdeoxplnId !== KNOWGRPH_VDEOXPLN_IDS.chatToCanvas) {
  fail(`chat-to-canvas neutral routing expected ${KNOWGRPH_VDEOXPLN_IDS.chatToCanvas}, got ${chatPlan.selectedVdeoxplnId || chatPlan.status}`)
}
const manifest = buildKnowgrphVdeoxplnRunManifestMarkdown(chatPlan, {
  status: 'ok',
  workspacePath: '/chat/20260530T010203Z/kgc_20260530T010203Z.md',
  timestamp: '2026-05-30T01:02:03.000Z',
  canvasApplied: true,
})
if (!manifest.includes('schema: "knowgrph-vdeoxpln-run/v1"') || !manifest.includes(chatPlan.semanticRunKey)) {
  fail('vdeoxpln run manifest must include schema and semantic run key')
}

if (errors.length > 0) {
  console.error('[knowgrph] vdeoxpln check failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(`[knowgrph] vdeoxpln check passed: ${registry.length}/${registry.length} vdeoxpln entries`)
