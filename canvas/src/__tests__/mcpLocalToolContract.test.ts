import path from 'node:path'
import { pathToFileURL } from 'node:url'

type LocalToolContractModule = {
  KNOWGRPH_LOCAL_MCP_TOOL_NAMES: Record<string, string>
  buildKnowgrphLocalMcpToolDefinitions: (args?: {
    defaultUiHost?: string
    defaultUiPort?: number
  }) => Array<{
    name: string
    description: string
    _meta?: {
      securitySchemes?: Array<{ type?: string }>
      ui?: {
        resourceUri?: string
      }
      'openai/widgetAccessible'?: boolean
    }
    outputSchema?: {
      type?: string
      required?: string[]
    }
    securitySchemes?: Array<{ type?: string }>
    annotations?: {
      readOnlyHint?: boolean
      destructiveHint?: boolean
      openWorldHint?: boolean
      idempotentHint?: boolean
    }
    inputSchema: {
      additionalProperties?: boolean
      properties?: Record<string, { description?: string }>
    }
  }>
}

const assertAnnotations = (
  tool: { name?: string, annotations?: { readOnlyHint?: boolean, destructiveHint?: boolean, openWorldHint?: boolean, idempotentHint?: boolean } },
  expected: { readOnlyHint: boolean, destructiveHint: boolean, openWorldHint: boolean, idempotentHint: boolean },
) => {
  if (
    tool.annotations?.readOnlyHint !== expected.readOnlyHint
    || tool.annotations?.destructiveHint !== expected.destructiveHint
    || tool.annotations?.openWorldHint !== expected.openWorldHint
    || tool.annotations?.idempotentHint !== expected.idempotentHint
  ) {
    throw new Error(`expected complete MCP annotations for ${tool.name}, got ${JSON.stringify(tool.annotations)}`)
  }
}

type PromptContractModule = {
  KNOWGRPH_AGENT_READY_PROMPT_NAMES: Record<string, string>
  buildKnowgrphAgentReadyPromptContracts: () => Array<{
    name: string
    description?: string
    arguments?: Array<{ name?: string, required?: boolean }>
  }>
  getKnowgrphAgentReadyPrompt: (name: string, args?: Record<string, string>) => {
    description?: string
    messages?: Array<{
      role?: string
      content?: {
        type?: string
        text?: string
      }
    }>
  }
}

type ResourceContractModule = {
  KNOWGRPH_SOURCE_FILE_RESOURCE_MIME_TYPE: string
  KNOWGRPH_SOURCE_FILE_RESOURCE_URI_TEMPLATE: string
  buildKnowgrphAgentReadyResourceTemplateContracts: () => Array<{
    name?: string
    uriTemplate?: string
    mimeType?: string
    annotations?: { audience?: string[], priority?: number }
    _meta?: { readOnly?: boolean, tool?: string }
  }>
  buildKnowgrphSourceFileResourceReadResult: (args?: {
    uri?: string
    sourceFile?: Record<string, unknown>
  }) => { contents?: Array<{ uri?: string, mimeType?: string, text?: string, _meta?: Record<string, unknown> }> }
  buildKnowgrphSourceFileResourceUri: (id: string) => string
  parseKnowgrphSourceFileResourceUri: (uri: string) => string
}

type AgenticCanvasOsRuntimeModule = {
  runAgenticCanvasOsPlan: (
    args: Record<string, unknown>,
    context: { rootDir: string },
  ) => Promise<{ payload: Record<string, any>, text: string }>
}

const importLocalToolContract = async (): Promise<LocalToolContractModule> => {
  const contractUrl = pathToFileURL(path.resolve(process.cwd(), '..', 'mcp', 'local-tool-contract.js')).href
  return await import(contractUrl) as LocalToolContractModule
}

const importPromptContract = async (): Promise<PromptContractModule> => {
  const contractUrl = pathToFileURL(path.resolve(process.cwd(), 'src', 'features', 'agent-ready', 'knowgrphAgentReadyPromptContract.mjs')).href
  return await import(contractUrl) as PromptContractModule
}

const importResourceContract = async (): Promise<ResourceContractModule> => {
  const contractUrl = pathToFileURL(path.resolve(process.cwd(), 'src', 'features', 'agent-ready', 'knowgrphAgentReadyResourceContract.mjs')).href
  return await import(contractUrl) as ResourceContractModule
}

const importAgenticCanvasOsRuntime = async (): Promise<AgenticCanvasOsRuntimeModule> => {
  const runtimeUrl = pathToFileURL(path.resolve(process.cwd(), '..', 'mcp', 'agentic-canvas-os-runtime.js')).href
  return await import(runtimeUrl) as AgenticCanvasOsRuntimeModule
}

export async function testKnowgrphLocalMcpToolContractStaysSharedAndStable() {
  const contract = await importLocalToolContract()
  const tools = contract.buildKnowgrphLocalMcpToolDefinitions({
    defaultUiHost: '0.0.0.0',
    defaultUiPort: 4173,
  })
  const toolNames = tools.map(tool => tool.name)
  const expectedNames = [
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.search,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.fetch,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiLaunch,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiStop,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.pipeline,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.graphragPipeline,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.superagentRun,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.agenticCanvasOsPlan,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.browserApiRun,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList,
  ]

  if (JSON.stringify(toolNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`expected stable local MCP tool order, got ${JSON.stringify(toolNames)}`)
  }

  if (new Set(toolNames).size !== toolNames.length) {
    throw new Error(`expected unique local MCP tool names, got ${JSON.stringify(toolNames)}`)
  }

  for (const tool of tools) {
    if (tool.inputSchema?.additionalProperties !== false) {
      throw new Error(`expected additionalProperties=false for ${tool.name}`)
    }
    if (tool.securitySchemes?.[0]?.type !== 'noauth') {
      throw new Error(`expected local stdio tool ${tool.name} to expose noauth security scheme, got ${JSON.stringify(tool.securitySchemes)}`)
    }
    if (!tool.description.startsWith('Use this when')) {
      throw new Error(`expected local stdio tool ${tool.name} to use model-selectable description phrasing, got ${JSON.stringify(tool.description)}`)
    }
  }

  const launchTool = tools.find(tool => tool.name === contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiLaunch)
  if (!launchTool) {
    throw new Error('expected knowgrph.ui.launch tool definition')
  }
  const hostDescription = String(launchTool.inputSchema.properties?.host?.description || '')
  const portDescription = String(launchTool.inputSchema.properties?.port?.description || '')
  if (!hostDescription.includes('0.0.0.0')) {
    throw new Error(`expected UI launch host description to reflect injected default host, got ${JSON.stringify(hostDescription)}`)
  }
  if (!portDescription.includes('4173')) {
    throw new Error(`expected UI launch port description to reflect injected default port, got ${JSON.stringify(portDescription)}`)
  }

  const searchTool = tools.find(tool => tool.name === contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.search)
  if (!searchTool) {
    throw new Error('expected local stdio search tool definition')
  }
  if (searchTool.outputSchema?.type !== 'object' || !searchTool.outputSchema.required?.includes('ids') || !searchTool.outputSchema.required?.includes('results')) {
    throw new Error(`expected local stdio search to reuse the published search outputSchema, got ${JSON.stringify(searchTool.outputSchema)}`)
  }
  if (searchTool.securitySchemes?.[0]?.type !== 'noauth') {
    throw new Error(`expected local stdio search to reuse the published noauth security scheme, got ${JSON.stringify(searchTool.securitySchemes)}`)
  }

  const fetchTool = tools.find(tool => tool.name === contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.fetch)
  if (!fetchTool) {
    throw new Error('expected local stdio fetch tool definition')
  }
  if (fetchTool.outputSchema?.type !== 'object' || !fetchTool.outputSchema.required?.includes('content') || !fetchTool.outputSchema.required?.includes('text') || !fetchTool.outputSchema.required?.includes('url')) {
    throw new Error(`expected local stdio fetch to reuse the published fetch outputSchema, got ${JSON.stringify(fetchTool.outputSchema)}`)
  }
  if (fetchTool.securitySchemes?.[0]?.type !== 'noauth') {
    throw new Error(`expected local stdio fetch to reuse the published noauth security scheme, got ${JSON.stringify(fetchTool.securitySchemes)}`)
  }
  assertAnnotations(searchTool, { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true })
  assertAnnotations(fetchTool, { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true })

  const processTools = [
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiLaunch,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.pipeline,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.graphragPipeline,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.superagentRun,
  ]
  for (const processToolName of processTools) {
    const processTool = tools.find(tool => tool.name === processToolName)
    if (!processTool) throw new Error(`expected local process tool ${processToolName}`)
    assertAnnotations(processTool, { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false })
  }
  const stopTool = tools.find(tool => tool.name === contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiStop)
  if (!stopTool) throw new Error('expected local stop tool')
  assertAnnotations(stopTool, { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true })
  const browserApiTool = tools.find(tool => tool.name === contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.browserApiRun)
  if (!browserApiTool) throw new Error('expected browser API runtime tool')
  assertAnnotations(browserApiTool, { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false })

  const agenticCanvasOsTool = tools.find(tool => tool.name === contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.agenticCanvasOsPlan)
  if (!agenticCanvasOsTool) throw new Error('expected Agentic Canvas OS planner tool')
  assertAnnotations(agenticCanvasOsTool, { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true })
  if (!String(agenticCanvasOsTool.description || '').includes('dry-run Agentic Canvas OS dashboard')) {
    throw new Error(`expected Agentic Canvas OS tool to describe dry-run dashboard scope, got ${JSON.stringify(agenticCanvasOsTool.description)}`)
  }
  if (!agenticCanvasOsTool.inputSchema.properties?.goal || !agenticCanvasOsTool.inputSchema.properties?.writeArtifacts) {
    throw new Error(`expected Agentic Canvas OS tool schema to expose goal and writeArtifacts, got ${JSON.stringify(agenticCanvasOsTool.inputSchema.properties)}`)
  }
  if (agenticCanvasOsTool.outputSchema?.type !== 'object' || !agenticCanvasOsTool.outputSchema.required?.includes('dashboard')) {
    throw new Error(`expected Agentic Canvas OS tool to expose structured dashboard output, got ${JSON.stringify(agenticCanvasOsTool.outputSchema)}`)
  }

  const superagentTool = tools.find(tool => tool.name === contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.superagentRun)
  if (!superagentTool) {
    throw new Error('expected knowgrph.superagent.run tool definition')
  }
  if (!String(superagentTool.description || '').includes('research, code, and create tasks')) {
    throw new Error(`expected SuperAgent tool to describe research/code/create scope, got ${JSON.stringify(superagentTool.description)}`)
  }
  if (!String(superagentTool.description || '').includes('quick_triage')
    || !String(superagentTool.description || '').includes('parallel_build')) {
    throw new Error(`expected SuperAgent tool to describe task levels, got ${JSON.stringify(superagentTool.description)}`)
  }
  if (!superagentTool.inputSchema.properties?.providerMode) {
    throw new Error('expected SuperAgent tool schema to expose providerMode')
  }
  if (!String(superagentTool.inputSchema.properties.providerMode.description || '').includes('PixVerse MCP with mock fallback')) {
    throw new Error(`expected SuperAgent providerMode to document PixVerse fallback, got ${JSON.stringify(superagentTool.inputSchema.properties.providerMode)}`)
  }

  const vdeoxplnTool = tools.find(tool => tool.name === contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList)
  if (!vdeoxplnTool) {
    throw new Error('expected knowgrph.vdeoxpln.list tool definition')
  }
  if (!String(vdeoxplnTool.description || '').includes('canonical Knowgrph vdeoxpln registry')) {
    throw new Error(`expected vdeoxpln tool to describe the canonical registry, got ${JSON.stringify(vdeoxplnTool.description)}`)
  }
  if (vdeoxplnTool._meta?.ui?.resourceUri !== 'ui://knowgrph/agent-ready') {
    throw new Error(`expected vdeoxpln tool to link the shared MCP Apps resource, got ${JSON.stringify(vdeoxplnTool._meta)}`)
  }
  if (vdeoxplnTool.securitySchemes?.[0]?.type !== 'noauth' || vdeoxplnTool._meta?.securitySchemes?.[0]?.type !== 'noauth') {
    throw new Error(`expected vdeoxpln tool to expose mirrored noauth security schemes, got ${JSON.stringify({ securitySchemes: vdeoxplnTool.securitySchemes, meta: vdeoxplnTool._meta })}`)
  }
  if (vdeoxplnTool._meta?.['openai/widgetAccessible'] !== true) {
    throw new Error(`expected vdeoxpln tool to expose OpenAI widget accessibility metadata, got ${JSON.stringify(vdeoxplnTool._meta)}`)
  }
  if (vdeoxplnTool.outputSchema?.type !== 'object' || !vdeoxplnTool.outputSchema.required?.includes('vdeoxplnEntries')) {
    throw new Error(`expected vdeoxpln app tool to expose a structured outputSchema, got ${JSON.stringify(vdeoxplnTool.outputSchema)}`)
  }
  assertAnnotations(vdeoxplnTool, { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true })
  const vdeoxplnProperties = vdeoxplnTool.inputSchema.properties || {}
  for (const required of ['intentText', 'requestedOutputs', 'stateSignals', 'chatStorageTarget']) {
    if (!vdeoxplnProperties[required]) {
      throw new Error(`expected vdeoxpln tool schema to expose neutral routing input ${required}`)
    }
  }
  if (!String(vdeoxplnProperties.intentText.description || '').includes('Route names and file paths are ignored')) {
    throw new Error('expected vdeoxpln intentText schema to forbid route/file based routing')
  }
}

export async function testKnowgrphMcpPromptContractStaysSharedAndStable() {
  const contract = await importPromptContract()
  const prompts = contract.buildKnowgrphAgentReadyPromptContracts()
  const promptNames = prompts.map(prompt => prompt.name)
  const expectedNames = [
    contract.KNOWGRPH_AGENT_READY_PROMPT_NAMES.researchSourceFiles,
    contract.KNOWGRPH_AGENT_READY_PROMPT_NAMES.inspectAgentSurface,
  ]

  if (JSON.stringify(promptNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`expected stable MCP prompt order, got ${JSON.stringify(promptNames)}`)
  }

  const researchPrompt = prompts.find(prompt => prompt.name === contract.KNOWGRPH_AGENT_READY_PROMPT_NAMES.researchSourceFiles)
  if (!researchPrompt?.arguments?.some(argument => argument.name === 'query' && argument.required === true)) {
    throw new Error(`expected Source Files research prompt to require query, got ${JSON.stringify(researchPrompt)}`)
  }

  const rendered = contract.getKnowgrphAgentReadyPrompt(contract.KNOWGRPH_AGENT_READY_PROMPT_NAMES.researchSourceFiles, {
    query: 'renderer architecture',
    limit: '3',
  })
  const renderedText = String(rendered.messages?.[0]?.content?.text || '')
  if (rendered.messages?.[0]?.role !== 'user' || !renderedText.includes('Call search') || !renderedText.includes('call fetch') || !renderedText.includes('renderer architecture')) {
    throw new Error(`expected Source Files research prompt to render tool guidance, got ${JSON.stringify(rendered)}`)
  }

  const inspectPrompt = contract.getKnowgrphAgentReadyPrompt(contract.KNOWGRPH_AGENT_READY_PROMPT_NAMES.inspectAgentSurface, {
    focus: 'prompts',
  })
  const inspectText = String(inspectPrompt.messages?.[0]?.content?.text || '')
  if (!inspectText.includes('inspect_agent_surface') || !inspectText.includes('prompt')) {
    throw new Error(`expected agent-surface inspection prompt to render prompt readiness guidance, got ${JSON.stringify(inspectPrompt)}`)
  }
}

export async function testKnowgrphMcpResourceTemplateContractStaysSharedAndStable() {
  const contract = await importResourceContract()
  const templates = contract.buildKnowgrphAgentReadyResourceTemplateContracts()
  const sourceFileTemplate = templates[0]

  if (templates.length !== 1 || sourceFileTemplate?.uriTemplate !== contract.KNOWGRPH_SOURCE_FILE_RESOURCE_URI_TEMPLATE) {
    throw new Error(`expected one stable Source Files resource template, got ${JSON.stringify(templates)}`)
  }
  if (sourceFileTemplate.mimeType !== contract.KNOWGRPH_SOURCE_FILE_RESOURCE_MIME_TYPE || sourceFileTemplate._meta?.readOnly !== true || sourceFileTemplate._meta?.tool !== 'fetch') {
    throw new Error(`expected Source Files resource template to stay read-only text/markdown, got ${JSON.stringify(sourceFileTemplate)}`)
  }
  if (!sourceFileTemplate.annotations?.audience?.includes('assistant') || sourceFileTemplate.annotations?.priority !== 0.8) {
    throw new Error(`expected Source Files resource template annotations for host context selection, got ${JSON.stringify(sourceFileTemplate.annotations)}`)
  }

  const sourceFileId = 'kgdoc::docs%2Fexample.md'
  const resourceUri = contract.buildKnowgrphSourceFileResourceUri(sourceFileId)
  if (contract.parseKnowgrphSourceFileResourceUri(resourceUri) !== sourceFileId) {
    throw new Error(`expected Source Files resource URI to round-trip kgdoc id, got ${resourceUri}`)
  }
  const readResult = contract.buildKnowgrphSourceFileResourceReadResult({
    uri: resourceUri,
    sourceFile: {
      id: sourceFileId,
      title: 'Example',
      url: 'https://airvio.co/api/storage/doc-default/docs/example.md',
      content: '# Example',
      metadata: { canonicalPath: 'docs/example.md' },
    },
  })
  const content = readResult.contents?.[0]
  if (content?.uri !== resourceUri || content?.mimeType !== contract.KNOWGRPH_SOURCE_FILE_RESOURCE_MIME_TYPE || content?.text !== '# Example' || content?._meta?.id !== sourceFileId) {
    throw new Error(`expected Source Files resource read result to expose markdown content and metadata, got ${JSON.stringify(readResult)}`)
  }
}

export async function testKnowgrphAgenticCanvasOsRuntimeCoversDryRunPrdTad() {
  const runtime = await importAgenticCanvasOsRuntime()
  const result = await runtime.runAgenticCanvasOsPlan({
    goal: 'Build a production-ready agent product with market evidence, browser evidence, learning, and demo pack',
    runId: 'agentic-os-contract-test',
    writeArtifacts: false,
    marketQuestion: 'Is there demand for an agentic productivity product?',
    sourceCards: [
      { url: 'https://example.com/source-a', platform: 'reddit', evidenceLevel: 'A', observedFields: ['thread', 'comments'], claimIds: ['claim-a'] },
      { url: 'https://example.com/source-b', platform: 'producthunt', evidenceLevel: 'B', observedFields: ['launch'], claimIds: ['claim-b'] },
    ],
    allowedDomains: ['example.com'],
    confirmBrowserScope: true,
    finalizedTraceIds: ['trace-1'],
    userNotes: ['Prefer dry-run-first agent workflows.'],
    failOnceTool: 'exa.search',
  }, { rootDir: path.resolve(process.cwd(), '..') })
  const payload = result.payload

  for (const required of ['planner', 'toolCalls', 'approvalGates', 'budgetMeters', 'evidencePack', 'marketRadar', 'browserEvidence', 'artifactPipeline', 'learningLoop', 'adapterPlans', 'failureHandling', 'demoPack', 'goalCoverage']) {
    if (!payload[required]) throw new Error(`expected Agentic Canvas OS payload to include ${required}`)
  }
  if (payload.dashboard?.written !== false) throw new Error(`expected dry-run runtime not to write artifacts by default, got ${JSON.stringify(payload.dashboard)}`)
  if (payload.demoPack.sections.length !== 7) throw new Error(`expected seven demo-pack sections, got ${JSON.stringify(payload.demoPack.sections)}`)
  if (!payload.goalCoverage.every((entry: { ok?: boolean }) => entry.ok === true)) {
    throw new Error(`expected all dry-run /goal coverage checks to pass, got ${JSON.stringify(payload.goalCoverage)}`)
  }
  if (payload.browserEvidence.redactionPolicy.persistedCredentialValues !== 0) {
    throw new Error(`expected browser evidence to persist zero credential values, got ${JSON.stringify(payload.browserEvidence)}`)
  }
  if (!payload.learningLoop.candidateSkills.every((skill: { approvalState?: string }) => skill.approvalState === 'required')) {
    throw new Error(`expected candidate skills to require approval, got ${JSON.stringify(payload.learningLoop.candidateSkills)}`)
  }
  if (!payload.flow.nodes.some((node: { type?: string }) => node.type === 'AgenticOSDemoPack')) {
    throw new Error(`expected dashboard graph to include AgenticOSDemoPack, got ${JSON.stringify(payload.flow.nodes)}`)
  }
}
