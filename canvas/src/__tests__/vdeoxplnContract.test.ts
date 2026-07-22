import fs from 'node:fs'
import path from 'node:path'
import {
  buildKnowgrphVdeoxplnAgentSkillDefinitions,
  buildKnowgrphVdeoxplnChatSystemPrompt,
  buildKnowgrphVdeoxplnMarkdown,
  buildKnowgrphVdeoxplnRegistry,
  buildKnowgrphVdeoxplnRoutingPlan,
  KNOWGRPH_VDEOXPLN_IDS,
  validateKnowgrphVdeoxplnRegistry,
} from '@/features/agent-ready/knowgrphVdeoxplnContract.mjs'
import {
  buildAgentReadyOpenApiPaths,
} from '../../../cloudflare/pages/knowgrph-agent-ready-discovery.mjs'
import {
  buildAgentReadyStaticFiles,
  onRequest,
} from '../../../cloudflare/pages/knowgrph-agent-ready.mjs'
import {
  KNOWGRPH_VDEOXPLN_DOC_ENTRIES,
} from '@/features/panels/views/vdeoxplnMcpApiDocs'
import {
  buildKnowgrphLocalMcpToolDefinitions,
  KNOWGRPH_LOCAL_MCP_TOOL_NAMES,
} from '../../../mcp/local-tool-contract.js'

const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function testKnowgrphVdeoxplnRegistryProjectsToAgentSkillsMainPanelAndMcp() {
  const repoRoot = path.resolve(process.cwd(), '..')
  const contractText = fs.readFileSync(path.resolve(process.cwd(), 'src', 'features', 'agent-ready', 'knowgrphVdeoxplnContract.mjs'), 'utf8')
  if (contractText.includes('from "grph-shared/hash/signature"')) {
    throw new Error('expected Pages-bundled vdeoxpln contract to avoid package-only hash helper imports')
  }
  if (!contractText.includes('from "../../../../grph-shared/dist/hash/signature.js"')) {
    throw new Error('expected vdeoxpln semantic keys to use the synced shared hash runtime')
  }
  const syncScriptText = fs.readFileSync(path.resolve(repoRoot, 'scripts', 'sync-pages-knowgrph.mjs'), 'utf8')
  if (!syncScriptText.includes("'dist/hash/signature.js'")) {
    throw new Error('expected Pages sync to publish the shared hash signature runtime')
  }
  const registry = buildKnowgrphVdeoxplnRegistry()
  const validation = validateKnowgrphVdeoxplnRegistry(registry)
  if (!validation.ok) {
    throw new Error(`expected vdeoxpln registry to validate, got ${JSON.stringify(validation.errors)}`)
  }
  const localMcp = registry.find(vdeoxpln => vdeoxpln.id === KNOWGRPH_VDEOXPLN_IDS.localMcp)
  for (const token of ['/implementation.run', '#managed-implementation-run', '@work-item', '@implementation-run']) {
    if (!localMcp?.triggers.includes(token)) throw new Error(`expected local MCP vdeoxpln triggers to include ${token}`)
  }

  const ids = registry.map(vdeoxpln => vdeoxpln.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error(`expected unique vdeoxpln ids, got ${JSON.stringify(ids)}`)
  }
  if (JSON.stringify(ids) !== JSON.stringify([...ids].sort((left, right) => left.localeCompare(right)))) {
    throw new Error(`expected stable sorted vdeoxpln ids, got ${JSON.stringify(ids)}`)
  }

  for (const vdeoxpln of registry) {
    if (!String(vdeoxpln.semanticKey || '').startsWith('kgvx_')) {
      throw new Error(`expected ${vdeoxpln.id} to expose a kgvx semantic key, got ${vdeoxpln.semanticKey}`)
    }
    for (const owner of vdeoxpln.owners) {
      const ownerPath = path.resolve(repoRoot, owner)
      if (!fs.existsSync(ownerPath)) {
        throw new Error(`expected ${vdeoxpln.id} owner to exist: ${owner}`)
      }
    }
    if (Array.isArray((vdeoxpln as { aliases?: unknown[] }).aliases) && (vdeoxpln as { aliases?: unknown[] }).aliases?.length) {
      throw new Error(`expected ${vdeoxpln.id} to avoid compatibility aliases`)
    }
  }

  const definitions = buildKnowgrphVdeoxplnAgentSkillDefinitions(registry)
  const staticFiles = await buildAgentReadyStaticFiles()
  const expectedMarkdownStaticPaths = definitions
    .map(definition => definition.path.replace(/^\/+/, ''))
    .sort((left, right) => left.localeCompare(right))
  const actualMarkdownStaticPaths = Object.keys(staticFiles)
    .filter(key => key.startsWith('.well-known/agent-skills/') && key.endsWith('.md'))
    .sort((left, right) => left.localeCompare(right))
  if (JSON.stringify(actualMarkdownStaticPaths) !== JSON.stringify(expectedMarkdownStaticPaths)) {
    throw new Error(`expected generated agent skill markdown paths to match registry paths, got ${JSON.stringify(actualMarkdownStaticPaths)}`)
  }
  const indexBody = staticFiles['.well-known/agent-skills/index.json']?.body
  if (!indexBody) {
    throw new Error('expected generated agent-skills index static file')
  }
  const index = JSON.parse(indexBody) as {
    skills?: Array<{
      name?: string
      url?: string
      sha256?: string
      vdeoxpln?: { id?: string; semanticKey?: string }
    }>
  }
  if (!Array.isArray(index.skills) || index.skills.length !== registry.length) {
    throw new Error(`expected one generated agent skill per vdeoxpln, got ${JSON.stringify(index.skills)}`)
  }

  const openApiPaths = buildAgentReadyOpenApiPaths({
    appBasePath: '/knowgrph',
    appA2aAgentCardPath: '/knowgrph/.well-known/agent-card.json',
    healthPath: '/knowgrph/health',
  })
  const docEntriesById = new Map(
    KNOWGRPH_VDEOXPLN_DOC_ENTRIES.map(entry => [entry.meta.key.replace(/^vdeoxpln\./, ''), entry]),
  )

  for (const definition of definitions) {
    const vdeoxpln = registry.find(candidate => candidate.id === definition.name)
    if (!vdeoxpln) {
      throw new Error(`expected definition ${definition.name} to map back to the registry`)
    }
    const staticPath = definition.path.replace(/^\/+/, '')
    const staticMarkdown = staticFiles[staticPath]?.body
    const expectedMarkdown = buildKnowgrphVdeoxplnMarkdown(vdeoxpln)
    if (staticMarkdown !== expectedMarkdown) {
      throw new Error(`expected static markdown for ${vdeoxpln.id} to be generated from the registry`)
    }
    const indexSkill = index.skills.find(skill => skill.name === vdeoxpln.id)
    if (!indexSkill) {
      throw new Error(`expected agent-skills index to include ${vdeoxpln.id}`)
    }
    if (
      indexSkill.url !== `https://airvio.co/knowgrph${definition.path}`
      || indexSkill.vdeoxpln?.id !== vdeoxpln.id
      || indexSkill.vdeoxpln?.semanticKey !== vdeoxpln.semanticKey
      || indexSkill.sha256 !== await sha256Hex(expectedMarkdown)
    ) {
      throw new Error(`expected agent-skills index entry to match ${vdeoxpln.id}, got ${JSON.stringify(indexSkill)}`)
    }
    if (!openApiPaths[`/knowgrph${definition.path}`]?.get) {
      throw new Error(`expected OpenAPI to expose ${definition.path}`)
    }

    const response = await onRequest({
      request: new Request(`https://airvio.co/knowgrph${definition.path}`, {
        method: 'GET',
        headers: { accept: 'text/markdown' },
      }),
      env: {},
      next: async () => new Response('unexpected next()'),
    } as never)
    const routedMarkdown = await response.text()
    if (!response.ok || routedMarkdown !== expectedMarkdown) {
      throw new Error(`expected route markdown for ${vdeoxpln.id} to match the registry, got ${response.status}`)
    }

    const docEntry = docEntriesById.get(vdeoxpln.id)
    if (!docEntry) {
      throw new Error(`expected MainPanel MCP docs to include ${vdeoxpln.id}`)
    }
    if (
      !String(docEntry.meta.read()).includes(`semanticKey=${vdeoxpln.semanticKey}`)
      || JSON.stringify(docEntry.details.modules) !== JSON.stringify(vdeoxpln.owners)
    ) {
      throw new Error(`expected MainPanel MCP doc entry to mirror ${vdeoxpln.id}`)
    }
  }

  const localToolNames = buildKnowgrphLocalMcpToolDefinitions().map(tool => tool.name)
  if (!localToolNames.includes(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList)) {
    throw new Error('expected local MCP to expose knowgrph.vdeoxpln.list')
  }
}

export function testKnowgrphVdeoxplnRoutingKeepsCanonicalKgcClean() {
  const routeOnlyPlan = buildKnowgrphVdeoxplnRoutingPlan({
    routePath: '/knowgrph/.well-known/agent-skills/knowgrph-chat-to-canvas.md',
    filePath: 'docs/demo.md',
  })
  if (routeOnlyPlan.status !== 'declined' || !String(routeOnlyPlan.reason || '').includes('ignored')) {
    throw new Error(`expected route-only skill routing to decline, got ${JSON.stringify(routeOnlyPlan)}`)
  }

  const chatPlan = buildKnowgrphVdeoxplnRoutingPlan({
    intentText: 'Generate a graph from the selected source evidence and apply the validated KGC markdown to the canvas.',
    chatStorageTarget: 'chatKnowgrph',
    contentTypes: ['workspace document markdown', 'source evidence'],
    requestedOutputs: ['validated KGC Markdown', 'workspace artifact', 'GraphData', 'canvas topology snapshot'],
    stateSignals: ['source files', 'FloatingPanel Chat', 'KGC validation', 'Canvas apply'],
    sourceFileCount: 2,
    hasGraphData: true,
    hasSelection: true,
    hasWorkspaceDocument: true,
  })
  if (chatPlan.status !== 'selected' || chatPlan.selectedVdeoxplnId !== KNOWGRPH_VDEOXPLN_IDS.chatToCanvas) {
    throw new Error(`expected chat-to-canvas routing plan, got ${JSON.stringify(chatPlan)}`)
  }
  if (!String(chatPlan.semanticRunKey || '').startsWith('kgvx_')) {
    throw new Error(`expected chat-to-canvas plan to expose semantic run key, got ${chatPlan.semanticRunKey}`)
  }
  const stageIds = new Set((chatPlan.executionStages || []).map((stage: { id?: string }) => stage.id))
  for (const required of ['source-backed-artifact', 'source-files', 'floating-panel-chat', 'kgc-validation', 'canvas-apply']) {
    if (!stageIds.has(required)) throw new Error(`expected chat-to-canvas plan to include ${required}`)
  }
  const prompt = buildKnowgrphVdeoxplnChatSystemPrompt(chatPlan)
  if (
    !prompt.includes('FloatingPanel Chat harness')
    || !prompt.includes('Do not infer vdeoxpln selection from route names')
    || !prompt.includes(chatPlan.semanticRunKey)
  ) {
    throw new Error(`expected chat system prompt to carry routing guardrails, got ${prompt}`)
  }

  const requestOwner = fs.readFileSync(path.resolve(process.cwd(), 'src/features/chat/floatingPanelChat/floatingPanelChatSubmitRequest.ts'), 'utf8')
  if (!requestOwner.includes('buildKnowgrphVdeoxplnRoutingPlan') || !requestOwner.includes('buildKnowgrphVdeoxplnChatSystemPrompt')) {
    throw new Error('expected FloatingPanel Chat request owner to inject the selected vdeoxpln contract prompt')
  }
  const finalizeOwner = fs.readFileSync(path.resolve(process.cwd(), 'src/features/chat/floatingPanelChat/useFinalizeAssistantSuccess.ts'), 'utf8')
  if (finalizeOwner.includes('RunManifest') || finalizeOwner.includes('knowgrphVdeoxplnChatArtifacts')) {
    throw new Error('expected FloatingPanel Chat finalization to keep canonical KGC files free of auxiliary run manifests')
  }
  const artifactOwnerPath = path.resolve(process.cwd(), 'src/features/chat/knowgrphVdeoxplnChatArtifacts.ts')
  if (fs.existsSync(artifactOwnerPath)) {
    throw new Error('expected obsolete vdeoxpln chat artifact helper to be removed')
  }
  const contractOwner = fs.readFileSync(path.resolve(process.cwd(), 'src/features/agent-ready/knowgrphVdeoxplnContract.mjs'), 'utf8')
  for (const stale of ['knowgrphVdeoxplnChatArtifacts', 'buildKnowgrphVdeoxplnRunManifestMarkdown', 'knowgrph-vdeoxpln-run/v1']) {
    if (contractOwner.includes(stale)) throw new Error(`expected vdeoxpln contract to avoid stale canonical manifest owner ${stale}`)
  }
}
